-- =====================================================================
-- BAGLAMUKHI RESORT - COMPLETE SCHEMA
-- Run this FIRST, then seed.sql (or `npm run seed`)
-- =====================================================================

SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `restaurant_tables` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `number` VARCHAR(50) NOT NULL UNIQUE,
  `status` VARCHAR(50) DEFAULT 'available',
  `guestCount` INT DEFAULT 4,
  `floor_name` VARCHAR(50) DEFAULT NULL,
  `section_name` VARCHAR(50) DEFAULT NULL,
  `seat_count` INT DEFAULT 4,
  `status_color` VARCHAR(30) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `menu_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `price` DECIMAL(10,2) NOT NULL,
  `category` VARCHAR(100) NOT NULL DEFAULT 'Others',
  `table_number` VARCHAR(50) DEFAULT NULL,
  `image_url` VARCHAR(500) DEFAULT NULL,
  `description` TEXT DEFAULT NULL,
  `food_type` ENUM('Veg','Non Veg','Egg') DEFAULT 'Veg',
  `status` ENUM('Available','Out of Stock') DEFAULT 'Available',
  `tax` DECIMAL(5,2) DEFAULT 5.00,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `tokens` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `tableNumber` VARCHAR(50) DEFAULT NULL,
  `waiter` VARCHAR(100) DEFAULT NULL,
  `status` VARCHAR(20) DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_tokens_table` (`tableNumber`),
  INDEX `idx_tokens_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `token_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `token_id` INT DEFAULT NULL,
  `item_name` VARCHAR(255) DEFAULT NULL,
  `qty` INT DEFAULT 1,
  `rate` DECIMAL(10,2) DEFAULT NULL,
  FOREIGN KEY (`token_id`) REFERENCES `tokens`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `orders` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `tableNumber` VARCHAR(50) NOT NULL,
  `status` ENUM('pending','paid') DEFAULT 'pending',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `order_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `order_id` INT NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `price` DECIMAL(10,2) NOT NULL,
  `quantity` INT DEFAULT 1,
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `bills` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `tableNumber` VARCHAR(50) NOT NULL,
  `subtotal` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `gst` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `total` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `paymentMethod` VARCHAR(50) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `restaurant_bills` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `tableNumber` VARCHAR(50) DEFAULT NULL,
  `tokenId` INT DEFAULT NULL,
  `entityType` VARCHAR(30) DEFAULT 'Table',
  `subtotal` DECIMAL(10,2) DEFAULT 0,
  `gst` DECIMAL(10,2) DEFAULT 0,
  `discount` DECIMAL(10,2) DEFAULT 0,
  `total` DECIMAL(10,2) DEFAULT 0,
  `paymentMethod` VARCHAR(50) DEFAULT NULL,
  `invoiceStatus` VARCHAR(30) DEFAULT 'unpaid',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_rb_table` (`tableNumber`),
  INDEX `idx_rb_token` (`tokenId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `rooms` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `room_number` VARCHAR(10) DEFAULT NULL,
  `room_type` VARCHAR(50) DEFAULT NULL,
  `price` DECIMAL(10,2) DEFAULT NULL,
  `status` VARCHAR(20) DEFAULT 'Available',
  `category_id` INT DEFAULT NULL,
  `room_name` VARCHAR(120) DEFAULT NULL,
  `floor_name` VARCHAR(50) DEFAULT NULL,
  `housekeeping_status` VARCHAR(50) NOT NULL DEFAULT 'Vacant Clean',
  `notes` TEXT DEFAULT NULL,
  `guest` VARCHAR(255) DEFAULT NULL,
  `check_in` DATE DEFAULT NULL,
  `check_out` DATE DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `room_service_orders` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `room_number` VARCHAR(50) NOT NULL,
  `token_id` INT DEFAULT NULL,
  `status` VARCHAR(30) DEFAULT 'pending',
  `total` DECIMAL(10,2) DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `kitchen_orders` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `waiter_name` VARCHAR(100) DEFAULT NULL,
  `table_number` VARCHAR(50) DEFAULT NULL,
  `item_name` VARCHAR(255) DEFAULT NULL,
  `status` VARCHAR(50) DEFAULT 'Pending',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `items` LONGTEXT DEFAULT NULL,
  `token_status` VARCHAR(50) DEFAULT 'Active',
  `source_order_id` INT DEFAULT NULL,
  `kot_no` VARCHAR(80) DEFAULT NULL,
  `entity_type` VARCHAR(30) DEFAULT 'Table',
  `prep_time_minutes` INT DEFAULT 20,
  `expected_ready_at` DATETIME DEFAULT NULL,
  `ready_at` DATETIME DEFAULT NULL,
  `ready_message` VARCHAR(255) DEFAULT NULL,
  INDEX `idx_ko_status` (`status`),
  INDEX `idx_ko_table` (`table_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `housekeeping` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `type` VARCHAR(50) DEFAULT 'Accommodation',
  `roomNo` VARCHAR(20) NOT NULL,
  `building` VARCHAR(50) DEFAULT NULL,
  `floor` VARCHAR(10) DEFAULT NULL,
  `section` VARCHAR(50) DEFAULT NULL,
  `guestStatus` VARCHAR(50) DEFAULT NULL,
  `roomType` VARCHAR(100) DEFAULT NULL,
  `status` VARCHAR(50) DEFAULT 'Vacant Dirty',
  `assignee` VARCHAR(100) DEFAULT 'No Housekeeper',
  `layout` VARCHAR(50) DEFAULT NULL,
  `articles` VARCHAR(50) DEFAULT NULL,
  `services` VARCHAR(50) DEFAULT NULL,
  `notes` TINYINT(1) DEFAULT 0,
  `priority` ENUM('Urgent','High','Normal','Low') DEFAULT 'Normal',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `assignments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `staff_name` VARCHAR(100) DEFAULT NULL,
  `room_number` VARCHAR(50) DEFAULT NULL,
  `task` TEXT DEFAULT NULL,
  `status` VARCHAR(50) DEFAULT 'Pending',
  `assigned_by` VARCHAR(100) DEFAULT NULL,
  `priority` ENUM('Urgent','High','Normal','Low') DEFAULT 'Normal',
  `due_time` VARCHAR(10) DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `inventory` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `category` VARCHAR(100) NOT NULL,
  `stock` INT DEFAULT 0,
  `unit` VARCHAR(50) DEFAULT NULL,
  `price` DECIMAL(10,2) DEFAULT NULL,
  `reorderPoint` INT DEFAULT 5,
  `expiry` DATE DEFAULT NULL,
  `branch` VARCHAR(100) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `accounts_transactions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `date` DATE NOT NULL,
  `type` ENUM('Income','Expense') NOT NULL,
  `description` VARCHAR(255) NOT NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `payment_mode` VARCHAR(30) NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `invoices` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `invoice_no` VARCHAR(50) DEFAULT NULL,
  `guest_name` VARCHAR(200) NOT NULL,
  `guest_email` VARCHAR(200) DEFAULT NULL,
  `items` TEXT DEFAULT NULL,
  `subtotal` DECIMAL(10,2) DEFAULT 0,
  `gst` DECIMAL(10,2) DEFAULT 0,
  `discount` DECIMAL(10,2) DEFAULT 0,
  `total` DECIMAL(10,2) DEFAULT 0,
  `payment_mode` VARCHAR(50) DEFAULT NULL,
  `status` VARCHAR(30) DEFAULT 'Pending',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `guests` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(200) NOT NULL,
  `mobile` VARCHAR(15) DEFAULT NULL,
  `email` VARCHAR(150) DEFAULT NULL,
  `id_type` VARCHAR(50) DEFAULT NULL,
  `id_number` VARCHAR(100) DEFAULT NULL,
  `address` TEXT DEFAULT NULL,
  `city` VARCHAR(100) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `bookings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `guest_name` VARCHAR(100) DEFAULT NULL,
  `mobile` VARCHAR(15) DEFAULT NULL,
  `email` VARCHAR(100) DEFAULT NULL,
  `check_in` DATE DEFAULT NULL,
  `check_out` DATE DEFAULT NULL,
  `booking_status` VARCHAR(50) DEFAULT NULL,
  `company_name` VARCHAR(100) DEFAULT NULL,
  `gstin` VARCHAR(50) DEFAULT NULL,
  `total_amount` DECIMAL(10,2) DEFAULT NULL,
  `paid_amount` DECIMAL(10,2) DEFAULT 0,
  `remaining_amount` DECIMAL(10,2) DEFAULT NULL,
  `room_id` INT DEFAULT NULL,
  `checkout_date` DATE DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `banquet_halls` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `capacity` INT DEFAULT 100,
  `rate_per_hour` DECIMAL(10,2) DEFAULT 0,
  `is_ac` TINYINT(1) DEFAULT 1,
  `status` VARCHAR(30) DEFAULT 'Available',
  `description` TEXT DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `banquet_bookings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `hall_id` INT DEFAULT NULL,
  `guest_name` VARCHAR(200) NOT NULL,
  `mobile` VARCHAR(15) DEFAULT NULL,
  `event_type` VARCHAR(100) DEFAULT NULL,
  `event_date` DATE DEFAULT NULL,
  `start_time` VARCHAR(10) DEFAULT NULL,
  `end_time` VARCHAR(10) DEFAULT NULL,
  `guest_count` INT DEFAULT 0,
  `status` VARCHAR(30) DEFAULT 'Confirmed',
  `advance_paid` DECIMAL(10,2) DEFAULT 0,
  `total_amount` DECIMAL(10,2) DEFAULT 0,
  `notes` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `register` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(100) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `role` ENUM('admin','manager','receptionist','waiter','kitchen','housekeeping','accountant','staff') NOT NULL DEFAULT 'staff',
  `avatar_url` VARCHAR(500) DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `attendance_records` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `staff_name` VARCHAR(100) DEFAULT NULL,
  `role` VARCHAR(50) DEFAULT NULL,
  `date` DATE NOT NULL,
  `status` ENUM('Present','Absent','Late','Half Day') DEFAULT 'Present',
  `in_time` VARCHAR(10) DEFAULT NULL,
  `out_time` VARCHAR(10) DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_att_date` (`date`),
  INDEX `idx_att_staff` (`staff_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `room_categories` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `base_price` DECIMAL(10,2) DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `hk_parameters` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `cleaning_time_minutes` INT DEFAULT 30,
  `max_rooms_per_housekeeper` INT DEFAULT 10,
  `shift_start_time` VARCHAR(10) DEFAULT '08:00',
  `shift_end_time` VARCHAR(10) DEFAULT '20:00',
  `auto_release_enabled` TINYINT(1) DEFAULT 1,
  `inspection_required` TINYINT(1) DEFAULT 1,
  `default_assignee` VARCHAR(100) DEFAULT 'No Housekeeper',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO `hk_parameters` (`id`) VALUES (1);

SET FOREIGN_KEY_CHECKS = 1;
