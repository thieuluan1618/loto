package validator

import (
	"fmt"

	"loto/internal/model"
)

func ValidateScanResponse(resp *model.GPTScanResponse) ([]int, string, error) {
	if resp.Confidence < 0.6 {
		return nil, "rejected", fmt.Errorf("confidence too low: %.2f", resp.Confidence)
	}

	seen := make(map[int]struct{})
	var valid []int

	for _, n := range resp.AllNumbers {
		if resp.LotteryType == "LOTO" {
			if n < 1 || n > 90 {
				continue
			}
		}
		if _, exists := seen[n]; exists {
			continue
		}
		seen[n] = struct{}{}
		valid = append(valid, n)
	}

	if len(valid) == 0 {
		return nil, "rejected", fmt.Errorf("no valid numbers found")
	}

	status := "confirmed"
	if resp.Confidence < 0.85 {
		status = "needs_confirmation"
	}

	return valid, status, nil
}

func ValidateFileType(contentType string) error {
	switch contentType {
	case "image/jpeg", "image/png":
		return nil
	default:
		return fmt.Errorf("unsupported file type: %s (only jpg/png allowed)", contentType)
	}
}
