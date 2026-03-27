const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const db = require("../../config/db");
const { app, initializeDatabase } = require("../../app");
const GuestModel = require("../../models/guestModel");
const HotelRoomInventoryModel = require("../../models/hotelRoomInventoryModel");
const HousekeepingModel = require("../../models/Housekeeping");
const RestaurantModel = require("../../models/RestaurantModel");
const FolioModel = require("../../models/folioModel");
const AdvanceModel = require("../../models/advanceModel");
const AccountsModel = require("../../models/AccountsModel");
const AttendanceModel = require("../../models/AttendanceModel");
const BanquetModel = require("../../models/BanquetModel");
const CompanyModel = require("../../models/companyModel");
const PaymentHistoryModel = require("../../models/Paymentadvance");
const PaxModel = require("../../models/paxModel");
const PaymentModel = require("../../models/PaymentModel");
const RoomServiceModel = require("../../models/RoomServiceModel");
const RoomTariffModel = require("../../models/roomTariffModel");
const InvoiceModel = require("../../models/InvoiceModel");
const TokenModel = require("../../models/TokenModel");

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";
let schemaReadyPromise = null;
let hashedPasswordsPromise = null;

const runQuery = async (sql, params = []) => {
  const [rows] = await db.promise().query(sql, params);
  return rows;
};

const getSeedPasswords = async () => {
  if (!hashedPasswordsPromise) {
    hashedPasswordsPromise = Promise.all([
      bcrypt.hash("Admin@123", 10),
      bcrypt.hash("Manager@123", 10),
      bcrypt.hash("Staff@123", 10),
    ]).then(([admin, manager, staff]) => ({ admin, manager, staff }));
  }

  return hashedPasswordsPromise;
};

const ensureSafeTestDatabase = () => {
  const usingDedicatedTestDb = Boolean(process.env.DB_NAME_TEST);
  const allowFallback = String(process.env.ALLOW_TEST_DB_FALLBACK || "").toLowerCase() === "true";

  if (process.env.NODE_ENV === "test" && !usingDedicatedTestDb && !allowFallback) {
    throw new Error(
      "Refusing to run destructive tests without DB_NAME_TEST. Set DB_NAME_TEST or ALLOW_TEST_DB_FALLBACK=true.",
    );
  }
};

const ensureExtraSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS register (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(191) NOT NULL,
      email VARCHAR(191) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'staff',
      avatar_url VARCHAR(255) DEFAULT NULL
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS companies (
      id INT AUTO_INCREMENT PRIMARY KEY,
      booking_id INT NOT NULL,
      company_name VARCHAR(191) NOT NULL,
      gstin VARCHAR(100) DEFAULT NULL
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS pax (
      id INT AUTO_INCREMENT PRIMARY KEY,
      booking_id INT NOT NULL,
      room_number VARCHAR(50) DEFAULT NULL,
      adults INT NOT NULL DEFAULT 1,
      children INT NOT NULL DEFAULT 0,
      meal_plan VARCHAR(100) DEFAULT NULL
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS room_tariff (
      id INT AUTO_INCREMENT PRIMARY KEY,
      booking_id INT NOT NULL,
      room_number VARCHAR(50) NOT NULL,
      date DATE DEFAULT NULL,
      quantity INT NOT NULL DEFAULT 1,
      category_name VARCHAR(120) DEFAULT 'Room Charge',
      tariff DECIMAL(10,2) NOT NULL DEFAULT 0,
      gst DECIMAL(10,2) NOT NULL DEFAULT 0,
      total DECIMAL(10,2) NOT NULL DEFAULT 0
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS payments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tableNumber VARCHAR(50) DEFAULT NULL,
      total DECIMAL(10,2) NOT NULL DEFAULT 0,
      paymentMethod VARCHAR(50) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS assignments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      staff_name VARCHAR(191) NOT NULL,
      room_number VARCHAR(50) DEFAULT NULL,
      task VARCHAR(255) NOT NULL,
      priority VARCHAR(50) DEFAULT 'Normal',
      assigned_by VARCHAR(191) DEFAULT NULL,
      due_time DATETIME DEFAULT NULL,
      notes TEXT DEFAULT NULL,
      status VARCHAR(50) DEFAULT 'Pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS room_orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      roomNumber VARCHAR(50) NOT NULL,
      status VARCHAR(30) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS room_order_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NOT NULL,
      name VARCHAR(191) NOT NULL,
      price DECIMAL(10,2) NOT NULL DEFAULT 0,
      quantity INT NOT NULL DEFAULT 1
    )
  `);
};

const ensureTestSchema = async () => {
  ensureSafeTestDatabase();
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      await initializeDatabase();
      await GuestModel.ensureSchema();
      await HotelRoomInventoryModel.ensureSchema();
      await HousekeepingModel.ensureSchema();
      await AccountsModel.ensureSchema();
      await AttendanceModel.ensureSchema();
      await BanquetModel.ensureSchema();
      await CompanyModel.ensureSchema();
      await RestaurantModel.ensureSchema();
      await FolioModel.ensureSchema();
      await AdvanceModel.ensureSchema();
      await PaymentHistoryModel.ensureSchema();
      await PaxModel.ensureSchema();
      await PaymentModel.ensureSchema();
      await RoomServiceModel.ensureSchema();
      await RoomTariffModel.ensureSchema();
      await InvoiceModel.ensureSchema();
      await TokenModel.ensureSchema();
      await ensureExtraSchema();
    })();
  }

  await schemaReadyPromise;
};

const TABLES_TO_CLEAR = [
  "restaurant_split_bills",
  "restaurant_item_action_requests",
  "kitchen_orders",
  "order_items",
  "orders",
  "bills",
  "menu_items",
  "tables",
  "room_menu_items",
  "rooms",
  "room_order_items",
  "room_orders",
  "hotel_folio_entries",
  "payment_history",
  "advance_payment",
  "invoices",
  "payments",
  "room_bills",
  "token_items",
  "tokens",
  "hotel_room_blocks",
  "attendance_records",
  "accounts_transactions",
  "audit_logs",
  "banquet_bookings",
  "banquet_halls",
  "assignments",
  "housekeeping_logs",
  "housekeeping",
  "hotel_room_inventory",
  "hotel_room_categories",
  "room_tariff",
  "pax",
  "companies",
  "guests",
  "register",
];

const clearDatabase = async () => {
  ensureSafeTestDatabase();
  await runQuery("SET FOREIGN_KEY_CHECKS = 0");
  for (const table of TABLES_TO_CLEAR) {
    try {
      await runQuery(`TRUNCATE TABLE ${table}`);
    } catch (error) {
      if (!String(error.message || error).includes("doesn't exist")) {
        throw error;
      }
    }
  }
  await runQuery("SET FOREIGN_KEY_CHECKS = 1");
};

const createAuthToken = (user) =>
  jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: String(user.role || "").toLowerCase(),
    },
    JWT_SECRET,
    { expiresIn: "7d" },
  );

const seedDatabase = async () => {
  const passwords = await getSeedPasswords();

  await runQuery(`
    INSERT INTO register (id, name, email, password, role, avatar_url)
    VALUES
      (1, 'Admin User', 'admin@test.com', ?, 'admin', NULL),
      (2, 'Manager User', 'manager@test.com', ?, 'manager', NULL),
      (3, 'Reception User', 'reception@test.com', ?, 'receptionist', NULL),
      (4, 'Account User', 'accounts@test.com', ?, 'accountant', NULL),
      (5, 'Housekeeping User', 'hk@test.com', ?, 'housekeeping', NULL)
  `, [passwords.admin, passwords.manager, passwords.staff, passwords.staff, passwords.staff]);

  await runQuery(`
    INSERT INTO hotel_room_categories (id, name, default_price, unit_label)
    VALUES
      (1, 'AC ROOM', 2000, 'PER NIGHT'),
      (2, 'DELUXE ROOM', 3000, 'PER NIGHT')
  `);

  await runQuery(`
    INSERT INTO hotel_room_inventory (id, category_id, room_number, guest, status, check_in, check_out)
    VALUES
      (1, 1, '101', 'John Carter', 'Available', NULL, NULL),
      (2, 1, '102', NULL, 'Available', NULL, NULL),
      (3, 2, '201', NULL, 'Available', NULL, NULL)
  `);

  await runQuery(`
    INSERT INTO housekeeping (id, roomNo, status, assignee, priority, notes)
    VALUES
      (1, '101', 'Vacant Clean', 'No Housekeeper', 'Normal', ''),
      (2, '102', 'Vacant Dirty', 'No Housekeeper', 'High', ''),
      (3, '201', 'Vacant Clean', 'No Housekeeper', 'Normal', '')
  `);

  await runQuery(`
    INSERT INTO guests (id, booking_code, mobile, guest_name, guest_email, check_in, check_out, arrival, departure, booking_status, cancel_reason)
    VALUES
      (1, 'BK-TEST-0001', '9990001111', 'John Carter', 'john@test.com', '2026-03-27', '2026-03-29', '10:00', '11:00', 'Confirmed', NULL),
      (2, 'BK-TEST-0002', '9990002222', 'Riya Sharma', 'riya@test.com', '2026-03-25', '2026-03-26', '09:00', '10:00', 'Checked Out', NULL),
      (3, 'BK-TEST-0003', '9990003333', 'Cancel Guest', 'cancel@test.com', '2026-03-28', '2026-03-30', '12:00', '10:00', 'Confirmed', NULL)
  `);

  await runQuery(`
    INSERT INTO companies (id, booking_id, company_name, gstin)
    VALUES
      (1, 1, 'Acme Travels', 'GST-001')
  `);

  await runQuery(`
    INSERT INTO pax (id, booking_id, room_number, adults, children, meal_plan)
    VALUES
      (1, 1, '101', 2, 1, 'MAP'),
      (2, 2, '201', 1, 0, 'CP')
  `);

  await runQuery(`
    INSERT INTO room_tariff (id, booking_id, room_number, date, quantity, category_name, tariff, gst, total)
    VALUES
      (1, 1, '101', '2026-03-27', 1, 'Deluxe Stay', 2000, 100, 2100),
      (2, 2, '201', '2026-03-25', 1, 'AC Stay', 1500, 75, 1575),
      (3, 3, '102', '2026-03-28', 1, 'AC Stay', 1800, 90, 1890)
  `);

  await runQuery(`
    INSERT INTO advance_payment (booking_id, amount, discount_amount, payment_mode, refund_amount)
    VALUES
      (1, 500, 100, 'Cash', 0),
      (2, 700, 0, 'UPI', 0),
      (3, 0, 0, 'Cash', 0)
  `);

  await runQuery(`
    INSERT INTO payment_history (id, booking_id, amount, discount_amount, payment_mode)
    VALUES
      (1, 1, 500, 100, 'Cash'),
      (2, 2, 700, 0, 'UPI')
  `);

  await runQuery(`
    INSERT INTO hotel_folio_entries (id, booking_id, entry_date, entry_type, category, description, amount, created_by)
    VALUES
      (1, 1, '2026-03-27', 'Extra Charge', 'Laundry', 'Laundry service', 200, 'Front Desk'),
      (2, 1, '2026-03-27', 'Discount', 'Promo', 'Loyalty discount', 50, 'Front Desk'),
      (3, 1, '2026-03-27', 'Payment', 'Cash', 'Extra payment', 100, 'Front Desk')
  `);

  await runQuery(`
    INSERT INTO room_orders (id, roomNumber, status)
    VALUES
      (1, '101', 'served'),
      (2, '101', 'pending')
  `);

  await runQuery(`
    INSERT INTO room_order_items (id, order_id, name, price, quantity)
    VALUES
      (1, 1, 'Veg Thali', 250, 2),
      (2, 1, 'Coffee', 80, 1),
      (3, 2, 'Should Not Bill', 999, 1)
  `);

  await runQuery(`
    INSERT INTO tables (id, number, floor_name, section_name, seat_count, status_color)
    VALUES
      (1, 'T1', 'Ground', 'Main', 4, '#14b8a6'),
      (2, 'T2', 'Ground', 'Patio', 2, '#3b82f6')
  `);

  await runQuery(`
    INSERT INTO menu_items (id, name, price, category, table_number, image_url, tax, happy_hour_price, happy_hour_start, happy_hour_end)
    VALUES
      (1, 'Paneer Tikka', 220, 'Starter', 'T1', NULL, 5, NULL, NULL, NULL),
      (2, 'Masala Soda', 90, 'Beverage', 'T1', NULL, 5, 70, '00:00:00', '23:59:59'),
      (3, 'Dal Fry', 180, 'Main Course', 'T2', NULL, 5, NULL, NULL, NULL)
  `);

  await runQuery(`
    INSERT INTO orders (id, tableNumber, status)
    VALUES
      (1, 'T1', 'pending'),
      (2, 'T2', 'paid')
  `);

  await runQuery(`
    INSERT INTO order_items (id, order_id, name, price, quantity)
    VALUES
      (1, 1, 'Paneer Tikka', 220, 2),
      (2, 1, 'Masala Soda', 90, 1),
      (3, 2, 'Dal Fry', 180, 1)
  `);

  await runQuery(`
    INSERT INTO bills (id, tableNumber, entityType, waiter_name, customerName, phone, subtotal, gst, total, paymentMethod, invoiceStatus, split_no, split_count)
    VALUES
      (1, 'T2', 'Table', 'Waiter One', 'Walk In', '9991000000', 180, 9, 189, 'Cash', 'Saved', NULL, NULL)
  `);

  await runQuery(`
    INSERT INTO payments (id, tableNumber, total, paymentMethod)
    VALUES
      (1, 'T2', 189, 'Cash')
  `);

  await runQuery(`
    INSERT INTO accounts_transactions (id, date, type, description, amount, payment_mode)
    VALUES
      (1, '2026-03-27', 'Income', 'Room revenue', 2958, 'Cash'),
      (2, '2026-03-27', 'Expense', 'Cleaning supplies', 300, 'Cash')
  `);

  await runQuery(`
    INSERT INTO attendance_records (id, date, employee_name, role, department, check_in, check_out, status, method)
    VALUES
      (1, '2026-03-27', 'Housekeeping User', 'housekeeping', 'Housekeeping', '09:00', '18:00', 'Present', 'Manual')
  `);

  await runQuery(`
    INSERT INTO assignments (id, staff_name, room_number, task, priority, assigned_by, due_time, notes, status)
    VALUES
      (1, 'Housekeeping User', '101', 'Clean room', 'High', 'Manager User', '2026-03-27 14:00:00', 'Priority cleaning', 'Pending'),
      (2, 'Housekeeping User', '102', 'Check minibar', 'Normal', 'Manager User', '2026-03-27 16:00:00', '', 'Completed')
  `);

  await runQuery(`
    INSERT INTO banquet_halls (id, name, capacity, rate_per_hour, is_ac, image, status)
    VALUES
      (1, 'Grand Ballroom', 300, 5000, 1, NULL, 'Available')
  `);

  await runQuery(`
    INSERT INTO banquet_bookings (
      id, hall_id, customer_name, phone, guest_email, event_title, event_type, guests,
      menu_package_id, meal_section, custom_menu_items, lighting_system, decoration_fee,
      notes, date, start_time, end_time, discount, gst_percent, invoice_no, status, advance
    )
    VALUES
      (1, 1, 'Banquet Guest', '7777777777', 'banquet@test.com', 'Wedding', 'Wedding', 150,
       'premium', 'Veg', 'Paneer', 'classic', 5000, 'Seeded banquet booking',
       '2026-03-30', '18:00:00', '22:00:00', 500, 5, NULL, 'Confirmed', 10000)
  `);

  await runQuery(`
    INSERT INTO tokens (id, tableNumber, waiter, status)
    VALUES
      (1, 'T1', 'Waiter One', 'active')
  `);

  await runQuery(`
    INSERT INTO token_items (id, token_id, item_name, qty, rate)
    VALUES
      (1, 1, 'Paneer Tikka', 2, 220),
      (2, 1, 'Masala Soda', 1, 90)
  `);

  await runQuery(`
    INSERT INTO kitchen_orders (
      id, table_number, waiter_name, entity_type, items, status, prep_time_minutes, expected_ready_at, ready_at, ready_message
    )
    VALUES
      (1, 'T1', 'Waiter One', 'Table', '[{"name":"Paneer Tikka","quantity":2,"price":220}]', 'Pending', 20, '2026-03-27 13:00:00', NULL, NULL)
  `);

  return {
    app,
    users: {
      admin: { id: 1, email: "admin@test.com", role: "admin" },
      manager: { id: 2, email: "manager@test.com", role: "manager" },
      receptionist: { id: 3, email: "reception@test.com", role: "receptionist" },
      accountant: { id: 4, email: "accounts@test.com", role: "accountant" },
      housekeeping: { id: 5, email: "hk@test.com", role: "housekeeping" },
    },
    bookings: {
      active: 1,
      checkedOut: 2,
      cancellable: 3,
    },
  };
};

const resetAndSeedDatabase = async () => {
  await ensureTestSchema();
  await clearDatabase();
  return seedDatabase();
};

module.exports = {
  app,
  db,
  runQuery,
  ensureTestSchema,
  clearDatabase,
  seedDatabase,
  resetAndSeedDatabase,
  createAuthToken,
};
