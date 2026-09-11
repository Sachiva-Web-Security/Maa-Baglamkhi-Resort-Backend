const fs = require('fs');
const path = require('path');

const backendDir = '/Users/apple/Desktop/S T P L/Sachiva/resort/Maa-Baglamkhi-Resort-Backend';
const modelsDir = path.join(backendDir, 'models');
fs.mkdirSync(modelsDir, { recursive: true });

const sql = fs.readFileSync(path.join(backendDir, 'schema-v4.sql'), 'utf8');
const tableRegex = /CREATE TABLE IF NOT EXISTS `(\w+)`\s*\(([\s\S]*?)\)\s*ENGINE=InnoDB/g;

function parseFields(raw) {
  const fields = [];
  const lines = raw.split(',\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    const m = line.match(/^`(\w+)`\s+(.*)$/);
    if (!m) continue;
    let def = m[2];
    def = def.replace(/ DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP/g, '');
    def = def.replace(/ DEFAULT CURRENT_TIMESTAMP/g, '');
    def = def.replace(/ ON UPDATE CURRENT_TIMESTAMP/g, '');
    fields.push({ name: m[1], def: def.trim() });
  }
  return fields;
}

function parseConstraints(raw) {
  const uniqueKeys = [];
  const indexes = [];
  const foreignKeys = [];
  const constraintLines = raw.match(/(?:UNIQUE )?KEY `[^`]+` \(`[^`]+(?:, `[^`]+)*`\)/g) || [];
  const fkLines = raw.match(/FOREIGN KEY \([^)]+\) REFERENCES `[^`]+`\(`[^`]+`\)[^)]*/g) || [];
  for (const line of constraintLines) {
    const unique = line.startsWith('UNIQUE');
    const km = line.match(/KEY `(\w+)` \(`(\w+)(?:, `(\w+))?`\)/);
    if (!km) continue;
    const cols = km[2] + (km[3] ? ', ' + km[3] : '');
    if (unique) uniqueKeys.push({ name: km[1], cols });
    else indexes.push({ name: km[1], cols });
  }
  for (const line of fkLines) {
    const fkm = line.match(/FOREIGN KEY \(`(\w+)`\) REFERENCES `(\w+)`\(`(\w+)`\)(?: ON DELETE (\w+))?(?: ON UPDATE (\w+))?/);
    if (!fkm) continue;
    foreignKeys.push({ col: fkm[1], refTable: fkm[2], refCol: fkm[3], onDelete: fkm[4] || 'RESTRICT', onUpdate: fkm[5] || 'CASCADE' });
  }
  let primaryKey = [];
  for (const line of raw.split(',\n').map(l => l.trim()).filter(Boolean)) {
    if (/PRIMARY KEY/.test(line)) {
      const pkm = line.match(/PRIMARY KEY \(`(\w+)`\)/);
      if (pkm) primaryKey = [pkm[1]];
    }
  }
  return { primaryKey, uniqueKeys, indexes, foreignKeys };
}

const seedData = {
  roles: [
    { name: 'admin', display_name: 'Administrator', is_system: 1 },
    { name: 'manager', display_name: 'Manager', is_system: 1 },
    { name: 'front_desk', display_name: 'Front Desk', is_system: 1 },
    { name: 'staff', display_name: 'Staff', is_system: 1 },
    { name: 'housekeeping', display_name: 'Housekeeping', is_system: 1 },
    { name: 'kitchen', display_name: 'Kitchen', is_system: 1 },
    { name: 'accountant', display_name: 'Accountant', is_system: 1 },
  ],
  booking_sources: [
    { name: 'Walk-in', type: 'walk_in' }, { name: 'Online Direct', type: 'direct' },
    { name: 'MakeMyTrip', type: 'ota' }, { name: 'Booking.com', type: 'ota' },
    { name: 'Goibibo', type: 'ota' }, { name: 'Agoda', type: 'ota' },
    { name: 'Corporate', type: 'corporate' }, { name: 'Travel Agent', type: 'travel_agent' },
  ],
  rate_plans: [
    { code: 'BAR', name: 'Best Available Rate', is_active: 1 },
    { code: 'EP', name: 'European Plan (Room Only)', is_active: 1 },
    { code: 'CP', name: 'Continental Plan (Breakfast)', is_active: 1, includes_breakfast: 1 },
    { code: 'MAP', name: 'Modified American Plan', is_active: 1, includes_breakfast: 1, includes_dinner: 1 },
    { code: 'AP', name: 'American Plan (All Meals)', is_active: 1, includes_breakfast: 1, includes_lunch: 1, includes_dinner: 1 },
  ],
  room_categories: [
    { name: 'AC ROOM', slug: 'ac-room', default_price: 2000 },
    { name: 'NON-AC ROOM', slug: 'non-ac-room', default_price: 1500 },
    { name: 'DELUXE ROOM', slug: 'deluxe-room', default_price: 3000 },
    { name: 'SUPER DELUXE ROOM', slug: 'super-deluxe-room', default_price: 4000 },
    { name: 'SUITE ROOM', slug: 'suite-room', default_price: 5000 },
    { name: 'DELUXE DORMITORY', slug: 'deluxe-dormitory', default_price: 800, unit_label: 'Bed' },
  ],
  amenities: [
    { name: 'WiFi', category: 'Technology' }, { name: 'Air Conditioning', category: 'Comfort' },
    { name: 'Swimming Pool', category: 'Recreation' }, { name: 'Spa', category: 'Wellness' },
    { name: 'Gym', category: 'Fitness' }, { name: 'Room Service', category: 'Service' },
    { name: 'Laundry', category: 'Service' }, { name: 'Parking', category: 'Facility' },
    { name: 'Restaurant', category: 'Dining' }, { name: 'Bar', category: 'Dining' },
  ],
  menu_categories: [
    { name: 'Starters', sort_order: 1 }, { name: 'Main Course', sort_order: 2 },
    { name: 'Breads', sort_order: 3 }, { name: 'Rice & Biryani', sort_order: 4 },
    { name: 'Desserts', sort_order: 5 }, { name: 'Beverages', sort_order: 6 },
  ],
  payment_methods: [
    { name: 'Cash', code: 'cash' }, { name: 'Credit Card', code: 'card' },
    { name: 'Debit Card', code: 'card' }, { name: 'UPI', code: 'upi' },
    { name: 'Net Banking', code: 'net_banking' }, { name: 'Credit (Hotel)', code: 'credit' },
  ],
  chart_of_accounts: [
    { code: '1000', name: 'Cash in Hand', type: 'asset' },
    { code: '1010', name: 'Bank Account', type: 'asset' },
    { code: '2000', name: 'Accounts Payable', type: 'liability' },
    { code: '3000', name: "Owner's Equity", type: 'equity' },
    { code: '4000', name: 'Room Revenue', type: 'revenue' },
    { code: '4010', name: 'Restaurant Revenue', type: 'revenue' },
    { code: '4020', name: 'Banquet Revenue', type: 'revenue' },
    { code: '5000', name: 'Cost of Goods Sold', type: 'expense' },
    { code: '5010', name: 'Staff Salaries', type: 'expense' },
    { code: '5020', name: 'Utilities', type: 'expense' },
  ],
  departments: [
    { name: 'Front Office' }, { name: 'Housekeeping' }, { name: 'Food & Beverage' },
    { name: 'Kitchen' }, { name: 'Finance' }, { name: 'Maintenance' }, { name: 'Security' }, { name: 'Management' },
  ],
  inventory_units: [
    { name: 'Piece', abbreviation: 'pcs' }, { name: 'Kilogram', abbreviation: 'kg' },
    { name: 'Gram', abbreviation: 'g' }, { name: 'Liter', abbreviation: 'L' },
    { name: 'Milliliter', abbreviation: 'ml' }, { name: 'Dozen', abbreviation: 'dz' },
    { name: 'Packet', abbreviation: 'pkt' }, { name: 'Box', abbreviation: 'box' },
  ],
  housekeeping_statuses: [
    { name: 'vacant_dirty', display_name: 'Vacant Dirty', color: '#F59E0B', sort_order: 1 },
    { name: 'vacant_clean', display_name: 'Vacant Clean', color: '#10B981', sort_order: 2 },
    { name: 'cleaning_in_progress', display_name: 'Cleaning In Progress', color: '#3B82F6', sort_order: 3 },
    { name: 'occupied_dirty', display_name: 'Occupied Dirty', color: '#EF4444', sort_order: 4 },
    { name: 'occupied_clean', display_name: 'Occupied Clean', color: '#10B981', sort_order: 5 },
    { name: 'out_of_service', display_name: 'Out of Service', color: '#6B7280', sort_order: 6 },
    { name: 'reserved', display_name: 'Reserved', color: '#8B5CF6', sort_order: 7 },
  ],
  permissions: [
    { module: 'dashboard', action: 'read' }, { module: 'bookings', action: 'create' },
    { module: 'bookings', action: 'read' }, { module: 'bookings', action: 'update' },
    { module: 'bookings', action: 'delete' }, { module: 'restaurant', action: 'create' },
    { module: 'restaurant', action: 'read' }, { module: 'kitchen', action: 'read' },
    { module: 'kitchen', action: 'update' }, { module: 'housekeeping', action: 'read' },
    { module: 'housekeeping', action: 'update' }, { module: 'inventory', action: 'read' },
    { module: 'inventory', action: 'update' }, { module: 'accounts', action: 'read' },
    { module: 'accounts', action: 'update' }, { module: 'reports', action: 'read' },
    { module: 'users', action: 'read' }, { module: 'users', action: 'update' },
    { module: 'settings', action: 'update' },
  ],
  resort_profiles: [{ name: 'Maa Baglamukhi Resort', country: 'India' }],
};

const commonQueries = {
  users: [
    { name: 'findByEmail', sql: "SELECT * FROM `users` WHERE `email` = ? AND `status` = 'active'" },
    { name: 'findById', sql: 'SELECT * FROM `users` WHERE `id` = ?' },
    { name: 'findByPhone', sql: "SELECT * FROM `users` WHERE `phone` = ? AND `status` = 'active'" },
  ],
  roles: [
    { name: 'findByName', sql: 'SELECT * FROM `roles` WHERE `name` = ?' },
    { name: 'findAll', sql: 'SELECT * FROM `roles` ORDER BY `id`' },
  ],
  permissions: [
    { name: 'findAll', sql: 'SELECT * FROM `permissions` ORDER BY `module`, `action`' },
  ],
  role_permissions: [
    { name: 'findByRoleId', sql: 'SELECT p.* FROM `permissions` p JOIN `role_permissions` rp ON p.id = rp.permission_id WHERE rp.role_id = ?' },
  ],
  bookings: [
    { name: 'findByCode', sql: 'SELECT * FROM `bookings` WHERE `booking_code` = ?' },
    { name: 'findUpcoming', sql: "SELECT * FROM `bookings` WHERE `status` IN ('confirmed','reserved','checked_in') AND `check_out` >= CURDATE() ORDER BY `check_in`" },
  ],
  booking_sources: [{ name: 'findAll', sql: 'SELECT * FROM `booking_sources` ORDER BY `name`' }],
  booking_status_history: [
    { name: 'findByBookingId', sql: 'SELECT * FROM `booking_status_history` WHERE `booking_id` = ? ORDER BY `created_at`' },
  ],
  booking_rooms: [
    { name: 'findByBookingId', sql: 'SELECT * FROM `booking_rooms` WHERE `booking_id` = ?' },
  ],
  guest_profiles: [
    { name: 'findByPhone', sql: 'SELECT * FROM `guest_profiles` WHERE `phone` = ?' },
    { name: 'findByEmail', sql: 'SELECT * FROM `guest_profiles` WHERE `email` = ?' },
    { name: 'findVIP', sql: 'SELECT * FROM `guest_profiles` WHERE `is_vip` = 1 ORDER BY `last_stay_date` DESC' },
  ],
  booking_guests: [
    { name: 'findByBookingId', sql: 'SELECT * FROM `booking_guests` WHERE `booking_id` = ?' },
  ],
  guest_identifications: [
    { name: 'findByBookingId', sql: 'SELECT * FROM `guest_identifications` WHERE `booking_id` = ?' },
  ],
  guest_reviews: [
    { name: 'findPublished', sql: 'SELECT * FROM `guest_reviews` WHERE `is_published` = 1 ORDER BY `created_at` DESC' },
  ],
  review_media: [
    { name: 'findByReviewId', sql: 'SELECT * FROM `review_media` WHERE `review_id` = ? ORDER BY `sort_order`' },
  ],
  special_requests: [
    { name: 'findByBookingId', sql: 'SELECT * FROM `special_requests` WHERE `booking_id` = ?' },
  ],
  promotions: [
    { name: 'findActive', sql: "SELECT * FROM `promotions` WHERE `is_active` = 1 AND `valid_from` <= CURDATE() AND `valid_to` >= CURDATE()" },
  ],
  promo_usages: [
    { name: 'findByBookingId', sql: 'SELECT * FROM `promo_usages` WHERE `booking_id` = ?' },
  ],
  restaurant_tables: [
    { name: 'findAll', sql: 'SELECT * FROM `restaurant_tables` ORDER BY `sort_order`, `number`' },
    { name: 'findByStatus', sql: 'SELECT * FROM `restaurant_tables` WHERE `status` = ?' },
  ],
  menu_categories: [
    { name: 'findAllActive', sql: 'SELECT * FROM `menu_categories` WHERE `is_active` = 1 ORDER BY `sort_order`, `name`' },
  ],
  menu_items: [
    { name: 'findAllAvailable', sql: "SELECT mi.*, mc.name as category_name FROM `menu_items` mi JOIN `menu_categories` mc ON mi.category_id = mc.id WHERE mi.status = 'available' ORDER BY mc.sort_order, mi.sort_order" },
  ],
  orders: [
    { name: 'findActive', sql: "SELECT * FROM `orders` WHERE `status` NOT IN ('completed','cancelled') ORDER BY `created_at` DESC" },
    { name: 'findByTable', sql: "SELECT * FROM `orders` WHERE `table_number` = ? AND `status` NOT IN ('completed','cancelled') ORDER BY `created_at` DESC" },
  ],
  order_items: [
    { name: 'findByOrderId', sql: 'SELECT * FROM `order_items` WHERE `order_id` = ? ORDER BY `id`' },
  ],
  bills: [
    { name: 'findByStatus', sql: 'SELECT * FROM `bills` WHERE `payment_status` = ? ORDER BY `created_at` DESC' },
    { name: 'findByDateRange', sql: 'SELECT * FROM `bills` WHERE `created_at` BETWEEN ? AND ?' },
  ],
  bill_splits: [
    { name: 'findByBillId', sql: 'SELECT * FROM `bill_splits` WHERE `bill_id` = ? ORDER BY `split_no`' },
  ],
  tokens: [
    { name: 'findByCode', sql: 'SELECT * FROM `tokens` WHERE `token_code` = ?' },
    { name: 'findActiveByTable', sql: "SELECT * FROM `tokens` WHERE `table_number` = ? AND `status` = 'active'" },
  ],
  kot_orders: [
    { name: 'findPending', sql: "SELECT * FROM `kot_orders` WHERE `status` IN ('pending','preparing') ORDER BY `created_at`" },
  ],
  banquet_halls: [
    { name: 'findAll', sql: 'SELECT * FROM `banquet_halls` ORDER BY `name`' },
    { name: 'findAvailable', sql: "SELECT * FROM `banquet_halls` WHERE `status` = 'available'" },
  ],
  banquet_pricing_plans: [
    { name: 'findByHallId', sql: 'SELECT * FROM `banquet_pricing_plans` WHERE `hall_id` = ?' },
  ],
  banquet_bookings: [
    { name: 'findByHallAndDate', sql: "SELECT * FROM `banquet_bookings` WHERE `hall_id` = ? AND `event_date` = ? AND `status` NOT IN ('cancelled')" },
  ],
  banquet_booking_addons: [
    { name: 'findByBookingId', sql: 'SELECT * FROM `banquet_booking_addons` WHERE `booking_id` = ?' },
  ],
  payment_methods: [
    { name: 'findAll', sql: 'SELECT * FROM `payment_methods` ORDER BY `name`' },
  ],
  payments: [
    { name: 'findByBookingId', sql: 'SELECT * FROM `payments` WHERE `booking_id` = ? ORDER BY `created_at`' },
    { name: 'findCompleted', sql: "SELECT * FROM `payments` WHERE `status` = 'completed' ORDER BY `created_at` DESC" },
  ],
  invoices: [
    { name: 'findByInvoiceNo', sql: 'SELECT * FROM `invoices` WHERE `invoice_no` = ?' },
    { name: 'findByBookingId', sql: 'SELECT * FROM `invoices` WHERE `booking_id` = ?' },
  ],
  invoice_lines: [
    { name: 'findByInvoiceId', sql: 'SELECT * FROM `invoice_lines` WHERE `invoice_id` = ? ORDER BY `id`' },
  ],
  folio_entries: [
    { name: 'findByBookingId', sql: 'SELECT * FROM `folio_entries` WHERE `booking_id` = ? ORDER BY `entry_date`, `id`' },
  ],
  housekeeping_statuses: [
    { name: 'findAll', sql: 'SELECT * FROM `housekeeping_statuses` ORDER BY `sort_order`' },
  ],
  housekeeping_assignments: [
    { name: 'findByStatus', sql: 'SELECT * FROM `housekeeping_assignments` WHERE `status` = ? ORDER BY `priority`, `created_at`' },
    { name: 'findByRoom', sql: 'SELECT * FROM `housekeeping_assignments` WHERE `room_number` = ? ORDER BY `created_at` DESC' },
  ],
  housekeeping_logs: [
    { name: 'findByRoom', sql: 'SELECT * FROM `housekeeping_logs` WHERE `room_number` = ? ORDER BY `completed_at` DESC' },
  ],
  maintenance_requests: [
    { name: 'findOpen', sql: "SELECT * FROM `maintenance_requests` WHERE `status` IN ('open','in_progress') ORDER BY FIELD(`priority`,'urgent','high','normal','low'), `created_at`" },
  ],
  inventory_categories: [
    { name: 'findAll', sql: 'SELECT * FROM `inventory_categories` ORDER BY `name`' },
  ],
  inventory_items: [
    { name: 'findAll', sql: 'SELECT * FROM `inventory_items` ORDER BY `name`' },
  ],
  inventory_stock: [
    { name: 'findByItem', sql: 'SELECT * FROM `inventory_stock` WHERE `inventory_item_id` = ?' },
  ],
  inventory_vendors: [
    { name: 'findAll', sql: 'SELECT * FROM `inventory_vendors` ORDER BY `name`' },
  ],
  inventory_units: [
    { name: 'findAll', sql: 'SELECT * FROM `inventory_units` ORDER BY `name`' },
  ],
  inventory_locations: [
    { name: 'findAll', sql: 'SELECT * FROM `inventory_locations` ORDER BY `name`' },
  ],
  inventory_purchases: [
    { name: 'findAll', sql: 'SELECT * FROM `inventory_purchases` ORDER BY `purchase_date` DESC' },
  ],
  inventory_purchase_items: [
    { name: 'findByPurchaseId', sql: 'SELECT * FROM `inventory_purchase_items` WHERE `purchase_id` = ?' },
  ],
  inventory_consumption: [
    { name: 'findByItemId', sql: 'SELECT * FROM `inventory_consumption` WHERE `inventory_item_id` = ? ORDER BY `consumed_at` DESC' },
  ],
  inventory_adjustments: [
    { name: 'findByItemId', sql: 'SELECT * FROM `inventory_adjustments` WHERE `inventory_item_id` = ? ORDER BY `created_at` DESC' },
  ],
  menu_item_ingredients: [
    { name: 'findByMenuItemId', sql: 'SELECT * FROM `menu_item_ingredients` WHERE `menu_item_id` = ? ORDER BY `sort_order`' },
  ],
  chart_of_accounts: [
    { name: 'findByType', sql: 'SELECT * FROM `chart_of_accounts` WHERE `type` = ? ORDER BY `code`' },
    { name: 'findAll', sql: 'SELECT * FROM `chart_of_accounts` ORDER BY `code`' },
  ],
  transactions: [
    { name: 'findByNo', sql: 'SELECT * FROM `transactions` WHERE `transaction_no` = ?' },
    { name: 'findByDateRange', sql: 'SELECT * FROM `transactions` WHERE `transaction_date` BETWEEN ? AND ?' },
  ],
  transaction_entries: [
    { name: 'findByTransactionId', sql: 'SELECT * FROM `transaction_entries` WHERE `transaction_id` = ?' },
  ],
  departments: [{ name: 'findAll', sql: 'SELECT * FROM `departments` ORDER BY `name`' }],
  designations: [{ name: 'findAll', sql: 'SELECT * FROM `designations` ORDER BY `name`' }],
  employees: [
    { name: 'findAll', sql: 'SELECT * FROM `employees` ORDER BY `first_name`' },
    { name: 'findByUserId', sql: 'SELECT * FROM `employees` WHERE `user_id` = ?' },
  ],
  attendance_records: [
    { name: 'findByEmployeeAndMonth', sql: 'SELECT * FROM `attendance_records` WHERE `employee_id` = ? AND MONTH(`date`) = ? AND YEAR(`date`) = ? ORDER BY `date`' },
  ],
  salary_payments: [
    { name: 'findByEmployeeAndMonth', sql: 'SELECT * FROM `salary_payments` WHERE `employee_id` = ? AND `month` = ?' },
  ],
  audit_logs: [
    { name: 'findByModule', sql: 'SELECT * FROM `audit_logs` WHERE `module` = ? ORDER BY `created_at` DESC' },
    { name: 'findByUserId', sql: 'SELECT * FROM `audit_logs` WHERE `user_id` = ? ORDER BY `created_at` DESC' },
  ],
  notifications: [
    { name: 'findByUserId', sql: 'SELECT * FROM `notifications` WHERE `user_id` = ? OR `user_role` = ? ORDER BY `created_at` DESC' },
    { name: 'findUnread', sql: 'SELECT * FROM `notifications` WHERE `is_read` = 0 ORDER BY `created_at` DESC' },
  ],
  app_settings: [
    { name: 'findByKey', sql: 'SELECT * FROM `app_settings` WHERE `key` = ?' },
    { name: 'findAll', sql: 'SELECT * FROM `app_settings` ORDER BY `key`' },
  ],
  print_logs: [
    { name: 'findByStatus', sql: 'SELECT * FROM `print_logs` WHERE `status` = ? ORDER BY `created_at` DESC' },
  ],
  communication_logs: [
    { name: 'findByChannel', sql: "SELECT * FROM `communication_logs` WHERE `channel` = ? ORDER BY `created_at` DESC" },
  ],
  room_categories: [
    { name: 'findAllActive', sql: 'SELECT * FROM `room_categories` WHERE `is_active` = 1 ORDER BY `sort_order`, `name`' },
  ],
  rooms: [
    { name: 'findByStatus', sql: 'SELECT * FROM `rooms` WHERE `status` = ? ORDER BY `room_number`' },
    { name: 'findAvailable', sql: "SELECT r.*, rc.name as category_name FROM `rooms` r JOIN `room_categories` rc ON r.category_id = rc.id WHERE r.status = 'available' AND r.category_id = ? ORDER BY r.room_number" },
  ],
  amenities: [{ name: 'findAll', sql: 'SELECT * FROM `amenities` ORDER BY `name`' }],
  room_category_amenities: [
    { name: 'findByCategory', sql: 'SELECT a.* FROM `amenities` a JOIN `room_category_amenities` rca ON a.id = rca.amenity_id WHERE rca.category_id = ?' },
  ],
  room_images: [
    { name: 'findByCategory', sql: 'SELECT * FROM `room_images` WHERE `category_id` = ? ORDER BY `sort_order`' },
  ],
  rate_plans: [
    { name: 'findAll', sql: 'SELECT * FROM `rate_plans` ORDER BY `id`' },
    { name: 'findByCode', sql: 'SELECT * FROM `rate_plans` WHERE `code` = ?' },
  ],
  room_rates: [
    { name: 'findByCategoryAndPlan', sql: 'SELECT * FROM `room_rates` WHERE `category_id` = ? AND `rate_plan_id` = ? AND `is_active` = 1' },
  ],
  room_rate_calendar: [
    { name: 'findByDateRange', sql: 'SELECT * FROM `room_rate_calendar` WHERE `category_id` = ? AND `date` BETWEEN ? AND ? AND `stop_sell` = 0' },
  ],
};

let tableCount = 0;
let match;
while ((match = tableRegex.exec(sql)) !== null) {
  const tableName = match[1];
  const raw = match[2].trim();
  const className = tableName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  const fileName = className + 'Model.js';

  const fields = parseFields(raw);
  const constraints = parseConstraints(raw);
  const seeds = seedData[tableName] || null;

  const fieldDefs = fields.map(function(f) { return '  `' + f.name + '` ' + f.def; }).join(',\n');
  const constraintParts = [];
  if (constraints.primaryKey.length) {
    constraintParts.push('  PRIMARY KEY (`' + constraints.primaryKey.join('`, `') + '`)');
  }
  constraints.uniqueKeys.forEach(function(uk) {
    constraintParts.push('  UNIQUE KEY `' + uk.name + '` (`' + uk.cols + '`)');
  });
  constraints.indexes.forEach(function(idx) {
    constraintParts.push('  KEY `' + idx.name + '` (`' + idx.cols + '`)');
  });
  constraints.foreignKeys.forEach(function(fk) {
    constraintParts.push('  FOREIGN KEY (`' + fk.col + '`) REFERENCES `' + fk.refTable + '`(`' + fk.refCol + '`) ON DELETE ' + fk.onDelete + ' ON UPDATE ' + fk.onUpdate);
  });
  const allConstraints = constraintParts.join(',\n');
  const createTableSql = 'CREATE TABLE IF NOT EXISTS `' + tableName + '` (\n          ' + fieldDefs + (allConstraints ? ',\n' + allConstraints : '') + '\n        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
  const escapedSql = createTableSql.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/'/g, "\\'");

  const ensureSchemaBody = '  async ensureSchema() {\n' +
    "    const conn = await pool.getConnection()\n" +
    '    try {\n' +
    '      await conn.beginTransaction()\n\n' +
    "      await conn.query(`" + escapedSql + "`)\n\n" +
    '      await conn.commit()\n' +
    '    } catch (err) {\n' +
    '      await conn.rollback()\n' +
    "      console.error('Schema error for " + tableName + ":', err.message)\n" +
    '    } finally {\n' +
    '      conn.release()\n' +
    '    }\n' +
    '  }';

  const queries = commonQueries[tableName] || [];
  const defaultQueries = [];
  if (!queries.find(function(q) { return q.name === 'findById'; }) && fields.some(function(f) { return f.name === 'id'; })) {
    defaultQueries.push({ name: 'findById', sql: 'SELECT * FROM `' + tableName + '` WHERE `id` = ?' });
  }
  if (!queries.find(function(q) { return q.name === 'findAll'; }) && fields.some(function(f) { return f.name === 'created_at'; })) {
    defaultQueries.push({ name: 'findAll', sql: 'SELECT * FROM `' + tableName + '` ORDER BY `created_at` DESC' });
  }
  const allQueries = queries.concat(defaultQueries);

  const queryMethodStrings = allQueries.map(function(q) {
    const escapedSql = q.sql.replace(/`/g, '\\`').replace(/'/g, "\\'");
    return '  async ' + q.name + '(...args) {\n    const [rows] = await this.pool.execute("' + escapedSql + '", args)\n    return rows\n  }';
  }).join('\n\n');

  let seedMethod = '';
  if (seeds) {
    const seedsJson = JSON.stringify(seeds);
    const keys = Object.keys(seeds);
    const cols = keys.join(', ');
    const placeholders = keys.map(function() { return '?'; }).join(', ');
    seedMethod = '\n  async seed() {\n    try {\n      const [existing] = await this.pool.execute(\'SELECT COUNT(*) as cnt FROM `' + tableName + '`\')\n      if (existing[0] && existing[0].cnt > 0) return\n      const rows = ' + seedsJson + '\n      const cols = \'' + cols + '\'\n      const placeholders = \'' + placeholders + '\'\n      for (const row of rows) {\n        const vals = Object.values(row)\n        await this.pool.execute(\'INSERT INTO `' + tableName + '` (\' + cols + \') VALUES (\' + placeholders + \')\', vals)\n      }\n    } catch (err) {\n      console.error(\'Seed error for ' + tableName + ':\', err.message)\n    }\n  }';
  }

  const content = 'const pool = require(\'../config/db\')\n\nclass ' + className + ' {\n  constructor() {\n    this.pool = pool\n  }\n\n' + ensureSchemaBody + '\n\n' + queryMethodStrings + seedMethod + '\n}\n\nmodule.exports = new (' + className + ')()\n';

  const filePath = path.join(modelsDir, fileName);
  fs.writeFileSync(filePath, content);
  tableCount++;
  console.log('Created ' + fileName + ' -> ' + tableName);
}

console.log('\nGenerated ' + tableCount + ' model files in ' + modelsDir);
