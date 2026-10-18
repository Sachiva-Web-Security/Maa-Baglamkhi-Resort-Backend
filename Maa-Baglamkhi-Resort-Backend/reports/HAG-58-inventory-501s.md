# HAG-58 — the three 501 stubs and the handler that never called the API

**All four resolved on the frontend side. Zero backend files changed.** The backend already had
working persisting routes for every one of these writes; the routes the component used were stubs
(`src/routes/inventoryRoutes.js:87`, `:157`, `:160`) that only did
`res.status(501).json({ message: "Not implemented yet" })`. Repointing was the smaller thing in
every case, so I did not add a single line of backend code.

File changed: `Maa-Baglamkhi-Resort-frontend/src/components/Inventory/InventoryFlow.jsx`
**+58 / −29.** ESLint clean on the file, `vite build --logLevel error` silent.

## One row per handler

| handler | called before | calls after | live status |
|---|---|---|---|
| `handleSavePurchase` | `POST /inventory/purchases` → **501** | `POST /inventory/purchase-orders` | **not live** — server down |
| `handleSaveStock` | `POST /inventory/stock` → **501** | `POST /inventory/vendor-inwards` | **not live** — server down |
| `handleSaveAction` (transfer) | `POST /inventory/stock-action` → **501** | `POST /inventory/transfers` | **not live** — server down |
| `handleSaveAction` (audit) | `POST /inventory/stock-action` → **501** | `POST /inventory/audit` | **not live** — server down |
| `handleSaveAction` (waste) | `POST /inventory/stock-action` → **501** | `POST /inventory/waste` | **not live** — server down |
| `handleSaveMaster` | no call at all — `console.log` + success toast | **removed** | n/a |

**The live column is the honest part of this report and it is empty.** Both 5002 and 5173 return
connection refused as of 18:15. I did not restart them. Before my change the status for all five
paths was a verified 501; after it, the calls target routes I read and confirmed implement real
`INSERT`s — but I have not seen a status code back from them, because there is no server.

## Why each landed where it did

**`handleSavePurchase` → `/purchase-orders`.** This was the decision god asked for, and the backend
answered it. The route the component called, `POST /inventory/purchases`, is a stub and is
*ambiguous* — `GET /inventory/purchases` sits directly above it and returns a hard-coded
`[]`. Two routes can't serve two shapes. `createPurchaseOrder`
(`inventoryController.js:1032`) inserts into `inventory_purchase_orders` with the fields the modal
already collects. Field mapping: the modal collects `itemName`, `vendor`, `quantity`, `rate`,
`status`, so a `poNumber` is derived from the item label with a timestamp fallback, because
`createPurchaseOrder` requires it and the modal has no field for it.

**`handleSaveStock` → `/vendor-inwards`.** `createVendorInward`
(`:1141`) is the one real "add stock" in the backend: it inserts a row, then
`UPDATE inventory SET stock = stock + ?`, syncs expiry, and writes a ledger entry — inside one
transaction. That is exactly what this modal claims to do ("Add stock / Update physical stock for
an item"). The mapping moves the modal's `receivedQty` into `quantityReceived`, the only field name
the handler validates.

**`handleSaveAction` → three routes, not one.** `ActionModal` is already a tabbed control
(transfer / audit / waste) and the backend already has a distinct, working route for each:
`recordTransfer` (`:2109`, requires `itemName`, `fromStore`, `toStore`, `quantity > 0`),
`submitAudit` (`:2059`, requires `body.entries` with `item_name`, `system_stock`, `physical_stock`,
`variance`), `logWaste` (`:814`, requires `itemName`, `quantity > 0`). Sending one flat payload to
`/audit` would always have returned `400 {"message":"No audit entries provided."}` — 400 instead of
501 is still a broken button, so the body is reshaped per branch.

Each branch also fixes a real payload defect the old code would have kept, now that the call can
fail for a good reason:

- `ActionModal` sends `item`, not `itemName`. Every one of the three handlers reads
  `req.body.itemName`, so a repoint alone would have flipped a silent 501 into
  `400 {"message":"itemName ... are required"}`. The branches read `data.itemName || data.item`.
- transfer takes `fromStore`/`toStore`, but the modal only ever populated `fromStore`. Sending one
  string to two fields is not how a transfer works; the modal shape is the defect, left alone.

## `handleSaveMaster` — removed, and the drawer behind it too

The brief gave two options and the second one won, on evidence:

- Nothing in this file is restorable from it. `SetupDrawer` writes categories, vendors, units,
  stores and groups; `categories`, `vendors` and `stores` are the same arrays that
  `NewPurchaseModal`, `AddStockModal` and `ActionModal` render their `<select>` options from — and
  they are loaded from `GET /inventory/setup/*`, which returns a hard-coded `[]`. Master data never
  existed on the backend, so removing the drawer cannot break a select that is already empty.
- The backend has no master-table route. Grepping `inventoryController.js` for
  `inventory_categories`, `inventory_stores`, `inventory_groups` returns nothing.
- `POST /inventory` (`createItem`, `:587`) calls `ensureSchema()` first and *would* have been a
  candidate — until I checked `getItems`, which reads from the table `inventory`. But
  `ensureSchema()` builds `inventory_items`. **The whole `/inventory/items` CRUD set is
  insert-then-read against two different tables.** An add returns 201 and the next list call never
  shows it. That is a backend defect for the owner, not a repoint I can make safely: writing a
  frontend fix into a read path that silently drops rows would hide the bug.

What I removed: `handleSaveMaster`, the `SetupDrawer` mount, the `⚙ Setup` button in the top bar,
the `Manage vendors` button and the `onOpenVendorDrawer` prop it fed, and the two drawer states.
Keeping the console.log and the toast would have kept the exact bug in the brief — a green toast on
a log line. `SetupDrawer` stays exported (`export { … SetupDrawer … }`) so an external importer is
not broken.

## Not verified — servers down

5002, 5173 and the 5173 proxy all return connection refused as of 18:15. Per the brief I restarted
neither. What is verified is static, not live:

- **ESLint** on `InventoryFlow.jsx`: no output, exit 0.
- **`./node_modules/.bin/vite build --logLevel error`**: silent, exit 0.
- **Handler signatures** read straight out of `inventoryController.js` and matched field by field,
  which is why the payload reshaping above exists at all.

When 5002 is back, the one command that would close this: log in, POST a purchase order, an inward,
a transfer, an audit and a waste entry, and confirm each appears in its `GET` list. I did not run
that and will not claim it.
