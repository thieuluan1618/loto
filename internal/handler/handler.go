package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"loto/internal/service"
)

type Handler struct {
	svc    *service.Service
	logger *zap.Logger
}

func New(svc *service.Service, logger *zap.Logger) *Handler {
	return &Handler{svc: svc, logger: logger}
}

func (h *Handler) ScanTicket(c *gin.Context) {
	file, header, err := c.Request.FormFile("image")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "image file is required"})
		return
	}
	defer file.Close()

	var userID *string
	if uid := c.PostForm("user_id"); uid != "" {
		userID = &uid
	}

	resp, err := h.svc.ScanTicket(c.Request.Context(), file, header, userID)
	if err != nil {
		h.logger.Error("scan failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *Handler) GetScanHistory(c *gin.Context) {
	userID := c.Query("user_id")
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_id is required"})
		return
	}

	history, err := h.svc.GetScanHistory(c.Request.Context(), userID)
	if err != nil {
		h.logger.Error("failed to get scan history", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get scan history"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"scans": history})
}

func (h *Handler) CheckResult(c *gin.Context) {
	scanID := c.Query("scan_id")
	if scanID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "scan_id is required"})
		return
	}

	result, err := h.svc.CheckResult(c.Request.Context(), scanID)
	if err != nil {
		h.logger.Error("failed to check result", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check result"})
		return
	}

	c.JSON(http.StatusOK, result)
}

func (h *Handler) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
