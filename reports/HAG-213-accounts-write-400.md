# HAG-213 — `POST /api/accounts/income` and `/expense` return 400

**Status:** fixed
**File:** `Maa-Baglamkhi-Resort-Backend/src/controller/accountsController.js`
**Verified against:** live server on 127.0.0.1:5077, MySQL 127.0.0.1:3306, database `resort_management`, signed in as `admin@resort.com`. Every probe row inserted by this report was deleted afterwards.

## What was broken

`accountsController.js:449` awaited the header INSERT as a bare value and then read `.insertId` off it:

```js
const header = await query(
  `INSERT INTO transactions (transaction_no, transaction_date, description, reference_type, created_by) ...`,
  [transactionNo, entryDate, ..., createdBy || null],
);
const transactionId = header.insertId;   // undefined
```

mysql2's promise pool resolves every statement as a tuple: a write is
`[ResultSetHeader, fields]`, a read is `[rows, fields]`. So `header` was the
whole tuple and `header.insertId` was `undefined`. The two-leg INSERT into
`transaction_entries` then ran with `transaction_id = null`, and MySQL rejected
it. The header row was already committed, so the ledger was left one-sided until
the retry path cleaned it up.

## Before

```
POST /api/accounts/income
{"message":"Column 'transaction_id' cannot be null"}
HTTP 400

POST /api/accounts/expense
{"message":"Column 'transaction_id' cannot be null"}
HTTP 400
```

## After

```
POST /api/accounts/income
{"message":"Income recorded","id":148,"transaction_no":"TXN-1792275435340-520"}
HTTP 201

POST /api/accounts/expense
{"message":"Expense recorded","id":149,"transaction_no":"TXN-1792275435930-238"}
HTTP 201
```

Both postings wrote a balanced two-leg journal entry, confirmed by reading the
ledger straight from MySQL:

```
id 148  TXN-1792275435340-520  debit    Cash in Hand    500.00
id 148  TXN-1792275435340-520  credit   Other Revenue   500.00
id 149  TXN-1792275435930-238  debit    Other Expenses  125.00
id 149  TXN-1792275435930-238  credit   Cash in Hand    125.00
```

Income debits the cash/bank asset and credits revenue; expense debits the
expense account and credits cash/bank. Debits and credits match.

## The dispatched fix was not sufficient

The report asked for one missing bracket at line 453. That bracket is in, but
income still returned 400 — with a different message. Three further defects in
the same file had to go:

1. **The controller's own `query` helper was silently lying.** It wrapped
   `db.query(sql, params, callback)` in a promise. `src/config/db.js` passes the
   callback `asRows(result)`, which unwraps by `Array.isArray(result[1])`. The
   write `ResultSetHeader` sits at index 0 of the tuple, so `asRows` returns the
   header object for a write — a non-array — and for a `LIMIT 1` read it returns
   the fields array instead of the row. Every caller in this file was therefore
   one level too shallow regardless of how they destructured:

   ```
   promise form  -> tuple len 2, [0]=rows, [1]=fields      (correct)
   callback form -> [{"id":1,...}]                          (header object / fields)
   ```

   `const [rows] = await query(...)` on a callback form gave `rows` = the first
   field descriptor, so `rows.length` was the number of columns, not the number
   of rows. That is why income read 400 "Cash/bank account is not configured"
   on a `chart_of_accounts` that demonstrably contained 14 rows including code
   `1000` "Cash in Hand". `const query = async (sql, params = []) => db.query(sql, params)`
   now resolves the real tuple, so all callers index it themselves.

2. **`addPaymentGatewaySetting` returned a 500 on a successfully written row.**
   `const created = await queryOne("SELECT * FROM payment_methods WHERE id = ?", ...)`
   resolved to the field-descriptor array through the same `asRows` defect, and
   the name was lying: the handler never actually fetched a setting, it just got
   a column list. `paymentSettingToRow(created)` then threw
   "Cannot read properties of null (reading 'id')" because `created.id` was
   `undefined`. The INSERT had committed; the 500 only reported the failed
   read-back.

3. **Two call sites bypassed the helper and awaited the raw pool**, which
   returned the tuple that the callback helper does not:
   `ensureProfitAccount` (chart_of_accounts INSERT) and `createProfitEntry`
   (transactions INSERT). Both now go through `query()`.

4. **`getTransactionEntriesForHeader` passed its result straight to
   `res.json`, which serialised the tuple** — `entries` came back as
   `[[row, row], {_buf, _clientEncoding, ...}]`, i.e. the wire-format fields
   object. That also broke the update path: `GET /api/accounts/transactions/:id`
   after a PUT reported the old amount, because `entries[0]` was the second
   ledger row, not the first. It now returns `safeArray(rows)`.

## Tests

`write-probe.test.js`: **30 passed / 6 failed → 45 passed / 2 failed.**

All four accounts write-path failures are gone: income, vendor-payments,
purchase-orders and bank-ledger now return real ids; the
"PUT actually changed the amount" assertion now passes too.

`api-routes.test.js`: **210/445 routes failed → all 433 routes pass**
(0 of 445 failing; 12 skipped). Accounts: 50/50 pass. Every remaining failure
was a 4xx validation response, not a 5xx.

`lifecycle.test.js`: 109 passed / 2 failed.

The 2 remaining write-probe failures and 2 lifecycle failures are unrelated to
this work:

- `POST /api/accounts/payroll` — `Duplicate entry '5-2026-10-01' for key
  'uniq_employee_month'`. The test writes a fixed employee/month that already
  exists. A fresh month works: `{"message":"Payroll record added","id":28}` 201.
- `POST /api/banquet` — `Column count doesn't match value count at row 1`, an
  INSERT arity mismatch in the banquet controller, outside this file.

## Out of scope, not touched

The `asRows` predicate in `src/config/db.js` has the same flaw for every
callback call site repo-wide, but fixing it means changing the contract for
roughly ten thousand raw `await db.query(...)` calls across the tree. That is a
separate decision, not a bug fix, so it was left alone and this controller now
reads the tuple itself.
