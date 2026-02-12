# Loto - Vietnamese Lottery Ticket Scanner

## Commands
- **Backend dev**: `make dev` (hot-reload via air) or `make run`
- **Backend build**: `make build` or `go build ./...`
- **Backend test**: `go test ./...` or single: `go test ./internal/validator/ -run TestName -v`
- **Frontend dev**: `cd mobile && npx expo start --clear` (add `--web` for browser)
- **Frontend typecheck**: `cd mobile && npx tsc --noEmit`
- **Benchmark**: `cd test && bash benchmark.sh`

## Architecture
- **Go backend** (`cmd/server/`, `internal/`): Gin REST API, clean architecture (handler→service→repository). DB is optional — app runs without PostgreSQL.
- **Expo React Native app** (`mobile/`): TypeScript + NativeWind (Tailwind CSS), scans Lô Tô tickets via camera/gallery, sends to backend AI Vision API, renders interactive ticket card.
- **API**: `POST /api/v1/scan-ticket` (multipart image), `GET /api/v1/scan-history`, `GET /api/v1/check-result`, `GET /health`
- **AI**: Default provider is Google Gemini (gemini-3-flash-preview, thinking=minimal). Also supports OpenAI (gpt-5.2). Response JSON may be wrapped in markdown — `cleanJSON()` strips it.
- **Dev network**: Backend on `:8080`. Mobile uses `DEV_HOST` IP in `mobile/src/api/client.ts` for physical devices, `localhost` for web.

## Frontend Stack
- **NativeWind v4.2.1** + **Tailwind CSS 3.4.17** for styling (use `className` props, not `StyleSheet.create`)
- **Tailwind config**: `mobile/tailwind.config.js` — custom `tet-*` color palette (red, gold, cream, pink)
- **Custom font**: Roboto Condensed Bold via `@expo-google-fonts/roboto-condensed`, use `font-condensed` class
- **Dynamic colors**: `useImageColors` hook extracts dominant colors from ticket images via `react-native-image-colors`
- **Theme**: Lunar New Year (Tết) — soft pastel background with coral/peach tones, gentle gold accents

## Code Style
- Go: idiomatic, no logic in handlers, structured logging with `zap`, errors wrapped with `fmt.Errorf`, no panics on user errors.
- TypeScript: strict mode, functional components, NativeWind/Tailwind classes for styles, no `any` types.
- No code comments unless complex logic. No secrets in code — use `.env`.
