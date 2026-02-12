#!/usr/bin/env bash
set -euo pipefail

HOST="${1:-http://localhost:8080}"
IMAGE="$(dirname "$0")/Lo To Game 90.jpg"

if [ ! -f "$IMAGE" ]; then
  echo "FAIL: test image not found: $IMAGE"
  exit 1
fi

echo "==> Scanning ticket: $IMAGE"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$HOST/api/v1/scan-ticket" \
  -F "image=@$IMAGE")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" != "200" ]; then
  echo "FAIL: expected HTTP 200, got $HTTP_CODE"
  echo "$BODY"
  exit 1
fi

echo "==> Response:"
echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"

EXPECTED_NUMBERS='[1,3,4,5,7,10,13,14,15,22,23,24,25,26,28,30,34,35,36,41,42,47,48,49,50,51,52,53,56,59,60,61,64,66,71,72,75,76,79,81,83,84,86,87,89]'

EXPECTED_BLOCKS='[
  {"row1":[13,22,41,61,86],"row2":[3,24,34,52,71],"row3":[1,35,56,64,83]},
  {"row1":[7,23,36,53,75],"row2":[5,48,59,72,84],"row3":[14,28,42,60,87]},
  {"row1":[26,47,50,79,89],"row2":[4,10,30,49,66],"row3":[15,25,51,76,81]}
]'

ERRORS=0

LOTTERY_TYPE=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['lottery_type'])")
if [ "$LOTTERY_TYPE" != "LOTO" ]; then
  echo "FAIL: lottery_type expected 'LOTO', got '$LOTTERY_TYPE'"
  ERRORS=$((ERRORS + 1))
fi

ACTUAL_NUMBERS=$(echo "$BODY" | python3 -c "import sys,json; print(json.dumps(sorted(json.load(sys.stdin)['all_numbers']),separators=(',',':')))")
if [ "$ACTUAL_NUMBERS" != "$EXPECTED_NUMBERS" ]; then
  echo "FAIL: all_numbers mismatch"
  echo "  expected: $EXPECTED_NUMBERS"
  echo "  actual:   $ACTUAL_NUMBERS"
  ERRORS=$((ERRORS + 1))
fi

ACTUAL_BLOCKS=$(echo "$BODY" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(json.dumps(data.get('blocks', []), separators=(',', ':')))
")
EXPECTED_BLOCKS_COMPACT=$(echo "$EXPECTED_BLOCKS" | python3 -c "
import sys, json
print(json.dumps(json.load(sys.stdin), separators=(',', ':')))
")
if [ "$ACTUAL_BLOCKS" != "$EXPECTED_BLOCKS_COMPACT" ]; then
  echo "FAIL: blocks mismatch"
  echo "  expected: $EXPECTED_BLOCKS_COMPACT"
  echo "  actual:   $ACTUAL_BLOCKS"
  ERRORS=$((ERRORS + 1))
fi

STATUS=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
if [ "$STATUS" != "confirmed" ]; then
  echo "FAIL: status expected 'confirmed', got '$STATUS'"
  ERRORS=$((ERRORS + 1))
fi

CONFIDENCE=$(echo "$BODY" | python3 -c "import sys,json; c=json.load(sys.stdin)['confidence']; print('ok' if c >= 0.7 else f'low:{c}')")
if [ "$CONFIDENCE" != "ok" ]; then
  echo "FAIL: confidence too low: $CONFIDENCE"
  ERRORS=$((ERRORS + 1))
fi

echo ""
if [ $ERRORS -eq 0 ]; then
  echo "PASS: all checks passed"
else
  echo "FAIL: $ERRORS check(s) failed"
  exit 1
fi
