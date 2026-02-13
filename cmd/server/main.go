package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"go.uber.org/zap"

	"loto/internal/ai"
	"loto/internal/config"
	"loto/internal/handler"
	"loto/internal/ocr"
	"loto/internal/repository"
	"loto/internal/scan"
	"loto/internal/service"
)

func main() {
	logCfg := zap.NewProductionConfig()
	logCfg.OutputPaths = []string{"stdout"}
	logCfg.ErrorOutputPaths = []string{"stderr"}
	logger, err := logCfg.Build()
	if err != nil {
		panic(err)
	}
	defer logger.Sync()

	_ = godotenv.Load()

	cfg, err := config.Load()
	if err != nil {
		logger.Fatal("failed to load config", zap.Error(err))
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	var aiClient ai.Scanner
	switch cfg.AIProvider {
	case "google", "gemini":
		if cfg.GoogleAI.APIKey == "" {
			logger.Fatal("GOOGLE_API_KEY is required when AI_PROVIDER=google")
		}
		geminiClient, err := ai.NewGeminiClient(ctx, cfg.GoogleAI, logger)
		if err != nil {
			logger.Fatal("failed to create Gemini client", zap.Error(err))
		}
		aiClient = geminiClient
		logger.Info("using Google Gemini AI provider", zap.String("model", cfg.GoogleAI.Model))
	default:
		if cfg.OpenAI.APIKey == "" {
			logger.Fatal("OPENAI_API_KEY is required when AI_PROVIDER=openai")
		}
		aiClient = ai.NewClient(cfg.OpenAI, logger)
		logger.Info("using OpenAI provider", zap.String("model", cfg.OpenAI.Model))
	}

	var repo *repository.Repository
	pool, err := pgxpool.New(ctx, cfg.Database.DSN())
	if err != nil {
		logger.Warn("database not available, running without persistence", zap.Error(err))
	} else if err := pool.Ping(ctx); err != nil {
		logger.Warn("database not reachable, running without persistence", zap.Error(err))
		pool.Close()
	} else {
		logger.Info("connected to database")
		repo = repository.New(pool)
		defer pool.Close()
	}

	var hybridScanner *scan.HybridScanner
	if cfg.Vision.Enabled {
		ocrScanner, err := ocr.NewGoogleVisionScanner(cfg.Vision.CredentialsFile, logger)
		if err != nil {
			logger.Warn("Google Vision not available, using AI-only mode", zap.Error(err))
		} else {
			hybridScanner = scan.NewHybridScanner(ocrScanner, aiClient, logger)
			logger.Info("hybrid scanner enabled (OCR + AI)")
			defer ocrScanner.Close()
		}
	}

	svc := service.New(repo, aiClient, logger)
	if hybridScanner != nil {
		svc.SetHybridScanner(hybridScanner)
	}
	h := handler.New(svc, logger)

	router := setupRouter(h, cfg.Server.MaxUploadSizeMB)

	srv := &http.Server{
		Addr:         fmt.Sprintf(":%s", cfg.Server.Port),
		Handler:      router,
		ReadTimeout:  cfg.Server.ReadTimeout,
		WriteTimeout: cfg.Server.WriteTimeout,
	}

	go func() {
		logger.Info("starting server", zap.String("port", cfg.Server.Port))
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Fatal("server error", zap.Error(err))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("shutting down server...")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Fatal("server forced to shutdown", zap.Error(err))
	}

	logger.Info("server stopped")
}

func setupRouter(h *handler.Handler, maxUploadMB int64) *gin.Engine {
	router := gin.Default()

	router.MaxMultipartMemory = maxUploadMB << 20

	corsOrigins := []string{"http://localhost:8081", "http://localhost:19006"}
	if extra := os.Getenv("CORS_ORIGINS"); extra != "" {
		corsOrigins = append(corsOrigins, strings.Split(extra, ",")...)
	}
	router.Use(cors.New(cors.Config{
		AllowOrigins:     corsOrigins,
		AllowMethods:     []string{"GET", "POST", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type"},
		AllowCredentials: false,
	}))

	router.GET("/health", h.HealthCheck)

	api := router.Group("/api/v1")
	{
		api.POST("/scan-ticket", h.ScanTicket)
		api.GET("/scan-history", h.GetScanHistory)
		api.GET("/check-result", h.CheckResult)
	}

	return router
}
