# HAG-52 — Banquet INSERT arity mismatch

**Verdict:** one bug, one character class, one line. `src/controller/banquetBookingsController.js:394`
listed 33 columns but supplied 32 `?` placeholders against 33 bind values. MySQL rejected every
booking create with `Column count doesn't match value count at row 1`. Fixed by adding the missing
placeholder. All other INSERTs and UPDATEs in the banquet controller and route files are arithmetically
consistent — counts below.

Verified live on MySQL `resort_management` at 127.0.0.1:3306, backend booted on 5002, admin token
from `POST /api/auth/login` (admin@resort.com, id 94).

## Failing statement

| | count |
|---|---|
| Columns (lines 361–393) | **33** |
| `?` placeholders (line 394) | **32** |
| Bind array entries (lines 397–429) | **33** |

The gap is the last column: `created_by` at line 393 has no placeholder of its own, so MySQL bound the
final 32 values one short and threw at row 1. Because the failure happened inside the INSERT, every
downstream field after the 31st slot was never written.

### After the fix

| | count |
|---|---|
| Columns | 33 |
| `?` placeholders | **33** |
| Bind array entries | 33 |

Diff is one character class on one line:

```diff
-      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
+      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
```

## Every INSERT and UPDATE audited in the banquet files

| Statement | Location | Needs | Has | |
|---|---|---|---|---|
| `INSERT banquet_bookings` | banquetBookingsController.js:360–431 | 33 | 32 → **33** | **FIXED** |
| `INSERT banquet_halls` | banquetHallController.js:53–73 | 13 | 13 | OK |
| `INSERT banquet_pricing_config` | banquetPricingController.js:124–128 | 1 (`id` is literal `1`) | 1 | OK |
| `UPDATE banquet_halls SET ... WHERE id=?` | banquetHallController.js:154 | dynamic set | dynamic | OK |
| `UPDATE banquet_bookings` (edit) | banquetBookingsController.js:544–613 | 33 (32 SET + 1 WHERE) | 33 | OK |
| `UPDATE banquet_bookings` (refund) | banquetBookingsController.js:697–708 | 8 (7 SET + 1 WHERE) | 8 | OK |
| `UPDATE banquet_bookings` (complete) | banquetBookingsController.js:763 | 1 | 1 | OK |
| `UPDATE banquet_bookings` (bill) | banquetBookingsController.js:806–813 | 8 (7 SET + 1 WHERE) | 8 | OK |
| `INSERT ... ON DUPLICATE KEY UPDATE` | banquetPricingController.js:124 | 1 | 1 | OK |
| `routes/banquetRoutes.js` | — | — | 0 writes | OK |

Note on `buildBanquetNotes(null, notesMeta)` at line 707: the comma-split naive count reads 9 entries
here, but the function call itself carries an inner comma and is one argument. Real arity is 8 of 8.

`routes/banquetRoutes.js` contains no INSERT or UPDATE — all writes live in the controllers.

## Live before / after

Same request body, same hall, same admin token, same date `2027-07-15` 18:00–22:00. Endpoint is
`POST /api/banquet` — the route file registers `router.post("/", createBanquetBooking)` at
`banquetRoutes.js:119`, so `POST /api/banquet/bookings` is **not a route at all** and returns 404
`{"message":"Endpoint not found.","path":"/api/banquet/bookings"}`. Both the reported symptom and the
write-probe failure come from the `POST /api/banquet` handler.

### Before (HEAD, unfixed controller)

```
HTTP 500
{"message":"Failed to create booking","error":"Column count doesn't match value count at row 1"}
```

Deterministic — same body, same date, identical error.

### After (fix applied)

```
HTTP 201
{"message":"Banquet booking created successfully","id":50}
```

### Read back from MySQL (before deleting)

```
id: 50          hall_id: 79        customer_name: HAG-52 Probe Guest
event_title: HAG-52 Arity Probe    guest_count: 120
created_by: 94  status: confirmed  total: 682500.00
```

`created_by: 94` is the column that had been silently dropped — it now lands, and the whole tail of the
row (`status`, `total`, `advance`, `balance`, `payment_mode`, `payment_status`) survives instead of
being truncated at the arity error.

## Probe cleanup

Two rows created by this investigation, both deleted, both confirmed absent:

- **id 47** — created by the fixed handler during the first live check (date 2027-06-15). Deleted.
- **id 50** — created by the fixed handler for the after-comparison (date 2027-07-15). Deleted.

`DELETE FROM banquet_bookings WHERE id IN (47,50)` → 2 rows affected; re-count returns 0. Nothing else
was touched.

## Notes for the floor

- **Sandbox masks 3306.** `nc -z 127.0.0.1 3306` and `lsof -iTCP:3306` both report closed/empty inside
  the command sandbox; outside it, mysqld (XAMPP, pid 30059) is listening and `SELECT 1` succeeds. God's
  ruling was right — probe with the sandbox disabled, or you will re-report a healthy DB as down.
- `nc -z` exit codes and `pgrep` also disagree under sandbox. Trust direct socket queries.
- Worktree `node_modules` is absent, so the backend will not boot there without it. I symlinked the
  main tree's `node_modules` and copied the main `.env` into the worktree to verify live; both are
  untracked and excluded from the commit.
- A first attempt used date `2027-06-15` and got HTTP 409
  `Selected hall is already booked for the chosen time slot` from the overlap guard
  (`checkBookingOverlap`, lines 326–337). That guard is correct — it uses the tuple contract,
  `const [hallRows] = await db.query(...)` then `hallRows.length` — and was blocked only by row 47 that
  I had just inserted. Re-ran on a clear date.
- `src/config/db.js` was not opened and its contract was not changed.
