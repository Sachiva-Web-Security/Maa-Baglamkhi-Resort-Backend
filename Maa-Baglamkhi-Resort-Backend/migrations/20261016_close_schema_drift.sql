-- ============================================================
-- Migration: close schema drift reported by HAG-23 / HAG-204
-- Date: 2026-10-16
-- DB: resort_management (MariaDB via XAMPP)
-- RULE: ADDITIVE ONLY. No DROP, no ALTER that removes, no TRUNCATE.
-- Idempotent: every statement uses IF NOT EXISTS.
-- ============================================================

-- ----------------------------------------------------------------
-- PART A — guest_identifications: columns written by
--          src/controller/guestDocumentController.js:38
-- The INSERT lists (booking_id, guest_id, document_type, file_url,
-- notes, uploaded_by, is_accepted, created_at, updated_at); the
-- live table only has (id, booking_id, guest_profile_id, id_type,
-- id_number, file_url, verified, verified_by, verified_at,
-- created_at). Without these the whole "add guest document" flow
-- 500s.
-- ----------------------------------------------------------------
ALTER TABLE guest_identifications
  ADD COLUMN IF NOT EXISTS guest_id BIGINT UNSIGNED NULL COMMENT 'Booking id written by guestDocumentController',
  ADD COLUMN IF NOT EXISTS document_type VARCHAR(100) NULL COMMENT 'Alias of id_type: Aadhaar/PAN/Passport/etc.',
  ADD COLUMN IF NOT EXISTS notes TEXT NULL,
  ADD COLUMN IF NOT EXISTS uploaded_by VARCHAR(191) NULL,
  ADD COLUMN IF NOT EXISTS is_accepted TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Alias of verified (terms accepted)',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- ----------------------------------------------------------------
-- PART B — bills: columns written by
--          src/controller/restaurantController.js (createSplitBill)
-- and read across folio/reporting. The live table has no split
-- metadata columns, so a split bill can only be represented as
-- many identical rows.
-- ----------------------------------------------------------------
ALTER TABLE bills
  ADD COLUMN IF NOT EXISTS split_label VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS split_no INT NULL,
  ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS entity_ref_id VARCHAR(191) NULL,
  ADD COLUMN IF NOT EXISTS items_json JSON NULL COMMENT 'Itemised bill payload sent by the frontend',
  ADD COLUMN IF NOT EXISTS paid_by VARCHAR(191) NULL;

-- ----------------------------------------------------------------
-- PART C — tables the controllers reference that do not exist.
-- These are all guarded by tableExists()/columnExists() in
-- dashboardController.js and reportsController.js, so they degrade
-- to "no rows" rather than throwing; creating them makes the
-- guarded dashboard/report queries start returning real numbers.
-- ----------------------------------------------------------------

-- Legacy room-revenue join used by dashboardController.js:
--   FROM guests g INNER JOIN room_tariff rt ON rt.booking_id = g.id
-- dashboardController also probes guests.check_in and guests.check_in_date.
CREATE TABLE IF NOT EXISTS room_tariff (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `booking_id` BIGINT UNSIGNED NULL,
  `total` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_room_tariff_booking` (`booking_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- whatsappInvoiceController.js reads:
--   SELECT amount, discount_amount FROM advance_payment WHERE booking_id = ?
CREATE TABLE IF NOT EXISTS advance_payment (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `booking_id` BIGINT UNSIGNED NULL,
  `amount` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `discount_amount` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `payment_method` VARCHAR(50) NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_advance_booking` (`booking_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- dashboardController.js reads payment_history ph for payment counts/sums.
CREATE TABLE IF NOT EXISTS payment_history (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `booking_id` BIGINT UNSIGNED NULL,
  `bill_id` BIGINT UNSIGNED NULL,
  `amount` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `payment_method` VARCHAR(50) NULL,
  `status` VARCHAR(30) NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_payment_history_booking` (`booking_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- reportsController.js reads restaurant_bills ... AS status.
CREATE TABLE IF NOT EXISTS restaurant_bills (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `table_number` VARCHAR(50) NULL,
  `subtotal` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `tax_amount` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `total` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `status` VARCHAR(30) NOT NULL DEFAULT 'Pending',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- reportsController.js LEFT JOINs hotel_room_inventory hri on
-- CAST(hri.room_number AS CHAR) = CAST(rt.room_number AS CHAR).
CREATE TABLE IF NOT EXISTS hotel_room_inventory (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `room_number` VARCHAR(50) NULL,
  `category_id` INT NULL,
  `status` VARCHAR(30) NULL,
  `rate` DECIMAL(12,2) NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_hri_room_number` (`room_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- reportsController.js LEFT JOINs hotel_room_categories hrc on
-- hrc.id = hri.category_id.
CREATE TABLE IF NOT EXISTS hotel_room_categories (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- restaurantController.js createSplitBill INSERTs into
-- restaurant_split_bills (NOT guarded by tableExists -> hard 500).
-- NOTE: `tables` is reserved, so it is backticked in the CREATE and
-- must be backticked in every reference. The controller's own INSERT
-- is still broken; see the report for the required controller fix.
CREATE TABLE IF NOT EXISTS `restaurant_split_bills` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `bill_id` BIGINT UNSIGNED NULL,
  `table_number` VARCHAR(50) NULL,
  `entity_type` VARCHAR(50) NULL,
  `entity_ref_id` VARCHAR(191) NULL,
  `split_label` VARCHAR(100) NULL,
  `split_no` INT NULL,
  `split_count` INT NULL,
  `subtotal` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `gst` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `total` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `payment_method` VARCHAR(50) NULL,
  `items_json` JSON NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_rsb_bill` (`bill_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------
-- PART D — the old frontend table set, used unguarded.
-- guestController.js / guestDocumentController.js run:
--   SELECT id, mobile, guest_name, booking_code FROM guests ...
--   UPDATE guests SET mobile = ? WHERE id = ?
--   UPDATE guests SET mobile = ?, guest_name = ?, booking_code = ?, ...
-- None of these is wrapped in tableExists(), so every guest-edit and
-- guest-document call dies with ER_NO_SUCH_TABLE (1146).
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS guests (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `guest_name` VARCHAR(191) NULL,
  `mobile` VARCHAR(30) NULL,
  `email` VARCHAR(191) NULL,
  `booking_code` VARCHAR(64) NULL,
  `check_in_date` DATE NULL,
  `check_out_date` DATE NULL,
  `total_amount` DECIMAL(12,2) NULL,
  `status` VARCHAR(30) NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_guests_booking_code` (`booking_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The frontend uses `tables` as its restaurant-tables table (legacy
-- name). `restaurant_tables` exists and is what the current
-- restaurantController.js writes; this keeps the old frontend and any
-- other code that still says `FROM tables` from breaking.
CREATE TABLE IF NOT EXISTS `tables` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `number` VARCHAR(50) NULL,
  `floor_name` VARCHAR(100) NULL,
  `section_name` VARCHAR(100) NULL,
  `seat_count` INT NULL,
  `guestCount` INT NULL,
  `status` VARCHAR(30) NULL,
  `status_color` VARCHAR(20) NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `sort_order` INT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS register (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `entry_type` VARCHAR(50) NULL,
  `amount` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `notes` TEXT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
