package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/openai/openai-go"
	"github.com/openai/openai-go/option"
	"github.com/openai/openai-go/shared"
	"go.uber.org/zap"

	"loto/internal/config"
	"loto/internal/model"
)

type Client struct {
	client          *openai.Client
	model           string
	reasoningEffort string
	timeout         time.Duration
	logger          *zap.Logger
}

func NewClient(cfg config.OpenAIConfig, logger *zap.Logger) *Client {
	client := openai.NewClient(option.WithAPIKey(cfg.APIKey))

	model := cfg.Model
	if model == "" {
		model = "gpt-5.2"
	}

	return &Client{
		client:          &client,
		model:           model,
		reasoningEffort: cfg.ReasoningEffort,
		timeout:         cfg.Timeout,
		logger:          logger,
	}
}

const scanPrompt = `You are a Vietnamese lottery ticket scanner. Analyze the image and extract all numbers visible on the ticket.

The ticket may be:
- "LOTO" (Lô Tô): A bingo-style card with 3 blocks, each block has 3 rows x 9 columns. Numbers range from 1 to 90. Each row has 5 numbers and 4 blank cells.
- "VN_6_DIGIT": A traditional lottery ticket with 6-digit numbers.

Respond ONLY with valid JSON in this exact format:
{
  "lottery_type": "LOTO",
  "blocks": [
    {"row1": [13, 22, 41, 61, 86], "row2": [3, 24, 34, 52, 71], "row3": [1, 35, 56, 64, 83]},
    {"row1": [], "row2": [], "row3": []},
    {"row1": [], "row2": [], "row3": []}
  ],
  "all_numbers": [1, 3, 5, 7, 13, 14, 22, 23, 24, 25, 26, 28, 30, 34, 35, 36, 41, 42, 47, 48, 49, 50, 51, 52, 53, 56, 59, 60, 61, 64, 66, 71, 72, 75, 76, 79, 81, 83, 84, 86, 87, 89],
  "ticket_id": "",
  "confidence": 0.0,
  "notes": ""
}

Rules:
- For LOTO: each number is 1-90, extract every number from all 3 blocks
- For VN_6_DIGIT: each number is exactly 6 digits, put them in all_numbers, leave blocks empty
- all_numbers must contain every unique number on the ticket, sorted ascending
- confidence is 0.0 to 1.0 based on image clarity
- ticket_id: any visible ticket/series number
- If you cannot read the ticket, set confidence to 0.0 and all_numbers to empty array
- Do not make up numbers. Only extract what you can clearly see.`

func (c *Client) ScanTicket(ctx context.Context, base64Image string, mimeType string) (*model.GPTScanResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()

	dataURI := fmt.Sprintf("data:%s;base64,%s", mimeType, base64Image)

	var lastErr error
	for attempt := 0; attempt < 2; attempt++ {
		if attempt > 0 {
			c.logger.Warn("retrying OpenAI request", zap.Int("attempt", attempt))
			time.Sleep(1 * time.Second)
		}

		params := openai.ChatCompletionNewParams{
			Model:               openai.ChatModel(c.model),
			MaxCompletionTokens: openai.Int(16000),
			Messages: []openai.ChatCompletionMessageParamUnion{
				openai.UserMessage([]openai.ChatCompletionContentPartUnionParam{
					openai.TextContentPart(scanPrompt),
					openai.ImageContentPart(openai.ChatCompletionContentPartImageImageURLParam{
						URL: dataURI,
					}),
				}),
			},
		}
		if c.reasoningEffort != "" {
			params.ReasoningEffort = shared.ReasoningEffort(strings.ToLower(c.reasoningEffort))
		}
		resp, err := c.client.Chat.Completions.New(ctx, params)
		if err != nil {
			lastErr = fmt.Errorf("openai request failed: %w", err)
			continue
		}

		if len(resp.Choices) == 0 {
			lastErr = fmt.Errorf("openai returned no choices")
			continue
		}

		choice := resp.Choices[0]
		if choice.Message.Refusal != "" {
			lastErr = fmt.Errorf("GPT refused the request: %s", choice.Message.Refusal)
			c.logger.Warn("GPT refusal", zap.String("refusal", choice.Message.Refusal))
			continue
		}

		rawContent := choice.Message.Content
		content := cleanJSON(rawContent)
		if content == "" {
			lastErr = fmt.Errorf("GPT returned empty content after cleaning. Raw response: '%s'", rawContent)
			continue
		}

		var result model.GPTScanResponse
		if err := json.Unmarshal([]byte(content), &result); err != nil {
			c.logger.Error("failed to parse GPT response", zap.String("raw_content", rawContent), zap.String("cleaned_content", content), zap.Error(err))
			return nil, fmt.Errorf("invalid JSON from GPT: %w", err)
		}

		logScanResult(c.logger, "GPT", &result)
		return &result, nil
	}

	return nil, lastErr
}

func buildOCRAugmentedPrompt(ocrResult *model.OCRScanResult) string {
	numbers := make([]string, len(ocrResult.Numbers))
	for i, n := range ocrResult.Numbers {
		numbers[i] = fmt.Sprintf("%d", n)
	}
	numbersStr := strings.Join(numbers, ", ")

	fullText := ocrResult.FullText
	if len(fullText) > 500 {
		fullText = fullText[:500]
	}

	return fmt.Sprintf(`You are a Vietnamese lottery ticket scanner. You have OCR data to help you. Analyze BOTH the image and the OCR data below.

## OCR Data (from Google Cloud Vision)
Detected numbers: [%s]
OCR confidence: %.2f
Raw text: "%s"

## Your Task
Use the OCR numbers as your primary reference. Only override OCR numbers when the image clearly shows different digits.

The ticket may be:
- "LOTO" (Lô Tô): A bingo-style card with 3 blocks, each block has 3 rows x 9 columns. Numbers range from 1 to 90. Each row has 5 numbers and 4 blank cells.
- "VN_6_DIGIT": A traditional lottery ticket with 6-digit numbers.

Respond ONLY with valid JSON in this exact format:
{
  "lottery_type": "LOTO",
  "blocks": [
    {"row1": [13, 22, 41, 61, 86], "row2": [3, 24, 34, 52, 71], "row3": [1, 35, 56, 64, 83]},
    {"row1": [], "row2": [], "row3": []},
    {"row1": [], "row2": [], "row3": []}
  ],
  "all_numbers": [1, 3, 5, 7, 13, 14, 22, 23, 24, 25, 26, 28, 30, 34, 35, 36, 41, 42, 47, 48, 49, 50, 51, 52, 53, 56, 59, 60, 61, 64, 66, 71, 72, 75, 76, 79, 81, 83, 84, 86, 87, 89],
  "ticket_id": "",
  "confidence": 0.0,
  "notes": ""
}

Rules:
- For LOTO: each number is 1-90, extract every number from all 3 blocks
- For VN_6_DIGIT: each number is exactly 6 digits, put them in all_numbers, leave blocks empty
- all_numbers must contain every unique number on the ticket, sorted ascending
- confidence is 0.0 to 1.0 based on image clarity
- ticket_id: any visible ticket/series number
- If you cannot read the ticket, set confidence to 0.0 and all_numbers to empty array
- Do not make up numbers. Only extract what you can clearly see.

Additional rules for hybrid mode:
- Prefer OCR-detected numbers unless the image clearly contradicts them
- If OCR missed numbers that are clearly visible in the image, add them
- If OCR detected wrong numbers (e.g., OCR says 18 but image shows 13), correct them
- Set higher confidence when OCR and your reading agree
- In notes, mention any corrections you made vs the OCR data`, numbersStr, ocrResult.Confidence, fullText)
}

func (c *Client) ScanTicketWithOCR(ctx context.Context, base64Image string, mimeType string, ocrResult *model.OCRScanResult) (*model.GPTScanResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()

	dataURI := fmt.Sprintf("data:%s;base64,%s", mimeType, base64Image)
	prompt := buildOCRAugmentedPrompt(ocrResult)

	var lastErr error
	for attempt := 0; attempt < 2; attempt++ {
		if attempt > 0 {
			c.logger.Warn("retrying OpenAI request", zap.Int("attempt", attempt))
			time.Sleep(1 * time.Second)
		}

		resp, err := c.client.Chat.Completions.New(ctx, openai.ChatCompletionNewParams{
			Model:               openai.ChatModel(c.model),
			MaxCompletionTokens: openai.Int(16000),
			Messages: []openai.ChatCompletionMessageParamUnion{
				openai.UserMessage([]openai.ChatCompletionContentPartUnionParam{
					openai.TextContentPart(prompt),
					openai.ImageContentPart(openai.ChatCompletionContentPartImageImageURLParam{
						URL: dataURI,
					}),
				}),
			},
		})
		if err != nil {
			lastErr = fmt.Errorf("openai request failed: %w", err)
			continue
		}

		if len(resp.Choices) == 0 {
			lastErr = fmt.Errorf("openai returned no choices")
			continue
		}

		choice := resp.Choices[0]
		if choice.Message.Refusal != "" {
			lastErr = fmt.Errorf("GPT refused the request: %s", choice.Message.Refusal)
			c.logger.Warn("GPT refusal", zap.String("refusal", choice.Message.Refusal))
			continue
		}

		rawContent := choice.Message.Content
		content := cleanJSON(rawContent)
		if content == "" {
			lastErr = fmt.Errorf("GPT returned empty content after cleaning. Raw response: '%s'", rawContent)
			continue
		}

		var result model.GPTScanResponse
		if err := json.Unmarshal([]byte(content), &result); err != nil {
			c.logger.Error("failed to parse GPT response", zap.String("raw_content", rawContent), zap.String("cleaned_content", content), zap.Error(err))
			return nil, fmt.Errorf("invalid JSON from GPT: %w", err)
		}

		logScanResult(c.logger, "GPT (hybrid)", &result)
		return &result, nil
	}

	return nil, lastErr
}

func cleanJSON(s string) string {
	s = strings.TrimSpace(s)
	s = strings.TrimPrefix(s, "```json")
	s = strings.TrimPrefix(s, "```")
	s = strings.TrimSuffix(s, "```")
	return strings.TrimSpace(s)
}
