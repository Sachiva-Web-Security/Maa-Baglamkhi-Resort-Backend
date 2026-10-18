# HAG-210 — 500 on POST /api/token/create

**Verdict: not reproducible on main. The defect is already fixed in the tree. No controller change was made, and the controller is unchanged by this run.**

Tested against the live `resort_management` database at 127.0.0.1:3306 (`SELECT 1` OK), `NODE_ENV=production`, admin login `admin@resort.com`, spare port (50312), sandbox disabled. HEAD at the time of the run: `50867ac` (main), which contains `acdb5d5`.

## 1. The reported 500 is not in the source

The reported failure was `errno 1265` writing the literal `closed` into `tokens.status`. It cannot come from the current code:

- `src/controller/tokenController.js:15` `TOKEN_OPEN_STATUS = "active"`
- `src/controller/tokenController.js:16` `TOKEN_CLOSED_STATUS = "completed"`
- `src/controller/tokenController.js:66` `UPDATE tokens SET status = ? WHERE id = ? AND status = ?` with `[TOKEN_CLOSED_STATUS, activeToken.id, TOKEN_OPEN_STATUS]`
- `src/controller/tokenController.js:200` `UPDATE tokens SET status = ? WHERE table_number = ? AND status = ?` with `[TOKEN_CLOSED_STATUS, table, TOKEN_OPEN_STATUS]`

`grep -rn "token_code" src/` confirms `tokenController.js:73` is the only INSERT into `tokens` on the live route; the model layer (`src/models/TokenModel.js`, `src/models/TokensModel.js`) defines no route, and `src/routes/tokenRoutes.js:10` mounts `controller.createToken` for `POST /create`. No code path in the tree writes `closed`.

## 2. Reproduction — back to back creates, same table

Second call, exact status and body:

```
POST /api/token/create  {"tableNumber":"__HAG210MVD4LOQ7_TBL","waiter":"Probe"}
  call 1  status=200  body={"message":"Token created","tokenId":20,"tokenCode":"VIS-20261018-SC0R66","existing":false}
  call 2  status=200  body={"message":"Token already active","tokenId":20,"tokenCode":"VIS-20261018-SC0R66","existing":true}
```

No `err.code`, no `err.sqlMessage`, no 500. The second call returns the same token id with `existing: true`.

The UPDATE branch is the one that historically produced the 1265, so it was exercised directly rather than reasoned about. A bill was inserted and marked `paid` against the active token, which makes `createToken` take the paid path: mark the old token `completed`, then INSERT a new one.

```
INSERT INTO bills (token_id, table_number, total, payment_status) VALUES (20, '__HAG210MVD4LOQ7_TBL', 0, 'paid')   -- bill id 114
POST /api/token/create  status=200  body={"message":"Token created","tokenId":21,"tokenCode":"VIS-20261018-SWLHJ6","existing":false}
```

Read back from the database after that call:

```
{"id":20,"token_code":"VIS-20261018-SC0R66","table_number":"__HAG210MVD4LOQ7_TBL","waiter_name":"Probe","status":"completed"}
{"id":21,"token_code":"VIS-20261018-SWLHJ6","table_number":"__HAG210MVD4LOQ7_TBL","waiter_name":"Probe","status":"active"}
```

The UPDATE wrote `completed` — a valid enum value. Both calls after it returned 2xx.

## 3. The candidate causes named in the brief, checked individually

- **UNIQUE key on `token_code`** — real and reachable, but `buildTokenCode()` cannot hit it in practice: `VIS-` + `YYYYMMDD` + 6 chars from `Math.random().toString(36)`, `varchar(40) NOT NULL UNIQUE`. A literal duplicate collides as expected: `{"code":"ER_DUP_ENTRY","errno":1062,"sqlMessage":"Duplicate entry 'HAG210-DUP-CODE' for key 'token_code'"}`. Nothing in the reported errno 1265 matches this; 1062 is a different error.
- **UNIQUE on `table_number` + `waiter_name`** — no such key exists. Live DDL has only `PRIMARY KEY (id)`, `UNIQUE KEY token_code`, `KEY idx_code`, `KEY idx_status`, `KEY idx_table`.
- **NOT NULL column receiving `undefined`** — every column the INSERT omits is nullable in the live table: `table_id`, `table_number`, `waiter_id`, `waiter_name`, `status` (defaults `'active'`), `created_at`, `updated_at` (default `current_timestamp`). Only `id` (auto) and `token_code` (supplied) are `NOT NULL`, and both are populated.
- **Foreign key to `restaurant_tables`** — the INSERT does not set `table_id`, so `tokens_ibfk_1` is never evaluated on this path. `waiter_id` is not constrained at all.
- **The INSERT at line 73 failing while the earlier UPDATE is reported** — both statements executed and both read back correct; there is no error-reporting mix-up to find.

## 4. Before / after

Nothing to diff. The second call before and after this run is the same 200 above, because no controller code was touched. `git status` for `src/controller/tokenController.js` is clean at `50867ac`.

`node test/token-create-regression.test.js` (the file `acdb5d5` added) passes 12/12 against the live database, including both consecutive creates, the close, and the close-before-reopen.

## 5. Conclusion

The 500 was fixed before `acdb5d5` — the status literals and the enum were made to agree earlier and are correct now. `acdb5d5` added a test that passes because the code it tests was already right, not because it made the code right. Card HAG-210 can be closed on the evidence above rather than on a second controller edit; there is no bug left in the tree to fix.

Any 500 still seen in production came from a build or database state that predates these literals. Worth checking where the app runs `schema-v4.sql` against, and whether the deployed revision matches main — `errno 1265` on `closed` means an older controller paired with a strict-mode database.

## Probe data

All rows created and removed by this run, deleted by id:

- `tokens` id 18 (`__HAG210MVD49ZIO_TBL`, leftover from a crashed probe run)
- `tokens` id 19 (`__HAG210MVD4E2UB_TBL`, leftover from a crashed probe run)
- `tokens` id 20, `tokens` id 21, `tokens` id 22 (the run that completed)
- `bills` id 114

Final check returned zero matching rows in `tokens` and zero in `bills`. Nothing else was added, deleted or updated. The probe script is at `Maa-Baglamkhi-Resort-Backend/_hag210-probe.js` (untracked, alongside the existing `_god-probe-*` files).
