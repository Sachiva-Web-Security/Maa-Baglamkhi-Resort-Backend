-- Waiter flow support schema
-- Run these statements only if the column/index does not already exist in your database.

-- 1. Persist waiter ownership on restaurant orders
ALTER TABLE orders
  ADD COLUMN waiter_name VARCHAR(191) DEFAULT NULL AFTER tableNumber;

CREATE INDEX idx_orders_waiter_name ON orders (waiter_name);

-- 2. Optional one-time backfill for current active-table ownership
UPDATE orders o
LEFT JOIN tokens t
  ON t.tableNumber = o.tableNumber
 AND t.status = 'active'
SET o.waiter_name = COALESCE(NULLIF(o.waiter_name, ''), t.waiter)
WHERE o.waiter_name IS NULL OR o.waiter_name = '';
