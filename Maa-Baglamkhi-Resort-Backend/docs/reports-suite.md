# Reports Suite (`/api/reports-suite`)

Admin-side accounts + reporting suite. 33 read-only endpoints for
admin / manager / accountant. Every endpoint takes `?from&to`
(YYYY-MM-DD, default: last 30 days) and `?format=csv` for a
`Content-Disposition` CSV download.

## Endpoints

### Core 19 (original suite)

| Key | Source |
| --- | --- |
| `/mis` | `bookings`, `bills`, `banquet_bookings`, `payments` |
| `/invoice-register` | `invoices`, `bookings` |
| `/service-wise` | `bookings`, `bills`, `banquet_bookings`, `orders`, `banquet_booking_addons` |
| `/room-occupancy` | `rooms`, `booking_rooms`, `bookings` |
| `/rooms-all` | `rooms` (live status) |
| `/rooms-checkin` / `/rooms-checkout` | `bookings` |
| `/company-ledger` | `transactions`, `transaction_entries` |
| `/room-history` | `booking_rooms`, `bookings` |
| `/room-performance` | `booking_rooms`, `bookings` |
| `/guest-list-police` | `bookings`, `guest_profiles`, `guest_documents` |
| `/housekeeping-history` | `housekeeping_logs`, `completed_cleaning_logs` |
| `/maintenance-history` | `maintenance_requests` |
| `/general-ledger` | `chart_of_accounts`, `transaction_entries` |
| `/cashbook-summary` | `payments`, `payment_methods` |
| `/night-audit` | multi-table snapshot; upserts into `night_audit_snapshots` (additive only) |
| `/cash-summary` | `petty_cash_entries`, `payments` |
| `/refund-collection` | `payments` (refunds), `bookings` (cancelled) |
| `/stock-summary` | `inventory` (live quantities) |

### Extension 14 (HAG-66)

| Key | Source / fallback |
| --- | --- |
| `/collection-report` | `payments` (completed receipts, by day + channel) |
| `/item-wise` | `order_items` + `bills.items_json` (server-side aggregation) |
| `/invoice-group-wise` | `invoices` |
| `/sales-by-guest` | `bookings` + `folio_entries` (extras) |
| `/sales-by-order-type` | `bills` + `orders`, grouped by `entity_type` |
| `/due-list` | live open balances: `bills`, `invoices`, `bookings` |
| `/table-wise` | `bills` where `entity_type = 'Table'` |
| `/nc-sales` | `payments` where channel ≠ Cash |
| `/parcel-sales` | `orders` / `bills` where `entity_type = 'Takeaway'` |
| `/void-kot-history` | `restaurant_item_action_requests` + `kot_orders` (cancelled) |
| `/refund-item-summary` | `payments` where `payment_type` / `status` marks a refund |
| `/pax` | `pax` table if present, else `bookings` guest counts |
| `/day-end-summary` | daily lines from `bookings` + `bills` + `banquet_bookings` + `payments` |
| `/feedback-analytics` | `guest_reviews` |

## Notes

- **`void-kot-history`**: item-level voids have no dedicated table on this
  deployment. The report uses the two closest sources (item-action requests
  and cancelled KOTs). No void data is invented.
- **`pax`**: the `pax` table is created on demand by `paxModel.js`; if it
  does not exist the endpoint falls back to `bookings` guest counts.
- **`feedback-analytics`**: `guest_reviews` is the only rating source
  checked. The `reports` table (0 rows) and `review_media` were checked and
  hold no rating fields.
- Missing tables degrade to an empty report with a `note` field in `summary`,
  not a 500. This is by design — the suite must run on deployments with
  partial schemas.
- No table is written except the night-audit upsert
  (`night_audit_snapshots`, `CREATE TABLE IF NOT EXISTS`).

## Auth

All endpoints require a valid JWT (admin / manager / accountant) and pass
through `roleMiddleware(["admin", "manager", "accountant"])`.
