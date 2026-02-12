package ai

import (
	"context"
	"fmt"
	"strings"

	"go.uber.org/zap"

	"loto/internal/model"
)

type Scanner interface {
	ScanTicket(ctx context.Context, base64Image string, mimeType string) (*model.GPTScanResponse, error)
	ScanTicketWithOCR(ctx context.Context, base64Image string, mimeType string, ocrResult *model.OCRScanResult) (*model.GPTScanResponse, error)
}

func logScanResult(logger *zap.Logger, provider string, result *model.GPTScanResponse) {
	var blocksSummary []string
	for i, b := range result.Blocks {
		blocksSummary = append(blocksSummary,
			fmt.Sprintf("  Block %d: row1=%v | row2=%v | row3=%v", i+1, b.Row1, b.Row2, b.Row3),
		)
	}

	logger.Info(fmt.Sprintf("%s scan result", provider),
		zap.String("lottery_type", result.LotteryType),
		zap.String("ticket_id", result.TicketID),
		zap.Float64("confidence", result.Confidence),
		zap.Int("total_numbers", len(result.AllNumbers)),
		zap.Ints("all_numbers", result.AllNumbers),
		zap.String("notes", result.Notes),
	)

	if len(blocksSummary) > 0 {
		logger.Info(fmt.Sprintf("%s blocks detail\n%s", provider, strings.Join(blocksSummary, "\n")))
	}
}
