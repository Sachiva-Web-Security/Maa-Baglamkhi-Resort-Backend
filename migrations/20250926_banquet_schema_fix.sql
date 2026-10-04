-- Migration: align banquet_bookings with controller query
-- Run this once against resort_management

ALTER TABLE banquet_bookings
  ADD COLUMN IF NOT EXISTS guest_email VARCHAR(191) NULL AFTER phone,
  ADD COLUMN IF NOT EXISTS guests INT NULL AFTER event_type,
  ADD COLUMN IF NOT EXISTS menu_package_id VARCHAR(100) NULL AFTER guest_count,
  ADD COLUMN IF NOT EXISTS notes TEXT NULL AFTER decoration_fee,
  ADD COLUMN IF NOT EXISTS `date` DATE NULL AFTER notes,
  ADD COLUMN IF NOT EXISTS subtotal_amount DECIMAL(12,2) DEFAULT 0 AFTER discount,
  ADD COLUMN IF NOT EXISTS grand_total DECIMAL(12,2) DEFAULT 0 AFTER gst_amount,
  ADD COLUMN IF NOT EXISTS refund_amount DECIMAL(12,2) DEFAULT 0 AFTER advance,
  ADD COLUMN IF NOT EXISTS net_received DECIMAL(12,2) DEFAULT 0 AFTER refund_amount,
  ADD COLUMN IF NOT EXISTS balance_due DECIMAL(12,2) DEFAULT 0 AFTER net_received,
  ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(50) NULL AFTER balance_due,
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'Pending' AFTER payment_mode,
  ADD COLUMN IF NOT EXISTS payment_reference_no VARCHAR(100) NULL AFTER payment_status,
  ADD COLUMN IF NOT EXISTS billed_at DATETIME NULL AFTER payment_reference_no;

-- Backfill date from event_date
UPDATE banquet_bookings
  SET `date` = event_date
WHERE `date` IS NULL AND event_date IS NOT NULL;

-- Backfill grand_total from total
UPDATE banquet_bookings
  SET grand_total = total
WHERE grand_total IS NULL AND total IS NOT NULL;

-- Backfill subtotal_amount from subtotal
UPDATE banquet_bookings
  SET subtotal_amount = subtotal
WHERE subtotal_amount IS NULL AND subtotal IS NOT NULL;

-- Backfill guests from guest_count
UPDATE banquet_bookings
  SET guests = guest_count
WHERE guests IS NULL AND guest_count IS NOT NULL;

-- Backfill menu_package_id from menu_package
UPDATE banquet_bookings
  SET menu_package_id = menu_package
WHERE menu_package_id IS NULL AND menu_package IS NOT NULL;
