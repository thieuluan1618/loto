#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

IMAGE="test/Lo To Game 90.jpg"
BASE_PORT=8100
RUNS="${1:-3}"
RESULTS_DIR="/tmp/loto-bench-results"

EXPECTED_NUMBERS='[1,3,4,5,7,10,13,14,15,22,23,24,25,26,28,30,34,35,36,41,42,47,48,49,50,51,52,53,56,59,60,61,64,66,71,72,75,76,79,81,83,84,86,87,89]'
EXPECTED_BLOCKS='[{"row1":[13,22,41,61,86],"row2":[3,24,34,52,71],"row3":[1,35,56,64,83]},{"row1":[7,23,36,53,75],"row2":[5,48,59,72,84],"row3":[14,28,42,60,87]},{"row1":[26,47,50,79,89],"row2":[4,10,30,49,66],"row3":[15,25,51,76,81]}]'

if [ ! -f "$IMAGE" ]; then
  echo "FAIL: test image not found: $IMAGE"
  exit 1
fi

source .env 2>/dev/null || true

if [ -z "${OPENAI_API_KEY:-}" ]; then
  echo "WARN: OPENAI_API_KEY not set, skipping OpenAI tests"
fi
if [ -z "${GOOGLE_API_KEY:-}" ]; then
  echo "WARN: GOOGLE_API_KEY not set, skipping Google tests"
fi

echo "Building server..."
go build -o /tmp/loto-bench ./cmd/server/

rm -rf "$RESULTS_DIR"
mkdir -p "$RESULTS_DIR"

wait_for_server() {
  local port="$1"
  for i in $(seq 1 30); do
    if curl -s "http://localhost:$port/health" > /dev/null 2>&1; then
      return 0
    fi
    sleep 0.5
  done
  return 1
}

run_provider() {
  local name="$1" provider="$2" port="$3" slot="$4"
  local result_file="$RESULTS_DIR/${slot}_${name}"
  local body_file="/tmp/loto-bench-body-${port}.json"

  export AI_PROVIDER="$provider"
  export SERVER_PORT="$port"
  export GOOGLE_VISION_ENABLED=false

  /tmp/loto-bench > /dev/null 2>&1 &
  local server_pid=$!

  if ! wait_for_server "$port"; then
    kill $server_pid 2>/dev/null || true
    wait $server_pid 2>/dev/null || true
    echo "FAIL: server did not start" > "$result_file"
    return
  fi

  local times="" accuracies="" sum="0" best_acc="0" blocks_ok="--"

  for r in $(seq 1 "$RUNS"); do
    local start end t http_code acc
    start=$(python3 -c "import time; print(time.time())")
    http_code=$(curl -s -o "$body_file" -w "%{http_code}" -X POST "http://localhost:$port/api/v1/scan-ticket" \
      -F "image=@$IMAGE")
    end=$(python3 -c "import time; print(time.time())")
    t=$(python3 -c "print(f'{$end - $start:.2f}')")

    if [ "$http_code" != "200" ]; then
      acc="ERR"
    else
      acc=$(python3 -c "
import json
with open('$body_file') as f:
    data = json.load(f)
expected = set($EXPECTED_NUMBERS)
actual = set(data.get('all_numbers', []))
if not actual:
    print('0')
else:
    print(f'{len(expected & actual) * 100 // len(expected)}')
")
    fi

    if [ -z "$times" ]; then times="$t"; else times="$times, $t"; fi
    if [ -z "$accuracies" ]; then accuracies="$acc"; else accuracies="$accuracies, $acc"; fi
    sum=$(python3 -c "print(f'{$sum + $t:.2f}')")

    if [ "$acc" != "ERR" ] && [ "$acc" -gt "$best_acc" ] 2>/dev/null; then
      best_acc="$acc"
      blocks_ok=$(python3 -c "
import json
with open('$body_file') as f:
    data = json.load(f)
actual = json.dumps(data.get('blocks', []), separators=(',', ':'))
print('MATCH' if actual == '$EXPECTED_BLOCKS' else 'MISMATCH')
")
    fi
  done

  kill $server_pid 2>/dev/null || true
  wait $server_pid 2>/dev/null || true

  local avg
  avg=$(python3 -c "print(f'{$sum / $RUNS:.2f}')")
  printf "%-25s %-24s avg: %-8s acc: %-16s blocks: %s\n" "$name" "$times" "${avg}s" "${accuracies}%" "$blocks_ok" > "$result_file"
}

PIDS=""
SLOT=0

launch() {
  local name="$1" provider="$2"
  local port=$((BASE_PORT + SLOT))
  run_provider "$name" "$provider" "$port" "$(printf '%02d' $SLOT)" &
  PIDS="$PIDS $!"
  SLOT=$((SLOT + 1))
}

echo "Launching all providers in parallel ($RUNS runs each)..."
echo ""

# Google models
if [ -n "${GOOGLE_API_KEY:-}" ]; then
  GOOGLE_AI_MODEL="gemini-3-flash-preview" GOOGLE_AI_THINKING=""        launch "gemini-3-flash"         "google"
  GOOGLE_AI_MODEL="gemini-3-flash-preview" GOOGLE_AI_THINKING="minimal" launch "gemini-3-flash-nothink" "google"
  GOOGLE_AI_MODEL="gemini-2.5-pro"         GOOGLE_AI_THINKING=""        launch "gemini-2.5-pro"         "google"
  GOOGLE_AI_MODEL="gemini-2.5-flash"       GOOGLE_AI_THINKING=""        launch "gemini-2.5-flash"       "google"
fi

# OpenAI models
if [ -n "${OPENAI_API_KEY:-}" ]; then
  OPENAI_MODEL="gpt-5.2"                                   launch "gpt-5.2"           "openai"
  OPENAI_MODEL="gpt-5.2"   OPENAI_REASONING_EFFORT="low" launch "gpt-5.2-nothink"   "openai"
  OPENAI_MODEL="gpt-5-mini" launch "gpt-5-mini" "openai"
  OPENAI_MODEL="gpt-5-nano" launch "gpt-5-nano" "openai"
fi

for pid in $PIDS; do
  wait $pid 2>/dev/null || true
done

printf "%-25s %-24s %-13s %-21s %s\n" "Provider" "Times (s)" "Avg" "Accuracy (%)" "Blocks"
printf "%-25s %-24s %-13s %-21s %s\n" "-------------------------" "------------------------" "-------------" "---------------------" "--------"

for f in $(ls "$RESULTS_DIR"/* 2>/dev/null | sort); do
  cat "$f"
done

echo ""
echo "Done. ($RUNS run(s) per provider, all parallel)"
