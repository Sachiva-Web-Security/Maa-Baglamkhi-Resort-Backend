-- =====================================================================
-- Maa Baglamukhi Resort — MySQL Schema Dump
-- =====================================================================
-- Generated from backend/models/* + backend/app.js ensureSchema() calls.
-- Database: any MySQL 5.7+ / MariaDB 10.3+
-- Notes:
--   * All statements are idempotent (CREATE TABLE IF NOT EXISTS / INSERT IGNORE).
--   * Keys with FKs reference tables that are created earlier in this file.
--     Run this file top-to-bottom; do not reorder.
--   * The backend's runtime `ensureSchema()` calls also issue ALTER TABLE
--     migrations for legacy databases. For a fresh DB this file is enough.
--   * Default users (admin@resort.com / manager@resort.com / etc.) with
--     password "password" are seeded at the bottom (bcrypt-hashed at runtime
--     by app.js — not embedded here for security).
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------
-- 1. Authentication / users (created by app.js ensureDefaultStaffLogins)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS register (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(191) NOT NULL,
  email        VARCHAR(191) NOT NULL UNIQUE,
  phone        VARCHAR(20)  DEFAULT NULL,
  password     VARCHAR(255) NOT NULL,
  role         VARCHAR(50)  NOT NULL DEFAULT 'staff',
  avatar_url   VARCHAR(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 2. Guests & bookings
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS guests (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  booking_code    VARCHAR(40)  NOT NULL UNIQUE,
  mobile          VARCHAR(50)  DEFAULT '',
  guest_name      VARCHAR(255) DEFAULT '',
  guest_email     VARCHAR(255) DEFAULT '',
  check_in        DATE         DEFAULT NULL,
  check_out       DATE         DEFAULT NULL,
  arrival         VARCHAR(20)  DEFAULT NULL,
  departure       VARCHAR(20)  DEFAULT NULL,
  booking_status  VARCHAR(50)  DEFAULT 'Confirmed',
  cancel_reason   TEXT         DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS guest_documents (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  booking_id      INT          NOT NULL,
  mobile          VARCHAR(50)  DEFAULT '',
  guest_name      VARCHAR(255) DEFAULT '',
  document_type   VARCHAR(50)  NOT NULL DEFAULT 'checkin_form',
  file_url        VARCHAR(500) NOT NULL,
  terms_accepted  TINYINT(1)   NOT NULL DEFAULT 0,
  notes           TEXT         DEFAULT NULL,
  uploaded_by     VARCHAR(255) DEFAULT NULL,
  uploaded_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_guest_documents_booking_id (booking_id),
  INDEX idx_guest_documents_mobile     (mobile),
  INDEX idx_guest_documents_type       (document_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS other_booking (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  guest_id          INT          NOT NULL,
  booking_type      VARCHAR(100) DEFAULT NULL,
  booking_source    VARCHAR(100) DEFAULT NULL,
  booking_reference VARCHAR(255) DEFAULT NULL,
  address           TEXT         DEFAULT NULL,
  country           VARCHAR(120) DEFAULT NULL,
  state             VARCHAR(120) DEFAULT NULL,
  city              VARCHAR(120) DEFAULT NULL,
  pincode           VARCHAR(30)  DEFAULT NULL,
  created_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_other_booking_guest_id (guest_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS reference_notes (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  guest_id       INT          NOT NULL,
  guest_type     VARCHAR(100) DEFAULT NULL,
  guest_notes    TEXT         DEFAULT NULL,
  internal_notes TEXT         DEFAULT NULL,
  created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_reference_notes_guest_id (guest_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS companies (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  booking_id   INT          NOT NULL,
  company_name VARCHAR(191) NOT NULL,
  gstin        VARCHAR(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pax (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  booking_id  INT          NOT NULL,
  room_number VARCHAR(50)  DEFAULT NULL,
  adults      INT          NOT NULL DEFAULT 1,
  children    INT          NOT NULL DEFAULT 0,
  meal_plan   VARCHAR(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 3. Room inventory, blocks, tariff, folios
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hotel_room_categories (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120) NOT NULL UNIQUE,
  default_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit_label    VARCHAR(40)  NOT NULL DEFAULT 'PER NIGHT',
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hotel_room_inventory (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT          NOT NULL,
  room_number VARCHAR(50)  NOT NULL UNIQUE,
  guest       VARCHAR(200) DEFAULT NULL,
  status      VARCHAR(60)  DEFAULT 'Available',
  check_in    DATE         DEFAULT NULL,
  check_out   DATE         DEFAULT NULL,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_hotel_room_inventory_category
    FOREIGN KEY (category_id) REFERENCES hotel_room_categories(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Pre-seeded default categories (kept across resets)
INSERT IGNORE INTO hotel_room_categories (id, name, default_price, unit_label) VALUES
  (1, 'AC ROOM',           2000, 'PER NIGHT'),
  (2, 'NON-AC ROOM',       1500, 'PER NIGHT'),
  (3, 'DELUXE ROOM',       3000, 'PER NIGHT'),
  (4, 'SUPER DELUXE ROOM', 4000, 'PER NIGHT'),
  (5, 'SUITE ROOM',        5000, 'PER NIGHT'),
  (6, 'DELUXE DORMITORY',  800,  'PER BED');

CREATE TABLE IF NOT EXISTS hotel_room_blocks (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  room_number   VARCHAR(50) NOT NULL,
  block_type    ENUM('Maintenance','Deep Clean','Renovation','Inspection','Pest Control','Other')
                  NOT NULL DEFAULT 'Maintenance',
  reason        TEXT DEFAULT NULL,
  blocked_from  DATE NOT NULL,
  blocked_until DATE NOT NULL,
  blocked_by    VARCHAR(100) DEFAULT 'Manager',
  status        ENUM('Active','Completed','Cancelled')
                  NOT NULL DEFAULT 'Active',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS room_tariff (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  booking_id    INT          NOT NULL,
  room_number   VARCHAR(50)  NOT NULL,
  date          DATE         DEFAULT NULL,
  quantity      INT          NOT NULL DEFAULT 1,
  category_name VARCHAR(120) DEFAULT 'Room Charge',
  tariff        DECIMAL(10,2) NOT NULL DEFAULT 0,
  gst           DECIMAL(10,2) NOT NULL DEFAULT 0,
  total         DECIMAL(10,2) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hotel_folio_entries (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  booking_id  INT NOT NULL,
  entry_date  DATE NOT NULL,
  entry_type  ENUM('Room Charge','Extra Charge','Discount','Payment','Refund','Adjustment')
                NOT NULL DEFAULT 'Extra Charge',
  category    VARCHAR(100) DEFAULT 'Miscellaneous',
  description VARCHAR(255) NOT NULL,
  amount      DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_by  VARCHAR(100) DEFAULT 'Front Desk',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_folio_booking
    FOREIGN KEY (booking_id) REFERENCES guests(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 4. Payments / advances / invoices
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS advance_payment (
  booking_id          INT PRIMARY KEY,
  amount              DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_amount     DECIMAL(10,2) NOT NULL DEFAULT 0,
  payment_mode        VARCHAR(100)  DEFAULT 'Cash',
  receipt_account     VARCHAR(150)  DEFAULT NULL,
  transaction_details TEXT          DEFAULT NULL,
  remarks             TEXT          DEFAULT NULL,
  refund_amount       DECIMAL(10,2) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS payment_history (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  booking_id      INT NOT NULL,
  amount          DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  payment_mode    VARCHAR(100) DEFAULT 'Cash',
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS payments (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  tableNumber   VARCHAR(50)  DEFAULT NULL,
  total         DECIMAL(10,2) NOT NULL DEFAULT 0,
  paymentMethod VARCHAR(50)  DEFAULT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS invoices (
  id            INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  invoice_no    VARCHAR(120) NOT NULL,
  date          DATE DEFAULT NULL,
  customer_name VARCHAR(255) DEFAULT NULL,
  phone         VARCHAR(30)  DEFAULT NULL,
  room_no       VARCHAR(255) DEFAULT NULL,
  check_in      DATE DEFAULT NULL,
  check_out     DATE DEFAULT NULL,
  price_per_day DECIMAL(12,2) DEFAULT 0,
  food_charge   DECIMAL(12,2) DEFAULT 0,
  extra_charge  DECIMAL(12,2) DEFAULT 0,
  gst           DECIMAL(12,2) DEFAULT 0,
  discount      DECIMAL(12,2) DEFAULT 0,
  final_total   DECIMAL(12,2) DEFAULT 0,
  total_amount  DECIMAL(12,2) DEFAULT 0,
  payment_mode  VARCHAR(100) DEFAULT NULL,
  payment_status VARCHAR(50) DEFAULT 'Pending',
  status        VARCHAR(50) DEFAULT 'Pending',
  notes         TEXT NULL,
  items_json    LONGTEXT NULL,
  booking_id    INT DEFAULT NULL,
  customer_id   INT DEFAULT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_invoice_no (invoice_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 5. Accounts / finance
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS accounts_transactions (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  date          DATE NOT NULL,
  type          ENUM('Income','Expense') NOT NULL,
  department    ENUM('Room','Restaurant','Other') NOT NULL DEFAULT 'Other',
  source_module VARCHAR(50) NULL,
  description   VARCHAR(255) NOT NULL,
  amount        DECIMAL(10,2) NOT NULL,
  payment_mode  VARCHAR(30) NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NULL DEFAULT NULL,
  created_by    INT NULL,
  updated_by    INT NULL,
  is_deleted    TINYINT(1) NOT NULL DEFAULT 0,
  INDEX idx_transactions_date (date),
  INDEX idx_transactions_type (type),
  INDEX idx_transactions_payment_mode (payment_mode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS account_bank_ledgers (
  id                   INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  entry_date           DATE NOT NULL,
  bank_name            VARCHAR(255) NOT NULL,
  bank_account         VARCHAR(255) NULL,
  source_type          VARCHAR(50) NULL,
  source_id            INT NULL,
  payment_mode         VARCHAR(50) NULL,
  amount               DECIMAL(12,2) NOT NULL DEFAULT 0,
  direction            VARCHAR(10) NOT NULL DEFAULT 'in',
  reference_no         VARCHAR(120) DEFAULT NULL,
  description          VARCHAR(255) NOT NULL,
  debit                DECIMAL(12,2) NOT NULL DEFAULT 0,
  credit               DECIMAL(12,2) NOT NULL DEFAULT 0,
  reconciliation_status VARCHAR(50) NOT NULL DEFAULT 'Pending',
  match_status         VARCHAR(30) NOT NULL DEFAULT 'unmatched',
  matched_amount       DECIMAL(12,2) NOT NULL DEFAULT 0,
  statement_ref        VARCHAR(120) NULL,
  statement_date       DATE NULL,
  reconciled_at        DATETIME NULL,
  notes                TEXT NULL,
  created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_bank_ledger_date (entry_date),
  INDEX idx_bank_ledger_bank (bank_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS bank_reconciliation_matches (
  id             INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  bank_ledger_id INT NOT NULL,
  source_type    VARCHAR(50) NOT NULL,
  source_id      INT NOT NULL,
  source_amount  DECIMAL(12,2) NOT NULL DEFAULT 0,
  matched_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  match_status   VARCHAR(30) NOT NULL DEFAULT 'matched',
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_reco_match_source (source_type, source_id),
  INDEX idx_reco_match_bank    (bank_ledger_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS petty_cash_entries (
  id          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  entry_date  DATE NOT NULL,
  entry_type  VARCHAR(20) NOT NULL,
  category    VARCHAR(120) NOT NULL,
  description VARCHAR(255) NOT NULL,
  amount      DECIMAL(12,2) NOT NULL,
  approved_by VARCHAR(255) DEFAULT NULL,
  notes       TEXT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_petty_cash_date (entry_date),
  INDEX idx_petty_cash_type (entry_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS gst_return_records (
  id             INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  filing_period  VARCHAR(20) NOT NULL,
  return_type    VARCHAR(50) NOT NULL,
  taxable_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  gst_collected  DECIMAL(12,2) NOT NULL DEFAULT 0,
  gst_paid       DECIMAL(12,2) NOT NULL DEFAULT 0,
  net_payable    DECIMAL(12,2) NOT NULL DEFAULT 0,
  status         VARCHAR(50) NOT NULL DEFAULT 'Draft',
  filed_on       DATE DEFAULT NULL,
  notes          TEXT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_gst_period (filing_period),
  INDEX idx_gst_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS vendor_payment_records (
  id            INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  vendor_name   VARCHAR(255) NOT NULL,
  invoice_ref   VARCHAR(120) DEFAULT NULL,
  payment_date  DATE NOT NULL,
  amount        DECIMAL(12,2) NOT NULL,
  payment_mode  VARCHAR(50) NOT NULL DEFAULT 'Bank Transfer',
  status        VARCHAR(50) NOT NULL DEFAULT 'Scheduled',
  notes         TEXT NULL,
  source_module VARCHAR(80) NULL,
  source_id     INT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_vendor_payment_date (payment_date),
  INDEX idx_vendor_payment_vendor (vendor_name),
  INDEX idx_vendor_payment_source (source_module, source_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS purchase_orders (
  id            INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  po_number     VARCHAR(100) NOT NULL,
  vendor_name   VARCHAR(255) NOT NULL,
  order_date    DATE NOT NULL,
  expected_date DATE DEFAULT NULL,
  total_amount  DECIMAL(12,2) NOT NULL DEFAULT 0,
  status        VARCHAR(50) NOT NULL DEFAULT 'Draft',
  notes         TEXT NULL,
  source_module VARCHAR(80) NULL,
  source_id     INT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_purchase_order_number (po_number),
  INDEX idx_purchase_order_date (order_date),
  INDEX idx_purchase_order_source (source_module, source_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS payroll_records (
  id             INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  staff_name     VARCHAR(255) NOT NULL,
  payroll_month  VARCHAR(20) NOT NULL,
  attendance_days INT NOT NULL DEFAULT 0,
  base_salary    DECIMAL(12,2) NOT NULL DEFAULT 0,
  allowance      DECIMAL(12,2) NOT NULL DEFAULT 0,
  deduction      DECIMAL(12,2) NOT NULL DEFAULT 0,
  net_salary     DECIMAL(12,2) NOT NULL DEFAULT 0,
  status         VARCHAR(50) NOT NULL DEFAULT 'Draft',
  notes          TEXT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_payroll_month (payroll_month),
  INDEX idx_payroll_staff (staff_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS profit_center_entries (
  id            INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  center_name   VARCHAR(100) NOT NULL,
  entry_date    DATE NOT NULL,
  income_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  expense_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes         TEXT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_profit_center_name (center_name),
  INDEX idx_profit_center_date (entry_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS payment_gateway_settings (
  id                  INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  payment_mode        VARCHAR(50) NOT NULL,
  department          VARCHAR(50) NOT NULL DEFAULT 'Hotel',
  provider_name       VARCHAR(100) DEFAULT NULL,
  upi_id              VARCHAR(150) DEFAULT NULL,
  account_holder_name VARCHAR(150) DEFAULT NULL,
  bank_name           VARCHAR(150) DEFAULT NULL,
  qr_image_url        VARCHAR(255) DEFAULT NULL,
  is_active           TINYINT(1) NOT NULL DEFAULT 1,
  notes               TEXT NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_payment_gateway_mode (payment_mode),
  INDEX idx_payment_gateway_department (department)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 6. Attendance
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance_records (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  date          DATE NOT NULL,
  employee_name VARCHAR(100) NOT NULL,
  role          VARCHAR(50) NOT NULL,
  department    VARCHAR(100) NOT NULL,
  check_in      VARCHAR(10) DEFAULT NULL,
  check_out     VARCHAR(10) DEFAULT NULL,
  status        VARCHAR(20) NOT NULL,
  method        VARCHAR(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 7. Banquets
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS banquet_halls (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(191) NOT NULL,
  capacity     INT NOT NULL DEFAULT 0,
  rate_per_hour DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_ac        TINYINT(1) NOT NULL DEFAULT 0,
  image        VARCHAR(255) DEFAULT NULL,
  status       VARCHAR(50) DEFAULT 'Available'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS banquet_bookings (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  hall_id             INT NOT NULL,
  customer_name       VARCHAR(191) NOT NULL DEFAULT '',
  phone               VARCHAR(50) DEFAULT '',
  guest_email         VARCHAR(191) DEFAULT '',
  event_title         VARCHAR(191) DEFAULT '',
  event_type          VARCHAR(100) NOT NULL,
  guests              INT NOT NULL DEFAULT 0,
  menu_package_id     VARCHAR(100) DEFAULT 'standard',
  meal_section        VARCHAR(100) DEFAULT '',
  custom_menu_items   TEXT DEFAULT NULL,
  lighting_system     VARCHAR(100) DEFAULT 'classic',
  decoration_fee      DECIMAL(10,2) NOT NULL DEFAULT 0,
  event_support_fee   DECIMAL(10,2) NOT NULL DEFAULT 0,
  lighting_charge     DECIMAL(10,2) NOT NULL DEFAULT 0,
  custom_menu_charge  DECIMAL(10,2) NOT NULL DEFAULT 0,
  hall_charge         DECIMAL(12,2) NOT NULL DEFAULT 0,
  meal_charge         DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes               TEXT DEFAULT NULL,
  date                DATE DEFAULT NULL,
  start_time          TIME NOT NULL,
  end_time            TIME NOT NULL,
  discount            DECIMAL(10,2) NOT NULL DEFAULT 0,
  gst_percent         DECIMAL(10,2) NOT NULL DEFAULT 5,
  subtotal_amount     DECIMAL(12,2) NOT NULL DEFAULT 0,
  gst_amount          DECIMAL(12,2) NOT NULL DEFAULT 0,
  grand_total         DECIMAL(12,2) NOT NULL DEFAULT 0,
  invoice_no          VARCHAR(100) DEFAULT NULL,
  status              VARCHAR(50) DEFAULT 'Confirmed',
  advance             DECIMAL(10,2) NOT NULL DEFAULT 0,
  refund_amount       DECIMAL(12,2) NOT NULL DEFAULT 0,
  net_received        DECIMAL(12,2) NOT NULL DEFAULT 0,
  balance_due         DECIMAL(12,2) NOT NULL DEFAULT 0,
  payment_mode        VARCHAR(50) DEFAULT NULL,
  payment_status      VARCHAR(50) NOT NULL DEFAULT 'Pending',
  payment_reference_no VARCHAR(120) DEFAULT NULL,
  billed_at           DATETIME DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS banquet_pricing_config (
  id          INT PRIMARY KEY,
  config_json LONGTEXT NOT NULL,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 8. Audit log
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id              BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id         BIGINT NULL,
  action          VARCHAR(100) NOT NULL,
  endpoint        VARCHAR(255) NOT NULL,
  http_method     VARCHAR(10) NOT NULL,
  request_data    JSON NULL,
  response_status INT NOT NULL,
  ip_address      VARCHAR(64) NULL,
  old_value       JSON NULL,
  new_value       JSON NULL,
  response_body   JSON NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_user_id    (user_id),
  INDEX idx_audit_action     (action),
  INDEX idx_audit_endpoint   (endpoint),
  INDEX idx_audit_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 9. Housekeeping
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS housekeeping (
  id                   INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  type                 VARCHAR(50) NOT NULL DEFAULT 'Accommodation',
  roomNo               VARCHAR(50) NOT NULL,
  building             VARCHAR(50) NULL,
  floor                VARCHAR(20) NULL,
  section              VARCHAR(50) NULL,
  guestStatus          VARCHAR(50) NULL,
  roomType             VARCHAR(100) NULL,
  status               VARCHAR(100) NOT NULL DEFAULT 'Vacant Dirty',
  assignee             VARCHAR(100) NOT NULL DEFAULT 'No Housekeeper',
  layout               VARCHAR(50) NULL,
  articles             VARCHAR(50) NULL,
  services             VARCHAR(50) NULL,
  priority             VARCHAR(50) NOT NULL DEFAULT 'Normal',
  notes                TEXT NULL,
  cleaningStart        DATETIME NULL,
  cleaningEnd          DATETIME NULL,
  assignee_user_id     INT NULL,
  assigned_at          DATETIME NULL,
  assigned_by_user_id  INT NULL,
  started_at           DATETIME NULL,
  completed_at         DATETIME NULL,
  verified_at          DATETIME NULL,
  verified_by_user_id  INT NULL,
  verified_by_name     VARCHAR(120) NULL,
  pipeline_status      VARCHAR(40) NULL,
  created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_roomNo (roomNo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS housekeeping_logs (
  id          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  roomNo      VARCHAR(50) NOT NULL,
  oldStatus   VARCHAR(100) NULL,
  newStatus   VARCHAR(100) NOT NULL,
  assignee    VARCHAR(100) NULL,
  notes       TEXT NULL,
  changed_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hk_parameters (
  id                         INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  cleaning_time_minutes      INT NOT NULL DEFAULT 30,
  max_rooms_per_housekeeper  INT NOT NULL DEFAULT 10,
  shift_start_time           VARCHAR(10) NOT NULL DEFAULT '08:00',
  shift_end_time             VARCHAR(10) NOT NULL DEFAULT '20:00',
  auto_release_enabled       TINYINT(1) NOT NULL DEFAULT 1,
  inspection_required        TINYINT(1) NOT NULL DEFAULT 1,
  default_assignee           VARCHAR(100) NOT NULL DEFAULT 'No Housekeeper',
  updated_at                 TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO hk_parameters (id) VALUES (1);

CREATE TABLE IF NOT EXISTS hk_messages (
  id            INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  room_id       VARCHAR(100) NULL,
  room_no       VARCHAR(100) NULL,
  assigned_to   VARCHAR(255) NULL,
  receptionist  VARCHAR(255) NULL,
  message       TEXT NOT NULL,
  task_label    VARCHAR(255) NULL,
  due_at        DATETIME NULL,
  status        VARCHAR(60) NOT NULL DEFAULT 'New',
  completed_at  DATETIME NULL,
  sent_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_hk_messages_assigned_to (assigned_to),
  INDEX idx_hk_messages_status      (status),
  INDEX idx_hk_messages_sent_at     (sent_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hk_amenities_consumption (
  id          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  room_id     VARCHAR(100) NULL,
  room_no     VARCHAR(100) NULL,
  category    VARCHAR(120) NOT NULL,
  item_name   VARCHAR(255) NOT NULL,
  quantity    INT NOT NULL DEFAULT 1,
  unit_cost   DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_cost  DECIMAL(10,2) NOT NULL DEFAULT 0,
  notes       TEXT NULL,
  logged_by   VARCHAR(120) NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hk_inspections (
  id              INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  room_id         VARCHAR(100) NULL,
  room_no         VARCHAR(100) NULL,
  inspector_name  VARCHAR(255) NOT NULL,
  priority        VARCHAR(60) NOT NULL DEFAULT 'Normal',
  checklist_json  LONGTEXT NULL,
  score           INT NOT NULL DEFAULT 0,
  notes           TEXT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hk_lost_found (
  id              INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  found_date      DATE NOT NULL,
  found_room      VARCHAR(100) NULL,
  room_id         VARCHAR(100) NULL,
  found_by        VARCHAR(255) NOT NULL,
  category        VARCHAR(120) NOT NULL,
  description     TEXT NOT NULL,
  guest_name      VARCHAR(255) NULL,
  storage_location VARCHAR(255) NULL,
  status          VARCHAR(60) NOT NULL DEFAULT 'Found',
  notes           TEXT NULL,
  claimed_by      VARCHAR(255) NULL,
  claimed_date    DATE NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hk_shift_roster (
  id         INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  staff_name VARCHAR(255) NOT NULL,
  shift_date DATE NOT NULL,
  shift      VARCHAR(120) NOT NULL,
  UNIQUE KEY uq_hk_shift_roster_staff_date (staff_name, shift_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hk_room_costing (
  id            INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  room_id       VARCHAR(100) NULL,
  room_no       VARCHAR(100) NULL,
  staff_cost    DECIMAL(10,2) NOT NULL DEFAULT 0,
  linen_cost    DECIMAL(10,2) NOT NULL DEFAULT 0,
  toiletrie_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  misc_cost     DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_cost    DECIMAL(10,2) NOT NULL DEFAULT 0,
  logged_by     VARCHAR(120) NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hk_completed_cleaning_logs (
  id                INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  room_id           VARCHAR(100) NULL,
  room_no           VARCHAR(100) NOT NULL,
  assignee          VARCHAR(255) NULL,
  guest_status      VARCHAR(255) NULL,
  final_status      VARCHAR(100) NOT NULL DEFAULT 'Vacant Clean',
  completed_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verified_at       DATETIME NULL,
  verified_by_user_id INT NULL,
  verified_by_name  VARCHAR(120) NULL,
  INDEX idx_hk_completed_room_no  (room_no),
  INDEX idx_hk_completed_assignee (assignee),
  INDEX idx_hk_completed_at       (completed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 10. Restaurant (tables, menu, orders, bills)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS restaurant_tables (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  number       VARCHAR(50) NOT NULL UNIQUE,
  status       VARCHAR(50) DEFAULT 'available',
  guestCount   INT DEFAULT 4,
  floor_name   VARCHAR(80) DEFAULT NULL,
  section_name VARCHAR(80) DEFAULT NULL,
  seat_count   INT NOT NULL DEFAULT 4,
  status_color VARCHAR(30) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS menu_items (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  name              VARCHAR(191) NOT NULL,
  price             DECIMAL(10,2) NOT NULL DEFAULT 0,
  category          VARCHAR(120) DEFAULT 'Other',
  table_number      VARCHAR(50) DEFAULT NULL,
  image_url         VARCHAR(255) DEFAULT NULL,
  description       TEXT DEFAULT NULL,
  food_type         VARCHAR(30) DEFAULT 'Veg',
  status            VARCHAR(40) DEFAULT 'Available',
  availability_status VARCHAR(40) DEFAULT 'Available',
  tax               DECIMAL(6,2) NOT NULL DEFAULT 5,
  happy_hour_price  DECIMAL(10,2) DEFAULT NULL,
  happy_hour_start  TIME DEFAULT NULL,
  happy_hour_end    TIME DEFAULT NULL,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS orders (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  tableNumber VARCHAR(50) NOT NULL,
  waiter_name VARCHAR(191) DEFAULT NULL,
  status      VARCHAR(30) NOT NULL DEFAULT 'pending',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_orders_waiter_name (waiter_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS order_items (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  order_id   INT NOT NULL,
  name       VARCHAR(191) NOT NULL,
  price      DECIMAL(10,2) NOT NULL DEFAULT 0,
  quantity   INT NOT NULL DEFAULT 1,
  CONSTRAINT fk_order_items_order
    FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS bills (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  tableNumber           VARCHAR(50) NOT NULL,
  token_id              INT DEFAULT NULL,
  entityType            VARCHAR(30) DEFAULT 'Table',
  waiter_name           VARCHAR(191) DEFAULT NULL,
  customerName          VARCHAR(191) DEFAULT NULL,
  phone                 VARCHAR(30) DEFAULT NULL,
  subtotal              DECIMAL(10,2) NOT NULL DEFAULT 0,
  serviceCharge         DECIMAL(10,2) NOT NULL DEFAULT 0,
  gst                   DECIMAL(10,2) NOT NULL DEFAULT 0,
  total                 DECIMAL(10,2) NOT NULL DEFAULT 0,
  discountAmount        DECIMAL(10,2) NOT NULL DEFAULT 0,
  paymentMethod         VARCHAR(50) DEFAULT NULL,
  invoiceStatus         VARCHAR(50) DEFAULT 'Saved',
  split_no              INT DEFAULT NULL,
  split_count           INT DEFAULT NULL,
  paid_at               DATETIME DEFAULT NULL,
  payment_id            INT DEFAULT NULL,
  account_transaction_id INT DEFAULT NULL,
  posted_to_room        TINYINT(1) NOT NULL DEFAULT 0,
  posted_room_number    VARCHAR(50) DEFAULT NULL,
  room_booking_id       INT DEFAULT NULL,
  room_booking_code     VARCHAR(80) DEFAULT NULL,
  folio_entry_id        INT DEFAULT NULL,
  source_table_number   VARCHAR(50) DEFAULT NULL,
  posted_at             DATETIME DEFAULT NULL,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_bills_token_id (token_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS restaurant_bills (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  modern_bill_id        INT DEFAULT NULL,
  tableNumber           VARCHAR(50) DEFAULT NULL,
  tokenId               INT DEFAULT NULL,
  entityType            VARCHAR(30) DEFAULT 'Table',
  waiter_name           VARCHAR(191) DEFAULT NULL,
  customerName          VARCHAR(191) DEFAULT NULL,
  phone                 VARCHAR(30) DEFAULT NULL,
  subtotal              DECIMAL(10,2) DEFAULT 0,
  serviceCharge         DECIMAL(10,2) DEFAULT 0,
  gst                   DECIMAL(10,2) DEFAULT 0,
  discount              DECIMAL(10,2) DEFAULT 0,
  total                 DECIMAL(10,2) DEFAULT 0,
  paymentMethod         VARCHAR(50) DEFAULT NULL,
  invoiceStatus         VARCHAR(30) DEFAULT 'unpaid',
  paid_at               DATETIME DEFAULT NULL,
  payment_id            INT DEFAULT NULL,
  account_transaction_id INT DEFAULT NULL,
  posted_to_room        TINYINT(1) NOT NULL DEFAULT 0,
  posted_room_number    VARCHAR(50) DEFAULT NULL,
  room_booking_id       INT DEFAULT NULL,
  room_booking_code     VARCHAR(80) DEFAULT NULL,
  folio_entry_id        INT DEFAULT NULL,
  source_table_number   VARCHAR(50) DEFAULT NULL,
  posted_at             DATETIME DEFAULT NULL,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_restaurant_bills_modern_bill_id (modern_bill_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS restaurant_item_action_requests (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  token_item_id INT NOT NULL,
  table_number  VARCHAR(50) NOT NULL,
  action_type   VARCHAR(30) NOT NULL,
  reason        TEXT NOT NULL,
  requested_by  VARCHAR(191) DEFAULT NULL,
  status        VARCHAR(30) NOT NULL DEFAULT 'Pending',
  manager_note  TEXT DEFAULT NULL,
  approved_by   VARCHAR(191) DEFAULT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS restaurant_split_bills (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  bill_id       INT DEFAULT NULL,
  table_number  VARCHAR(50) NOT NULL,
  entity_type   VARCHAR(30) DEFAULT 'Table',
  split_label   VARCHAR(80) NOT NULL,
  split_no      INT NOT NULL,
  split_count   INT NOT NULL,
  subtotal      DECIMAL(10,2) NOT NULL DEFAULT 0,
  gst           DECIMAL(10,2) NOT NULL DEFAULT 0,
  total         DECIMAL(10,2) NOT NULL DEFAULT 0,
  payment_method VARCHAR(50) DEFAULT NULL,
  items_json    LONGTEXT DEFAULT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tokens (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  token_code  VARCHAR(40) DEFAULT NULL,
  tableNumber VARCHAR(50) NOT NULL,
  waiter      VARCHAR(191) DEFAULT NULL,
  status      VARCHAR(30) NOT NULL DEFAULT 'active',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tokens_table       (tableNumber),
  INDEX idx_tokens_status      (status),
  UNIQUE KEY uniq_tokens_token_code (token_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS token_items (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  token_id   INT NOT NULL,
  item_name  VARCHAR(191) NOT NULL,
  qty        INT NOT NULL DEFAULT 1,
  rate       DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 11. Kitchen / Restaurant KOT
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kitchen_orders (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  table_number        VARCHAR(50) NOT NULL,
  waiter_name         VARCHAR(100) NULL,
  entity_type         VARCHAR(30) DEFAULT 'Table',
  items               LONGTEXT NULL,
  status              VARCHAR(50) DEFAULT 'Pending',
  token_status        VARCHAR(50) DEFAULT 'Active',
  kot_no              VARCHAR(100) DEFAULT NULL,
  prep_time_minutes   INT DEFAULT 20,
  expected_ready_at   DATETIME NULL,
  ready_at            DATETIME NULL,
  ready_message       VARCHAR(255) NULL,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 12. Room service
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS room_service_orders (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  room_number VARCHAR(50) NOT NULL,
  token_id    INT DEFAULT NULL,
  status      VARCHAR(30) DEFAULT 'pending',
  total       DECIMAL(10,2) DEFAULT 0,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rooms (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  room_number VARCHAR(50) NOT NULL UNIQUE,
  status      VARCHAR(60) DEFAULT 'Available',
  guest       VARCHAR(191) DEFAULT NULL,
  check_in    DATE DEFAULT NULL,
  check_out   DATE DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS room_menu_items (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  name     VARCHAR(191) NOT NULL,
  price    DECIMAL(10,2) NOT NULL DEFAULT 0,
  category VARCHAR(100) DEFAULT 'Other'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS room_orders (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  roomNumber VARCHAR(50) NOT NULL,
  status     VARCHAR(30) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS room_order_items (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  order_id  INT NOT NULL,
  name      VARCHAR(191) NOT NULL,
  price     DECIMAL(10,2) NOT NULL DEFAULT 0,
  quantity  INT NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS room_bills (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  roomNumber    VARCHAR(50) NOT NULL,
  subtotal      DECIMAL(10,2) NOT NULL DEFAULT 0,
  gst           DECIMAL(10,2) NOT NULL DEFAULT 0,
  total         DECIMAL(10,2) NOT NULL DEFAULT 0,
  paymentMethod VARCHAR(50) DEFAULT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 13. Inventory masters (12 small reference tables)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_menu_categories (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  status     VARCHAR(60) NOT NULL DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS inventory_stock_categories (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  subcategory VARCHAR(255) NULL,
  status      VARCHAR(60) NOT NULL DEFAULT 'Active',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS inventory_segments (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  description TEXT NULL,
  status      VARCHAR(60) NOT NULL DEFAULT 'Active',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS inventory_vendors (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  contact    VARCHAR(255) NULL,
  phone      VARCHAR(60) NULL,
  email      VARCHAR(255) NULL,
  city       VARCHAR(120) NULL,
  gstin      VARCHAR(80) NULL,
  status     VARCHAR(60) NOT NULL DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS inventory_units (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  short_name VARCHAR(60) NOT NULL,
  type       VARCHAR(80) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS inventory_unit_conversions (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  from_unit VARCHAR(60) NOT NULL,
  to_unit   VARCHAR(60) NOT NULL,
  factor    DECIMAL(12,4) NOT NULL DEFAULT 1,
  notes     TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS inventory_locations (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  type       VARCHAR(80) NOT NULL,
  manager    VARCHAR(255) NULL,
  status     VARCHAR(60) NOT NULL DEFAULT 'Open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS inventory_item_groups (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  segment    VARCHAR(255) NULL,
  status     VARCHAR(60) NOT NULL DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS inventory_gravies (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  base        VARCHAR(255) NULL,
  spice_level VARCHAR(80) NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS inventory_ingredients (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  group_name VARCHAR(255) NULL,
  unit       VARCHAR(60) NULL,
  status     VARCHAR(60) NOT NULL DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS inventory_purchase_items (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  item_name    VARCHAR(255) NOT NULL,
  vendor       VARCHAR(255) NOT NULL,
  quantity     DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit         VARCHAR(60) NULL,
  rate_per_unit DECIMAL(10,2) NOT NULL DEFAULT 0,
  amount       DECIMAL(10,2) NOT NULL DEFAULT 0,
  invoice_no   VARCHAR(120) NULL,
  purchase_date DATE NOT NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS inventory_purchase_services (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  service_name VARCHAR(255) NOT NULL,
  vendor       VARCHAR(255) NOT NULL,
  amount       DECIMAL(10,2) NOT NULL DEFAULT 0,
  service_date DATE NOT NULL,
  status       VARCHAR(60) NOT NULL DEFAULT 'Pending',
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 14. Inventory (items, ops, ledger)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(255) NOT NULL,
  category       VARCHAR(120) NULL,
  subcategory    VARCHAR(120) NULL,
  stock          DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit           VARCHAR(60) NULL,
  price          DECIMAL(10,2) NOT NULL DEFAULT 0,
  reorder_point  DECIMAL(10,2) NOT NULL DEFAULT 10,
  expiry         DATE NULL,
  branch         VARCHAR(120) NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS inventory_waste_log (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  item_id     INT NULL,
  item_name   VARCHAR(255) NOT NULL,
  quantity    DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit        VARCHAR(60) NULL,
  reason      VARCHAR(255) NOT NULL,
  store       VARCHAR(120) NULL,
  remarks     TEXT NULL,
  waste_date  DATE NULL,
  created_by  VARCHAR(120) NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS inventory_purchase_orders (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  po_number     VARCHAR(120) NOT NULL,
  vendor        VARCHAR(255) NOT NULL,
  item_name     VARCHAR(255) NOT NULL,
  quantity      DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit          VARCHAR(60) NULL,
  rate          DECIMAL(10,2) NOT NULL DEFAULT 0,
  expected_date DATE NULL,
  status        VARCHAR(60) NOT NULL DEFAULT 'Draft',
  created_by    VARCHAR(120) NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS inventory_stock_audit (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  item_id        INT NULL,
  item_name      VARCHAR(255) NOT NULL,
  system_stock   DECIMAL(10,2) NOT NULL DEFAULT 0,
  physical_stock DECIMAL(10,2) NOT NULL DEFAULT 0,
  variance       DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit           VARCHAR(60) NULL,
  remarks        TEXT NULL,
  audit_date     DATE NULL,
  audited_by     VARCHAR(120) NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS inventory_transfers (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  item_id       INT NULL,
  item_name     VARCHAR(255) NOT NULL,
  from_store    VARCHAR(120) NOT NULL,
  to_store      VARCHAR(120) NOT NULL,
  quantity      DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit          VARCHAR(60) NULL,
  approved_by   VARCHAR(120) NULL,
  transfer_date DATE NULL,
  notes         TEXT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS inventory_vendor_inwards (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  po_id             INT NULL,
  po_number         VARCHAR(120) NULL,
  vendor_name       VARCHAR(255) NOT NULL,
  item_id           INT NULL,
  item_name         VARCHAR(255) NOT NULL,
  quantity_received DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit              VARCHAR(60) NULL,
  rate              DECIMAL(10,2) NOT NULL DEFAULT 0,
  amount            DECIMAL(10,2) NOT NULL DEFAULT 0,
  invoice_no        VARCHAR(120) NULL,
  batch_no          VARCHAR(120) NULL,
  expiry_date       DATE NULL,
  received_date     DATE NOT NULL,
  store             VARCHAR(120) NULL,
  remarks           TEXT NULL,
  stock_updated     TINYINT(1) NOT NULL DEFAULT 0,
  created_by        VARCHAR(120) NULL,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS inventory_vendor_payments (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  vendor_name   VARCHAR(255) NOT NULL,
  invoice_ref   VARCHAR(120) NULL,
  payment_date  DATE NOT NULL,
  amount        DECIMAL(10,2) NOT NULL DEFAULT 0,
  payment_mode  VARCHAR(80) NOT NULL DEFAULT 'Bank Transfer',
  status        VARCHAR(60) NOT NULL DEFAULT 'Scheduled',
  notes         TEXT NULL,
  created_by    VARCHAR(120) NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS inventory_stock_ledger (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  item_id        INT NULL,
  item_name      VARCHAR(255) NULL,
  reference_type VARCHAR(80) NOT NULL,
  reference_id   INT NULL,
  direction      VARCHAR(10) NOT NULL DEFAULT 'IN',
  quantity       DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit           VARCHAR(60) NULL,
  vendor_name    VARCHAR(255) NULL,
  location_name  VARCHAR(120) NULL,
  rate           DECIMAL(10,2) NOT NULL DEFAULT 0,
  amount         DECIMAL(10,2) NOT NULL DEFAULT 0,
  balance_after  DECIMAL(10,2) NULL,
  remarks        TEXT NULL,
  entry_date     DATE NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS inventory_chef_issues (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  item_id           INT NULL,
  item_name         VARCHAR(255) NOT NULL,
  quantity_issued   DECIMAL(10,2) NOT NULL DEFAULT 0,
  quantity_returned DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit              VARCHAR(60) NULL,
  chef_name         VARCHAR(120) NULL,
  chef_id           INT NULL,
  purpose           VARCHAR(255) NULL,
  status            VARCHAR(30) NOT NULL DEFAULT 'issued',
  issued_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  returned_at       DATETIME NULL,
  remarks           TEXT NULL,
  created_by        VARCHAR(120) NULL,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 15. Menu recipe ↔ inventory link tables (FKs require menu_items + inventory)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS menu_item_ingredients (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  menu_item_id    INT NOT NULL,
  inventory_item_id INT NOT NULL,
  quantity        DECIMAL(10,3) NOT NULL DEFAULT 0,
  unit            VARCHAR(60) NULL,
  wastage_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  is_optional     TINYINT(1) NOT NULL DEFAULT 0,
  notes           TEXT NULL,
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_menu_recipe_item (menu_item_id, inventory_item_id),
  INDEX idx_menu_recipe_menu      (menu_item_id),
  INDEX idx_menu_recipe_inventory (inventory_item_id),
  CONSTRAINT fk_menu_recipe_menu_item
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_menu_recipe_inventory_item
    FOREIGN KEY (inventory_item_id) REFERENCES inventory(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS inventory_consumption_log (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  menu_item_id      INT NOT NULL,
  inventory_item_id INT NOT NULL,
  recipe_row_id     INT NULL,
  order_quantity    DECIMAL(10,3) NOT NULL DEFAULT 0,
  consumed_quantity DECIMAL(10,3) NOT NULL DEFAULT 0,
  unit              VARCHAR(60) NULL,
  reference_type    VARCHAR(80) NOT NULL DEFAULT 'manual',
  reference_id      VARCHAR(120) NULL,
  remarks           TEXT NULL,
  consumed_by       VARCHAR(120) NULL,
  consumed_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_consumption_menu      (menu_item_id),
  INDEX idx_consumption_inventory (inventory_item_id),
  INDEX idx_consumption_reference (reference_type, reference_id),
  CONSTRAINT fk_consumption_menu_item
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_consumption_inventory_item
    FOREIGN KEY (inventory_item_id) REFERENCES inventory(id) ON DELETE CASCADE,
  CONSTRAINT fk_consumption_recipe_row
    FOREIGN KEY (recipe_row_id) REFERENCES menu_item_ingredients(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 16. Settings (single-row key/value store)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_settings (
  id                       INT NOT NULL PRIMARY KEY,
  admin_whatsapp_number    VARCHAR(30)  DEFAULT NULL,
  admin_whatsapp_username  VARCHAR(80)  DEFAULT NULL,
  sms_enabled              TINYINT(1)   NOT NULL DEFAULT 0,
  business_name            VARCHAR(120) DEFAULT 'Maa Baglamukhi Resort',
  business_contact         VARCHAR(120) DEFAULT NULL,
  updated_at               TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO app_settings (id) VALUES (1);

-- ---------------------------------------------------------------------
-- 17. Print logs (audit trail + queue)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS print_logs (
  id            INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  print_no      VARCHAR(120) NOT NULL,
  invoice_no    VARCHAR(120) DEFAULT NULL,
  kot_no        VARCHAR(120) DEFAULT NULL,
  print_type    VARCHAR(80) NOT NULL,
  printer_name  VARCHAR(255) NOT NULL,
  print_count   INT NOT NULL DEFAULT 1,
  printed_by    VARCHAR(120) DEFAULT NULL,
  printed_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status        VARCHAR(50) NOT NULL DEFAULT 'success',
  error_message TEXT DEFAULT NULL,
  metadata      JSON DEFAULT NULL,
  INDEX idx_print_no    (print_no),
  INDEX idx_invoice_no  (invoice_no),
  INDEX idx_kot_no      (kot_no),
  INDEX idx_print_type  (print_type),
  INDEX idx_status      (status),
  INDEX idx_printed_at  (printed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS print_queue (
  id            INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  job_id        VARCHAR(120) NOT NULL,
  print_type    VARCHAR(80) NOT NULL,
  payload       JSON NOT NULL,
  printer_name  VARCHAR(255) NOT NULL,
  priority      INT NOT NULL DEFAULT 0,
  retry_count   INT NOT NULL DEFAULT 0,
  max_retries   INT NOT NULL DEFAULT 3,
  status        VARCHAR(50) NOT NULL DEFAULT 'queued',
  error_message TEXT DEFAULT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at  DATETIME DEFAULT NULL,
  INDEX idx_job_id               (job_id),
  INDEX idx_status               (status),
  INDEX idx_priority (priority, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================
-- Done. 84 tables total. To apply:
--   mysql -u root -p your_db_name < database-schema.sql
--
-- The backend's own ensureSchema() pass will then ALTER existing tables
-- to add any columns added after this snapshot, so this file is safe to
-- re-run or to use alongside a partially-bootstrapped database.
-- =====================================================================