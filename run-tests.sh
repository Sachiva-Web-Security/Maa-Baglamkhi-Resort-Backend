#!/usr/bin/env bash
# MBR regression gate — one command. Requires: backend on 5002, MySQL on 3306.
# Playwright spawns the frontend dev server itself (127.0.0.1:5173).
set -u
cd "$(dirname "$0")"
fail=0

echo "=== services ==="
for p in 5002 3306; do
  if nc -z -w2 -s 127.0.0.1 127.0.0.1 "$p" 2>/dev/null; then echo "  port $p OPEN"; else echo "  port $p CLOSED (start it: backend 5002, MySQL 3306)"; fail=1; fi
done

echo
echo "=== backend suites ==="
(cd Maa-Baglamkhi-Resort-Backend && npm test) || fail=1

echo
echo "=== frontend unit (jest) ==="
(cd Maa-Baglamkhi-Resort-frontend && npm test) || fail=1

echo
echo "=== frontend e2e (playwright) ==="
(cd Maa-Baglamkhi-Resort-frontend && npm run test:e2e) || fail=1

echo
if [ "$fail" -eq 0 ]; then echo "GATE: GREEN"; else echo "GATE: RED"; fi
exit "$fail"
