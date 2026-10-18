# HAG-46 — accounts schema drift

Date: 2026-10-18
Branch: `agent/worker-re-schema-drift`
Base: `c07a779`
DB probed: `resort_management` on 127.0.0.1:3306, MariaDB 10.4.28 (XAMPP)

## What changed

- `Maa-Baglamkhi-Resort-Backend/migrations/20261018_accounts_schema_drift.sql` (new, additive, `IF NOT EXISTS`-guarded)
- `Maa-Baglamkhi-Resort-Backend/schema-v4.sql` (+171 lines appended, additive)
- `reports/HAG-46-accounts-schema-drift.md` (this file)
- No application code changed. No data row was created, updated or deleted.

## First, the mechanism, because the brief's premise needs correcting

The 8 tables do not exist "only at runtime via `AccountsExpansionModel.js`".
Nothing calls that model's `ensureSchema()`. `app.js:34` imports the symbol
`ensureAccountsExpansionSchema` from `./models/TransactionsModel`, which is a
`Transactions` class whose `ensureSchema()` creates only `transactions`
(`TransactionsModel.js:8`). `AccountsExpansionModel.js` exports an
`ensureSchema` that creates the 8 tables, and a grep for every call site of
that export across `src/` returns zero. The model is not required anywhere
either — `accountsRoutes.js:79` defines its own local `ensureAccountsSchema`,
which only `ALTER TABLE`s the `payments` columns.

So `ensureAccountsExpansionSchema` at boot was a silently wrong alias: it ran
`TransactionsModel.ensureSchema()` and returned success, which is why no one
noticed the accounts tables were never provisioned. That is not this ticket's
to fix — the correct alias is a two-line change in `app.js`, which belongs to
the accounts card owner.

What this ticket does: makes `schema-v4.sql` sufficient on its own, so the
tables exist whether or not any model runs.

## The 8 tables (9 counted, 1 more found)

All of them exist on the live db and none is in `schema-v4.sql`. All 8 have
their DDL in `src/models/AccountsExpansionModel.js:ensureSchema()`, which is
the unwired model described above.

| Table | Live rows | In schema-v4.sql | DDL defined at |
|---|---|---|---|
| `purchase_orders` | 19 | no | `AccountsExpansionModel.js:264` |
| `vendor_payment_records` | 5 | no | `AccountsExpansionModel.js:247` |
| `petty_cash_entries` | 0 | no | `AccountsExpansionModel.js:211` |
| `gst_return_records` | 0 | no | `AccountsExpansionModel.js:228` |
| `profit_center_entries` | 0 | no | `AccountsExpansionModel.js:299` |
| `account_bank_ledgers` | 0 | no | `AccountsExpansionModel.js:131` |
| `payroll_records` | 0 | no | `AccountsExpansionModel.js:281` |
| `payment_gateway_settings` | 0 | no | `AccountsExpansionModel.js:315` |

One extra table in the same gap, same model:

| Table | Live rows | DDL defined at |
|---|---|---|
| `bank_reconciliation_matches` | 0 | `AccountsExpansionModel.js:161` |

`purchase_orders` and `vendor_payment_records` are also referenced by
`InventoryModel.js` and `inventoryController.js`, which own the inventory
slice of them. The two `source_module` / `source_id` columns in the DDL after
below come from that other caller.

`accounts_transactions` is a 9th absence from `schema-v4.sql`, but it is not
in this list: it is defined in `src/models/AccountsModel.js`, not
`AccountsExpansionModel.js`, and god's brief named the 8 above.

`migrations/20261016_close_schema_drift.sql` covers none of the 9. It has 10
`CREATE TABLE IF NOT EXISTS` statements and none is an accounts table. The
file's PART C says it closes the missing-table gap and for these 9 it does
not.

## The scale of the gap

`schema-v4.sql` created 72 tables. The live db has 130. Adding the previous
migration's 10 brings a clean install to 91. The live db's other 39 tables
exist only because models have run on it. A clean install of `schema-v4.sql`
alone therefore does not produce the schema the app expects — the 9 above are
the accounts slice of that, and are what this ticket closes.

Verified by loading into a scratch database
(`DROP DATABASE hag46_schema_probe; CREATE DATABASE …; mysql … < file`):

| Step | Tables |
|---|---|
| `schema-v4.sql` as committed on `c07a779` | 72 |
| + `migrations/20261016_close_schema_drift.sql` | 91 |
| + this ticket | 91 → 101 |

## DDL before

Not in `schema-v4.sql`. Before this ticket the only definition was the one at
`AccountsExpansionModel.js`, and it is *not* the shape the live db has:

- `purchase_orders` and `vendor_payment_records` — the live tables carry
  `source_module VARCHAR(80) NULL`, `source_id INT NULL` and the composite
  index `idx_purchase_order_source` / `idx_vendor_payment_source`. The model's
  `CREATE` does not declare any of that. A clean db built from the model
  today would be missing 2 columns and 1 index each.
- `account_bank_ledgers` — the model creates 12 columns, then issues 11
  separate `ALTER TABLE … ADD COLUMN` statements to reach the live shape.
  A clean db that skipped `ensureSchema()` has only 12 columns, so
  `AccountsExpansionModel.getReconciliationLedgerMap()` fails on the first
  read: it selects `bank_account`, `payment_mode`, `amount`, `direction`,
  `match_status`, `matched_amount`, `statement_ref`, `statement_date`,
  `reconciled_at` — 9 columns that would not exist.
- The other 7 tables are identical between the model DDL and the live db.

## DDL after

The 9 tables are now in both files, matching the live column names, types,
defaults, keys and ordinal order exactly. Verified by diffing
`information_schema.columns` for each table between the live db and a db
built from `schema-v4.sql` alone — all 9 came back identical:

```
MATCH purchase_orders          MATCH profit_center_entries
MATCH vendor_payment_records   MATCH account_bank_ledgers
MATCH petty_cash_entries       MATCH payroll_records
MATCH gst_return_records       MATCH payment_gateway_settings
MATCH bank_reconciliation_matches
```

### Idempotency and no-op proof

- `schema-v4.sql` into a fresh db → exit 0, 101 tables, no error output.
- `migrations/20261018_accounts_schema_drift.sql` against that db → exit 0,
  still 101 tables, no duplicate-key errors.
- The migration file re-run twice more on the same db → exit 0, still 101.
- A second fresh db: `schema-v4.sql`, then `AccountsExpansionModel.ensureSchema()`
  executed against it → 101 tables, unchanged. The model is a no-op on a
  migrated db, which is what folding the DDL in is for.

### Guarded statements

Every statement is `CREATE TABLE IF NOT EXISTS`. There is no `DROP`, no
`ALTER`, no `MODIFY`, no `UPDATE`, no `DELETE`, no `TRUNCATE` in the
migration file. Re-running it cannot remove or alter anything.

## `accounts` — the mapping

`accounts` does not exist. `SHOW TABLES LIKE '%account%'` returns:

```
account_bank_ledgers
accounts_transactions
chart_of_accounts
```

`accounts_transactions` is not the answer, and neither is it a replacement
for `chart_of_accounts`. The live v4 ledger is three tables:

| Table | Role | Columns |
|---|---|---|
| `transactions` | one header row per posting | `id BIGINT UNSIGNED`, `transaction_no VARCHAR(80) UNIQUE`, `transaction_date DATE`, `description VARCHAR(255)`, `reference_type VARCHAR(50)`, `reference_id BIGINT UNSIGNED`, `created_by BIGINT UNSIGNED`, `created_at TIMESTAMP` |
| `transaction_entries` | the two legs of a posting | `id BIGINT UNSIGNED`, `transaction_id`, `account_id INT UNSIGNED NOT NULL`, `entry_type ENUM('debit','credit')`, `amount DECIMAL(12,2)`, `description VARCHAR(255)` |
| `chart_of_accounts` | the chart itself | the thing `account_id` points at |

Foreign keys, taken from `SHOW CREATE TABLE transaction_entries`:

```
transaction_entries_ibfk_1  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
transaction_entries_ibfk_2  FOREIGN KEY (account_id)     REFERENCES chart_of_accounts(id)
```

Live counts: `transactions` AUTO_INCREMENT 156, `transaction_entries` 38 rows,
`accounts_transactions` 4 rows and unused by any route.

So if any caller still says `FROM accounts`, it is not looking at a renamed
chart of accounts. The write path is `transactions` + `transaction_entries`,
and `transaction_entries.account_id` must resolve to a `chart_of_accounts.id`.
A literal `'income'` in `entry_type` is rejected by the database — the enum is
`('debit','credit')`.

Nothing in `src/` references a bare `accounts` table. Confirmed by grepping
`FROM accounts`, `INTO accounts`, `UPDATE accounts`, `JOIN accounts` and
`TABLE accounts` across `src/`, excluding `accounts_transactions`,
`accountsController`, `AccountsModel`, `AccountsExpansion` and
`chart_of_accounts`: zero hits. So there is no caller to remap, and no
`accounts` table is created. Adding one would have hidden that foreign key
behind a dead alias.

## Which of the 20 routes were broken

`/api/accounts` registers **50** routes, not 20:
`accountsRoutes.js` has 50 `router.get/post/put/delete` lines. The 20 in the
brief is 19 read endpoints plus 1 write, which is the shape of the smoke
test, not the surface.

Booted on 127.0.0.1:5091, logged in as `admin@resort.com` and hit every
registered route. Results before this ticket, so this is the pre-fix state:

**19 read routes — all 200.** `/`, `/summary`, `/transactions`,
`/department-summary`, `/hotel-billing`, `/restaurant-billing`,
`/extended-summary`, `/reconciliation/summary`, `/reconciliation/items`,
`/bank-ledger`, `/petty-cash`, `/gst-returns`, `/vendor-payments`,
`/purchase-orders`, `/payroll`, `/profit-centers`, `/payment-settings`,
`/payment-history`, `/transactions/:id` (200 with a real row, 404 on a
missing id — correct).

**12 write routes — all working.** `POST /income` and `POST /expense`
return 201 and write a balanced two-leg entry. `POST /bank-ledger`,
`POST /vendor-payments`, `POST /purchase-orders`, `POST /payroll`,
`POST /payment-settings` all return 201. `DELETE /bank-ledger/:id`,
`/vendor-payments/:id`, `/purchase-orders/:id`, `/payroll/:id`,
`/payment-settings/:id`, `/transactions/:id` all return 200.
`POST /reconciliation/match` and `/reconciliation/unmatch` both return 200.

**6 routes broken — and none of it is schema.** All 6 are code decisions in
`accountsController.js`, not missing tables:

| Route | Status | Message |
|---|---|---|
| `POST /petty-cash` | 501 | "Petty cash is a derived read-only view over the v4 payments table; no writable petty_cash table exists in v4." |
| `PUT /petty-cash/:id` | 501 | same |
| `DELETE /petty-cash/:id` | 501 | same |
| `POST /gst-returns` | 501 | "GST returns are derived read-only from invoices.tax_amount; no writable gst_returns table exists in v4." |
| `PUT /gst-returns/:id` | 501 | same |
| `DELETE /gst-returns/:id` | 501 | same |

These 501s are intentional and pre-date this ticket. petty_cash_entries and
gst_return_records are not empty by accident — the writes are refused on
purpose, and the read routes derive the rows from `payments` and `invoices`.
Creating those two tables would not fix the routes.

**The real latent break, which is what this ticket closes.** None of the 50
routes was returning 500. The break is at install time: a database built
from `schema-v4.sql` alone has no purchase_orders, no vendor_payment_records,
no account_bank_ledgers and no bank_reconciliation_matches, so
`GET /purchase-orders`, `GET /vendor-payments`, `GET /bank-ledger`,
`POST /reconciliation/match` and `/reconciliation/summary` would each fail
with `ER_NO_SUCH_TABLE (1146)` — unless the model's `ensureSchema()` had
already run on that database. That is why the live db had 130 tables and why
the drift was invisible: the model was silently rescuing the schema on every
boot.

Also verified, both mounts god said depend on this card:
`GET /api/dashboard`, `/api/dashboard/metrics`, `/api/dashboard/charts` → 200
with real numbers. `GET /api/room-service/rooms`, `/menu`, `/order/:room`,
`/order-items/:orderId` → 200. `/api/room-service/bill/101` → 404
"No pending order", which is a data condition, not a defect.

## Things this ticket does not do

- Does not create `accounts`. See the mapping above.
- Does not create `accounts_transactions`. Different model, different owner.
- Does not close the other 48 live-only tables. `schema-v4.sql` now has 81 of
  the live 130. The rest are owned by other models' `ensureSchema()` calls and
  are out of scope for an accounts card.
- Does not fix the 6 petty-cash and GST write routes. They are deliberately
  read-only by design and are a code question for the accounts card owner.
- Does not touch `20261016_close_schema_drift.sql`. Its PART C says it closes
  the missing-table gap and it does not cover any accounts table. Renaming it
  would rewrite another owner's file.
- Did not start MySQL, did not drop a live database, and did not modify a
  single row in `resort_management`. Probe rows were cleaned up: transactions
  159 and 160 deleted through `DELETE /transactions/:id` with their legs
  cascading, and a petty_cash probe row inserted and deleted in the same
  statement. `SELECT … FROM transaction_entries LEFT JOIN transactions WHERE
  header IS NULL` returns 0 orphan legs. Scratch databases `hag46_schema_probe`
  and `hag46_model_probe` are live and are the reproducers for the numbers in
  this report.

## Open: 10 accounts read routes are structurally wrong on a clean db

Probed after this ticket on a fresh database built from `schema-v4.sql`
alone (scratch `hag46_schema_probe`). These routes pass a real row id into a
join on a table that is not in `schema-v4.sql`, so on a clean install they
return either empty or 500:

| Route | Depends on | Behaviour on a clean db |
|---|---|---|
| `GET /hotel-billing` | `hotel_folio_entries` (absent from `schema-v4.sql`) | `LEFT JOIN` → every row comes back with null booking fields |
| `GET /restaurant-billing` | `restaurant_bills` | `LEFT JOIN` → null table fields |
| `GET /payment-history` | `hotel_folio_entries`, `restaurant_bills` | same |
| `GET /summary`, `GET /` | `invoices`, `payments` | works — both are in `schema-v4.sql` |
| `GET /extended-summary` | `petty_cash_entries`, `gst_return_records`, `vendor_payment_records`, `purchase_orders`, `payroll_records`, `profit_center_entries`, `account_bank_ledgers` | works now — this ticket added all 7 |
| `GET /reconciliation/summary`, `GET /reconciliation/items` | `invoices`, `restaurant_bills`, `banquet_bookings`, `vendor_payment_records`, `account_bank_ledgers` | `restaurant_bills` is the remaining gap |
| `GET /department-summary` | `transaction_entries`, `chart_of_accounts` | works |
| `POST /settle-pending-bill` | `invoices`, `bills`, `payment_methods` | works |

`restaurant_bills`, `hotel_folio_entries` and `hotel_room_blocks` are not in
`schema-v4.sql` and not owned by the accounts card. `20261016_close_schema_drift.sql`
does create a `restaurant_bills` stub, but only those 6 columns
(`id`, `table_number`, `subtotal`, `tax_amount`, `total`, `status`), so a db
built from both migrations still cannot serve `/restaurant-billing` correctly.
