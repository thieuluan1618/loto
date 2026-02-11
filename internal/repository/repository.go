package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"loto/internal/model"
)

type Repository struct {
	db *pgxpool.Pool
}

func New(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) SaveScan(ctx context.Context, scan *model.Scan) error {
	scan.ID = uuid.NewString()
	scan.CreatedAt = time.Now().UTC()

	numbersJSON, err := json.Marshal(scan.ExtractedNumbers)
	if err != nil {
		return err
	}

	_, err = r.db.Exec(ctx,
		`INSERT INTO scans (id, user_id, image_url, extracted_numbers, confidence, status, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		scan.ID, scan.UserID, scan.ImageURL, numbersJSON, scan.Confidence, scan.Status, scan.CreatedAt,
	)
	return err
}

func (r *Repository) GetScansByUserID(ctx context.Context, userID string) ([]model.ScanHistoryItem, error) {
	rows, err := r.db.Query(ctx,
		`SELECT id, extracted_numbers, confidence, status, created_at
		 FROM scans WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return collectScanHistory(rows)
}

func (r *Repository) GetScanByID(ctx context.Context, scanID string) (*model.Scan, error) {
	var scan model.Scan
	var numbersJSON []byte

	err := r.db.QueryRow(ctx,
		`SELECT id, user_id, image_url, extracted_numbers, confidence, status, created_at
		 FROM scans WHERE id = $1`, scanID,
	).Scan(&scan.ID, &scan.UserID, &scan.ImageURL, &numbersJSON, &scan.Confidence, &scan.Status, &scan.CreatedAt)
	if err != nil {
		return nil, err
	}

	if err := json.Unmarshal(numbersJSON, &scan.ExtractedNumbers); err != nil {
		return nil, err
	}
	return &scan, nil
}

func (r *Repository) FindMatchingResults(ctx context.Context, numbers []int) ([]model.LotteryResult, error) {
	strNumbers := make([]string, len(numbers))
	for i, n := range numbers {
		strNumbers[i] = fmt.Sprintf("%d", n)
	}
	rows, err := r.db.Query(ctx,
		`SELECT id, date, region, prize_type, winning_number
		 FROM lottery_results WHERE winning_number = ANY($1)`,
		strNumbers,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []model.LotteryResult
	for rows.Next() {
		var lr model.LotteryResult
		if err := rows.Scan(&lr.ID, &lr.Date, &lr.Region, &lr.PrizeType, &lr.WinningNumber); err != nil {
			return nil, err
		}
		results = append(results, lr)
	}
	return results, rows.Err()
}

func collectScanHistory(rows pgx.Rows) ([]model.ScanHistoryItem, error) {
	var items []model.ScanHistoryItem
	for rows.Next() {
		var item model.ScanHistoryItem
		var numbersJSON []byte

		if err := rows.Scan(&item.ID, &numbersJSON, &item.Confidence, &item.Status, &item.CreatedAt); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(numbersJSON, &item.ExtractedNumbers); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}
