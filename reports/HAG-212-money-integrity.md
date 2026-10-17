# HAG-212 — money integrity: duplicate bill payments

Verified against the live DB (127.0.0.1:3306, `resort_management`) on 2026-10-18, and against a live backend process on a spare port (5077). No row was inserted, updated or deleted; de-dup is query-time only.

## 1. The defect

`payments` carries several identical rows per bill. Stable duplicates:

| bill_id | rows | distinct amounts | amounts |
| --- | --- | --- | --- |
| 1 | 36 | 1 | 100.00 each |
| 45 | 3 | 1 | 750.00 each |
| 53 | 2 | 1 | 640.00 each |

41 rows, 40 redundant, every duplicate an exact copy. `bills` held **1 row** with `MAX(id)` 98 at the start of this job and has moved on to `MAX(id)` 102 with 1 row — bills are being deleted as tests run. All referenced bill ids are orphans, including 1, 45 and 53. The live DB was also being written to by other agents throughout this job (payments grew 238 → 419), so the row counts move.

Every one of the bill-attached payments is `payment_type='payment'`, `status='completed'`. There are no `advance` rows against bills, so the `advance` branch of `paymentsJoin` is dead weight in the current schema.

## 2. The rule

**Revenue comes from `bills.total`, never `bills.paid_amount`** — that column is written by `settlePendingBill` from `paid_amount + due` against a bill total that no longer exists, so summing it double-counts whatever is invoiced from it. It currently reads `3530` against an `80.00` real bill total.

**De-duplicate before summing payments: one row per bill, latest `completed` wins.** Applied as query-time filtering on `payments.bill_id`, the only duplicate key actually populated (`bill_id` 205/288, `booking_id` 161/288, `invoice_id` and `banquet_booking_id` both 0/288). Rows with no `bill_id` are genuine singles and are kept whole; `refund` and `cancelled` rows are never duplicated, so they are unaffected.

The de-dup subquery, used verbatim by every fixed aggregate:

```sql
SELECT MAX(id) AS last_id FROM payments
  WHERE bill_id IS NOT NULL AND <outer filters>
  GROUP BY bill_id
UNION ALL
SELECT id FROM payments WHERE bill_id IS NULL AND <outer filters>
-- then JOIN payments p ON p.id = last_id
```

## 3. Affected endpoints and figures

Endpoint, old behaviour, before/after (figures from the same snapshot, `payments` 288 rows):

**1. `GET /api/accounts/summary`** — `src/controller/accountsController.js:349`
Summed all `completed` payments, so bill 1 counted as 3600 instead of 100.
- income `207163` → `201523`
- refunds `188603` → `22500` — was `WHERE status='completed'` with no type filter, so the 166103 of genuine receipts were reported as cash returned to guests
- net `207153` → `201513`

**2. `GET /api/accounts/reconciliation/summary`** — `accountsController.js:1174`
- totalBankIn `219220` → `213580`
- totalBankOut `0.00` → `0.00` unchanged — the `CASE WHEN status = 'refunded'` branch could never match (that value does not exist in the enum), but it was also inverted: the non-refund branch netted refunds out of totalIn. Both were corrected, and totalBankOut remains 0.

**3. `GET /api/accounts/extended-summary`** — `accountsController.js:927`
- pettyCashBalance `32180` → `29790`

**4. `GET /api/report/daywise`** — `src/controller/reportController.js:22`
Had no `status` or `payment_type` filter at all, so the 30257 of `pending` rows were reported as collected. Fixed, and de-duped. Per day:

| day | before | after |
| --- | --- | --- |
| 2026-10-04 | 3000 | 3000 |
| 2026-10-05 | 4000 | 4000 |
| 2026-10-07 | 45000 | 45000 |
| 2026-10-14 | 14900 | 14800 |
| 2026-10-15 | 13510 | 13510 |
| 2026-10-16 | 68873 | 68173 |
| 2026-10-17 | 49077 | 46737 |
| 2026-10-18 | 18360 | 18360 |
| **total** | **216720** | **213580** |

**5. `GET /api/booking/list` and `GET /api/booking/:id`** — `src/controller/bookingController.js:157` (`paymentsJoin`)
booking 1 `paidAmount` was `7100` against a `7000` total, which the row's own `paymentStatus` logic read as `Partial`. Now `7000`, `Paid`.

**6. `GET /api/guest-profile`** — `src/controller/guestProfileController.js:76`
Same `paidAmount` over-count; `remainingAmount` now stops going negative on a cancelled booking.

**7. `GET /api/invoice/customer/:id`** — `src/models/InvoiceModel.js:279`
Same `paidAmount` over-count.

**8. `folioTotals.getAdvancePaid(bookingId)`** — `src/utils/folioTotals.js:265`
Single-booking query, so a duplicate only lands if the bill is the customer's own bill. No live change: booking 1 stayed `7000` before and after. Fixed so it cannot drift.

**9. `POST /api/booking/:id/cancel`** — `src/controller/bookingController.js:1968`
`received` feeds the refund insert, so it could have refunded 100 more than was received. `7100` → `7000`.

**10. `GET /api/report/items` and the old `src/models/ReportModel.js` daywise**
`ReportModel` is dead code (nothing requires it) and is left alone. `reportItems` sums `order_items` quantities and is unaffected.

## 4. Checked and left as-is

- **`/api/dashboard`** — `todayRevenue` `1150`, `totalRevenueGenerated` `1655`. Both are `SUM(bills.total)`, so both are correct by the rule. `totalRevenueGenerated` still includes banquet and room revenue, which is what that metric means.
- **`GET /api/reports/data?type=all-bills` and `?type=restaurant`** — `reportsController.js` already sums `bills.total`. Unaffected.
- **`GET /api/accounts/hotel-billing`** — booking-level `paid_amount` comes from `payments.booking_id`, never `bill_id`. Unaffected.
- **`GET /api/accounts/department-summary`** — sums the double-entry ledger (`transaction_entries` + `chart_of_accounts`), not `payments`. Unaffected.
- **`GET /api/restaurant/waiter-performance`** — `SUM(bills.total)` grouped by waiter. Correct by the rule.

## 5. Rows to look at (nothing was changed)

Duplicate `payments.id` to drop manually, latest kept:
- bill 1, keep `330`, drop: `46,50,52,54,56,58,60,62,64,66,68,70,72,74,76,78,80,82,84,86,88,90,92,94,96,100,278,280,281,291,298,301,304,327`
- bill 45, keep `310`, drop: `305,306`
- bill 53, keep `357`, drop: `356`

Plus zero-amount `completed` rows against non-existent bills (ids `108,110,112,116,118,120,122,124,128,130,132,134,136,138,140,144,146,150,154,158,163,168,173,180,187,200,205,210,219,229,235,237,239,241,243,248,261,263,288,290,318,320,337,339,344,353,368`, and growing) — they carry no money but make the bill/payment counts look populated.

Two data bugs behind the mess, not fixed here (they would need write access):
- `settlePendingBill` at `accountsController.js:2240` selects `bills WHERE id = ?` before computing `due`, so settling a deleted bill returns 404 but a bill that was deleted *after* the select inserts an orphan payment row.
- `payments.paid_amount`/`bills.paid_amount` keep accumulating against totals that are gone, hence `3530` against `80.00`.

## 6. Verification

`node --check` on all six edited files, `require('./src/app')` loads, backend booted clean on 5077, every endpoint above returns 200, and each new query was executed directly against the DB with its old version side by side. One real bug found this way: `GROUP BY p.date` failed on MariaDB with `Unknown column 'p.date' in 'group statement'`, so daywise groups on `DATE(p.created_at)` instead.
