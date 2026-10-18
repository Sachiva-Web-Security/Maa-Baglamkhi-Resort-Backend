# HAG-59 orphan dashboards — nav links

Date: 2026-10-18
Base: `main` at `0a34883`
Changed file: `src/components/Sidebar/Sidebar.jsx` (the one file that renders nav)

## Headline

`/kitchen-dashboard` and `/restaurant-dashboard` are reachable from the sidebar now.
A `kitchen` user and a `waiter` user each get a first item in their **Operations**
section that opens their own dashboard. No other file needed changing: `Sidebar.jsx`
is the only component in `src/` that renders nav entries — `Header.jsx` has no `route:`
items, and a grep for `restaurant-dashboard` / `kitchen-dashboard` across `src/` hits
only `src/App.jsx` (the route) and `src/utils/roleHome.js` (the role→home map).

## Nav entries added

| Role | New entry | Path | Section |
|---|---|---|---|
| kitchen | Kitchen Dashboard | `/kitchen-dashboard` | Operations |
| waiter | Restaurant Dashboard | `/restaurant-dashboard` | Operations |

Each is the first item in its role's menu, so it is the top entry a user sees. Both
reuse the existing icons (`FaFire`, `FaUtensils`) already imported and already used on
neighbouring items — no new imports, no new classes.

## The duplication I had to avoid

The sidebar builds its item list as a hard-coded head entry followed by the role menu:

```jsx
const menuItems = [
  { id: 1, name: "Dashboard", icon: FaHome, path: dashboardPath },   // getRoleHome(role)
  ...(roleMenuMap[role] || []).map(...),
];
```

`dashboardPath` is `getRoleHome(role)`, which is already `/kitchen-dashboard` for a
kitchen user and `/restaurant-dashboard` for a waiter. So a `kitchen` or `waiter` user
**already** had a Dashboard link pointing at these two routes — a second entry in the
menu would have rendered the same page twice, and the longest-prefix `activeNavId`
winner would have kept only the head item highlighted while the new button sat
unlit.

Adding the new items naively would also have created a genuine defect for `chef`:
`menuItems` prepends a head entry unconditionally, and the chef's `getRoleHome` is
`/chef-dashboard`, so a chef was already seeing a Dashboard button to it — plus the
commented-out `{ id: "601c", name: "Chef Dashboard", ... }` block shows someone else
had the same idea. One more link would have made it a duplicate.

So the head entry is now conditional:

```jsx
const roleMenusOwnHome = roleMenuItems.some((item) => item.path === dashboardPath);
const menuItems = [
  ...(roleMenusOwnHome ? [] : [{ id: 1, name: "Dashboard", icon: FaHome, path: dashboardPath }]),
  ...roleMenuItems,
];
```

A role whose menu already covers its own home loses the redundant head entry; every
other role keeps it unchanged. The `badgeCount` map, which was previously applied
inside the `menuItems` literal, was lifted into `roleMenuItems` so it still reaches the
final list, and the `useMemo` dependency array became `[roleMenuItems, dashboardPath]`
since the `roleMenuMap` literal it derived from is rebuilt every render and is not a
stable dependency.

## Screen showing them

Rendered nav per role, derived from the actual final `menuItems` array:

```
kitchen   head=(none)                              total=5   dupes=none
waiter    head=(none)                              total=4   dupes=none
admin     head=Dashboard->/dashboard              total=22  dupes=none
manager   head=Dashboard->/manager-dashboard      total=15  dupes=none
receptionist head=Dashboard->/reception-dashboard total=11  dupes=none
housekeeping head=Dashboard->/housekeeping-dashboard total=7 dupes=/housekeepingx2
chef      head=Dashboard->/chef-dashboard         total=4   dupes=none
accountant head=Dashboard->/accounts-dashboard    total=7   dupes=none
staff     head=Dashboard->/staff-dashboard        total=5   dupes=none
```

Kitchen and waiter drop the head item and show their dashboard as their first
Operations entry. No other role changes shape, and no role gains a duplicate path.
The one pre-existing duplicate (`/housekeeping` appears twice for `housekeeping`,
"Room Status" and "Cleaned Rooms", both pointing at `/housekeeping`) is untouched —
it was there before this change and is not part of this job.

Guard check, so the links land on a page the user may open:

- `/kitchen-dashboard` → `protect(<KitchenDashboard />, ["kitchen"])`, reached by the `kitchen` role.
- `/restaurant-dashboard` → `protect(<RestaurantDashboard />, ROLES.RESTAURANT)`; `ROLES.RESTAURANT`
  is `["admin", "manager", "waiter", "kitchen", "staff", "receptionist"]`, which contains `waiter`.

Both guards admit the role that owns the new link. No guard was changed.

## Verification

- `./node_modules/.bin/vite build --logLevel error` from `Maa-Baglamkhi-Resort-frontend` →
  **exit 0, zero output.** Run against the checked-in file, not a rebuild of a stale copy.
- Live over the Vite proxy on 5173 with a real admin token
  (`POST /api/auth/login` → 200, token length 221):
  - `GET /kitchen-dashboard` → HTTP 200, SPA shell
  - `GET /restaurant-dashboard` → HTTP 200, SPA shell (again with the `Authorization`
    header → 200)
  - `GET /src/components/Sidebar/Sidebar.jsx` → 200, and the served source contains
    `Kitchen Dashboard` (1 hit), `Restaurant Dashboard` (1 hit), `roleMenusOwnHome` (2 hits)
    — so the dev server is serving the edited file, not a cached one.
- Both dev-server routes return the static `index.html` shell, which is correct for a
  client-side-routed SPA: the 648-byte body is the same document for every path and
  contains no per-route HTML. The role logic above is what actually decides what the
  user sees, so it was exercised directly rather than assumed from a 200.

## Boundaries

One frontend file changed: `src/components/Sidebar/Sidebar.jsx`. Nothing under
`Maa-Baglamkhi-Resort-Backend/`, no changes to `src/api.js`, `vite.config.js`,
`package.json`, `src/App.jsx` or `src/utils/roleHome.js`. No servers restarted —
backend still on 5002, Vite still on 5173. No database rows written; the only request
that touched data was the login POST. No probe scripts committed; the role-evaluation
script ran in `$TMPDIR` and was not written into the repo.
