# HAG-47 — POST /api/employees half-create

Backend: `Maa-Baglamkhi-Resort-Backend/src/controller/employeeController.js`
Probe date: 2026-10-18, MySQL 127.0.0.1:3306 / `resort_management` verified up (`SELECT 1` succeeded).
`src/config/db.js` was not opened.

## Root error

The employees INSERT does not raise a database error. It runs with the wrong
value count, and MySQL rejects it:

```
ER_WRONG_VALUE_COUNT_ON_ROW  errno 1136  sqlState 21S01
Column count doesn't match value count at row 1
```

Cause: `createUserRecord` called `await nextEmployeeCode()` inside the params
array. That expression returns the whole `[rows, fields]` tuple from a SELECT,
not the string. So the row went out as 9 placeholders against 8 values.

`createUserRecord` did not `await` that statement, either — the array was built
eagerly, so the rejected promise never reached the `try/catch` in
`createEmployee`. The function resolved normally and the caller read the
employees table back empty, then returned the fallback
`employee: { id: users.id, name }` with HTTP 201.

Second, independent reason a 201 could be wrong: `const [result] = await
db.query(users INSERT)` followed by `result.insertId` is always `undefined` for
a pool write. A write resolves to `[header, undefined]`, so `userId` was
`undefined` and the employees INSERT would have received `user_id: undefined`,
which MySQL coerces to `null`. That is accepted — `user_id` is nullable — and
produces an account the payroll and attendance modules can never find.

Two facts verified by probe, not read off a grep:

| statement | result on the pool |
|---|---|
| `SELECT 1` | `[ [rows], [fields] ]` |
| `INSERT` (pool) | `[ header, undefined ]` — `insertId` at `[0]` |
| `INSERT` (single connection, raw mysql2) | bare `header` — `insertId` at top level |

`const [result] = ...; result.insertId` is wrong on the pool but happens to be
right on a raw connection, which is why the bug is invisible when the same code
is tested with a probe script.

## What the endpoint does now

`createUserRecordTx` runs both INSERTs on one connection inside one transaction,
reads each header with `const [header] = await connection.query(...)`, and
fails loudly if either header is missing. `createEmployee` commits, then reads
back through `LIST_QUERY`; if the read-back is empty it throws
`ER_NO_EMPLOYEE_ROW`. Any throw rolls back and returns 500 with the real error
code. `connection.release()` is in `finally`, so a failed request no longer
leaks a pooled connection.

The `{ id: userId, name }` fallback is gone. A 201 now always means a users row
and an employees row both exist.

Observed on the live DB through a throwaway express server on port 5417:

- valid payload → `201`, `user_id: 149`, `employee_id: 142`, code `EMP-94309`
- `department_id: 99999` → `500`, code `ER_NO_REFERENCED_ROW_2`
  (`employees_ibfk_2` → `departments.id`). `users` delta 0, employees delta 0 —
  the users row was rolled back.
- `employee_code` collision, driven at the DB level → `ER_DUP_ENTRY`, errno
  1062, `Duplicate entry 'EMP-94312' for key 'employee_code'`. `users` delta 0
  after rollback.

## resolveEmployee

The function itself was already strict — it returns `null` when no employees row
matches either `id` or `user_id`. The looseness was at the call site:
`employeeId = (await resolveEmployee(employeeId)) || employeeId` silently
swallowed the `null` and kept using the raw `users.id`, which then became
`salary_payments.employee_id`.

`createPayment` now calls `requireEmployeeRow` (added next to `resolveEmployee`,
which keeps its contract for `estimateSalary` and its tests). No employees row
→ `404`, no payment written. Verified with `user_id: 7`, a users row with no
employees row: `404` instead of a draft payment for a non-employee. `user_id:
151` and `employee_id: 144` still resolve and create `201`.

`estimateSalary` was left alone: it already 404s when the lookup misses, so it
never fell through to a bare users.id.

## Orphan rows observed

`users` without an employees row: **54**.

ids: 7–45, 88, 94, 104, 105, 106, 113, 114, 124, 125, 126, 127, 128, 129, 130, 131

Employees rows with `user_id IS NULL`: **11** (ids 1, 111, 113, 114, 124, 125,
126, 127, 128, 129, 140). Those are unlinked rows, not orphans — the user side
is absent, so a join will never surface them.

Table totals at probe end: `users` 74, `employees` 31.

Nothing was deleted or updated. The 4 employees rows and 4 users rows my probes
created (employees 142, 144, 145, 146 → users 149, 151, 152, 153) were
deactivated through `DELETE /api/employees/:id`, and probe salary payment 31 was
cancelled through the payroll PATCH. Those are `is_active = 0` /
`status = 'inactive'` / `status = 'cancelled'` rows that god may drop if wanted.

## Files

- `Maa-Baglamkhi-Resort-Backend/src/controller/employeeController.js` — +73 / -33
- `Maa-Baglamkhi-Resort-Backend/src/controller/payrollController.js` — +23 / -3

Both pass `node --check`.
