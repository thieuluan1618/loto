package service

import (
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"

	"go.uber.org/zap"

	"loto/internal/ai"
	"loto/internal/model"
	"loto/internal/repository"
	"loto/internal/scan"
	"loto/internal/validator"
)

type Service struct {
	repo   *repository.Repository
	ai     ai.Scanner
	hybrid *scan.HybridScanner
	logger *zap.Logger
}

func (s *Service) SetHybridScanner(hs *scan.HybridScanner) {
	s.hybrid = hs
}

func New(repo *repository.Repository, aiClient ai.Scanner, logger *zap.Logger) *Service {
	return &Service{
		repo:   repo,
		ai:     aiClient,
		logger: logger,
	}
}

func (s *Service) hasDB() bool {
	return s.repo != nil
}

func (s *Service) ScanTicket(ctx context.Context, file multipart.File, header *multipart.FileHeader, userID *string) (*model.ScanResponse, error) {
	buf := make([]byte, 512)
	n, err := file.Read(buf)
	if err != nil {
		return nil, fmt.Errorf("failed to read file header: %w", err)
	}
	contentType := http.DetectContentType(buf[:n])

	if err := validator.ValidateFileType(contentType); err != nil {
		return nil, err
	}

	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return nil, fmt.Errorf("failed to seek file: %w", err)
	}

	data, err := io.ReadAll(file)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	b64 := base64.StdEncoding.EncodeToString(data)

	var gptResp *model.GPTScanResponse
	if s.hybrid != nil {
		gptResp, err = s.hybrid.Scan(ctx, data, b64, contentType)
	} else {
		gptResp, err = s.ai.ScanTicket(ctx, b64, contentType)
	}
	if err != nil {
		return nil, fmt.Errorf("AI scan failed: %w", err)
	}

	numbers, status, err := validator.ValidateScanResponse(gptResp)
	if err != nil {
		s.logger.Warn("scan validation failed",
			zap.Float64("confidence", gptResp.Confidence),
			zap.Error(err),
		)
		return &model.ScanResponse{
			LotteryType: gptResp.LotteryType,
			AllNumbers:  nil,
			Confidence:  gptResp.Confidence,
			Status:      status,
			Notes:       err.Error(),
		}, nil
	}

	scan := &model.Scan{
		UserID:           userID,
		ImageURL:         header.Filename,
		ExtractedNumbers: numbers,
		Confidence:       gptResp.Confidence,
		Status:           status,
	}

	if s.hasDB() {
		if err := s.repo.SaveScan(ctx, scan); err != nil {
			s.logger.Error("failed to save scan", zap.Error(err))
			return nil, fmt.Errorf("failed to save scan: %w", err)
		}
	}

	return &model.ScanResponse{
		ScanID:      scan.ID,
		LotteryType: gptResp.LotteryType,
		Blocks:      gptResp.Blocks,
		AllNumbers:  numbers,
		TicketID:    gptResp.TicketID,
		Confidence:  gptResp.Confidence,
		Status:      status,
		Notes:       gptResp.Notes,
	}, nil
}

func (s *Service) GetScanHistory(ctx context.Context, userID string) ([]model.ScanHistoryItem, error) {
	if !s.hasDB() {
		return nil, fmt.Errorf("database not configured")
	}
	return s.repo.GetScansByUserID(ctx, userID)
}

func (s *Service) CheckResult(ctx context.Context, scanID string) (*model.CheckResultResponse, error) {
	if !s.hasDB() {
		return nil, fmt.Errorf("database not configured")
	}

	scan, err := s.repo.GetScanByID(ctx, scanID)
	if err != nil {
		return nil, fmt.Errorf("scan not found: %w", err)
	}

	lotteryResults, err := s.repo.FindMatchingResults(ctx, scan.ExtractedNumbers)
	if err != nil {
		return nil, fmt.Errorf("failed to check results: %w", err)
	}

	winMap := make(map[string]model.LotteryResult)
	for _, lr := range lotteryResults {
		winMap[lr.WinningNumber] = lr
	}

	var matches []model.MatchResult
	for _, num := range scan.ExtractedNumbers {
		mr := model.MatchResult{Number: fmt.Sprintf("%d", num)}
		if lr, ok := winMap[mr.Number]; ok {
			mr.Matched = true
			mr.PrizeType = lr.PrizeType
			mr.WinningNumber = lr.WinningNumber
			mr.Region = lr.Region
		}
		matches = append(matches, mr)
	}

	return &model.CheckResultResponse{
		ScanID:  scanID,
		Matches: matches,
	}, nil
}
