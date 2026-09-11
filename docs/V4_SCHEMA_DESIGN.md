# Resort Management System — v4 Normalized Schema Design

## Design Goals
1. **Booking.com-style** — rates calendar, reviews/ratings, image gallery, search filters, promotions
2. **Normalization** — eliminate duplicates, consistent FK naming, no redundant data
3. **Accountability** — full audit trail, user attribution, immutable financial records
4. **User-based RBAC** — roles + granular permissions per module
5. **Auto-bootstrap** — fresh install on any PC creates all tables automatically
6. **Frontend compatible** — preserve existing API contract shapes during transition

---

## Entity Groups

### 1. Auth & Users
| Table | Purpose |
|-------|---------|
| `users` | Staff accounts (replaces `register`) |
| `roles` | Role definitions (admin, manager, etc.) |
| `permissions` | Granular permission definitions |
| `role_permissions` | Role → permission mapping |
| `user_sessions` | Active login sessions / tokens |

### 2. Resort & Rooms
| Table | Purpose |
|-------|---------|
| `resort_profiles` | Resort master (name, address, contact, policies) |
| `room_categories` | Room types (AC, Deluxe, Suite…) with base rate, capacity, amenities |
| `rooms` | Individual room inventory (number, floor, building, status) |
| `room_amenities` | Amenity catalog (WiFi, Pool, Spa…) |
| `room_category_amenities` | Category ↔ amenity mapping |
| `room_images` | Image gallery per room/category |
| `room_rates` | Base/seasonal/promotional rates per category |
| `room_rate_calendar` | Date-specific rate overrides |
| `rate_plans` | Rate plan types (BAR, AP, CP, MAP, EP) |

### 3. Bookings & Guests
| Table | Purpose |
|-------|---------|
| `bookings` | Master booking (replaces `guests`) |
| `booking_guests` | Guest profiles (replaces denormalized guest fields) |
| `booking_rooms` | Room allocation per booking (1:N) |
| `booking_sources` | Channel: Walk-in, Online, OTA, Corporate, etc. |
| `booking_status_history` | Status change audit (Confirmed → Checked In → Checked Out → Cancelled) |
| `guest_identifications` | ID proofs, documents |
| `guest_reviews` | Reviews + ratings (Booking.com-style) |
| `review_media` | Review photos |
| `special_requests` | Early check-in, late check-out, anniversary, etc. |
| `promotions` | Active promotions & offers |
| `promo_usages` | Track promo redemption per booking |

### 4. Payments & Finance
| Table | Purpose |
|-------|---------|
| `payment_methods` | Cash, Card, UPI, Wallet, Net Banking… |
| `payments` | All payments (consolidates `payment_history`, `payments`, `advance_payment`) |
| `invoices` | Consolidated invoices (replaces per-module invoice tables) |
| `invoice_lines` | Line items per invoice |
| `folio_entries` | Guest folio charges/payments |
| `chart_of_accounts` | Accounting categories |
| `transactions` | Double-entry ledger (replaces `accounts_transactions`) |
| `transaction_entries` | Debit/credit legs per transaction |

### 5. Restaurant
| Table | Purpose |
|-------|---------|
| `restaurant_tables` | Floor plan tables |
| `menu_categories` | Menu section categories |
| `menu_items` | Menu items with pricing, availability |
| `menu_item_images` | Menu item photos |
| `orders` | Active orders (cart) |
| `order_items` | Items within an order |
| `bills` | Consolidated bills (replaces `bills` + `restaurant_bills`) |
| `bill_splits` | Split bill records |
| `tokens` | QR tokens for ordering |
| `kot_orders` | Kitchen order tickets |

### 6. Banquet & Events
| Table | Purpose |
|-------|---------|
| `banquet_halls` | Hall definitions |
| `banquet_pricing_plans` | Per-hall pricing tiers |
| `banquet_bookings` | Event bookings |
| `banquet_booking_menus` | Selected menu packages per booking |
| `banquet_booking_addons` | Lighting, decoration, etc. |

### 7. Room Service
| Table | Purpose |
|-------|---------|
| `room_service_orders` | Room service order master (no duplicate cart tables needed) |

### 8. Housekeeping & Maintenance
| Table | Purpose |
|-------|---------|
| `room_statuses` | Room status definitions |
| `housekeeping_assignments` | Cleaning tasks |
| `housekeeping_logs` | Completed cleaning audit |
| `maintenance_requests` | Repair/maintenance tickets |

### 9. Inventory & Procurement
| Table | Purpose |
|-------|---------|
| `inventory_categories` | Stock categories |
| `inventory_items` | Inventory master |
| `inventory_stock` | Current stock levels |
| `inventory_vendors` | Vendor master |
| `inventory_units` | UoM definitions |
| `inventory_locations` | Storage locations |
| `inventory_purchases` | Purchase orders |
| `inventory_purchase_items` | Line items per PO |
| `inventory_consumption` | Consumption log |
| `inventory_adjustments` | Stock adjustments |
| `menu_item_ingredients` | Recipe/BOM (reuse existing concept) |

### 10. HR & Attendance
| Table | Purpose |
|-------|---------|
| `employees` | Staff master (extends `users`) |
| `departments` | Department definitions |
| `designations` | Job titles |
| `attendance_records` | Daily attendance |
| `salary_structures` | Base salary + allowances |
| `salary_payments` | Monthly salary disbursement |

### 11. Communications
| Table | Purpose |
|-------|---------|
| `notifications` | In-app notifications |
| `notification_templates` | Message templates |
| `sms_logs` | SMS audit trail |
| `whatsapp_logs` | WhatsApp audit trail |

### 12. System & Audit
| Table | Purpose |
|-------|---------|
| `audit_logs` | Full action audit trail |
| `print_logs` | Print job history |
| `app_settings` | System configuration |
| `report_definitions` | Saved report configs |

---

## Key Normalization Improvements

### Eliminated Redundancies
- `guests.booking_code` → `bookings.booking_code` (source of truth)
- `rooms` (roomService) + `hotel_room_inventory` → single `rooms` table
- `bills` + `restaurant_bills` → single `bills` table
- `payment_history` + `payments` + `advance_payment` → single `payments` table
- `accounts_transactions` → proper double-entry `transactions` + `transaction_entries`

### Added Missing Features
- `room_rates` + `room_rate_calendar` — date-specific pricing (Booking.com needs this)
- `guest_reviews` + `review_media` — star ratings + photo reviews
- `room_images` — photo gallery per room
- `promotions` + `promo_usages` — discount codes, seasonal offers
- `booking_rooms` — multi-room per booking (group bookings)
- `booking_status_history` — full lifecycle tracking
- `chart_of_accounts` + proper ledger
- `rate_plans` — BAR, AP, CP, MAP, EP plans
- `room_amenities` — amenity catalog with category mapping

---

## Auto-Bootstrap Strategy
1. Each model has `ensureSchema()` using `CREATE TABLE IF NOT EXISTS`
2. Uses `SHOW COLUMNS LIKE` + `ALTER TABLE ADD COLUMN IF NOT EXISTS` for migrations
3. Adds `SHOW INDEX LIKE` + `ALTER TABLE ADD INDEX` for new indexes
4. Seeds default lookup data (roles, room categories, payment methods, rate plans, status definitions)
5. Creates default admin user if `users` table is empty

---

## Migration Strategy (Old → New)
Phase 1: Create new tables (parallel, no data migration)
Phase 2: Write data-migration scripts per entity group
Phase 3: Update backend routes/models to use new schema
Phase 4: Frontend compatibility layer (route aliases, response transforms)
Phase 5: Drop legacy tables after validation period

This file will be expanded with full CREATE TABLE statements and model implementations.
