-- =====================================================================
-- BAGLAMUKHI RESORT — COMPLETE DATABASE SEED
-- Run against: employee database
-- Purpose: Realistic test data for every module
-- Run after: schema.sql
-- =====================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";

-- ─── 1. USERS (all roles) ────────────────────────────────────────────
TRUNCATE TABLE `register`;
INSERT INTO `register` (`id`, `name`, `email`, `password`, `role`) VALUES
(1,  'Admin User',       'admin@resort.com',     '$2b$10$9G1BpuXC7ZwBhib4gDKEVOAF8Na9LpNZJ6Z.t9mrJoxipWRB5/W3W', 'admin'),
(2,  'Rajesh Manager',   'manager@resort.com',   '$2b$10$9G1BpuXC7ZwBhib4gDKEVOAF8Na9LpNZJ6Z.t9mrJoxipWRB5/W3W', 'manager'),
(3,  'Priya Reception',  'reception@resort.com', '$2b$10$9G1BpuXC7ZwBhib4gDKEVOAF8Na9LpNZJ6Z.t9mrJoxipWRB5/W3W', 'receptionist'),
(4,  'Ramu Waiter',      'waiter@resort.com',    '$2b$10$9G1BpuXC7ZwBhib4gDKEVOAF8Na9LpNZJ6Z.t9mrJoxipWRB5/W3W', 'waiter'),
(5,  'Chef Kumar',       'kitchen@resort.com',   '$2b$10$9G1BpuXC7ZwBhib4gDKEVOAF8Na9LpNZJ6Z.t9mrJoxipWRB5/W3W', 'kitchen'),
(6,  'Tarun HK',         'tarun@resort.com',     '$2b$10$9G1BpuXC7ZwBhib4gDKEVOAF8Na9LpNZJ6Z.t9mrJoxipWRB5/W3W', 'housekeeping'),
(7,  'Kapil HK',         'kapil@resort.com',     '$2b$10$9G1BpuXC7ZwBhib4gDKEVOAF8Na9LpNZJ6Z.t9mrJoxipWRB5/W3W', 'housekeeping'),
(8,  'Sumit HK',         'sumit@resort.com',     '$2b$10$9G1BpuXC7ZwBhib4gDKEVOAF8Na9LpNZJ6Z.t9mrJoxipWRB5/W3W', 'housekeeping'),
(9,  'CA Accounts',      'accounts@resort.com',  '$2b$10$9G1BpuXC7ZwBhib4gDKEVOAF8Na9LpNZJ6Z.t9mrJoxipWRB5/W3W', 'accountant'),
(10, 'Front Desk Staff', 'staff@resort.com',     '$2b$10$9G1BpuXC7ZwBhib4gDKEVOAF8Na9LpNZJ6Z.t9mrJoxipWRB5/W3W', 'staff');
-- Default password for ALL users: "password"

-- ─── 2. ROOM CATEGORIES ─────────────────────────────────────────────
TRUNCATE TABLE `room_categories`;
INSERT INTO `room_categories` (`id`, `name`, `description`, `base_price`) VALUES
(1, 'AC Room',           'Air conditioned standard room',      1800.00),
(2, 'Non-AC Room',       'Standard room without AC',           1200.00),
(3, 'Deluxe Room',       'Spacious deluxe room with amenities', 2500.00),
(4, 'Super Deluxe Room', 'Premium room with extra facilities',  3500.00),
(5, 'Suite Room',        'Luxury suite with sitting area',      5500.00);

-- ─── 3. ROOMS ────────────────────────────────────────────────────────
TRUNCATE TABLE `rooms`;
INSERT INTO `rooms` (`id`, `room_number`, `room_type`, `price`, `status`, `category_id`, `room_name`, `floor_name`, `housekeeping_status`) VALUES
(1,  '101', 'AC Room',           1800, 'Occupied',  1, 'AC Room 101',   'Ground Floor', 'Occupied Clean'),
(2,  '102', 'AC Room',           1800, 'Available', 1, 'AC Room 102',   'Ground Floor', 'Vacant Clean'),
(3,  '103', 'AC Room',           1800, 'Available', 1, 'AC Room 103',   'Ground Floor', 'Vacant Dirty'),
(4,  '104', 'Non-AC Room',       1200, 'Available', 2, 'Non-AC 104',    'Ground Floor', 'Vacant Clean'),
(5,  '105', 'Non-AC Room',       1200, 'Occupied',  2, 'Non-AC 105',    'Ground Floor', 'Occupied Dirty'),
(6,  '201', 'Deluxe Room',       2500, 'Available', 3, 'Deluxe 201',    'First Floor',  'Vacant Clean'),
(7,  '202', 'Deluxe Room',       2500, 'Occupied',  3, 'Deluxe 202',    'First Floor',  'Occupied Clean'),
(8,  '203', 'Deluxe Room',       2500, 'Available', 3, 'Deluxe 203',    'First Floor',  'Vacant Dirty'),
(9,  '301', 'Super Deluxe Room', 3500, 'Available', 4, 'Super Deluxe 301','Second Floor','Vacant Clean'),
(10, '302', 'Super Deluxe Room', 3500, 'Available', 4, 'Super Deluxe 302','Second Floor','Vacant Clean'),
(11, '401', 'Suite Room',        5500, 'Occupied',  5, 'Suite 401',     'Top Floor',    'Occupied Clean'),
(12, '402', 'Suite Room',        5500, 'Available', 5, 'Suite 402',     'Top Floor',    'Vacant Clean');

-- ─── 4. GUESTS ───────────────────────────────────────────────────────
TRUNCATE TABLE `guests`;
INSERT INTO `guests` (`id`, `name`, `mobile`, `email`, `id_type`, `id_number`, `address`, `city`) VALUES
(1, 'Rahul Sharma',    '9876543210', 'rahul@email.com',   'Aadhaar', '1234-5678-9012', '12 MG Road',     'Jabalpur'),
(2, 'Priya Verma',     '9765432109', 'priya@email.com',   'PAN',     'ABCDE1234F',     '45 Civil Lines', 'Bhopal'),
(3, 'Amit Singh',      '9654321098', 'amit@email.com',    'Passport','IN1234567',      '78 Narmada Rd',  'Jabalpur'),
(4, 'Sunita Gupta',    '9543210987', 'sunita@email.com',  'Aadhaar', '9876-5432-1098', '23 Station Rd',  'Indore'),
(5, 'Vikram Joshi',    '9432109876', 'vikram@email.com',  'DL',      'MP0120020034567','56 Gandhi Nagar', 'Sagar'),
(6, 'Meera Patel',     '9321098765', 'meera@email.com',   'Aadhaar', '2345-6789-0123', '89 Tilak Nagar', 'Jabalpur'),
(7, 'Corporate Guest', '9210987654', 'corp@tcs.com',      'PAN',     'FGHIJ5678K',     'TCS Office',     'Mumbai');

-- ─── 5. BOOKINGS ─────────────────────────────────────────────────────
TRUNCATE TABLE `bookings`;
INSERT INTO `bookings` (`id`, `guest_name`, `mobile`, `email`, `check_in`, `check_out`, `booking_status`, `total_amount`, `paid_amount`, `remaining_amount`) VALUES
(1,  'Rahul Sharma',    '9876543210', 'rahul@email.com',  CURDATE(),                   DATE_ADD(CURDATE(), INTERVAL 2 DAY),  'Checked In',  5400.00,  5400.00,  0.00),
(2,  'Priya Verma',     '9765432109', 'priya@email.com',  CURDATE(),                   DATE_ADD(CURDATE(), INTERVAL 3 DAY),  'Confirmed',   7500.00,  3000.00,  4500.00),
(3,  'Amit Singh',      '9654321098', 'amit@email.com',   CURDATE(),                   DATE_ADD(CURDATE(), INTERVAL 1 DAY),  'Checked In',  2500.00,  2500.00,  0.00),
(4,  'Vikram Joshi',    '9432109876', 'vikram@email.com', DATE_ADD(CURDATE(),INTERVAL 1 DAY), DATE_ADD(CURDATE(), INTERVAL 4 DAY),  'Confirmed',   10500.00, 5000.00,  5500.00),
(5,  'Meera Patel',     '9321098765', 'meera@email.com',  DATE_SUB(CURDATE(),INTERVAL 1 DAY), CURDATE(),                           'Checked Out', 1800.00,  1800.00,  0.00),
(6,  'Sunita Gupta',    '9543210987', 'sunita@email.com', DATE_SUB(CURDATE(),INTERVAL 2 DAY), CURDATE(),                           'Checked Out', 3500.00,  3500.00,  0.00),
(7,  'Corporate Guest', '9210987654', 'corp@tcs.com',     DATE_ADD(CURDATE(),INTERVAL 2 DAY), DATE_ADD(CURDATE(), INTERVAL 5 DAY),  'Confirmed',   16500.00, 8000.00,  8500.00);

-- ─── 6. RESTAURANT TABLES ────────────────────────────────────────────
TRUNCATE TABLE `restaurant_tables`;
INSERT INTO `restaurant_tables` (`id`, `number`, `status`, `guestCount`) VALUES
(1, '1',  'available', 4),
(2, '2',  'available', 4),
(3, '3',  'available', 6),
(4, '4',  'available', 2),
(5, '5',  'available', 4),
(6, '6',  'available', 8),
(7, '7',  'available', 4),
(8, '8',  'available', 4),
(9, '9',  'available', 4),
(10,'10', 'available', 6),
(11,'11', 'available', 4),
(12,'12', 'available', 2);

-- ─── 7. MENU ITEMS ───────────────────────────────────────────────────
TRUNCATE TABLE `menu_items`;
INSERT INTO `menu_items` (`id`, `name`, `price`, `category`, `table_number`, `image_url`) VALUES
-- Starters
(1,  'Paneer Tikka',           220, 'Starter',    NULL, NULL),
(2,  'Chicken Tikka',          280, 'Starter',    NULL, NULL),
(3,  'Veg Manchurian',         180, 'Chinese',    NULL, NULL),
(4,  'Chicken Manchurian',     240, 'Chinese',    NULL, NULL),
(5,  'Samosa (2 pcs)',          60, 'Starter',    NULL, NULL),
(6,  'Mushroom Tikka',         200, 'Starter',    NULL, NULL),
-- Main Course - Veg
(7,  'Paneer Butter Masala',   260, 'Paneer',     NULL, NULL),
(8,  'Palak Paneer',           240, 'Paneer',     NULL, NULL),
(9,  'Dal Makhani',            180, 'Dal',        NULL, NULL),
(10, 'Dal Tadka',              160, 'Dal',        NULL, NULL),
(11, 'Shahi Paneer',           280, 'Paneer',     NULL, NULL),
(12, 'Mix Veg Sabzi',          180, 'Sabzi',      NULL, NULL),
(13, 'Aloo Gobi',              160, 'Sabzi',      NULL, NULL),
-- Main Course - Non Veg
(14, 'Butter Chicken',         320, 'Chicken',    NULL, NULL),
(15, 'Chicken Curry',          280, 'Chicken',    NULL, NULL),
(16, 'Chicken Biryani',        360, 'Biryani',    NULL, NULL),
(17, 'Mutton Curry',           380, 'Mutton',     NULL, NULL),
(18, 'Egg Curry',              180, 'Egg',        NULL, NULL),
-- Rice & Bread
(19, 'Jeera Rice',             120, 'Rice',       NULL, NULL),
(20, 'Veg Fried Rice',         180, 'Rice',       NULL, NULL),
(21, 'Chicken Fried Rice',     220, 'Rice',       NULL, NULL),
(22, 'Roti (2 pcs)',            40, 'Bread',      NULL, NULL),
(23, 'Naan (2 pcs)',            60, 'Bread',      NULL, NULL),
(24, 'Garlic Naan',             80, 'Bread',      NULL, NULL),
(25, 'Paratha',                 60, 'Bread',      NULL, NULL),
-- Soups
(26, 'Tomato Soup',            120, 'Soup',       NULL, NULL),
(27, 'Sweet Corn Soup',        130, 'Soup',       NULL, NULL),
(28, 'Hot & Sour Soup',        140, 'Soup',       NULL, NULL),
-- Beverages
(29, 'Lassi',                  80,  'Beverages',  NULL, NULL),
(30, 'Masala Chaas',           60,  'Beverages',  NULL, NULL),
(31, 'Fresh Lime Water',       60,  'Beverages',  NULL, NULL),
(32, 'Cold Coffee',            120, 'Beverages',  NULL, NULL),
(33, 'Mango Shake',            130, 'Beverages',  NULL, NULL),
(34, 'Mineral Water',          30,  'Beverages',  NULL, NULL),
-- Desserts
(35, 'Gulab Jamun (2 pcs)',     80, 'Dessert',    NULL, NULL),
(36, 'Ice Cream',               80, 'Dessert',    NULL, NULL),
(37, 'Kheer',                   90, 'Dessert',    NULL, NULL),
(38, 'Rasgulla (2 pcs)',        80, 'Dessert',    NULL, NULL),
-- Breakfast
(39, 'Poha',                    80, 'Breakfast',  NULL, NULL),
(40, 'Upma',                    80, 'Breakfast',  NULL, NULL),
(41, 'Idli Sambhar (4 pcs)',   100, 'Breakfast',  NULL, NULL),
(42, 'Masala Dosa',             130,'Breakfast',  NULL, NULL),
(43, 'Aloo Paratha with Curd', 120, 'Breakfast',  NULL, NULL),
(44, 'Bread Toast with Butter', 70, 'Breakfast',  NULL, NULL);

-- ─── 8. HOUSEKEEPING ─────────────────────────────────────────────────
TRUNCATE TABLE `housekeeping`;
INSERT INTO `housekeeping` (`id`, `type`, `roomNo`, `building`, `floor`, `section`, `guestStatus`, `roomType`, `status`, `assignee`) VALUES
(1,  'Accommodation', '101', NULL, '1', NULL, 'Occupied', 'AC Room',           'Occupied Clean',  'Tarun HK'),
(2,  'Accommodation', '102', NULL, '1', NULL, NULL,       'AC Room',           'Vacant Clean',    'Kapil HK'),
(3,  'Accommodation', '103', NULL, '1', NULL, NULL,       'AC Room',           'Vacant Dirty',    'No Housekeeper'),
(4,  'Accommodation', '104', NULL, '1', NULL, NULL,       'Non-AC Room',       'Vacant Clean',    'Sumit HK'),
(5,  'Accommodation', '105', NULL, '1', NULL, 'Occupied', 'Non-AC Room',       'Occupied Dirty',  'Tarun HK'),
(6,  'Accommodation', '201', NULL, '2', NULL, NULL,       'Deluxe Room',       'Vacant Clean',    'No Housekeeper'),
(7,  'Accommodation', '202', NULL, '2', NULL, 'Occupied', 'Deluxe Room',       'Occupied Clean',  'Kapil HK'),
(8,  'Accommodation', '203', NULL, '2', NULL, NULL,       'Deluxe Room',       'Vacant Dirty',    'No Housekeeper'),
(9,  'Accommodation', '301', NULL, '3', NULL, NULL,       'Super Deluxe Room', 'Vacant Clean',    'Sumit HK'),
(10, 'Accommodation', '302', NULL, '3', NULL, NULL,       'Super Deluxe Room', 'Vacant Clean',    'No Housekeeper'),
(11, 'Accommodation', '401', NULL, '4', NULL, 'Occupied', 'Suite Room',        'Occupied Clean',  'Tarun HK'),
(12, 'Accommodation', '402', NULL, '4', NULL, NULL,       'Suite Room',        'Vacant Clean',    'Kapil HK');

-- ─── 9. ASSIGNMENTS ──────────────────────────────────────────────────
TRUNCATE TABLE `assignments`;
INSERT INTO `assignments` (`id`, `staff_name`, `room_number`, `task`, `assigned_by`, `status`) VALUES
(1, 'Tarun HK',  '101', 'Clean and replace linen',          'Rajesh Manager', 'Completed'),
(2, 'Kapil HK',  '103', 'Deep clean vacant room',            'Rajesh Manager', 'Pending'),
(3, 'Sumit HK',  '203', 'Check minibar and replenish',       'Admin User',     'Pending'),
(4, 'Tarun HK',  '105', 'Change bed sheets, clean bathroom', 'Admin User',     'In Progress'),
(5, 'Kapil HK',  '202', 'Turn down service',                 'Rajesh Manager', 'Completed'),
(6, 'Sumit HK',  '301', 'Fresh room setup',                  'Rajesh Manager', 'Pending');

-- ─── 10. INVENTORY ───────────────────────────────────────────────────
TRUNCATE TABLE `inventory`;
INSERT INTO `inventory` (`id`, `name`, `category`, `stock`, `unit`, `price`, `branch`) VALUES
(1,  'Paneer',          'Dairy',    15,  'kg',    320.00, 'Kitchen'),
(2,  'Chicken',         'Meat',     20,  'kg',    220.00, 'Kitchen'),
(3,  'Tomato',          'Vegetable', 30, 'kg',    40.00,  'Kitchen'),
(4,  'Onion',           'Vegetable', 25, 'kg',    30.00,  'Kitchen'),
(5,  'Rice',            'Grain',    50,  'kg',    55.00,  'Kitchen'),
(6,  'Atta (Wheat)',    'Grain',    40,  'kg',    45.00,  'Kitchen'),
(7,  'Cooking Oil',     'Oil',       20, 'litre', 140.00, 'Kitchen'),
(8,  'Butter',          'Dairy',    10,  'kg',    480.00, 'Kitchen'),
(9,  'Cream',           'Dairy',    8,   'litre', 280.00, 'Kitchen'),
(10, 'Maida (Flour)',   'Grain',    25,  'kg',    42.00,  'Kitchen'),
(11, 'Sugar',           'Pantry',   20,  'kg',    48.00,  'Kitchen'),
(12, 'Salt',            'Pantry',   10,  'kg',    20.00,  'Kitchen'),
(13, 'Cumin',           'Spice',    2,   'kg',    420.00, 'Kitchen'),
(14, 'Turmeric',        'Spice',    2,   'kg',    240.00, 'Kitchen'),
(15, 'Garam Masala',    'Spice',    3,   'kg',    380.00, 'Kitchen'),
(16, 'Milk',            'Dairy',    30,  'litre', 54.00,  'Kitchen'),
(17, 'Eggs',            'Egg',      10,  'dozen', 90.00,  'Kitchen'),
(18, 'Mineral Water',   'Beverage', 200, 'bottle',18.00,  'Store'),
(19, 'Soft Drinks',     'Beverage', 100, 'bottle',40.00,  'Store'),
(20, 'Shampoo Sachet',  'HK Supply', 200,'piece', 8.00,   'Store'),
(21, 'Soap Bar',        'HK Supply', 150,'piece', 25.00,  'Store'),
(22, 'Towel (Bath)',    'Linen',    60,  'piece', 250.00, 'Store'),
(23, 'Bed Sheet',       'Linen',    80,  'piece', 350.00, 'Store'),
(24, 'Pillow Cover',    'Linen',    120, 'piece', 120.00, 'Store'),
(25, 'Blanket',         'Linen',    40,  'piece', 800.00, 'Store');

-- ─── 11. ACCOUNTS TRANSACTIONS ───────────────────────────────────────
TRUNCATE TABLE `accounts_transactions`;
INSERT INTO `accounts_transactions` (`id`, `date`, `type`, `description`, `amount`, `payment_mode`) VALUES
(1,  CURDATE(),                           'Income',  'Room booking - Rahul Sharma',    5400.00,  'Cash'),
(2,  CURDATE(),                           'Income',  'Room booking - Amit Singh',      2500.00,  'UPI'),
(3,  CURDATE(),                           'Income',  'Restaurant - Table 3',           1240.00,  'Cash'),
(4,  DATE_SUB(CURDATE(), INTERVAL 1 DAY), 'Income',  'Room booking - Meera Patel',     1800.00,  'Card'),
(5,  DATE_SUB(CURDATE(), INTERVAL 1 DAY), 'Expense', 'Grocery purchase - vegetables',  3200.00,  'Cash'),
(6,  DATE_SUB(CURDATE(), INTERVAL 1 DAY), 'Expense', 'Staff salary advance',           5000.00,  'UPI'),
(7,  DATE_SUB(CURDATE(), INTERVAL 2 DAY), 'Income',  'Room booking - Sunita Gupta',    3500.00,  'Card'),
(8,  DATE_SUB(CURDATE(), INTERVAL 2 DAY), 'Expense', 'Electricity bill',               8500.00,  'Bank Transfer'),
(9,  DATE_SUB(CURDATE(), INTERVAL 2 DAY), 'Income',  'Restaurant - banquet order',     12000.00, 'UPI'),
(10, DATE_SUB(CURDATE(), INTERVAL 3 DAY), 'Expense', 'Kitchen equipment repair',       2200.00,  'Cash'),
(11, DATE_SUB(CURDATE(), INTERVAL 3 DAY), 'Income',  'Restaurant - Room service',      680.00,   'Cash'),
(12, DATE_SUB(CURDATE(), INTERVAL 4 DAY), 'Expense', 'Laundry service',                1800.00,  'Cash'),
(13, DATE_SUB(CURDATE(), INTERVAL 5 DAY), 'Income',  'Banquet booking advance',        15000.00, 'UPI'),
(14, DATE_SUB(CURDATE(), INTERVAL 5 DAY), 'Expense', 'Housekeeping supplies',          4500.00,  'Cash'),
(15, DATE_SUB(CURDATE(), INTERVAL 7 DAY), 'Income',  'Restaurant - Table 8',           2340.00,  'Cash');

-- ─── 12. BANQUET HALLS ───────────────────────────────────────────────
TRUNCATE TABLE `banquet_halls`;
INSERT INTO `banquet_halls` (`id`, `name`, `capacity`, `rate_per_hour`, `is_ac`, `status`) VALUES
(1, 'Crystal Hall',    200, 5000.00, 1, 'Available'),
(2, 'Diamond Hall',    100, 3000.00, 1, 'Available'),
(3, 'Emerald Garden',  300, 4000.00, 0, 'Available'),
(4, 'Pearl Suite',      50, 2000.00, 1, 'Available');

-- ─── 13. BANQUET BOOKINGS ────────────────────────────────────────────
TRUNCATE TABLE `banquet_bookings`;
INSERT INTO `banquet_bookings` (`id`, `hall_id`, `guest_name`, `mobile`, `event_type`, `event_date`, `start_time`, `end_time`, `guest_count`, `status`, `advance_paid`, `total_amount`) VALUES
(1, 1, 'Sharma Wedding',  '9876543210', 'Wedding',    DATE_ADD(CURDATE(), INTERVAL 7 DAY),  '10:00', '22:00', 180, 'Confirmed', 25000.00, 85000.00),
(2, 2, 'TCS Conference',  '9210987654', 'Conference', DATE_ADD(CURDATE(), INTERVAL 3 DAY),  '09:00', '18:00',  80, 'Confirmed', 15000.00, 42000.00),
(3, 4, 'Birthday Party',  '9321098765', 'Birthday',   DATE_ADD(CURDATE(), INTERVAL 14 DAY), '18:00', '23:00',  45, 'Confirmed',  8000.00, 22000.00);

-- ─── 14. KITCHEN ORDERS (active for testing) ─────────────────────────
-- Close previous test orders
UPDATE `kitchen_orders` SET `token_status` = 'Closed' WHERE `token_status` = 'Active';

INSERT INTO `kitchen_orders` (`waiter_name`, `table_number`, `status`, `items`, `token_status`, `kot_no`, `entity_type`, `prep_time_minutes`, `expected_ready_at`) VALUES
('Ramu Waiter', 3, 'Pending', '[{"name":"Paneer Butter Masala","quantity":2,"price":260},{"name":"Dal Makhani","quantity":1,"price":180}]', 'Active', 'KOT-001', 'Table', 20, DATE_ADD(NOW(), INTERVAL 20 MINUTE)),
('Ramu Waiter', 5, 'Pending', '[{"name":"Butter Chicken","quantity":1,"price":320},{"name":"Garlic Naan","quantity":2,"price":80}]',          'Active', 'KOT-002', 'Table', 25, DATE_ADD(NOW(), INTERVAL 25 MINUTE));

-- ─── 15. ATTENDANCE RECORDS ──────────────────────────────────────────
TRUNCATE TABLE `attendance_records`;
INSERT INTO `attendance_records` (`staff_name`, `role`, `date`, `status`, `in_time`, `out_time`) VALUES
('Admin User',       'admin',          CURDATE(), 'Present', '09:00', '18:00'),
('Rajesh Manager',   'manager',        CURDATE(), 'Present', '09:30', NULL),
('Priya Reception',  'receptionist',   CURDATE(), 'Present', '08:00', NULL),
('Ramu Waiter',      'waiter',         CURDATE(), 'Present', '10:00', NULL),
('Chef Kumar',       'kitchen',        CURDATE(), 'Present', '07:00', NULL),
('Tarun HK',         'housekeeping',   CURDATE(), 'Present', '08:00', NULL),
('Kapil HK',         'housekeeping',   CURDATE(), 'Present', '08:00', NULL),
('Sumit HK',         'housekeeping',   CURDATE(), 'Absent',  NULL,    NULL),
('CA Accounts',      'accountant',     CURDATE(), 'Present', '10:00', NULL),
('Front Desk Staff', 'staff',          CURDATE(), 'Present', '09:00', NULL);

SET FOREIGN_KEY_CHECKS = 1;

-- ─── LOGIN CREDENTIALS ───────────────────────────────────────────────
-- Email: admin@resort.com      Password: password  Role: admin
-- Email: manager@resort.com    Password: password  Role: manager
-- Email: reception@resort.com  Password: password  Role: receptionist
-- Email: waiter@resort.com     Password: password  Role: waiter
-- Email: kitchen@resort.com    Password: password  Role: kitchen
-- Email: tarun@resort.com      Password: password  Role: housekeeping
-- Email: accounts@resort.com   Password: password  Role: accountant
