package ai

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"go.uber.org/zap"
	"google.golang.org/genai"

	"loto/internal/config"
	"loto/internal/model"
)

type GeminiClient struct {
	client   *genai.Client
	model    string
	thinking string
	timeout  time.Duration
	logger   *zap.Logger
}

func NewGeminiClient(ctx context.Context, cfg config.GoogleAIConfig, logger *zap.Logger) (*GeminiClient, error) {
	client, err := genai.NewClient(ctx, &genai.ClientConfig{
		APIKey:  cfg.APIKey,
		Backend: genai.BackendGeminiAPI,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create Gemini client: %w", err)
	}

	modelName := cfg.Model
	if modelName == "" {
		modelName = "gemini-2.5-flash"
	}

	return &GeminiClient{
		client:   client,
		model:    modelName,
		thinking: cfg.Thinking,
		timeout:  cfg.Timeout,
		logger:   logger,
	}, nil
}

func (c *GeminiClient) ScanTicket(ctx context.Context, base64Image string, mimeType string) (*model.GPTScanResponse, error) {
	return c.scan(ctx, base64Image, mimeType, scanPrompt)
}

func (c *GeminiClient) ScanTicketWithOCR(ctx context.Context, base64Image string, mimeType string, ocrResult *model.OCRScanResult) (*model.GPTScanResponse, error) {
	prompt := buildOCRAugmentedPrompt(ocrResult)
	return c.scan(ctx, base64Image, mimeType, prompt)
}

func (c *GeminiClient) buildConfig() *genai.GenerateContentConfig {
	if c.thinking == "" {
		return nil
	}

	cfg := &genai.GenerateContentConfig{
		ThinkingConfig: &genai.ThinkingConfig{},
	}

	switch strings.ToLower(c.thinking) {
	case "off", "none", "0":
		budget := int32(0)
		cfg.ThinkingConfig.ThinkingBudget = &budget
	case "minimal":
		cfg.ThinkingConfig.ThinkingLevel = genai.ThinkingLevelMinimal
	case "low":
		cfg.ThinkingConfig.ThinkingLevel = genai.ThinkingLevelLow
	case "medium":
		cfg.ThinkingConfig.ThinkingLevel = genai.ThinkingLevelMedium
	case "high":
		cfg.ThinkingConfig.ThinkingLevel = genai.ThinkingLevelHigh
	}

	return cfg
}

func (c *GeminiClient) scan(ctx context.Context, base64Image string, mimeType string, prompt string) (*model.GPTScanResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()

	imgBytes, err := base64.StdEncoding.DecodeString(base64Image)
	if err != nil {
		return nil, fmt.Errorf("failed to decode base64 image: %w", err)
	}

	parts := []*genai.Part{
		{Text: prompt},
		{InlineData: &genai.Blob{Data: imgBytes, MIMEType: mimeType}},
	}

	contentConfig := c.buildConfig()

	var lastErr error
	for attempt := 0; attempt < 2; attempt++ {
		if attempt > 0 {
			c.logger.Warn("retrying Gemini request", zap.Int("attempt", attempt))
			time.Sleep(1 * time.Second)
		}

		resp, err := c.client.Models.GenerateContent(ctx, c.model, []*genai.Content{{Parts: parts}}, contentConfig)
		if err != nil {
			lastErr = fmt.Errorf("gemini request failed: %w", err)
			continue
		}

		rawContent := resp.Text()
		content := cleanJSON(rawContent)
		if content == "" {
			lastErr = fmt.Errorf("Gemini returned empty content after cleaning. Raw response: '%s'", rawContent)
			continue
		}

		var result model.GPTScanResponse
		if err := json.Unmarshal([]byte(content), &result); err != nil {
			c.logger.Error("failed to parse Gemini response", zap.String("raw_content", rawContent), zap.String("cleaned_content", content), zap.Error(err))
			return nil, fmt.Errorf("invalid JSON from Gemini: %w", err)
		}

		logScanResult(c.logger, "Gemini", &result)
		return &result, nil
	}

	return nil, lastErr
}
