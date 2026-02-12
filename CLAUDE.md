# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend (Go)
```bash
make dev      # Hot-reload development server (Air)
make run      # Production server
make build    # Build binary to ./bin/server
make test     # Run all tests
go test ./internal/validator/ -run TestName -v  # Run specific test
make migrate  # Run database migrations (requires DATABASE_URL)
make lint     # Run golangci-lint
make tidy     # Clean up go.mod
```

### Mobile (Expo)
```bash
cd mobile
npm install               # Install dependencies
npx expo start --clear    # Start dev server (mobile)
npx expo start --clear --web  # Start dev server (web)
npx expo run:android      # Build for Android
npx expo run:ios          # Build for iOS
npx tsc --noEmit          # TypeScript type check
```

### Docker
```bash
make docker-build  # Build Docker image (loto-server)
make docker-run    # Run container on port 8080
```

### Benchmark
```bash
cd test && bash benchmark.sh  # Compare AI providers (Gemini vs OpenAI)
```

## Architecture

### Project Structure
This is a **Vietnamese lottery ticket scanner** with two main components:

1. **Go Backend** - REST API with AI vision for number extraction
2. **Expo Mobile App** - React Native app for scanning tickets

### Backend Clean Architecture
```
cmd/server/          → Entry point
internal/
  ├── ai/            → Gemini & OpenAI vision clients (switchable via AI_PROVIDER env)
  ├── config/        → Environment configuration
  ├── handler/       → Gin HTTP handlers (no business logic)
  ├── model/         → Data models
  ├── ocr/           → Google Cloud Vision OCR (optional hybrid mode)
  ├── scan/          → Hybrid scan pipeline (OCR + AI)
  ├── service/       → Business logic layer
  ├── repository/    → Database abstraction (optional - app runs without DB)
  └── validator/     → Ticket number validation (00-99 range)
```

### Key Architecture Patterns
- **Clean architecture**: handler → service → repository. No logic in handlers.
- **Optional database**: PostgreSQL is optional; app runs in-memory if unavailable
- **AI abstraction**: `ai/` package supports multiple providers (Google Gemini default, OpenAI)
- **Hybrid scanning**: Can combine OCR + AI for better accuracy (GOOGLE_VISION_ENABLED)
- **JSON response handling**: AI may wrap JSON in markdown code blocks — `cleanJSON()` strips this

### Mobile App Structure
```
mobile/
  ├── src/
  │   ├── api/        → Backend API client with dynamic host detection
  │   ├── components/ → TicketCard (interactive number grid)
  │   ├── hooks/      → useImageColors (extracts dominant colors from tickets)
  │   └── screens/    → HomeScreen
  ├── App.tsx         → Root with font loading
  └── tailwind.config.js
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/scan-ticket` | Upload ticket image (multipart/form-data with `image` and `user_id`) |
| GET | `/api/v1/scan-history?user_id=` | Get scan history |
| GET | `/api/v1/check-result?scan_id=` | Check results against lottery |
| GET | `/health` | Health check |

## Configuration

### Backend Environment (.env)
- `AI_PROVIDER`: `google` (default) or `openai`
- `GOOGLE_API_KEY`: For Gemini models
- `OPENAI_API_KEY`: For OpenAI models
- `GOOGLE_VISION_ENABLED`: Enable hybrid OCR mode
- `SERVER_PORT`: Default 8080
- `MAX_UPLOAD_SIZE_MB`: Default 5MB

### Mobile Dev Network
- Backend runs on port 8080
- Physical devices use `DEV_HOST` in `mobile/src/api/client.ts` (configured as `192.168.2.195:8080`)
- Web/emulator uses `localhost:8080`

## Code Style

### Go
- Idiomatic Go with structured logging via `zap`
- Errors wrapped with `fmt.Errorf`, no panics on user errors
- No logic in handlers — keep business logic in services

### TypeScript (Mobile)
- Strict mode enabled
- Functional components with hooks
- **Use NativeWind/Tailwind classes** (`className` prop), NOT `StyleSheet.create()`
- No `any` types
- Custom font: Use `font-condensed` class for Roboto Condensed Bold

### Styling (Mobile)
- NativeWind v4 + Tailwind CSS v3
- Custom `tet-*` color palette in `tailwind.config.js` (red, gold, cream, pink)
- Lunar New Year (Tết) theme: soft pastel backgrounds, coral/peach tones, gold accents
- Dynamic theming via `useImageColors` hook extracts colors from ticket images
