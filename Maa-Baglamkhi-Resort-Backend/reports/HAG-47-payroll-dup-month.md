# HAG-47 — Payroll write probe: `uniq_employee_month` duplicate key

## Status: VERDICT ONLY (worker-lane-b, 2026-10-24)
The actual fix is XAMPP/DB work the human does. No DB fix attempted here.

## Offending row

| Column | Value |
|---|---|
| table | `salary_payments` |
| row id | **22** |
| employee_id | 5 |
| first_name | "Write" |
| last_name | "Probe" |
| month | `2026-10-01` (DATE type; JSON shows `2026-09-30T18:30:00Z` — IST local) |
| basic_salary | 0.00 |
| status | `draft` |
| created_at | 2026-10-17 21:32:20 UTC (a prior write-probe run) |

The unique key `uniq_employee_month (employee_id, month)` on `salary_payments` fires on `Duplicate entry '5-2026-10-01'`.

## Why it fails

The write-probe POSTs to `/api/accounts/payroll` with `staffName: "Write Probe"` and **no** `payrollMonth` field. The handler (`accountsController.js:1761`) resolves `"Write Probe"` to employee_id 5 (already in `employees`). Because `payrollMonth` is undefined, the handler falls through to the default: current month (`2026-10-01`). The INSERT then collides with row 22, which already holds `employee_id=5, month='2026-10-01'` from the 2026-10-17 probe run.

Every subsequent probe run repeats the same collision: same employee, same default month, same key.

## Human's options (pick one)

**Option A — clean the probe data row:**
```sql
DELETE FROM salary_payments WHERE id = 22 AND employee_id = 5 AND month = '2026-10-01';
```
This lets the current probe run insert successfully. The next probe run will recreate the row, so the collision will return the cycle after.

**Option B (better) — make the probe month-stamped:**
Add `payrollMonth: "2099-01"` (or any future month that will never collide) to the write-probe `createBody` in `test/write-probe.test.js`. This makes the probe idempotent: it always writes a fresh `employee+month` combo that does not exist. The existing row 22 then becomes irrelevant to the gate.

## Gate state

- test:routes: 450 pass / 0 fail / 12 skip
- test:writeprobe: 50 pass / **1 fail** (this row)
- vite build: exit 0, silent
