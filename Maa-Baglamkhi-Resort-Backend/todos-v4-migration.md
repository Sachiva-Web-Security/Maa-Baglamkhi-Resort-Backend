# V4 Migration Checklist

## Completed
- [x] Step 0: Update app.js imports to use v4 models directly
- [x] Step 0: Commit and push backend `v4` branch with 67 v4 models + updated app.js
- [x] Step 1: Fix services (PrintQueue, KitchenPrintService, InvoicePrintService, PrintService, RestaurantPrintService) — all use PrintLogsModel
- [x] Step 2: Fix middleware (auditLogger) — inlined createAuditLog using AuditLogsModel (v4)
- [x] Step 3: Fix utilities (kitchenOrderSync) — already raw SQL, no legacy imports
- [x] Step 4: Fix routes (attendanceRoutes) — uses AttendanceRecordsModel + UsersModel (v4)
- [x] Step 5: Fix simple controllers (auth, settings, tokens, notifications)
- [x] Step 6: Fix medium controllers (payments, guests, users, staff, assignment, auditLog, guestProfile, guestDocument, salary)
- [x] Step 7: Fix complex controllers (booking, restaurant, housekeeping, banquet, kitchen, chef, roomService)
- [x] Step 8: Fix report controllers (reportController, reportsController)
- [x] Step 8: Fix other controllers (InvoiceController, accounts, folio, groupBooking, inventory, inventoryMasters, menuRecipe, hotelRoomInventory, roomBlock, restaurantWhatsapp, banquetWhatsapp, whatsappInvoice)

## Remaining
- [ ] Step 9: Folder restructure to src/, modules/, etc. (production layout)
- [ ] Step 10: Verification — node server.js boots, /api/health responds, tests pass
