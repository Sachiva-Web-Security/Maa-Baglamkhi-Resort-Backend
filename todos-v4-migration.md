# V4 Migration Checklist

## Completed
- [x] Step 0: Update app.js imports to use v4 models directly
- [x] Step 0: Commit and push backend `v4` branch with 67 v4 models + updated app.js
- [ ] Step 1: Fix services (PrintQueue, KitchenPrintService, InvoicePrintService, PrintService, RestaurantPrintService)
- [ ] Step 2: Fix middleware (auditLogger)
- [ ] Step 3: Fix utilities (kitchenOrderSync)
- [ ] Step 4: Fix routes (attendanceRoutes)
- [ ] Step 5: Fix simple controllers (auth, settings, tokens, notifications)
- [ ] Step 6: Fix medium controllers (payments, guests, users, staff, assignment, auditLog)
- [ ] Step 7: Fix complex controllers (booking, restaurant, housekeeping, banquet, kitchen)
- [ ] Step 8: Fix report controllers (reportController, reportsController)
- [ ] Step 9: Folder restructure to src/, modules/, etc.
- [ ] Step 10: Verification - node server.js boots, /api/health responds, tests pass
