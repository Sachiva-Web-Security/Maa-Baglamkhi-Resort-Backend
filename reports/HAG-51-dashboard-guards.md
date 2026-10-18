# HAG-51 — Dashboard schema guards: dead guards, and the guest_profiles leg

**Repo:** `Maa-Baglamkhi-Resort-Backend`
**File:** `src/controller/dashboardController.js`
**Commit:** `b1ae969d49de723e6688f4e08c96b5bd614f2343` on main (unpushed)
**Result:** controller 29 insertions, 16 deletions. Endpoint output unchanged.

---

## 1. The three guards, before and after

### `tableExists`

Before:

```js
const tableExists = async (tableName) => {
  const [rows] = await db.query("SHOW TABLES LIKE ?", [tableName]);
  return Array.isArray(rows) && rows.length > 0;
};
```

After:

```js
const tableExists = async (tableName) => {
  // information_schema, not SHOW: mysql2's query() returns SHOW output as two
  // result sets, so `rows` here is an array of result sets and rows.length is
  // the number of sets — 2 whether the table exists or not. Every tableExists
  // call went permanently true for every table.
  const [rows] = await db.query(
    "SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1",
    [tableName],
  );
  return Array.isArray(rows) && rows.length > 0;
};
```

### `columnExists`

Before:

```js
const columnExists = async (tableName, columnName) => {
  const [rows] = await db.query(`SHOW COLUMNS FROM ${tableName} LIKE ?`, [columnName]);
  return Array.isArray(rows) && rows.length > 0;
};
```

After:

```js
const columnExists = async (tableName, columnName) => {
  // information_schema, not SHOW COLUMNS: SHOW returns two result sets too, so
  // the tuple destructure handed us an array of sets and the length check was
  // true even when the column was missing.
  const [rows] = await db.query(
    "SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1",
    [tableName, columnName],
  );
  return Array.isArray(rows) && rows.length > 0;
};
```

### `detectDateColumn` (the third SHOW probe)

Before:

```js
const detectDateColumn = async (table, candidates) => {
  for (const col of candidates) {
    const [rows] = await db.query(
      `SHOW COLUMNS FROM ${table} WHERE Field = ?`,
      [col]
    );
    if (Array.isArray(rows) && rows.length > 0) return col;
  }
  return null;
};
```

After — one query instead of one per candidate:

```js
const detectDateColumn = async (table, candidates) => {
  const [rows] = await db.query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ?",
    [table],
  );
  const present = new Set((Array.isArray(rows) ? rows : []).map((row) => row.column_name));
  for (const col of candidates) {
    if (present.has(col)) return col;
  }
  return null;
};
```

The three helpers keep their names and signatures. No call site changed. The table name stays a bound parameter everywhere — no string interpolation.

---

## 2. What the guards actually did

The dispatch described `SHOW ... LIKE ?` as throwing `ER_PARSE_ERROR`. It does not
on this server — that error is specific to the sibling file's earlier state. Here,
`SHOW TABLES LIKE ?` and `SHOW COLUMNS FROM t LIKE ?` both execute. Probe against
`resort_management` on 127.0.0.1:3306:

```
SHOW TABLES LIKE 'invoices'                -> outer.length 2, [0] = [{Tables_in_...: 'invoices'}]
SHOW TABLES LIKE 'definitely_not_a_table'  -> outer.length 2, [0] = []
SHOW COLUMNS FROM invoices LIKE 'check_in' -> outer.length 2, [0] = [{Field:'check_in',...}]
SHOW COLUMNS FROM invoices LIKE 'totl_amout' -> outer.length 2, [0] = []
SHOW COLUMNS FROM invoices WHERE Field='no_such_column' -> outer.length 2, [0] = []
SHOW COLUMNS FROM missing_table LIKE 'x'   -> throws ER_NO_SUCH_TABLE
```

So `rows.length` here is **the number of result sets**, always 2, not the number of
matching rows. Read against the real code:

| guard | behaviour with SHOW |
|---|---|
| `tableExists` | correctly true when the table exists; **also true when it does not** (0 rows, 2 sets) |
| `columnExists` | correctly true when the column exists; **also true when it does not** (0 rows, 2 sets) |
| `detectDateColumn` | **always returns the first candidate**, `created_at` — the loop body never reaches the `return null` fallback |
| `detectDateColumn` on a missing table | **throws `ER_NO_SUCH_TABLE`** — an unguarded exception, not a false |

The dispatch's conclusion that the guards "filter nothing" was right; the mechanism
was not what it named. `tableExists` and `columnExists` return true for both
existing and missing objects. `detectDateColumn` never returns null at all.

### Concrete latent failures on the current schema

Two are reachable today with no data change:

1. **`detectDateColumn("invoices", ...)` returns `created_at` unconditionally.**
   Delete `invoices.created_at` and the endpoint keeps querying it — it never falls
   through to `bill_date`. Same shape for every candidate table.
2. **`resolveBillSource` selects `bills.date`, a column that does not exist.**
   `bills` has `created_at` and `total` but no `date`; if `created_at` were ever
   absent the guard says "true", the branch keeps `created_at`, and the count query
   falls back to `date` and throws `ER_BAD_FIELD_ERROR`. On this schema the branch
   happens to choose `created_at`, so it does not fire — but it fires on the next
   migration that removes `created_at`.

Neither is visible in the output, because neither object has actually gone missing.
That is why the endpoint still agrees with the six-source SQL check.

---

## 3. The guest + room_tariff leg (second defect)

Before:

```js
if (await tableExists("guests") && await tableExists("room_tariff")) {
  const hasCheckIn = await columnExists("guests", "check_in");
  const hasCheckInDate = await columnExists("guests", "check_in_date");

  if (hasCheckIn) { ... DATE(g.check_in) ... }
  else if (hasCheckInDate) { ... DATE(g.check_in_date) ... }
}
```

After:

```js
// 4. Hotel bookings with check-in today (room revenue for today). The
// booking row carries check_in; guest_profiles is an identity table with no
// booking dates, so a direct join is not an option.
if (await tableExists("bookings") && await tableExists("room_tariff")) {
  if (await columnExists("bookings", "check_in")) {
    ... DATE(g.check_in) ...
  } else if (await columnExists("bookings", "check_in_date")) {
    ... DATE(g.check_in_date) ...
  }
}
```

### Before / after contribution of the leg

| | value |
|---|---|
| legacy shape (`guests` + `check_in_date`) | **0.00** |
| fixed shape (`bookings` + `check_in`) | **0.00** |

The leg is zero either way, for three independent reasons measured against the live
DB:

- `guests` has 0 rows.
- `room_tariff` has 0 rows — this is also why `totalRevenueGenerated` leg 2
  contributes 0, and why that figure (3655) sits below todayRevenue (4105).
- 0 `room_tariff` rows have no `guest_profiles` match, so the table choice cannot
  change the sum.

### Renaming to `guest_profiles` as dispatched breaks the endpoint

The dispatch asked for the table name to be fixed to `guest_profiles`. Taken
literally, that throws:

```
SELECT ... FROM guest_profiles gp INNER JOIN room_tariff rt ON rt.booking_id = gp.id
WHERE DATE(gp.check_in_date) = CURDATE() ...
-> ER_BAD_FIELD_ERROR Unknown column 'gp.check_in_date' in 'where clause'
```

`guest_profiles` is an identity table. Its actual columns are
`id, first_name, last_name, email, phone, alternate_phone, date_of_birth, gender,
nationality, id_type, id_number, address_line1, address_line2, city, state, country,
pincode, preferences, is_vip, total_stays, total_spend, last_stay_date, created_at,
updated_at`. No `check_in`, no `check_in_date`, no `booking_id`. 71 rows.

Note the legacy guard hid this: `columnExists("guests", "check_in")` returns true
(false positive — see section 2), so the code takes the `check_in` branch and never
reaches the `check_in_date` one. The rename only becomes fatal once the guard is
honest, which is exactly the point of this change.

`bookings` is the correct source. It has `check_in` (77 rows), it is already the
source for leg 3 via `getMonthlyRevenueChart`, and `room_tariff.booking_id` joins to
it. If `bookings` were absent the `check_in` guard returns false and the leg
contributes 0, instead of throwing.

No data was written or updated. No row ids affected.

---

## 4. Endpoint values, before and after

Endpoint: `GET /api/dashboard/metrics` (also mounted at `GET /api/dashboard/`),
authenticated as `admin@resort.com`. Backend run on a spare port, the other
agent listeners untouched.

The database is shared and being written to concurrently — `todayRevenue` read 2105
at the start of this task and 4105 later. A lone before/after pair across a
commit is therefore not a valid comparison. Comparison below is paired: original
code and fixed code each run three times, back-to-back, against the same port and
the same DB state, three runs apart.

### `GET /api/dashboard/metrics`

| | original | fixed |
|---|---|---|
| todayRevenue | 4105 | 4105 |
| totalRevenueGenerated | 3655 | 3655 |
| totalRooms | 3 | 3 |
| occupiedRooms | 2 | 2 |
| expectedArrivals | 8 | 8 |
| expectedCheckouts | 0 | 0 |
| todayCheckins | 0 | 0 |

Six of six runs identical. The earlier 2105 reading is the same code at an earlier
DB state, not a before/after delta. Server log clean — no `Error fetching
dashboard metrics`.

### `GET /api/dashboard/charts`

Identical, both versions: `monthlyRevenue` all zeroes except Oct `Offline: 80`;
`roomOccupancy` 2/1/0/0; `foodSales` 0 across 12–18 Oct except Sat `80`.

### Leg breakdown (todayRevenue, at the 2105 DB state)

| leg | value |
|---|---|
| 1 invoices `total_amount` today | 425 |
| 2 bills `total` today (source `bills`; `restaurant_bills` had 0 rows today) | 80 |
| 3 banquet rate × hours | 1150 |
| 4 guest/booking + room_tariff | 0 |
| 5 accounts_transactions income | 350 |
| 6 payment_history unpaired | 100 |
| **sum** | **2105** — matches the endpoint |

---

## 5. Guardrail checks

- `node --check src/controller/dashboardController.js` — pass.
- `npm run test:routes` — 433 pass, 0 fail, 12 skip, 445 total.
- `npm run test:lifecycle` — 120 pass, 0 fail.
- `npm run test:writeprobe` — 50 pass, 1 fail:
  `POST /api/accounts/payroll` → 500
  `Duplicate entry '5-2026-10-01' for key 'uniq_employee_month'`.
  That endpoint is payroll, untouched here; the duplicate is from another agent's
  in-flight accounts work.
- No npm packages added. No untracked files deleted. No data rows written or
  updated. Nothing pushed.
