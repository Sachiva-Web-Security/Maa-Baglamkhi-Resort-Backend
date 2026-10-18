# HAG-53 — Accounts-expansion boot ensure + banquet lifecycle label

Two defects, two commits. Both were confirmed against a real MySQL before and after; nothing was taken
on trust.

- **Defect one, real:** `src/app.js:34` imported `ensureSchema` from `TransactionsModel`, a class
  instance. Destructuring a named property off an instance yields `undefined`, so the
  accounts-expansion tables were never ensured. Fixed. Commit `eaae1d7`.
- **Defect two, different from the brief:** there is no missing `POST /bookings` handler. The request
  at `test/lifecycle.test.js:1248` posts to `/api/banquet`, which is handled. Only the four `check()`
  *labels* named `/bookings`. The check always passed; the label was wrong. Fixed the labels.
  Commit `acb08ae`.

Environment: MySQL `resort_management` at 127.0.0.1:3306. Suite server on port **5091** (5002 was
left free). Clean-install proof on a throwaway database `hag53_clean_probe`, dropped and read back
empty afterwards.

## Defect one — what owns the nine tables

`AccountsExpansionModel.js` is the owner. Its `ensureSchema()` runs
`CREATE TABLE IF NOT EXISTS` for all nine, and **nothing in the tree required that file** — which is
exactly why the import could point elsewhere and break silently.

`src/app.js:34` now reads:

```js
const { ensureSchema: ensureAccountsExpansionSchema } = require("./models/AccountsExpansionModel");
```

It still runs through the same `bootstrapSchema("Accounts expansion schema init", ...)` call at
`app.js:198`; no other line in `app.js` changed. `src/config/db.js` was not opened or edited.

### Table ownership

Every entry is a `CREATE TABLE IF NOT EXISTS` inside `AccountsExpansionModel.ensureSchema()`.
`InventoryModel.js` also declares `purchase_orders` and `vendor_payment_records` — two DDL authors for
two of the nine, so those two tables would not have been fixed by booting InventoryModel alone. The
remaining seven exist only in `AccountsExpansionModel`.

| Table | Creates it | Also in |
|---|---|---|
| `account_bank_ledgers` | `AccountsExpansionModel.js` | — |
| `bank_reconciliation_matches` | `AccountsExpansionModel.js` | — |
| `payroll_records` | `AccountsExpansionModel.js` | — |
| `petty_cash_entries` | `AccountsExpansionModel.js` | — |
| `gst_return_records` | `AccountsExpansionModel.js` | — |
| `purchase_orders` | `AccountsExpansionModel.js` | `InventoryModel.js` |
| `vendor_payment_records` | `AccountsExpansionModel.js` | `InventoryModel.js` |
| `profit_center_entries` | `AccountsExpansionModel.js` | — |
| `payment_gateway_settings` | `AccountsExpansionModel.js` | — |

### Clean-install proof

Booted the **unpatched** tree against an empty database:

| | `transactions` | the nine |
|---|---|---|
| Unpatched, clean DB | EXISTS | **all 9 MISSING** |

`transactions` is what `TransactionsModel.ensureSchema` really builds — confirming the old import
silently did the wrong thing rather than throwing.

Booted the **patched** tree against a fresh empty database:

| Table | State |
|---|---|
| `purchase_orders` | EXISTS |
| `vendor_payment_records` | EXISTS |
| `petty_cash_entries` | EXISTS |
| `gst_return_records` | EXISTS |
| `profit_center_entries` | EXISTS |
| `account_bank_ledgers` | EXISTS |
| `payroll_records` | EXISTS |
| `payment_gateway_settings` | EXISTS |
| `bank_reconciliation_matches` | EXISTS |

The boot log on the patched tree shows no accounts-expansion failure line, and the patch is the only
change between the two boots. The probe database was dropped and read back as zero rows.

## Defect two — I fixed the test, and why

The brief offered two options: add `POST /bookings` as an alias, or repoint the test. Neither was
literally needed, because the test never posted to `/bookings`. Verified by grep across the whole
tree:

- `src/routes/banquetRoutes.js:98` — `GET /bookings`
- `src/routes/banquetRoutes.js:119` — `POST "/"` → `createBanquetBooking`
- `test/lifecycle.test.js:1248` — `await api("POST", "/api/banquet", ...)`
- `test/write-probe.test.js:339` — `await api("POST", "/api/banquet", ...)`
- Frontend `Maa-Baglamkhi-Resort-frontend/src/pages/Banquet.jsx:1472` — `API.post("/banquet", payload)`

Zero callers of `POST /banquet/bookings` anywhere — not the frontend, not either suite. So the route
is not a missing piece, and adding it would mean shipping a dead alias to satisfy a mis-stated label.
Only the label changed:

| Line | Was | Now |
|---|---|---|
| 1271 | `POST /api/banquet/bookings accepted` | `POST /api/banquet accepted` |
| 1319 | `PUT /api/banquet/bookings/:id accepted` | `PUT /api/banquet/:id accepted` |
| 1345 | `PUT /api/banquet/bookings/:id/refund accepted` | `PUT /api/banquet/:id/refund accepted` |
| 1364 | `PUT /api/banquet/bookings/:id/complete accepted` | `PUT /api/banquet/:id/complete accepted` |

Lines 1288, 1324 and 1335 hit `GET /api/banquet/bookings`, which is registered, so those three labels
were already correct and were left alone. The route file was not touched.

## Suite counts

Backend booted from `Maa-Baglamkhi-Resort-Backend/`, `TEST_BASE_URL=http://localhost:5091`.

| Suite | Before | After | Delta |
|---|---|---|---|
| `test:routes` | 433 pass / 0 fail / 12 skip (445 total) | 433 pass / 0 fail / 12 skip (445 total) | none |
| `test:lifecycle` | 120 pass / 0 fail | 120 pass / 0 fail | none |
| `test:writeprobe` | 50 pass / 1 fail | 50 pass / 1 fail | none |

**On the two prior claims: lifecycle was 120/0, not 109/2, and the write-probe suite does not post to
`/api/banquet/bookings`** — it posts to `/api/banquet` at `:339` and its banquet section passes. Both
checked by running the suites, not by reading them.

The single `test:writeprobe` failure is pre-existing and out of scope, identical on both runs:

```
POST /api/accounts/payroll returns an id
  got 500 {"message":"Failed to add payroll record",
           "error":"Duplicate entry '5-2026-10-01' for key 'uniq_employee_month'"}
```

That is a data collision on an existing `employees` row and month, not a code defect, and I was
bound not to modify employee rows. The banquet booking check passes after the change:

```
[Banquet lifecycle]
   PASS  POST /api/banquet accepted
   PASS  banquet booking returns a real numeric id
   PASS  booking appears in GET /api/banquet/bookings
   PASS  PUT /api/banquet/:id accepted
   PASS  PUT /api/banquet/:id/refund accepted
   PASS  PUT /api/banquet/:id/complete accepted
  PASS  Banquet lifecycle                   17 passed,  0 failed
```

## Commit contents, verified with `git show --name-only`

- `eaae1d7` — `Maa-Baglamkhi-Resort-Backend/src/app.js` (1 file, +1/−1)
- `acb08ae` — `Maa-Baglamkhi-Resort-Backend/test/lifecycle.test.js` (1 file, +4/−4)

Neither commit touches `src/config/db.js`, the five protected controllers, any fixture, or any
untracked probe script. No packages added, no data rows deleted, inserted or updated, nothing pushed.

`test/reports/api-routes.json` shows as modified after the sweep because
`test/api-routes.test.js:295` rewrites it on every run; it is regenerated output, not an edit, and
nothing reads it, so I left it unstaged as instructed.

## Open

- `purchase_orders` and `vendor_payment_records` have two DDL authors. Harmless while both files are
  idempotent, but a schema change to either would drift between them. Worth collapsing to one owner.
- The payroll writeprobe failure needs a decision from the data side, not a code fix.
