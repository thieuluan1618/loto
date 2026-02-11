# Loto - Vietnamese Lottery Ticket Scanner

## Commands
- **Backend dev**: `make dev` (hot-reload via air) or `make run`
- **Backend build**: `make build` or `go build ./...`
- **Backend test**: `go test ./...` or single: `go test ./internal/validator/ -run TestName -v`
- **Frontend dev**: `cd mobile && npx expo start` (add `--web` for browser)
- **Frontend typecheck**: `cd mobile && npx tsc --noEmit`

## Architecture
- **Go backend** (`cmd/server/`, `internal/`): Gin REST API, clean architecture (handler→service→repository). DB is optional — app runs without PostgreSQL.
- **Expo React Native app** (`mobile/`): TypeScript, scans Lô Tô tickets via camera/gallery, sends to backend OpenAI Vision API, renders interactive ticket card.
- **API**: `POST /api/v1/scan-ticket` (multipart image), `GET /api/v1/scan-history`, `GET /api/v1/check-result`, `GET /health`
- **AI**: OpenAI Vision (gpt-4o) extracts numbers from ticket images. Response JSON may be wrapped in markdown — `cleanJSON()` strips it.
- **Dev network**: Backend on `:8080`. Mobile uses `DEV_HOST` IP in `mobile/src/api/client.ts` for physical devices, `localhost` for web.

## Code Style
- Go: idiomatic, no logic in handlers, structured logging with `zap`, errors wrapped with `fmt.Errorf`, no panics on user errors.
- TypeScript: strict mode, functional components, StyleSheet for styles, no `any` types.
- No code comments unless complex logic. No secrets in code — use `.env`.
