# HAG-42 — Frontend failure states, hotel-core slice (my 10 files)

Checked 2026-10-18 ~18:00 UTC against the live backend `127.0.0.1:5002` through the real Vite dev
server `127.0.0.1:5173`, at main `8d1d5a0`.

## Verdict

Confirmed the golden path and the error path on all 10 screens. Found **4 real failure-state bugs,
all fixed** — 27 lines added across 5 files. Rebuilt green after the change.

My 10 files: `Hotel.jsx`, `Dashboard.jsx`, `ManagerDashboard.jsx`, `LiveBoard.jsx`,
`ReceptionDashboard.jsx`, `Reports.jsx`, `Attendance.jsx`, `MyAttendance.jsx`, `Assignments.jsx`,
`AuditLogs.jsx`.

## The four fixes

**1. `Reports.jsx:574` — stale summary cards after an out-of-band logout.** `fetchSummary` was the
only fetch in the page without an unmount guard. Any re-render of the report type re-ran `fetchData`
but never re-fetched the summary, and if the request settled after the user signed out (the 401
interceptor in `api.js` clears the token and redirects), the page kept showing six summary cards
computed from a session that no longer exists. Added the `active` flag and a `setSummary(null)` on
failure so the cards drop out instead of going stale.

**2. `LiveBoard.jsx:72` — a failed poll silently looked like an empty floor.** The catch did
`setOrders([])`, so a rejected `/waiter/live-board` rendered "No active orders — All tables and
rooms are available" while the 5-second interval kept burning. That is the textbook silent-empty
state. Now keeps the last good orders and records the error; the banner only appears when the list
is actually empty, so a partial outage never hides live data.

**3. `Attendance.jsx:57` — a failed load left the previous date's grid in place.** The catch only
`console.error`ed, so `employees` kept whatever the last date held. On the admin screen every
stat card (Total / Present / Absent / Paid Today) then reported yesterday's numbers for today's
date. Now clears the rows and raises a banner carrying the server message.

**4. `Hotel.jsx:320` — "Last updated" lied on failure.** `setLastUpdated` ran before the
`Promise.all`, so when `/hotel/rooms/setup`, `/hotel/all-bookings` or `/users` threw the header
still showed "just now". Now resets to `null`, which renders "—" as before the first successful load.

Also, `AuditLogs.jsx` already computed an error string and rendered it — but only at the pagination
footer, below the fold, while the table itself said "No audit logs found." Both the desktop table
and the mobile cards now lead with the error text.

## Not broken — checked and left alone

- **Spinner locks: none.** Every `setX(true)` in my 10 files has a `setX(false)` in a `finally` on
  the same function: 21 flags total (`Dashboard` 2, `ManagerDashboard` 1, `LiveBoard` 2,
  `ReceptionDashboard` 1, `Reports` 1, `Attendance` 1, `MyAttendance` 3, `Assignments` 2,
  `AuditLogs` 1, `Hotel` 6). `Hotel.jsx:364` resets `paymentsLoading` before it is set, so a failed
  payment fetch never stranding it either.
- **No swallowed catches.** One bare `catch {}` in the slice, `AuditLogs.jsx:85`, and it is a
  `JSON.parse` fallback inside `formatJson`. Every other catch logs and either surfaces a message or
  falls back to a safe value.
- **`ManagerDashboard`, `ReceptionDashboard`, `Reports` already had the right pattern** —
  `Promise.allSettled` with per-source fallback plus an error banner shown only when the primary
  sources all fail. `ReceptionDashboard.jsx:169` feeds its error into the shared role-dashboard
  shell, which renders it at `ReceptionDashboardLayout.jsx:369`.
- **`Attendance.jsx` roster merging is correct, not a silent empty state.** The grid joins
  `GET /attendance` onto `GET /attendance/employees`, so an employee who was never marked still
  shows a row with no status — absentees are visible instead of missing. `unmarkedStaff` counts
  them.
- **`Assignments.jsx` and `MyAttendance.jsx` write errors surface** via `window.alert` with the
  server message; both clear `saving` / `marking` in `finally`.
- **`Dashboard.jsx` initial load toasts on failure** (`Dashboard.jsx:259`) and its three write
  handlers (`assigningCleaning`, `handleBlockedRoom`, `handleBookingLifecycle`) each toast a
  distinct failure. The 30-second silent refresh at `:275` logs only — intentional, since a visible
  toast on every silent tick would be noise, and the page is unchanged from the last good render.

## Live verification

Logged in as `admin@resort.com` / `password` through the real proxy path `POST /api/auth/login` on
`:5173`, then hit all 21 endpoints my 10 files read — all `200` with payloads:

`/dashboard/metrics` {10} · `/dashboard` {10} · `/hotel/all-bookings` [21] · `/hotel/rooms/setup`
[7] · `/hotel/booking-history` [4] · `/hotel/room-blocks` [2] · `/hotel/payment-history/1` [27] ·
`/housekeeping` [5] · `/housekeeping/notifications` [20] · `/users` [75] · `/assignments` [1] ·
`/assignments/stats` {5} · `/attendance` [19] · `/attendance/employees` [34] · `/attendance/me`
[0] · `/attendance/me/salary` {10} · `/audit-logs` [75665] · `/reports/summary` {6} ·
`/inventory` [1] · `/banquet` {3} · `/waiter/live-board` [23]

The four report source endpoints behind the table also return 200:
`/accounts/hotel-billing`, `/accounts/restaurant-billing`, `/accounts/transactions`,
`/attendance/report`. No endpoint in my slice is missing — all 21 are present and `PASS` in
`Maa-Baglamkhi-Resort-Backend/test/reports/api-routes.json`.

Unauthenticated control: `GET /api/assignments` without a token returns
`401 {"message":"No token provided"}`, so a read does reject when there is no session and `api.js`
would redirect. Every request here went out with the header as a single argument, so the status
codes are trustworthy.

**Rendered-screen caveat.** No browser automation is available on this floor, so nothing was driven
in a real browser. The dev server serves each changed file as a transformed module, so the source
above is byte-identical to what ships; the fix behaviour rests on source reading plus the live
payloads above.

## Build health (HAG-35)

`./node_modules/.bin/vite build --logLevel error` from `Maa-Baglamkhi-Resort-frontend`:

- at `0a34883` (the commit god named): zero output, exit 0
- at `8d1d5a0` (current main, after the sidebar fix landed): zero output, exit 0
- at `8d1d5a0` with my 4 fixes applied: zero output, exit 0

The build is healthy and my edits do not regress it.

`eslint --quiet` on the 5 files I touched reports 12 `no-unused-vars` errors, all pre-existing and
none on a line I changed (`Hotel.jsx` 60, 152, 223×2, 282, 283, 287×2, 314, 497; `LiveBoard.jsx` 66,
135). Zero in `Reports.jsx`, `Attendance.jsx` or `AuditLogs.jsx`.

## Remaining gaps — not fixed, need a decision

1. **`GET /api/assignments` ignores its filters.** `?role=staff&name=`, `?role=manager&name=` and a
   bare call all return the identical full set. `ReceptionDashboard` and `Assignments` both pass
   `role` and `name`, so every role sees every assignment. Backend defect, not mine.
2. **`GET /api/reports/data` returns `400 {"message":"Report type required"}`** — bare and with
   `?reportType=room`. Nothing in my 10 files calls it (`Reports.jsx` builds its rows from the four
   accounts/attendance endpoints instead), so this is a dead or mis-parameterised backend route.
3. **`/audit-logs` returns 75,665 rows in one response.** The page filters and paginates
   client-side with a comment acknowledging the endpoint ignores `page`/`limit`/`search`. That is
   the whole table over the wire on every visit; worth bounding at the backend.

## Disclosure

- All writes during this check were read-only GETs. No data rows touched, no database writes.
- Probe scripts ran from `$TMPDIR` and are deleted. None left in the repo.
- Not committed, not pushed — `git status` still shows other engineers' uncommitted accounts edits
  and the usual unowned debris.
- Servers not restarted.
