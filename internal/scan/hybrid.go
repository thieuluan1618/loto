package scan

import (
	"context"
	"fmt"
	"sort"

	"go.uber.org/zap"

	"loto/internal/ai"
	"loto/internal/model"
	"loto/internal/ocr"
)

type HybridScanner struct {
	ocr    ocr.Scanner
	ai     ai.Scanner
	logger *zap.Logger
}

func NewHybridScanner(ocrScanner ocr.Scanner, aiClient ai.Scanner, logger *zap.Logger) *HybridScanner {
	return &HybridScanner{
		ocr:    ocrScanner,
		ai:     aiClient,
		logger: logger,
	}
}

func (s *HybridScanner) Scan(ctx context.Context, imgBytes []byte, base64Image string, mimeType string) (*model.GPTScanResponse, error) {
	ocrResult, ocrErr := s.ocr.Scan(ctx, imgBytes, mimeType)

	if ocrErr != nil {
		s.logger.Warn("OCR failed, falling back to GPT-only", zap.Error(ocrErr))
		return s.ai.ScanTicket(ctx, base64Image, mimeType)
	}

	s.logger.Info("OCR completed",
		zap.Int("numbers_found", len(ocrResult.Numbers)),
		zap.Ints("numbers", ocrResult.Numbers),
		zap.Float64("confidence", ocrResult.Confidence),
		zap.String("full_text", ocrResult.FullText),
		zap.String("provider", ocrResult.Provider),
	)

	gptResult, gptErr := s.ai.ScanTicketWithOCR(ctx, base64Image, mimeType, ocrResult)
	if gptErr != nil {
		s.logger.Warn("GPT failed, using OCR-only result", zap.Error(gptErr))
		return buildOCROnlyResponse(ocrResult), nil
	}

	s.logger.Info("GPT completed",
		zap.String("lottery_type", gptResult.LotteryType),
		zap.Int("numbers_found", len(gptResult.AllNumbers)),
		zap.Ints("numbers", gptResult.AllNumbers),
		zap.Float64("confidence", gptResult.Confidence),
		zap.String("ticket_id", gptResult.TicketID),
		zap.String("notes", gptResult.Notes),
	)

	final := reconcile(ocrResult, gptResult, s.logger)

	s.logger.Info("final result",
		zap.String("lottery_type", final.LotteryType),
		zap.Int("numbers_count", len(final.AllNumbers)),
		zap.Ints("numbers", final.AllNumbers),
		zap.Float64("confidence", final.Confidence),
		zap.String("notes", final.Notes),
	)

	return final, nil
}

func buildOCROnlyResponse(ocr *model.OCRScanResult) *model.GPTScanResponse {
	var filtered []int
	seen := make(map[int]struct{})
	for _, n := range ocr.Numbers {
		if n >= 1 && n <= 90 {
			if _, exists := seen[n]; !exists {
				seen[n] = struct{}{}
				filtered = append(filtered, n)
			}
		}
	}
	sort.Ints(filtered)
	return &model.GPTScanResponse{
		LotteryType: "LOTO",
		AllNumbers:  filtered,
		Confidence:  ocr.Confidence * 0.9,
		Notes:       "OCR-only scan (GPT unavailable)",
	}
}

func reconcile(ocrResult *model.OCRScanResult, gptResult *model.GPTScanResponse, logger *zap.Logger) *model.GPTScanResponse {
	ocrSet := make(map[int]struct{})
	for _, n := range ocrResult.Numbers {
		if n >= 1 && n <= 90 {
			ocrSet[n] = struct{}{}
		}
	}

	gptSet := make(map[int]struct{})
	for _, n := range gptResult.AllNumbers {
		gptSet[n] = struct{}{}
	}

	agreed := 0
	for n := range gptSet {
		if _, ok := ocrSet[n]; ok {
			agreed++
		}
	}

	gptCoverage := 0.0
	if len(gptSet) > 0 {
		gptCoverage = float64(agreed) / float64(len(gptSet))
	}

	logger.Info("reconciliation",
		zap.Int("ocr_count", len(ocrSet)),
		zap.Int("gpt_count", len(gptSet)),
		zap.Int("agreed", agreed),
		zap.Float64("gpt_coverage", gptCoverage),
	)

	if gptCoverage >= 0.85 {
		gptResult.Confidence = (gptResult.Confidence + ocrResult.Confidence) / 2
		if gptCoverage >= 0.95 {
			gptResult.Confidence = min(gptResult.Confidence*1.1, 1.0)
		}
		gptResult.Notes = fmt.Sprintf("hybrid scan: %.0f%% GPT numbers confirmed by OCR", gptCoverage*100)
		return gptResult
	}

	if gptCoverage >= 0.7 {
		gptResult.Confidence = (gptResult.Confidence*0.7 + ocrResult.Confidence*0.3)
		gptResult.Notes = fmt.Sprintf("hybrid scan: %.0f%% GPT numbers confirmed by OCR", gptCoverage*100)
		return gptResult
	}

	finalSet := make(map[int]struct{})

	for n := range gptSet {
		if _, ok := ocrSet[n]; ok {
			finalSet[n] = struct{}{}
		}
	}

	if gptResult.Confidence >= 0.7 {
		for n := range gptSet {
			finalSet[n] = struct{}{}
		}
	}

	var finalNumbers []int
	for n := range finalSet {
		finalNumbers = append(finalNumbers, n)
	}
	sort.Ints(finalNumbers)

	gptResult.AllNumbers = finalNumbers
	gptResult.Confidence = (gptResult.Confidence + ocrResult.Confidence) / 2 * 0.8
	if gptResult.Confidence < 0.4 {
		gptResult.Confidence = 0.4
	}
	gptResult.Notes = fmt.Sprintf("hybrid scan: low coverage (%.0f%%), merged results", gptCoverage*100)

	return gptResult
}
