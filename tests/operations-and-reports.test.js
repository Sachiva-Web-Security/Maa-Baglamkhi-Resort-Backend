const { api, authHeader } = require("./helpers/testRequest");
const { resetAndSeedDatabase, runQuery } = require("./helpers/testDb");

describe("Operations, Dashboard, Reports, and Audit APIs", () => {
  let seed;

  beforeEach(async () => {
    seed = await resetAndSeedDatabase();
  });

  describe("assignments", () => {
    test("lists assignments", async () => {
      const res = await api().get("/api/assignments").set(authHeader(seed.users.manager));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });

    test("returns assignment stats", async () => {
      const res = await api().get("/api/assignments/stats").set(authHeader(seed.users.manager));
      expect(res.status).toBe(200);
      expect(res.body.total).toBeGreaterThanOrEqual(2);
      expect(res.body.completed).toBeGreaterThanOrEqual(1);
    });

    test("creates assignment", async () => {
      const res = await api()
        .post("/api/assignments")
        .set(authHeader(seed.users.manager))
        .send({
          staffName: "Housekeeping User",
          roomNumber: "201",
          task: "Dust furniture",
          assignedBy: "Manager User",
        });

      expect(res.status).toBe(200);
      expect(res.body.id).toBeTruthy();
    });

    test("updates assignment", async () => {
      const res = await api()
        .put("/api/assignments/1")
        .set(authHeader(seed.users.manager))
        .send({
          status: "Completed",
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/updated/i);
    });

    test("rejects empty assignment update", async () => {
      const res = await api()
        .put("/api/assignments/1")
        .set(authHeader(seed.users.manager))
        .send({});
      expect(res.status).toBe(400);
    });

    test("deletes assignment", async () => {
      const res = await api().delete("/api/assignments/1").set(authHeader(seed.users.manager));
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/deleted/i);
    });
  });

  describe("housekeeping", () => {
    test("lists housekeeping rooms", async () => {
      const res = await api().get("/api/housekeeping").set(authHeader(seed.users.housekeeping));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test("returns housekeeping logs", async () => {
      const res = await api().get("/api/housekeeping/logs").set(authHeader(seed.users.housekeeping));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test("creates housekeeping room entry", async () => {
      const res = await api().post("/api/housekeeping").set(authHeader(seed.users.housekeeping)).send({
        roomNo: "501",
        status: "Vacant Dirty",
        assignee: "Housekeeping User",
        priority: "High",
        notes: "Fresh setup",
      });

      expect(res.status).toBe(200);
      expect(res.body.updatedExisting).toBe(false);
    });

    test("writes housekeeping log on status update", async () => {
      const updateRes = await api().put("/api/housekeeping/status/2").set(authHeader(seed.users.housekeeping)).send({
        status: "Cleaning In Progress",
      });

      expect(updateRes.status).toBe(200);

      const logsRes = await api().get("/api/housekeeping/logs").set(authHeader(seed.users.housekeeping));
      expect(logsRes.status).toBe(200);
      expect(
        logsRes.body.some(
          (row) => row.roomNo === "102" && row.newStatus === "Cleaning In Progress",
        ),
      ).toBe(true);
    });

    test("updates housekeeping room", async () => {
      const res = await api().put("/api/housekeeping/1").set(authHeader(seed.users.housekeeping)).send({
        status: "Vacant Clean",
        assignee: "Housekeeping User",
        priority: "Normal",
        notes: "Done",
      });

      expect(res.status).toBe(200);
    });

    test("updates housekeeping status", async () => {
      const res = await api().put("/api/housekeeping/status/2").set(authHeader(seed.users.housekeeping)).send({
        status: "Cleaning In Progress",
      });

      expect(res.status).toBe(200);
    });

    test("updates housekeeping assignee", async () => {
      const res = await api().put("/api/housekeeping/assignee/2").set(authHeader(seed.users.housekeeping)).send({
        assignee: "Housekeeping User",
      });

      expect(res.status).toBe(200);
    });

    test("deletes housekeeping room", async () => {
      await api().post("/api/housekeeping").set(authHeader(seed.users.housekeeping)).send({
        roomNo: "601",
        status: "Vacant Dirty",
      });

      const res = await api().delete("/api/housekeeping/601").set(authHeader(seed.users.housekeeping));
      expect(res.status).toBe(200);
    });
  });

  describe("accounts and attendance", () => {
    test("lists account transactions", async () => {
      const res = await api().get("/api/accounts/transactions");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test("returns accounts summary", async () => {
      const beforeRes = await api().get("/api/accounts/summary");
      expect(beforeRes.status).toBe(200);

      await runQuery(`
        INSERT INTO invoices
        (
          invoice_no, date, customer_name, phone, room_no, check_in, check_out,
          price_per_day, food_charge, extra_charge, subtotal, gst, discount,
          final_total, total_amount, payment_mode, payment_status, status,
          booking_id, customer_id
        )
        VALUES
        ('ACC-SUMMARY-1', '2026-03-27', 'Summary Guest', '9991112222', '201', '2026-03-27', '2026-03-28',
         1800, 0, 0, 1800, 90, 0, 1890, 1890, 'Cash', 'Paid', 'Paid', 88, 88)
      `);

      const res = await api().get("/api/accounts/summary");
      expect(res.status).toBe(200);
      expect(res.body.income).toBeGreaterThan(0);
      expect(res.body.expense).toBeGreaterThanOrEqual(0);
      expect(res.body.income - beforeRes.body.income).toBe(1890);
      expect(res.body.gstPayable - beforeRes.body.gstPayable).toBeCloseTo(90, 2);
    });

    test("returns invoice-backed summaries even when accounts transactions are empty", async () => {
      await runQuery("DELETE FROM accounts_transactions");

      await runQuery(`
        INSERT INTO invoices
        (
          invoice_no, date, customer_name, phone, room_no, check_in, check_out,
          price_per_day, food_charge, extra_charge, subtotal, gst, discount,
          final_total, total_amount, payment_mode, payment_status, status,
          booking_id, customer_id
        )
        VALUES
        ('ACC-EMPTY-1', '2026-03-27', 'Empty Ledger Guest', '9991112222', '202', '2026-03-27', '2026-03-28',
         1800, 0, 0, 1800, 90, 0, 1890, 1890, 'Cash', 'Paid', 'Paid', 89, 89)
      `);

      const summaryRes = await api().get("/api/accounts/summary");
      expect(summaryRes.status).toBe(200);
      expect(summaryRes.body.income).toBe(3090);
      expect(summaryRes.body.expense).toBe(0);
      expect(summaryRes.body.gstPayable).toBeCloseTo(147.14, 2);

      const departmentRes = await api().get("/api/accounts/department-summary");
      expect(departmentRes.status).toBe(200);
      expect(departmentRes.body.roomIncome).toBe(3090);
      expect(departmentRes.body.roomExpense).toBe(0);
      expect(departmentRes.body.restaurantExpense).toBe(0);
    });

    test("returns department summary", async () => {
      await runQuery(`
        INSERT INTO invoices
        (
          invoice_no, date, customer_name, phone, room_no, check_in, check_out,
          price_per_day, food_charge, extra_charge, subtotal, gst, discount,
          final_total, total_amount, payment_mode, payment_status, status,
          booking_id, customer_id
        )
        VALUES
        ('ACC-DEPT-1', '2026-03-27', 'Dept Guest', '9991112222', '301', '2026-03-27', '2026-03-28',
         2000, 300, 150, 2450, 123, 0, 2573, 2573, 'Cash', 'Paid', 'Paid', 77, 77)
      `);

      await runQuery(`
        INSERT INTO restaurant_bills
        (tableNumber, tokenId, entityType, subtotal, gst, discount, total, paymentMethod, invoiceStatus)
        VALUES
        ('T9', NULL, 'Table', 500, 25, 0, 525, 'UPI', 'Paid')
      `);

      await runQuery(`
        INSERT INTO accounts_transactions
        (date, type, department, source_module, description, amount, payment_mode)
        VALUES
        ('2026-03-27', 'Expense', 'Room', 'accounts-manual', 'Room linen purchase', 120, 'Cash'),
        ('2026-03-27', 'Expense', 'Restaurant', 'accounts-manual', 'Kitchen supply', 80, 'Cash')
      `);

      const res = await api().get("/api/accounts/department-summary");
      expect(res.status).toBe(200);
      expect(res.body.roomIncome).toBeCloseTo(3457.94, 2);
      expect(res.body.restaurantIncome).toBeCloseTo(840.06, 2);
      expect(res.body.roomExpense).toBe(120);
      expect(res.body.restaurantExpense).toBe(80);
    });

    test("returns hotel billing records from real booking payments", async () => {
      const res = await api().get("/api/accounts/hotel-billing");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toEqual(
        expect.objectContaining({
          bookingCode: "BK-TEST-0002",
          customerName: "Riya Sharma",
        }),
      );
    });

    test("returns restaurant billing records including served room service only", async () => {
      const res = await api().get("/api/accounts/restaurant-billing");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(
        res.body.some(
          (row) =>
            row.reference === "ROOM-ORDER-1" &&
            row.paymentStatus === "Paid" &&
            Number(row.total) === 580,
        ),
      ).toBe(true);
      expect(res.body.some((row) => row.reference === "ROOM-ORDER-2")).toBe(false);
    });

    test.each([
      ["/api/accounts/income", { description: "Missing", amount: 100 }, 400],
      ["/api/accounts/expense", { description: "Missing", amount: 100 }, 400],
    ])("validates income/expense payload %#", async (url, payload, status) => {
      const res = await api().post(url).send(payload);
      expect(res.status).toBe(status);
    });

    test("adds income", async () => {
      const res = await api().post("/api/accounts/income").send({
        date: "2026-03-27",
        description: "Counter sale",
        amount: 999,
        paymentMode: "Cash",
        department: "Restaurant",
        sourceModule: "accounts-manual",
      });

      expect(res.status).toBe(200);
      expect(res.body.id).toBeTruthy();

      const rows = await runQuery(
        "SELECT department, source_module FROM accounts_transactions WHERE id = ?",
        [res.body.id],
      );
      expect(rows[0].department).toBe("Restaurant");
      expect(rows[0].source_module).toBe("accounts-manual");
    });

    test("adds expense", async () => {
      const res = await api().post("/api/accounts/expense").send({
        date: "2026-03-27",
        description: "Stationery",
        amount: 199,
        paymentMode: "Cash",
        department: "Other",
        sourceModule: "accounts-manual",
      });

      expect(res.status).toBe(200);
    });

    test("returns extended summary", async () => {
      const res = await api().get("/api/accounts/extended-summary");
      expect(res.status).toBe(200);
    });

    test("returns reconciliation data and supports match/unmatch flow", async () => {
      const vendorRes = await api().post("/api/accounts/vendor-payments").send({
        vendorName: "Reco Vendor",
        invoiceRef: "RECO-INV-1",
        paymentDate: "2026-03-27",
        amount: 1200,
        paymentMode: "Bank Transfer",
        status: "Paid",
      });
      expect(vendorRes.status).toBe(200);

      const ledgerRes = await api().post("/api/accounts/bank-ledger").send({
        entryDate: "2026-03-27",
        bankName: "HDFC",
        bankAccount: "Corporate A/c",
        referenceNo: "RECO-BANK-1",
        description: "Vendor payout",
        amount: 1200,
        direction: "out",
        debit: 1200,
        credit: 0,
        paymentMode: "Bank Transfer",
      });
      expect(ledgerRes.status).toBe(200);

      const summaryRes = await api().get("/api/accounts/reconciliation/summary");
      expect(summaryRes.status).toBe(200);

      const itemsRes = await api()
        .get("/api/accounts/reconciliation/items")
        .query({ sourceType: "vendor_payment" });
      expect(itemsRes.status).toBe(200);
      expect(Array.isArray(itemsRes.body)).toBe(true);

      const matchRes = await api().post("/api/accounts/reconciliation/match").send({
        bankLedgerId: ledgerRes.body.id,
        sourceType: "vendor_payment",
        sourceId: vendorRes.body.id,
        matchedAmount: 1200,
      });
      expect(matchRes.status).toBe(200);

      const matchedRows = await runQuery(
        "SELECT source_type, source_id, match_status FROM account_bank_ledgers WHERE id = ?",
        [ledgerRes.body.id],
      );
      expect(matchedRows[0].source_type).toBe("vendor_payment");
      expect(Number(matchedRows[0].source_id)).toBe(Number(vendorRes.body.id));

      const unmatchRes = await api().post("/api/accounts/reconciliation/unmatch").send({
        bankLedgerId: ledgerRes.body.id,
      });
      expect(unmatchRes.status).toBe(200);
    });

    test("creates, updates, lists, and deletes payment settings", async () => {
      const createRes = await api().post("/api/accounts/payment-settings").send({
        paymentMode: "UPI",
        department: "Hotel",
        providerName: "Paytm",
        upiId: "hotel@paytm",
        accountHolderName: "Hotel Test",
        bankName: "SBI",
        qrImageUrl: "/uploads/test-qr.png",
        isActive: "1",
        notes: "Front desk scanner",
      });
      expect(createRes.status).toBe(200);

      const listRes = await api().get("/api/accounts/payment-settings");
      expect(listRes.status).toBe(200);
      expect(Array.isArray(listRes.body)).toBe(true);

      const updateRes = await api()
        .put(`/api/accounts/payment-settings/${createRes.body.id}`)
        .send({
          paymentMode: "UPI",
          department: "Restaurant",
          providerName: "PhonePe",
          upiId: "restaurant@phonepe",
          accountHolderName: "Restaurant Test",
          bankName: "HDFC",
          qrImageUrl: "/uploads/test-qr-2.png",
          isActive: "0",
          notes: "Restaurant scanner",
        });
      expect(updateRes.status).toBe(200);

      const deleteRes = await api().delete(`/api/accounts/payment-settings/${createRes.body.id}`);
      expect(deleteRes.status).toBe(200);
    });

    test("settles a pending invoice with UPI from accounts", async () => {
      const invoiceInsert = await runQuery(
        `
          INSERT INTO invoices
          (invoice_no, date, customer_name, room_no, subtotal, gst, final_total, total_amount, payment_mode, payment_status, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          "TEST-UPI-SETTLE-1",
          "2026-03-31",
          "UPI Guest",
          "101",
          1000,
          50,
          1050,
          1050,
          "Pending",
          "Pending",
          "Pending",
        ],
      );

      const settingRes = await api().post("/api/accounts/payment-settings").send({
        paymentMode: "UPI",
        department: "Hotel",
        providerName: "Paytm",
        upiId: "hotel@paytm",
        accountHolderName: "Hotel Test",
        bankName: "SBI",
        qrImageUrl: "/uploads/test-upi.png",
        isActive: "1",
      });
      expect(settingRes.status).toBe(200);

      const settleRes = await api().post("/api/accounts/settle-pending-bill").send({
        sourceType: "invoice",
        sourceId: invoiceInsert.insertId,
        paymentMode: "UPI",
        paymentSettingId: settingRes.body.id,
        referenceNo: "UTR-ACC-001",
        notes: "Paid from accounts",
      });
      expect(settleRes.status).toBe(200);

      const invoiceRows = await runQuery(
        "SELECT payment_status, payment_mode FROM invoices WHERE id = ?",
        [invoiceInsert.insertId],
      );
      expect(invoiceRows[0].payment_status).toBe("Paid");
      expect(invoiceRows[0].payment_mode).toBe("UPI");

      const ledgerRows = await runQuery(
        "SELECT source_type, source_id, payment_mode, credit FROM account_bank_ledgers WHERE source_type = 'invoice' AND source_id = ?",
        [invoiceInsert.insertId],
      );
      expect(ledgerRows.length).toBeGreaterThan(0);
      expect(ledgerRows[0].payment_mode).toBe("UPI");
      expect(Number(ledgerRows[0].credit)).toBe(1050);
    });

    test("adds and lists bank ledger entry", async () => {
      const createRes = await api().post("/api/accounts/bank-ledger").send({
        entryDate: "2026-03-27",
        bankName: "SBI",
        referenceNo: "REF-1",
        description: "Deposit",
        debit: 0,
        credit: 5000,
      });
      expect(createRes.status).toBe(200);

      const listRes = await api().get("/api/accounts/bank-ledger");
      expect(listRes.status).toBe(200);
      expect(Array.isArray(listRes.body)).toBe(true);
    });

    test("adds and lists petty cash", async () => {
      const createRes = await api().post("/api/accounts/petty-cash").send({
        entryDate: "2026-03-27",
        entryType: "Expense",
        category: "Cleaning",
        description: "Mop purchase",
        amount: 150,
      });
      expect(createRes.status).toBe(200);

      const listRes = await api().get("/api/accounts/petty-cash");
      expect(listRes.status).toBe(200);
    });

    test("updates and deletes petty cash entry", async () => {
      const createRes = await api().post("/api/accounts/petty-cash").send({
        entryDate: "2026-03-27",
        entryType: "Out",
        category: "Supplies",
        description: "Welcome kit purchase",
        amount: 275,
        approvedBy: "Manager User",
      });
      expect(createRes.status).toBe(200);

      const updateRes = await api().put(`/api/accounts/petty-cash/${createRes.body.id}`).send({
        entryDate: "2026-03-28",
        entryType: "In",
        category: "Refund",
        description: "Welcome kit refund",
        amount: 300,
        approvedBy: "Accounts User",
        notes: "Updated petty cash record",
      });
      expect(updateRes.status).toBe(200);

      const deleteRes = await api().delete(`/api/accounts/petty-cash/${createRes.body.id}`);
      expect(deleteRes.status).toBe(200);
    });

    test("updates and deletes bank ledger entry", async () => {
      const createRes = await api().post("/api/accounts/bank-ledger").send({
        entryDate: "2026-03-27",
        bankName: "Axis Bank",
        referenceNo: "REF-EDIT-1",
        description: "Opening balance",
        debit: 0,
        credit: 8000,
      });
      expect(createRes.status).toBe(200);

      const updateRes = await api().put(`/api/accounts/bank-ledger/${createRes.body.id}`).send({
        entryDate: "2026-03-27",
        bankName: "Axis Bank Updated",
        referenceNo: "REF-EDIT-1",
        description: "Opening balance revised",
        debit: 500,
        credit: 8500,
        reconciliationStatus: "Mismatch",
        notes: "Updated in test",
      });
      expect(updateRes.status).toBe(200);

      const deleteRes = await api().delete(`/api/accounts/bank-ledger/${createRes.body.id}`);
      expect(deleteRes.status).toBe(200);
    });

    test("updates and deletes GST return", async () => {
      const createRes = await api().post("/api/accounts/gst-returns").send({
        filingPeriod: "Mar-2026",
        returnType: "GSTR-3B",
        taxableAmount: 10000,
        gstCollected: 500,
        gstPaid: 200,
        netPayable: 300,
        status: "Draft",
      });
      expect(createRes.status).toBe(200);

      const updateRes = await api().put(`/api/accounts/gst-returns/${createRes.body.id}`).send({
        filingPeriod: "Mar-2026",
        returnType: "GSTR-1",
        taxableAmount: 12000,
        gstCollected: 600,
        gstPaid: 250,
        netPayable: 350,
        status: "Ready",
        filedOn: null,
        notes: "Updated GST record",
      });
      expect(updateRes.status).toBe(200);

      const deleteRes = await api().delete(`/api/accounts/gst-returns/${createRes.body.id}`);
      expect(deleteRes.status).toBe(200);
    });

    test("updates and deletes vendor payment", async () => {
      const createRes = await api().post("/api/accounts/vendor-payments").send({
        vendorName: "Vendor A",
        invoiceRef: "INV-1",
        paymentDate: "2026-03-27",
        amount: 1200,
        paymentMode: "Cash",
        status: "Scheduled",
      });
      expect(createRes.status).toBe(200);

      const updateRes = await api().put(`/api/accounts/vendor-payments/${createRes.body.id}`).send({
        vendorName: "Vendor A Updated",
        invoiceRef: "INV-1",
        paymentDate: "2026-03-27",
        amount: 1500,
        paymentMode: "UPI",
        status: "Paid",
        notes: "Updated vendor payment",
      });
      expect(updateRes.status).toBe(200);

      const deleteRes = await api().delete(`/api/accounts/vendor-payments/${createRes.body.id}`);
      expect(deleteRes.status).toBe(200);
    });

    test("updates and deletes purchase order", async () => {
      const createRes = await api().post("/api/accounts/purchase-orders").send({
        poNumber: "PO-CRUD-1",
        vendorName: "Supplier X",
        orderDate: "2026-03-27",
        expectedDate: "2026-03-29",
        totalAmount: 5000,
        status: "Draft",
      });
      expect(createRes.status).toBe(200);

      const updateRes = await api().put(`/api/accounts/purchase-orders/${createRes.body.id}`).send({
        poNumber: "PO-CRUD-1",
        vendorName: "Supplier X Updated",
        orderDate: "2026-03-27",
        expectedDate: "2026-03-30",
        totalAmount: 6500,
        status: "Approved",
        notes: "Updated PO",
      });
      expect(updateRes.status).toBe(200);

      const deleteRes = await api().delete(`/api/accounts/purchase-orders/${createRes.body.id}`);
      expect(deleteRes.status).toBe(200);
    });

    test("updates and deletes payroll record", async () => {
      const createRes = await api().post("/api/accounts/payroll").send({
        staffName: "Staff A",
        payrollMonth: "Mar-2026",
        attendanceDays: 25,
        baseSalary: 10000,
        allowance: 1000,
        deduction: 500,
        netSalary: 10500,
        status: "Draft",
      });
      expect(createRes.status).toBe(200);

      const updateRes = await api().put(`/api/accounts/payroll/${createRes.body.id}`).send({
        staffName: "Staff A Updated",
        payrollMonth: "Mar-2026",
        attendanceDays: 26,
        baseSalary: 12000,
        allowance: 1200,
        deduction: 700,
        netSalary: 12500,
        status: "Processed",
        notes: "Updated payroll",
      });
      expect(updateRes.status).toBe(200);

      const deleteRes = await api().delete(`/api/accounts/payroll/${createRes.body.id}`);
      expect(deleteRes.status).toBe(200);
    });

    test("updates and deletes profit center entry", async () => {
      const createRes = await api().post("/api/accounts/profit-centers").send({
        centerName: "Hotel",
        entryDate: "2026-03-27",
        incomeAmount: 10000,
        expenseAmount: 4000,
      });
      expect(createRes.status).toBe(200);

      const updateRes = await api().put(`/api/accounts/profit-centers/${createRes.body.id}`).send({
        centerName: "Restaurant",
        entryDate: "2026-03-27",
        incomeAmount: 15000,
        expenseAmount: 5000,
        notes: "Updated profit center",
      });
      expect(updateRes.status).toBe(200);

      const deleteRes = await api().delete(`/api/accounts/profit-centers/${createRes.body.id}`);
      expect(deleteRes.status).toBe(200);
    });

    test("returns attendance for date", async () => {
      const res = await api().get("/api/attendance?date=2026-03-27");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test("requires attendance date query", async () => {
      const res = await api().get("/api/attendance");
      expect(res.status).toBe(400);
    });

    test("creates manual attendance record", async () => {
      const res = await api().post("/api/attendance").send({
        date: "2026-03-28",
        name: "Manager User",
        role: "manager",
        department: "Management",
        checkIn: "09:00",
        checkOut: "18:00",
        status: "Present",
        method: "Manual",
      });

      expect(res.status).toBe(200);
      expect(res.body.id).toBeTruthy();
    });
  });

  describe("dashboard and reports", () => {
    test("returns dashboard metrics", async () => {
      const res = await api().get("/api/dashboard/metrics");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("totalRooms");
      expect(res.body).toHaveProperty("occupiedRooms");
    });

    test("includes accounts income in today's revenue", async () => {
      const beforeRes = await api().get("/api/dashboard/metrics");
      expect(beforeRes.status).toBe(200);
      const beforeRevenue = Number(beforeRes.body.todayRevenue || 0);

      await runQuery(`
        INSERT INTO accounts_transactions (date, type, description, amount, payment_mode)
        VALUES (CURDATE(), 'Income', 'Dashboard revenue test', 500, 'Cash')
      `);

      const afterRes = await api().get("/api/dashboard/metrics");
      expect(afterRes.status).toBe(200);
      expect(Number(afterRes.body.todayRevenue || 0)).toBe(beforeRevenue + 500);
    });

    test("returns dashboard charts", async () => {
      const res = await api().get("/api/dashboard/charts");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("monthlyRevenue");
      expect(res.body).toHaveProperty("roomOccupancy");
    });

    test("returns report summary", async () => {
      const res = await api().get("/api/reports/summary").set(authHeader(seed.users.manager));
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("totalRooms");
    });

    test("requires report type", async () => {
      const res = await api().get("/api/reports/data").set(authHeader(seed.users.manager));
      expect(res.status).toBe(400);
    });

    test.each(["room", "banquet", "restaurant", "housekeeping", "accounts", "all-bills"])(
      "returns report data for type %s",
      async (type) => {
        const res = await api()
          .get(`/api/reports/data?type=${type}`)
          .set(authHeader(seed.users.manager));
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
      },
    );

    test("returns daywise report", async () => {
      const res = await api().get("/api/report/daywise?start=2026-03-01&end=2026-03-31");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test("returns item consumption", async () => {
      const res = await api().get("/api/report/items");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe("audit logs role access", () => {
    test("blocks unauthenticated audit log access", async () => {
      const res = await api().get("/api/audit-logs");
      expect(res.status).toBe(401);
    });

    test("blocks receptionist audit log access", async () => {
      const res = await api()
        .get("/api/audit-logs")
        .set(authHeader(seed.users.receptionist));
      expect(res.status).toBe(403);
    });

    test("allows admin audit log access", async () => {
      await api().get("/api/dashboard/metrics");
      const res = await api()
        .get("/api/audit-logs")
        .set(authHeader(seed.users.admin));
      expect(res.status).toBe(200);
    });

    test("allows manager audit log access", async () => {
      const res = await api()
        .get("/api/audit-logs")
        .set(authHeader(seed.users.manager));
      expect(res.status).toBe(200);
    });
  });
});
