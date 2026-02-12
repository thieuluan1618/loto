package ocr

import (
	"context"
	"fmt"
	"sort"
	"strconv"

	vision "cloud.google.com/go/vision/v2/apiv1"
	"cloud.google.com/go/vision/v2/apiv1/visionpb"
	"go.uber.org/zap"
	"google.golang.org/api/option"

	"loto/internal/model"
)

type GoogleVisionScanner struct {
	client *vision.ImageAnnotatorClient
	logger *zap.Logger
}

func NewGoogleVisionScanner(credentialsFile string, logger *zap.Logger) (*GoogleVisionScanner, error) {
	ctx := context.Background()

	var client *vision.ImageAnnotatorClient
	var err error

	if credentialsFile != "" {
		client, err = vision.NewImageAnnotatorClient(ctx, option.WithCredentialsFile(credentialsFile))
	} else {
		client, err = vision.NewImageAnnotatorClient(ctx)
	}
	if err != nil {
		return nil, fmt.Errorf("creating vision client: %w", err)
	}

	return &GoogleVisionScanner{
		client: client,
		logger: logger,
	}, nil
}

func (s *GoogleVisionScanner) Close() error {
	return s.client.Close()
}

func (s *GoogleVisionScanner) Scan(ctx context.Context, imgBytes []byte, mimeType string) (*model.OCRScanResult, error) {
	req := &visionpb.BatchAnnotateImagesRequest{
		Requests: []*visionpb.AnnotateImageRequest{
			{
				Image: &visionpb.Image{Content: imgBytes},
				Features: []*visionpb.Feature{
					{Type: visionpb.Feature_DOCUMENT_TEXT_DETECTION},
				},
			},
		},
	}

	resp, err := s.client.BatchAnnotateImages(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("detecting document text: %w", err)
	}

	result := &model.OCRScanResult{
		Provider: "google_vision",
	}

	if len(resp.Responses) == 0 {
		return result, nil
	}

	annResp := resp.Responses[0]
	if annResp.Error != nil {
		return nil, fmt.Errorf("vision api error: %s", annResp.Error.Message)
	}

	annotation := annResp.FullTextAnnotation
	if annotation == nil || len(annotation.Pages) == 0 {
		return result, nil
	}

	result.FullText = annotation.Text

	var totalConfidence float64
	var wordCount int

	for _, page := range annotation.Pages {
		for _, block := range page.Blocks {
			for _, paragraph := range block.Paragraphs {
				for _, word := range paragraph.Words {
					var wordText string
					for _, symbol := range word.Symbols {
						wordText += symbol.Text
					}

					token := model.OCRToken{
						Text:       wordText,
						Confidence: float64(word.Confidence),
					}

					if word.BoundingBox != nil && len(word.BoundingBox.Vertices) >= 4 {
						v := word.BoundingBox.Vertices
						token.X = int(v[0].X)
						token.Y = int(v[0].Y)
						token.Width = int(v[1].X - v[0].X)
						token.Height = int(v[2].Y - v[0].Y)
					}

					result.Tokens = append(result.Tokens, token)

					totalConfidence += float64(word.Confidence)
					wordCount++

					result.Numbers = append(result.Numbers, splitLOTONumbers(wordText)...)
				}
			}
		}
	}

	if wordCount > 0 {
		result.Confidence = totalConfidence / float64(wordCount)
	}

	sort.Ints(result.Numbers)

	return result, nil
}

func splitLOTONumbers(s string) []int {
	n, err := strconv.Atoi(s)
	if err != nil {
		return nil
	}

	if n >= 1 && n <= 90 {
		return []int{n}
	}

	if len(s) == 3 {
		a, _ := strconv.Atoi(s[:1])
		b, _ := strconv.Atoi(s[1:])
		if a >= 1 && a <= 9 && b >= 10 && b <= 90 {
			return []int{a, b}
		}
		a, _ = strconv.Atoi(s[:2])
		b, _ = strconv.Atoi(s[2:])
		if a >= 1 && a <= 90 && b >= 1 && b <= 9 {
			return []int{a, b}
		}
	}

	if len(s) == 4 {
		a, _ := strconv.Atoi(s[:2])
		b, _ := strconv.Atoi(s[2:])
		if a >= 1 && a <= 90 && b >= 1 && b <= 90 {
			return []int{a, b}
		}
		a, _ = strconv.Atoi(s[:1])
		b, _ = strconv.Atoi(s[1:])
		if a >= 1 && a <= 9 && b >= 1 && b <= 90 {
			return []int{a, b}
		}
	}

	return nil
}
