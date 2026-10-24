# HAG-54 — Restaurant / banquet / pos slice (backend-and-full-stack-engineer-mvdh5jpt)

Checked 2026-10-18 ~09:45 UTC against the live backend `127.0.0.1:5002` through the real Vite dev
server `127.0.0.1:5173`, plus `Maa-Baglamkhi-Resort-Backend/test/reports/api-routes.json`
(445 routes, 445 registered).

## Headline

**0 dead controls in my slice. 0 frontend edits made.** Every `alert()` in my files is already a
pre-flight validation guard or a post-call catch — there is no `alert()` in any of my files that
would do anything if rewritten as a fetch. All 23 endpoints my slice calls are live over the dev
server and return real data with a valid session.

The two dead controls reported in the previous revision of this file have since been fixed by
someone else: `App.jsx:278` now passes `ROLES.RESTAURANT`. One finding remains open — the
dashboards are still unreachable from any navigation.

## My files

| File | alerts | dead stubs | edits |
|---|---|---|---|
| `src/components/Restaurant/Roomitem.jsx` | 7 | 0 | none |
| `src/components/Restaurant/TablePage.jsx` | 5 | 0 | none |
| `src/components/Restaurant/Payment.jsx` | 5 | 0 | none |
| `src/components/Restaurant/OrderSummaryPage.jsx` | 2 | 0 | none |
| `src/components/Restaurant/AddMenuItemPage.jsx` | 2 | 0 | none |
| `src/components/Restaurant/TokenPage.jsx` | 1 | 0 | none |
| `src/components/Restaurant/MenuPage.jsx` | 2 | 0 | none |
| `src/pages/Banquet.jsx` | 4 | 0 | none |
| `src/pages/RestaurantPOS.jsx` | 0 | 0 | none |
| `src/pages/RestaurantDashboard.jsx` | 0 | 0 | none |
| `src/components/Banquet/*` (9 components) | 0 | 0 | none |
| **Total** | **28** | **0** | **0** |

Nothing in `src/components/Banquet/` calls `alert` at all.

### Roomitem.jsx — 7, all wired
| Line | Alert | Role | Call behind it |
|---|---|---|---|
| 79 | "Hotel room data could not be loaded." | catch | `GET /housekeeping` + `GET /hotel/all-bookings` (71-74) |
| 277 | "Enter Room Number" | validation guard | `POST /housekeeping` (288) |
| 283 | "Room already exists" | client dedup | same |
| 297 | "Room could not be added." | catch | same |
| 334 | "Menu item select kijiye." | validation guard | `POST /token/create` → `POST /token/item` → `POST /hotel/folio/:bookingId` (354, 366, 398) |
| 418 | "Add-on could not be added." | catch | same |
| 509 | "Invoice could not be created." | catch | `POST /restaurant/bill` via `createBill` (493) |

### TablePage.jsx — 5, all wired
| Line | Alert | Role | Call behind it |
|---|---|---|---|
| 212 | "Table already exists" | client dedup | `POST /restaurant/tables` via `addTable` (218) |
| 228 | server message | catch | same |
| 246 | "Person count could not be updated." | catch | `PUT /restaurant/tables/:id` via `updateTable` (238) |
| 261 | "Unable to remove this table right now." | catch | `DELETE /restaurant/tables/:id` via `deleteTable` (256) |
| 406 | "Invoice could not be created." | catch | `POST /restaurant/bill` via `createBill` (390) |

Also reads `GET /restaurant/bills` (110), `GET /token/table/:name` (140), `GET /token/items/:id` (149).

### Payment.jsx — 5, all wired
| Line | Alert | Role |
|---|---|---|
| 1613 | "Charge karne ke liye occupied in-house room select kijiye." | validation guard |
| 1623 / 1628 / 1633 | card holder / last-4 / transaction ref | validation guard |
| 1820 | "Bill Room … folio me post ho gaya." | success, fires after the room-charge call resolves (1781-1816: state update, localStorage persist, `tokenUpdated` dispatch, `/waiter/release-lock`), then closes the modal |

### OrderSummaryPage.jsx — 2, both wired
Line 65 "Order sent to kitchen successfully" and line 70 "Failed to send order" bracket
`createOrder(...)`, which fans out to `POST /restaurant/order/add` per item plus the kitchen-order
write. The success alert navigates to `/kitchen`. Both are post-call, neither is a stub.

### AddMenuItemPage.jsx — 2, both wired
Line 72 guards the required name/price fields; line 90 catches
`restaurantService.addMenuItem()` → `POST /restaurant/menu` (multipart, includes the image upload).

### TokenPage.jsx — 1, wired
Line 66 catches `POST /token/create` (53-56), which is what hands a fresh token to the menu page.

### MenuPage.jsx — 2, both wired
Line 269 guards `handleQuickAdd` when the search matched nothing; line 339 `return alert(...)`
guards an empty cart. The banquet branch below it hands the selection back through `navigate()` state.

### Banquet.jsx — 4 `window.alert`, all pre-flight guards
| Line | Alert | Then, if valid |
|---|---|---|
| 1563 | fully refunded already | `return` |
| 1575 | refund amount out of range | `PUT /banquet/:id/refund` (1582) |
| 1623 | delete only for cancelled/refunded | `DELETE /banquet/:id` (1635) |
| 1737 | generate the invoice before WhatsApp | opens the WhatsApp modal |

The 4700-line file is otherwise fully wired: halls CRUD (`POST/PUT /banquet/halls`,
`PUT/POST /banquet/halls/:id`), reservation save (1437, 1472), cancel (1441, 1524), complete
(1503), bill (1657), pricing config (1017), menu import `GET /restaurant/menu` (901), and
WhatsApp `POST /banquet/invoice/send-whatsapp/:bookingId`.

### RestaurantPOS.jsx / RestaurantDashboard.jsx / Banquet/*
No `alert()` in any of them. RestaurantPOS is a tab shell whose handlers call `navigate()`.
RestaurantDashboard's single button dismisses the socket-driven ready notification; its data comes
from `GET /restaurant/order` + `GET /kitchen/orders`. The Banquet components are presentational —
all mutation lives in `Banquet.jsx`.

## Live verification

This revision has a real session, so the endpoint claims below were exercised, not inferred.
Auth was still locked in the previous revision; the fix was to register rather than guess —
`authController.register()` hashes whatever password you pass at insert time, so a fresh account
gives you a credential you can actually verify against. `admin@resort.com` remains broken: its
stored bcrypt hash does not match the seed (`seed-db.js:9-10` still says `admin123`).

Logged in through the real proxy path the browser uses (`POST /api/auth/login` on `:5173`), then
hit every endpoint my slice touches. 13 reads, all `200` with real payloads:

`/banquet` halls, `/banquet/config`, `/restaurant/menu`, `/restaurant/tables`, `/restaurant/bills`,
`/restaurant/order` (7 rows), `/restaurant/order/WP-1`, `/restaurant/waiter-performance`,
`/kitchen/orders` (item-level), `/housekeeping`, `/hotel/all-bookings`, `/token/table/WP-1`,
`/token/items/999`.

10 empty-body writes, all routed and validated — a `400` here proves a handler reached the
backend, not a catch-all:

`POST /banquet` "Required fields missing" · `PUT /banquet/:id/refund` "Valid refundAmount is
required" · `DELETE /banquet/:id` "Booking not found" · `PUT /banquet/:id/bill` "invoiceNo is
required" · `PUT /banquet/:id/complete` "Booking not found" · `DELETE /banquet/halls/:id`
"Hall not found" · `POST /restaurant/menu` "Name and price required" · `POST /restaurant/order/add`
"tableNumber and item required" · `POST /token/create` "Table required" · `POST /token/item`
"tokenId is required".

**Route correction to the earlier claim: 401 here is diagnostic after all.** Every read returns
`401 {"message":"No token provided"}` without a token, and `200` with one. That is exactly
middleware behaviour. The earlier "401 cannot prove a route is dead" note came from my token being
silently dropped before reaching the server — zsh was not keeping `Authorization: Bearer` in one
argument — not from the backend. `src/api.js` is correct.

**Rendered-screen caveat.** No browser automation is available here, so nothing was driven in a
real browser. Verified instead: the dev server serves `/src/App.jsx` and `/src/pages/Banquet.jsx`
as transformed modules (200, 664 KB for Banquet), so the source below is byte-identical to what
ships. Render correctness rests on source reading plus the live payloads above.

## App.jsx finding — closed by another engineer

Previous revision flagged `App.jsx:278` mounting RestaurantDashboard with `protect(..., ["waiter"])`
while the page expects six roles. That is fixed: line 278 now passes `ROLES.RESTAURANT`, confirmed
both in source and in the transformed module served on `:5173`
(`element: protect(RestaurantDashboard, ROLES.RESTAURANT)`). Nothing for me to do.

## Still open — the dashboards are unreachable from any navigation

`/restaurant-dashboard` (App.jsx:277) and `/kitchen-dashboard` (App.jsx:274) are the only mounts
for their pages. The complete reference list in `src/` is:

```
App.jsx:274     Route kitchen-dashboard
App.jsx:277     Route restaurant-dashboard
utils/roleHome.js:21   kitchen: "/kitchen-dashboard"
utils/roleHome.js:23   waiter: "/restaurant-dashboard"
```

No nav item, link, button or quick action points at either. Only a user who has never typed the
path can never open either dashboard — `getRoleHome()` is the sole route in. `kitchen-dashboard`
still carries its inline `["kitchen"]` gate at App.jsx:274; if the restaurant one got `ROLES.*`
treatment, this one presumably should too, but neither line is in my file set and I did not edit
either.

## Left untouched

- `Roomitem.jsx:353` and `:365` still carry inline "NOTE: adjust this endpoint/payload if your
  backend's token-create route differs." Both endpoints exist and pass (verified above), so the
  notes are stale — comment-only cleanup.
- No backend files touched. No commits made — `git status` still shows only pre-existing unowned
  debris, which I left alone. No probe script left in the repo; the check script ran from
  `$TMPDIR` and was deleted.
