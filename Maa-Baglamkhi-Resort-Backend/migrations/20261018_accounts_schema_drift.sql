-- ============================================================
-- Migration: close the accounts schema drift (HAG-46)
-- Date: 2026-10-18
-- DB: resort_management (MariaDB 10.4 via XAMPP, port 3306)
--
-- RULE: ADDITIVE ONLY. No DROP, no removal of a column or index,
--       no UPDATE, no DELETE, no TRUNCATE. Not a single data row
--       is written by this file.
-- Idempotent: every statement is IF NOT EXISTS guarded, so the file
--             can be re-run, and can be folded into schema-v4.sql.
--
-- WHY THIS FILE EXISTS
--                     schema-v4.sql creates 72 tables and none of the
--                     accounts side ledgers. Their DDL is defined in
--                     src/models/AccountsExpansionModel.js, but nothing
--                     requires that model and nothing calls its
--                     ensureSchema(). app.js:34 imports a symbol named
--                     ensureAccountsExpansionSchema from
--                     ./models/TransactionsModel, which is a different
--                     model that creates only transactions. So on a clean
--                     install there is no purchase_orders, no vendor
--                     payments, no petty cash, no GST, no payroll, no
--                     profit centres, no payment gateway settings, no
--                     bank ledger and no reconciliation matches. This
--                     file makes schema-v4.sql sufficient on its own.
--                     Wiring the model into boot would also work; that
--                     is a two-line change in app.js and belongs to the
--                     accounts card owner, not this ticket.
--
--                     migrations/20261016_close_schema_drift.sql covers
--                     guest_identifications, bills, guests, room_tariff,
--                     advance_payment, payment_history, restaurant_bills,
--                     hotel_room_inventory, hotel_room_categories,
--                     restaurant_split_bills, tables and register.
--                     None of the 9 accounts tables is in it, so the
--                     name of that file is not a promise for this drift.
--
--                     NOTE: bank_reconciliation_matches is a 9th table
--                     from the same model and is folded in here too, so
--                     the same accounts slice is closed in one file.
--
-- COLUMN SHAPES
--               Accounted for on the live db, which is ahead of
--               AccountsExpansionModel.ensureSchema() in two places.
--               purchase_orders and vendor_payment_records carry
--               source_module/source_id plus an index that the model's
--               CREATE does not declare. A clean install created by this
--               file has those columns, so both the model DDL and the
--               migration converge on the live shape.
--
-- NOT CREATED HERE
--                 "accounts" does not exist, and is not created.
--                 SHOW TABLES LIKE '%account%' returns
--                 account_bank_ledgers, accounts_transactions,
--                 chart_of_accounts. accounts_transactions is the
--                 accounts_transactions table, not an alias of
--                 chart_of_accounts and not a chart-of-accounts
--                 substitute. The v4 ledger is:
--                     transactions            header (1)
--                     transaction_entries     legs   (n)
--                     chart_of_accounts       the chart (n)
--                 transaction_entries.account_id is INT UNSIGNED
--                 NOT NULL and FOREIGN KEYs to chart_of_accounts.id, so
--                 an insert without a resolvable account_id is rejected
--                 by the database, not by application code. Adding a
--                 "accounts" table here would paper over that FK rather
--                 than close the drift.
-- ============================================================

-- ----------------------------------------------------------------
-- PART A — the accounts side ledgers
-- ----------------------------------------------------------------

-- src/controller/accountsController.js listPurchaseOrders /
-- addPurchaseOrder. Written at /accounts/purchase-orders.
CREATE TABLE IF NOT EXISTS `purchase_orders` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `po_number` VARCHAR(100) NOT NULL,
  `vendor_name` VARCHAR(255) NOT NULL,
  `order_date` DATE NOT NULL,
  `expected_date` DATE DEFAULT NULL,
  `total_amount` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `status` VARCHAR(50) NOT NULL DEFAULT 'Draft',
  `notes` TEXT NULL,
  `source_module` VARCHAR(80) NULL,
  `source_id` INT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_purchase_order_number` (`po_number`),
  KEY `idx_purchase_order_date` (`order_date`),
  KEY `idx_purchase_order_source` (`source_module`, `source_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- /accounts/vendor-payments. Also read back by
-- AccountsExpansionModel.getReconciliationSourceRows().
CREATE TABLE IF NOT EXISTS `vendor_payment_records` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `vendor_name` VARCHAR(255) NOT NULL,
  `invoice_ref` VARCHAR(120) NULL,
  `payment_date` DATE NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `payment_mode` VARCHAR(50) NOT NULL DEFAULT 'Bank Transfer',
  `status` VARCHAR(50) NOT NULL DEFAULT 'Scheduled',
  `notes` TEXT NULL,
  `source_module` VARCHAR(80) NULL,
  `source_id` INT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_vendor_payment_date` (`payment_date`),
  KEY `idx_vendor_payment_source` (`source_module`, `source_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- /accounts/petty-cash. Backed by the v4 ledger, so the route answers
-- 501 rather than creating rows in a table this file defines.
CREATE TABLE IF NOT EXISTS `petty_cash_entries` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `entry_date` DATE NOT NULL,
  `entry_type` VARCHAR(20) NOT NULL,
  `category` VARCHAR(120) NOT NULL,
  `description` VARCHAR(255) NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `approved_by` VARCHAR(255) NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_petty_cash_date` (`entry_date`),
  KEY `idx_petty_cash_type` (`entry_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- /accounts/gst-returns. Same story: derived read-only over
-- invoices.tax_amount.
CREATE TABLE IF NOT EXISTS `gst_return_records` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `filing_period` VARCHAR(20) NOT NULL,
  `return_type` VARCHAR(50) NOT NULL,
  `taxable_amount` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `gst_collected` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `gst_paid` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `net_payable` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `status` VARCHAR(50) NOT NULL DEFAULT 'Draft',
  `filed_on` DATE NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_gst_period` (`filing_period`),
  KEY `idx_gst_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- /accounts/payroll.
CREATE TABLE IF NOT EXISTS `payroll_records` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `staff_name` VARCHAR(255) NOT NULL,
  `payroll_month` VARCHAR(20) NOT NULL,
  `attendance_days` INT NOT NULL DEFAULT 0,
  `base_salary` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `allowance` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `deduction` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `net_salary` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `status` VARCHAR(50) NOT NULL DEFAULT 'Draft',
  `notes` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_payroll_month` (`payroll_month`),
  KEY `idx_payroll_staff` (`staff_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- /accounts/profit-centers.
CREATE TABLE IF NOT EXISTS `profit_center_entries` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `center_name` VARCHAR(100) NOT NULL,
  `entry_date` DATE NOT NULL,
  `income_amount` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `expense_amount` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `notes` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_profit_center_name` (`center_name`),
  KEY `idx_profit_center_date` (`entry_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- /accounts/payment-settings. Rows created here get a derived `code`
-- column at read time in accountsController, so there is no code
-- column to persist.
CREATE TABLE IF NOT EXISTS `payment_gateway_settings` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `payment_mode` VARCHAR(50) NOT NULL,
  `department` VARCHAR(50) NOT NULL DEFAULT 'Hotel',
  `provider_name` VARCHAR(100) NULL,
  `upi_id` VARCHAR(150) NULL,
  `account_holder_name` VARCHAR(150) NULL,
  `bank_name` VARCHAR(150) NULL,
  `qr_image_url` VARCHAR(255) NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `notes` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_payment_gateway_mode` (`payment_mode`),
  KEY `idx_payment_gateway_department` (`department`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- /accounts/bank-ledger and the reconciliation endpoints. The eleven
-- columns after entry_date are what
-- AccountsExpansionModel.ensureSchema() ADDs on a fresh database; they
-- are in the CREATE here so a clean install does not need eleven ALTER
-- statements to reach the shape the reconciliation reads expect.
CREATE TABLE IF NOT EXISTS `account_bank_ledgers` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `entry_date` DATE NOT NULL,
  `bank_name` VARCHAR(255) NOT NULL,
  `bank_account` VARCHAR(255) NULL,
  `source_type` VARCHAR(50) NULL,
  `source_id` INT NULL,
  `payment_mode` VARCHAR(50) NULL,
  `amount` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `direction` VARCHAR(10) NOT NULL DEFAULT 'in',
  `reference_no` VARCHAR(120) NULL,
  `description` VARCHAR(255) NOT NULL,
  `debit` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `credit` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `reconciliation_status` VARCHAR(50) NOT NULL DEFAULT 'Pending',
  `match_status` VARCHAR(30) NOT NULL DEFAULT 'unmatched',
  `matched_amount` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `statement_ref` VARCHAR(120) NULL,
  `statement_date` DATE NULL,
  `reconciled_at` DATETIME NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_bank_ledger_date` (`entry_date`),
  KEY `idx_bank_ledger_bank` (`bank_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- /accounts/reconciliation/match writes the audit half of a match.
CREATE TABLE IF NOT EXISTS `bank_reconciliation_matches` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `bank_ledger_id` INT NOT NULL,
  `source_type` VARCHAR(50) NOT NULL,
  `source_id` INT NOT NULL,
  `source_amount` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `matched_amount` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `match_status` VARCHAR(30) NOT NULL DEFAULT 'matched',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_reco_match_source` (`source_type`, `source_id`),
  KEY `idx_reco_match_bank` (`bank_ledger_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
