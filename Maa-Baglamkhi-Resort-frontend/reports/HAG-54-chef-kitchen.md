# HAG-54 chef-kitchen slice — dead-button audit

Date: 2026-10-18
Backend: 127.0.0.1:5002, reached through the Vite dev proxy at 127.0.0.1:5173
(neither restarted; no proxy change needed)
Client: `src/api.js` reused unchanged (`baseURL "/api"`, Bearer token from localStorage)

## Headline

**0 `alert()` stubs were found, so 0 were replaced.** None of my 12 files contain a
`window.alert(`, `alert(`, `confirm(`, or `prompt(` call at all, and none contain
TODO/FIXME/"not implemented" handlers or hard-coded host URLs. Every control in this
slice already calls a real backend endpoint through the shared client and renders the
response. There was nothing to rewire here.

I did find one real 501-write gap, but it is in a file **outside my assignment** — see below.

## Per-file

`alert()` stubs replaced: 0 for every file. Endpoint evidence below was taken live over
the dev server with a real admin token.

| File | Read | Write |
|---|---|---|
| AdminChefIssuePage.jsx | `GET /inventory/chef-issues`, `GET /inventory` → 200 | `POST /inventory/chef-issues`, `PUT /inventory/chef-issues/:id/return` (real calls, `chefService.createChefIssue` / `returnChefIssue`) |
| ChefInventoryPage.jsx | same two reads → 200 | same two writes |
| ChefDashboard.jsx | delegates to `KitchenOrdersList` → `GET /chef/orders` → 200 | `PUT /chef/orders/:id/status` via `chefService.updateOrderStatus` |
| Kitchen.jsx | `GET /kitchen/orders` → 200 (one order row: id 81, status "Ready", kot_no KOT-1792309151141); `GET /housekeeping` → 200 | `PUT /kitchen/orders/:id`, `PUT /:id/cancel`, `DELETE /:id` via `restaurantService` |
| KitchenDashboard.jsx | `GET /kitchen/orders` → 200; renders stat cards, insights and a 10-row status table | read-only dashboard, no write controls |
| MenuRecipeModulePage.jsx | 12-line wrapper around `MenuRecipeManager`, which uses `menuRecipeService` → all 9 `/menu-recipes/*` endpoints; `GET /menu-recipes/recipes` → 200 (empty `[]`, correct) | `POST /menu-recipes/menu/:menuItemId`, `PUT`/`DELETE /menu-recipes/recipes/:recipeRowId`, `POST /menu-recipes/apply-consumption` |
| InventoryMenuItemsPage.jsx | `GET /restaurant/menu` → 200 (menu dishes) | `POST/PUT/DELETE /restaurant/menu/:id` (`handleSave` L329, `handleDelete` L367) |
| InventoryMenuListPage.jsx | `GET /restaurant/menu` → 200; paged + collapsible category groups | `window.print()` only — print is local, not a backend control |
| InventoryItemsPage.jsx | `GET /inventory` → 200 (1 row); `/inventory-masters/stock-categories`, `/units`, `/locations` all → 200, so no fallback branch fires | `POST/PUT /inventory`, `DELETE /inventory/:id` (`handleSave` L274) |
| InventoryPurchasesPage.jsx | `GET /inventory/purchase-orders` → 200 (1 row); `GET /inventory/vendors` → 200; `GET /inventory/purchase-orders/:initialId` for the edit form | `POST /inventory/purchase-orders`, `PUT /:id` (`handleSave` L171). **Not** `POST /inventory/purchases` — that one is a 501 stub |
| InventoryReportsPage.jsx | Tab switcher over 15 endpoints — `/inventory/reports`, `/stock-ledger`, `/vendor-inwards`, `/vendor-payments`, `/transfers`, `/reports/vendor-spend`, `/reports/stock-value`, `/reports/expiry-batches`, `/reports/consumption`, `/reports/audit-trail`, `/vendor-insights`, `/audit/report`, `/alerts/low-stock`, `/alerts/expiring` → all 200 | read-only |
| InventoryHubPage.jsx | `GET /inventory/stats` → 200; 424 navigations to sibling routes, 0 backend writes | nav shell only |

Live payloads returned data, not failures: `/inventory` returns a 192-byte array,
`/inventory/transfers` a 6187-byte array, `/inventory/chef-issues` a populated ledger,
`/inventory/vendor-insights` a summary object.

Two notes on response shape, both handled correctly by the screens:
`/inventory/menu-list` and `/inventory/menu-items` are **aliases that both return the raw
stock-item array** (`{id, name, category, stock, unit, price, reorderPoint, isLowStock}`) —
not menu dishes. The real menu-dish shape (`{id, category_id, name, price, tax_percent,
food_type, availability_status}`) comes from `/restaurant/menu`, which is what
`InventoryMenuItemsPage.jsx` and `InventoryMenuListPage.jsx` actually call. So those two
pages are correct; the `/inventory/menu-*` names are misleading, not the frontend.

## Endpoint gap found (not mine to fix)

`components/Inventory/InventoryFlow.jsx` — lines 1436, 1446, 1456 — POSTs to three
endpoints that return HTTP 501 `{"message":"Not implemented yet"}`:

- `POST /inventory/purchases` → 501. Closest real match: `POST /inventory/purchase-orders` (works, 200/400-on-validation).
- `POST /inventory/stock` → 501. No close match; stock movement exists only as
`POST /inventory/stock-action`, which is also 501.
- `POST /inventory/stock-action` → 501. No close match.

A fourth handler in the same file, `handleSaveMaster` (line 1465), makes no call at all:
it `console.log`s and fires a success toast. That is a genuine dead control.

Reason I did not change it: it is not in my 12 assigned files, and it is reachable only
through `pages/InventoryPage.jsx`, which `src/App.jsx` does not route to. It is not on a
screen a user can reach. The backend half is also 501, so the fix belongs to the
backend owner (HAG-2), not to a frontend swap. Flagging rather than guessing.

## Not touched

`src/api.js`, `vite.config.js`, `package.json`, and everything under
`Maa-Baglamkhi-Resort-Backend/`. No database rows written. Two read-only POSTs with empty
bodies were sent to confirm validation paths still reject (all 400, no rows created);
the three 501s were probed the same way and created nothing either. No code changes made
to the 12 assigned files — there was nothing to change.
