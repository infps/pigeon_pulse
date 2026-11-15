#!/bin/bash
# API latency + payload benchmark, plus an N-viewer load test on one live race.
#
#   scripts/bench-api.sh <baseUrl> <liveRaceId> <endedRaceId> <eventId> <seasonId> [loadRequests]
#
#   loadRequests: total requests for the 20-parallel-viewer test (default 0 = skip).
#   Examples (on the EC2 host):
#     scripts/bench-api.sh http://127.0.0.1:3101 10000 834 19 15 100     # A/B container
#     CURL_EXTRA="--resolve pigeonpulse.com:443:127.0.0.1" \
#       scripts/bench-api.sh https://pigeonpulse.com 10000 834 19 15     # live, via Caddy
#
# Each endpoint: one request after the 3s race cache expires ("first"), then 10
# more (p50/p95). Sizes are as sent: through Caddy they are gzip, straight to a
# container they are raw (Next does not compress).
# Never point the load test at production without agreeing a window: the old
# code needed minutes to recover from 20 viewers.
set -u
B=$1; LIVE=$2; ENDED=$3; EV=$4; SEASON=$5; N=${6:-0}
# CURL_EXTRA: extra curl args, e.g. "--resolve pigeonpulse.com:443:127.0.0.1" on the host.
# shellcheck disable=SC2206
CURL=(curl -s -o /dev/null --compressed --max-time 60 ${CURL_EXTRA:-})
ms() { awk "BEGIN { printf \"%.0f\", $1 * 1000 }"; }

EPS="/api/breeder/races/$ENDED/items /api/breeder/races/$LIVE/items /api/public/race/$LIVE/overlay
/api/breeder/event/$EV/inventory-items?seasonId=$SEASON /api/breeder/event/$EV/inventory?seasonId=$SEASON
/api/breeder/events /api/breeder/events/$EV /api/breeder/races/live /races/$ENDED /events/$EV"

printf "%-52s %8s %8s %8s %9s %5s\n" "endpoint ($B)" first_ms p50_ms p95_ms KB code
for e in $EPS; do
  sleep 3.2
  first=$("${CURL[@]}" -w '%{time_total}' "$B$e")
  ts=$(for i in $(seq 1 10); do "${CURL[@]}" -w '%{time_total}\n' "$B$e"; done | sort -n)
  read -r sz code < <("${CURL[@]}" -w '%{size_download} %{http_code}' "$B$e")
  p50=$(echo "$ts" | sed -n 6p); p95=$(echo "$ts" | sed -n 10p)
  printf "%-52s %8s %8s %8s %9.1f %5s\n" "$e" "$(ms "$first")" "$(ms "$p50")" "$(ms "$p95")" "$(awk "BEGIN{print $sz/1024}")" "$code"
done

if [ "$N" -gt 0 ]; then
  sleep 3.2
  out=$(mktemp); start=$(date +%s.%N)
  seq 1 "$N" | xargs -P 20 -I{} "${CURL[@]}" -w '%{time_total}\n' "$B/api/breeder/races/$LIVE/items" > "$out"
  wall=$(awk "BEGIN{print $(date +%s.%N) - $start}")
  sort -n "$out" | awk -v n="$N" -v w="$wall" '{a[NR]=$1} END {
    printf "LOAD 20 parallel viewers, %d req on live race: wall %.1fs | p50 %.0fms p95 %.0fms max %.0fms\n",
      NR, w, a[int(NR/2)+1]*1000, a[int(NR*0.95)]*1000, a[NR]*1000 }'
  rm -f "$out"
fi
