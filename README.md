# Loto - Vietnamese Lottery Ticket Scanner API

REST API backend that scans lottery ticket images using OpenAI Vision and checks results against stored lottery data.

## Quick Start

```bash
# Copy env file and configure
cp .env.example .env

# Run database migration
psql "postgres://postgres:postgres@localhost:5432/loto?sslmode=disable" -f migrations/001_init.sql

# Run
make run
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/scan-ticket` | Upload lottery ticket image for scanning |
| GET | `/api/v1/scan-history?user_id=` | Get scan history for a user |
| GET | `/api/v1/check-result?scan_id=` | Check scanned numbers against lottery results |
| GET | `/health` | Health check |

### POST /api/v1/scan-ticket

```bash
curl -X POST http://localhost:8080/api/v1/scan-ticket \
  -F "image=@ticket.jpg" \
  -F "user_id=some-uuid"
```

## Docker

```bash
make docker-build
make docker-run
```

## Tech Stack

- Go 1.22+, Gin, pgx, OpenAI Go SDK, zap
