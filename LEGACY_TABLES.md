# Legacy Tables Documentation

Date: 2026-09-09
Audit: Full codebase audit of Maa Baglamkhi Resort system

---

## Overview

Three tables (`bills`, `orders`, `order_items`) are **actively used** by the restaurant module. They are NOT dead code — removing them would break the billing and cart flows. However, they represent an older data layer that should eventually be consolidated into `restaurant_bills`.

A fourth table (`restaurant_bills`) exists as the intended replacement but has **0 rows** in the live database because the one-time migration script in `RestaurantModel.js` (`bootstrapLegacyBills`) never completed successfully.

---

## Table Details

### `bills` — Primary Restaurant Bill Records

| Attribute | Value |
|---|---|
| **Status** | Active, primary bill table |
| **Row count** | 24 rows (₹7,656.35 total value) |
| **Created by** | `createBillRecord()` in `models/RestaurantModel.js:1073` |
| **Read by** | `ReportsModel.js`, `restaurantController.js` (list bills), `restaurant.test.js` |
| **Live SQL size** | 495 lines (lines 1032–1526 in `live_database.sql`) |

**Fields:** id, tableNumber, token_id, entityType, waiter_name, customerName, phone, subtotal, serviceCharge, gst, total, discountAmount, paymentMethod, invoiceStatus, split_no, split_count, paid_at, payment_id, account_transaction_id, posted_to_room, posted_room_number, room_booking_id, room_booking_code, folio_entry_id, source_table_number, posted_at, created_at

**Migration target:** `restaurant_bills` table (same fields, cleaner structure with explicit columns).

---

### `restaurant_bills` — Replacement Bill Table (EMPTY)

| Attribute | Value |
|---|---|
| **Status** | Empty — migration never completed |
| **Row count** | 0 rows |
| **Schema** | Fully defined in `live_database.sql` (lines 3160–3204), auto-bootstrapped by `RestaurantModel.js` |
| **Read by** | `restaurantController.js` line 608 (fallback bill listing) |
| **Write by** | `syncLegacyRestaurantBill()` in `RestaurantModel.js:984` (only when migrating) |

**Migration logic:** `bootstrapLegacyBills()` at `models/RestaurantModel.js:278` attempts to sync rows from `bills` to `restaurant_bills`. It runs once at app startup but has not produced any rows.

**Action needed:** Investigate why the migration fails. Likely causes:
1. The migration may throw silently (logged as "non-blocking" at line 1085)
2. The `unlinkedBills` loop may not find any rows due to NULL `modern_bill_id`

---

### `orders` — Pending Cart/Order Records

| Attribute | Value |
|---|---|
| **Status** | Active — cart flow |
| **Row count** | 23 rows |
| **Created by** | `restaurantController.js:362` (`INSERT INTO orders`) |
| **Read by** | `restaurantController.js` (get pending order, get items), `kitchenOrderSync.js:54` |
| **Test data** | `tests/helpers/testDb.js:501` |

**Fields:** id, tableNumber, waiter_name, status, token_id, created_at

**Purpose:** Holds pending/unpaid order carts per table. When a bill is finalized, the order is closed/removed.

---

### `order_items` — Individual Order Items

| Attribute | Value |
|---|---|
| **Status** | Active — cart line items |
| **Row count** | 102 rows |
| **Created by** | `restaurantController.js:372` (`INSERT INTO order_items`) |
| **Read by** | `restaurantController.js:441` (`SELECT * FROM order_items`), `kitchenOrderSync.js:64` |

**Fields:** id, order_id, name, price, quantity

**Purpose:** Individual items within a pending order cart.

---

## Migration Path (Future)

The intended architecture:

```
bills (legacy, 24 rows)
  └─► restaurant_bills (target, 0 rows — migration incomplete)
       └─► restaurant_bill_items (for individual line items)

orders (active cart, 23 rows)
  └─► restaurant_orders (future consolidation)

order_items (active cart items, 102 rows)
  └─► restaurant_order_items (future consolidation)
```

### Steps to complete migration (do when ready):

1. **Fix `bootstrapLegacyBills()`** — add logging to see why it produces 0 rows
2. **Run migration manually** — insert all 24 rows from `bills` into `restaurant_bills`
3. **Switch write path** — update `createBillRecord()` to write to `restaurant_bills` instead of `bills`
4. **Update reads** — switch report queries and controller reads to `restaurant_bills`
5. **Keep `bills` as read-only fallback** during transition period
6. **After verification** — drop `bills`, `orders`, `order_items` from SQL and DB

### Current risk: LOW
- All three tables are stable and working
- `bills` has 24 rows of paid bill history (₹7,656.35)
- `orders`/`order_items` are ephemeral (carts get finalized and removed)
- No data loss risk with current setup

---

## Recommendation

**Do NOT delete these tables.** They are actively used by production code and contain real financial data. Document the migration path and complete it only after:
1. Thorough testing of `restaurant_bills` as the primary table
2. Verification that all reports render correctly from `restaurant_bills`
3. A full data sync confirmation

**Immediate action:** Investigate why `bootstrapLegacyBills()` produces 0 rows and fix it so the migration is ready when needed.
