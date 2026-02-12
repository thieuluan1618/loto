# Loto - Vietnamese Lottery Ticket Scanner

Scan Lô Tô lottery tickets with AI vision, extract numbers, and track matched results — all from your phone.

## Quick Start

### Backend

```bash
cp .env.example .env
# Configure GOOGLE_API_KEY or OPENAI_API_KEY in .env

make dev    # hot-reload
# or
make run    # production
```

### Mobile App

```bash
cd mobile
npm install
npx expo start --clear        # dev server
npx expo start --clear --web  # browser
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

## Architecture

```
cmd/server/          → Entry point
internal/
  ├── ai/            → Gemini & OpenAI vision clients
  ├── config/        → Environment config
  ├── handler/       → Gin HTTP handlers
  ├── model/         → Data models
  ├── ocr/           → Google Vision OCR
  ├── scan/          → Hybrid scan pipeline (OCR + AI)
  ├── service/       → Business logic
  ├── repository/    → Database layer (optional)
  └── validator/     → Ticket number validation
mobile/
  ├── App.tsx         → Root with font loading
  ├── src/
  │   ├── api/        → Backend API client
  │   ├── components/ → TicketCard (interactive grid)
  │   ├── hooks/      → useImageColors (dynamic theming)
  │   └── screens/    → HomeScreen
  ├── tailwind.config.js
  └── global.css
test/
  ├── benchmark.sh   → Multi-provider accuracy benchmark
  └── scan_test.sh   → Single scan test
```

## Tech Stack

- **Backend**: Go 1.22+, Gin, pgx, zap
- **AI**: Google Gemini (default, gemini-3-flash-preview) / OpenAI (gpt-5.2)
- **Mobile**: Expo SDK 54, React Native, TypeScript
- **Styling**: NativeWind v4 (Tailwind CSS), Lunar New Year theme
- **Fonts**: Roboto Condensed Bold (via @expo-google-fonts)

## Benchmark

```bash
cd test && bash benchmark.sh
```

Compares accuracy and speed across Gemini and OpenAI models.

## Docker

```bash
make docker-build
make docker-run
```
