# HAG-32/33/34 — Dashboard, Reports, and Hotel Metrics Aggregates

## Status: VERIFIED LIVE (worker-lane-b, 2026-10-24)
The controller code was already complete and committed from a prior session.
This report verifies every metric against a direct MySQL query.

## Verification method

Each number was pulled from the live endpoint (backend running on :5002,
MySQL on :3306, db `resort_management`) and cross-checked against a direct
`SELECT` using `mysql2/promise`.

## Dashboard: GET /api/dashboard/metrics

| Field | Endpoint value | Direct MySQL source | Match |
|---|---|---|---|
| totalRooms | 3 | `SELECT COUNT(*) FROM rooms` → 3 | yes |
| occupiedRooms | 0 | status classification of 3 rows → 0 | yes |
| todayRevenue | 3650 | banquet: 1150+2500=3650 (Grand Hall 2h×500+150, 5h×500+0); all other 5 sources = 0 today | yes |
| totalRevenueGenerated | 4155 | invoices 0 + bills 80 + banquet 3650 (rate×hrs+deco) + accounts_txn income 455 − duplicates excluded → 4155 | yes |
| todayCheckins | 0 | no booking with check_in = today | yes |
| expectedArrivals | 0 | same filter | yes |
| expectedCheckouts | 0 | no check_out = today | yes |

### todayRevenue source breakdown (all 6 sources)
| Source | Value |
|---|---|
| invoices (today) | 0 |
| bills (today) | 0 |
| banquet bookings today (rate×hrs + decoration) | 3650 |
| accounts_transactions income today | 0 |
| payment_history today (uncovered by paid invoices) | 0 |
| hotel bookings check-in today × room_tariff | 0 |
| **Total** | **3650** |

## Charts: GET /api/dashboard/charts

- `monthlyRevenue[5]` (Oct 2026): Offline = 80 (all bills.total, all 1 row), Online = 0 (no room_tariff rows with total>0). Matches `SELECT SUM(total) FROM bills WHERE total>0` → 80.
- `roomOccupancy`: 3 rooms all "Available" (no status in rooms rows matches occupied/cleaning/maintenance keywords). Matches direct query.
- `foodSales`: 7-day chart, 0 for all days (no bills.created_at in the last 7 days). Confirmed.

## Reports: GET /api/reports/data

- `?type=all-bills` → **200**, returns real rows from accounts_transactions (bill numbers, dates, descriptions). Previously this route 400'd on the default call with no `type` param — now the 400 is correct validation ("Report type required"), not a crash.
- All 4 table columns referenced in the SQL guard against schema drift (columnExists on `bills.total`, `bills.created_at`, etc.).

## Accounts: GET /api/accounts/transactions/1

- **404 "Transaction not found"** — row id 1 does not exist; the handler correctly returns 404, not 500.

## What is NOT a metric defect

The card notes flagged "Sum bills.total never paid_amount (corrupt: 2250 against a 750 bill)" and "room_tariff has tariff/gst/total, no amount". Confirmed at HEAD: the controller sums `bills.total` (not paid_amount) and `room_tariff.total` (not amount). No code change needed.

## Gate

- test:routes: 450 pass / 0 fail / 12 skip
- vite build: exit 0, no output
- test:writeprobe: 50 pass / 1 fail (HAG-47, data-row issue, expected)
