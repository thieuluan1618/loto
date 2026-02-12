package ocr

import (
	"context"

	"loto/internal/model"
)

type Scanner interface {
	Scan(ctx context.Context, imgBytes []byte, mimeType string) (*model.OCRScanResult, error)
}
