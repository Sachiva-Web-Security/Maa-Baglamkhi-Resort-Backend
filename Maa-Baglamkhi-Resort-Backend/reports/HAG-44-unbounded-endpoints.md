# HAG-38 — Unbounded endpoints: audit-logs and banquet list

## Status: DONE (green-gate, worker-lane-b, 2026-10-24)

Both GET /api/audit-logs and GET /api/banquet/bookings previously returned every row ever written, with no LIMIT. Once audit_logs grew past a few thousand rows, neither returned under the 6 s test budget.

## What changed

**1. GET /api/audit-logs (auditLogController.js + AuditLogsModel.js)**

- `AuditLogsModel.findAll(limit)` now takes a limit and appends `LIMIT ?` to the query.
- `getAuditLogs` reads `?limit=` (clamped to 1–500, default 100) and passes it to `findAll`.
- `SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?` — newest-first, capped.

**2. GET /api/banquet/bookings (banquetRoutes.js)**

- Added `LIMIT ?` with `req.query.limit` clamped to 1–500, default 200.

**3. GET /api/banquet (banquetBookingsController.js, dashboard)**

- The dashboard's unbounded `bookings` SELECT now carries `LIMIT 500` on the `banquet_bookings` side. The halls side is already naturally bounded (few halls).

No DROP, no index removal. Pure additive LIMIT clauses.

## Gate

- test:routes: **450 pass / 0 fail / 12 skip**
- vite build: **exit 0, no output**
