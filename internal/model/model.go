package model

import (
	"time"
)

type Scan struct {
	ID               string    `json:"id" db:"id"`
	UserID           *string   `json:"user_id,omitempty" db:"user_id"`
	ImageURL         string    `json:"image_url" db:"image_url"`
	ExtractedNumbers []int     `json:"extracted_numbers" db:"extracted_numbers"`
	Confidence       float64   `json:"confidence" db:"confidence"`
	Status           string    `json:"status" db:"status"`
	CreatedAt        time.Time `json:"created_at" db:"created_at"`
}

type LotteryResult struct {
	ID            string    `json:"id" db:"id"`
	Date          time.Time `json:"date" db:"date"`
	Region        string    `json:"region" db:"region"`
	PrizeType     string    `json:"prize_type" db:"prize_type"`
	WinningNumber string    `json:"winning_number" db:"winning_number"`
}

type Block struct {
	Row1 []int `json:"row1"`
	Row2 []int `json:"row2"`
	Row3 []int `json:"row3"`
}

type GPTScanResponse struct {
	LotteryType string  `json:"lottery_type"`
	Blocks      []Block `json:"blocks"`
	AllNumbers  []int   `json:"all_numbers"`
	TicketID    string  `json:"ticket_id"`
	Confidence  float64 `json:"confidence"`
	Notes       string  `json:"notes"`
}

type ScanRequest struct {
	UserID string `form:"user_id"`
}

type ScanResponse struct {
	ScanID      string  `json:"scan_id,omitempty"`
	LotteryType string  `json:"lottery_type"`
	Blocks      []Block `json:"blocks,omitempty"`
	AllNumbers  []int   `json:"all_numbers"`
	TicketID    string  `json:"ticket_id,omitempty"`
	Confidence  float64 `json:"confidence"`
	Status      string  `json:"status"`
	Notes       string  `json:"notes,omitempty"`
}

type CheckResultResponse struct {
	ScanID  string        `json:"scan_id"`
	Matches []MatchResult `json:"matches"`
}

type MatchResult struct {
	Number        string `json:"number"`
	Matched       bool   `json:"matched"`
	PrizeType     string `json:"prize_type,omitempty"`
	WinningNumber string `json:"winning_number,omitempty"`
	Region        string `json:"region,omitempty"`
}

type ScanHistoryItem struct {
	ID               string    `json:"id"`
	ExtractedNumbers []int     `json:"extracted_numbers"`
	Confidence       float64   `json:"confidence"`
	Status           string    `json:"status"`
	CreatedAt        time.Time `json:"created_at"`
}
