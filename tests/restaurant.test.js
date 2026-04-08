const { api } = require("./helpers/testRequest");
const { resetAndSeedDatabase, runQuery } = require("./helpers/testDb");

describe("Restaurant Order APIs", () => {
  beforeEach(async () => {
    await resetAndSeedDatabase();
  });

  describe("tables", () => {
    test("adds a table", async () => {
      const res = await api().post("/api/restaurant/tables").send({
        number: "T9",
        floorName: "First",
        sectionName: "Lounge",
        seatCount: 6,
        statusColor: "#111827",
      });

      expect(res.status).toBe(200);
      expect(res.body.id).toBeTruthy();
    });

    test("rejects missing table number", async () => {
      const res = await api().post("/api/restaurant/tables").send({});
      expect(res.status).toBe(400);
    });

    test("rejects duplicate table", async () => {
      const res = await api().post("/api/restaurant/tables").send({
        number: "T1",
      });

      expect(res.status).toBe(400);
    });

    test("returns table list", async () => {
      const res = await api().get("/api/restaurant/tables");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("menu", () => {
    test("adds menu item without image", async () => {
      const res = await api().post("/api/restaurant/menu").send({
        name: "Spring Roll",
        price: 150,
        category: "Starter",
        tableNumber: "T1",
      });

      expect(res.status).toBe(200);
      expect(res.body.id).toBeTruthy();
    });

    test.each([
      [{ price: 100 }, 400],
      [{ name: "Tea" }, 400],
    ])("validates menu payload %#", async (payload, status) => {
      const res = await api().post("/api/restaurant/menu").send(payload);
      expect(res.status).toBe(status);
    });

    test("returns menu items", async () => {
      const res = await api().get("/api/restaurant/menu");
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(3);
    });

    test("filters menu by tableNumber", async () => {
      const res = await api().get("/api/restaurant/menu?tableNumber=T2");
      expect(res.status).toBe(200);
      expect(
        res.body.every((item) => item.table_number === "T2" || item.table_number == null || item.table_number === ""),
      ).toBe(true);
      expect(res.body.some((item) => item.table_number === "T2")).toBe(true);
    });

    test("includes global menu items when filtering by tableNumber", async () => {
      await api().post("/api/restaurant/menu").send({
        name: "Global Veg Thali",
        price: 240,
        category: "Main Course",
      });

      const res = await api().get("/api/restaurant/menu?tableNumber=T1");

      expect(res.status).toBe(200);
      expect(res.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "Global Veg Thali",
          }),
        ]),
      );
    });

    test("exposes effective price", async () => {
      const res = await api().get("/api/restaurant/menu?tableNumber=T1");
      expect(res.status).toBe(200);
      expect(res.body.some((item) => item.effectivePrice)).toBe(true);
    });
  });

  describe("orders and bills", () => {
    test("adds order item to existing pending order", async () => {
      const res = await api().post("/api/restaurant/order/add").send({
        tableNumber: "T1",
        item: {
          name: "Soup",
          price: 120,
          quantity: 1,
        },
      });

      expect(res.status).toBe(200);
      expect(res.body.orderId).toBe(1);
    });

    test("creates a new order when no pending one exists", async () => {
      const res = await api().post("/api/restaurant/order/add").send({
        tableNumber: "T9",
        item: {
          name: "Soup",
          price: 120,
          quantity: 1,
        },
      });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/created/i);
    });

    test("returns pending order by table", async () => {
      const res = await api().get("/api/restaurant/order/T1");
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(1);
    });

    test("returns undefined for table without pending order", async () => {
      const res = await api().get("/api/restaurant/order/T2");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({});
    });

    test("returns order items by order id", async () => {
      const res = await api().get("/api/restaurant/order-items/1");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2);
    });

    test("marks order as paid", async () => {
      const res = await api().put("/api/restaurant/order/T1/pay").send({});
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/paid/i);
    });

    test("returns success when paying non-pending order", async () => {
      const res = await api().put("/api/restaurant/order/T2/pay").send({});
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/already settled/i);
    });

    test("creates restaurant bill", async () => {
      const res = await api().post("/api/restaurant/bill").send({
        table: "T1",
        entityType: "Table",
        customerName: "Walk In",
        phone: "8888888888",
        subtotal: 500,
        gst: 25,
        total: 525,
        paymentMethod: "Cash",
      });

      expect(res.status).toBe(200);
      expect(res.body.id).toBeTruthy();

      const legacyBills = await runQuery(
        "SELECT modern_bill_id, customerName, phone, paymentMethod, invoiceStatus FROM restaurant_bills WHERE modern_bill_id = ?",
        [res.body.id],
      );

      expect(legacyBills).toHaveLength(1);
      expect(legacyBills[0].customerName).toBe("Walk In");
      expect(legacyBills[0].phone).toBe("8888888888");
      expect(legacyBills[0].paymentMethod).toBe("Cash");
      expect(legacyBills[0].invoiceStatus).toBe("Paid");
    });

    test("generate bill does not create payment or accounts income", async () => {
      const beforePayments = await runQuery("SELECT COUNT(*) AS total FROM payments");
      const beforeAccounts = await runQuery("SELECT COUNT(*) AS total FROM accounts_transactions");

      const res = await api().post("/api/restaurant/bill").send({
        table: "T1",
        entityType: "Table",
        customerName: "Bill Only",
        phone: "8888888888",
        subtotal: 500,
        gst: 25,
        total: 525,
        paymentMethod: null,
        invoiceStatus: "Generated",
      });

      expect(res.status).toBe(200);

      const afterPayments = await runQuery("SELECT COUNT(*) AS total FROM payments");
      const afterAccounts = await runQuery("SELECT COUNT(*) AS total FROM accounts_transactions");
      const bills = await runQuery("SELECT invoiceStatus, paymentMethod, account_transaction_id FROM bills WHERE id = ?", [res.body.id]);
      const legacyBills = await runQuery(
        "SELECT customerName, phone, invoiceStatus, paymentMethod FROM restaurant_bills WHERE modern_bill_id = ?",
        [res.body.id],
      );

      expect(Number(afterPayments[0].total)).toBe(Number(beforePayments[0].total));
      expect(Number(afterAccounts[0].total)).toBe(Number(beforeAccounts[0].total));
      expect(bills[0].invoiceStatus).toBe("Generated");
      expect(bills[0].paymentMethod).toBeNull();
      expect(bills[0].account_transaction_id).toBeNull();
      expect(legacyBills).toHaveLength(1);
      expect(legacyBills[0].customerName).toBe("Bill Only");
      expect(legacyBills[0].phone).toBe("8888888888");
      expect(legacyBills[0].invoiceStatus).toBe("Generated");
      expect(legacyBills[0].paymentMethod).toBeNull();
    });

    test("paying a generated bill creates payment and accounts income", async () => {
      const billRes = await api().post("/api/restaurant/bill").send({
        table: "T1",
        entityType: "Table",
        customerName: "Bill Then Pay",
        phone: "8888888888",
        subtotal: 500,
        gst: 25,
        total: 525,
        paymentMethod: null,
        invoiceStatus: "Generated",
      });

      const beforePayments = await runQuery("SELECT COUNT(*) AS total FROM payments");
      const beforeAccounts = await runQuery("SELECT COUNT(*) AS total FROM accounts_transactions");

      const payRes = await api().post(`/api/restaurant/bill/${billRes.body.id}/pay`).send({
        paymentMethod: "UPI",
      });

      expect(payRes.status).toBe(200);
      expect(payRes.body.billId).toBe(billRes.body.id);

      const afterPayments = await runQuery("SELECT COUNT(*) AS total FROM payments");
      const afterAccounts = await runQuery("SELECT COUNT(*) AS total FROM accounts_transactions");
      const bills = await runQuery(
        "SELECT invoiceStatus, paymentMethod, payment_id, account_transaction_id, paid_at FROM bills WHERE id = ?",
        [billRes.body.id],
      );
      const legacyBills = await runQuery(
        "SELECT customerName, phone, invoiceStatus, paymentMethod, payment_id, account_transaction_id, paid_at FROM restaurant_bills WHERE modern_bill_id = ?",
        [billRes.body.id],
      );

      expect(Number(afterPayments[0].total)).toBe(Number(beforePayments[0].total) + 1);
      expect(Number(afterAccounts[0].total)).toBe(Number(beforeAccounts[0].total) + 1);
      expect(bills[0].invoiceStatus).toBe("Paid");
      expect(bills[0].paymentMethod).toBe("UPI");
      expect(bills[0].payment_id).toBeTruthy();
      expect(bills[0].account_transaction_id).toBeTruthy();
      expect(bills[0].paid_at).toBeTruthy();
      expect(legacyBills).toHaveLength(1);
      expect(legacyBills[0].customerName).toBe("Bill Then Pay");
      expect(legacyBills[0].phone).toBe("8888888888");
      expect(legacyBills[0].invoiceStatus).toBe("Paid");
      expect(legacyBills[0].paymentMethod).toBe("UPI");
      expect(legacyBills[0].payment_id).toBeTruthy();
      expect(legacyBills[0].account_transaction_id).toBeTruthy();
      expect(legacyBills[0].paid_at).toBeTruthy();

      const activeTokens = await runQuery(
        "SELECT id FROM tokens WHERE tableNumber = 'T1' AND status = 'active'",
      );
      const pendingOrders = await runQuery(
        "SELECT id FROM orders WHERE tableNumber = 'T1' AND status = 'pending'",
      );

      expect(activeTokens).toHaveLength(0);
      expect(pendingOrders).toHaveLength(0);
    });

    test("posts a restaurant table bill to an active room folio", async () => {
      const checkInRes = await api().put("/api/hotel/check-in/1").send({});
      expect(checkInRes.status).toBe(200);

      const billRes = await api().post("/api/restaurant/bill").send({
        table: "T1",
        tokenId: 1,
        entityType: "Table",
        waiterName: "Waiter One",
        customerName: "John Carter",
        phone: "9990001111",
        subtotal: 500,
        gst: 25,
        total: 525,
        paymentMethod: null,
        invoiceStatus: "Generated",
      });

      expect(billRes.status).toBe(200);

      const chargeRes = await api()
        .post(`/api/restaurant/bill/${billRes.body.id}/charge-to-room`)
        .send({
          roomNumber: "101",
          bookingId: 1,
          sourceTableNumber: "T1",
          customerName: "John Carter",
          phone: "9990001111",
          total: 525,
          discountAmount: 0,
        });

      expect(chargeRes.status).toBe(200);
      expect(chargeRes.body.billId).toBe(billRes.body.id);
      expect(chargeRes.body.bookingId).toBe(1);
      expect(chargeRes.body.roomNumber).toBe("101");
      expect(chargeRes.body.folioEntryId).toBeTruthy();

      const bills = await runQuery(
        `
          SELECT
            invoiceStatus,
            paymentMethod,
            posted_to_room,
            posted_room_number,
            room_booking_id,
            folio_entry_id,
            source_table_number,
            posted_at
          FROM bills
          WHERE id = ?
        `,
        [billRes.body.id],
      );
      const legacyBills = await runQuery(
        `
          SELECT
            invoiceStatus,
            paymentMethod,
            posted_to_room,
            posted_room_number,
            room_booking_id,
            folio_entry_id,
            source_table_number,
            posted_at
          FROM restaurant_bills
          WHERE modern_bill_id = ?
        `,
        [billRes.body.id],
      );
      const folioRows = await runQuery(
        `
          SELECT booking_id, category, description, amount, created_by
          FROM hotel_folio_entries
          WHERE id = ?
        `,
        [chargeRes.body.folioEntryId],
      );
      const activeTokens = await runQuery(
        "SELECT id FROM tokens WHERE tableNumber = 'T1' AND status = 'active'",
      );
      const pendingOrders = await runQuery(
        "SELECT id FROM orders WHERE tableNumber = 'T1' AND status = 'pending'",
      );

      expect(bills).toHaveLength(1);
      expect(bills[0].invoiceStatus).toBe("Posted To Room");
      expect(bills[0].paymentMethod).toBe("Charge To Room");
      expect(Number(bills[0].posted_to_room)).toBe(1);
      expect(bills[0].posted_room_number).toBe("101");
      expect(Number(bills[0].room_booking_id)).toBe(1);
      expect(Number(bills[0].folio_entry_id)).toBe(Number(chargeRes.body.folioEntryId));
      expect(bills[0].source_table_number).toBe("T1");
      expect(bills[0].posted_at).toBeTruthy();

      expect(legacyBills).toHaveLength(1);
      expect(legacyBills[0].invoiceStatus).toBe("Posted To Room");
      expect(legacyBills[0].paymentMethod).toBe("Charge To Room");
      expect(Number(legacyBills[0].posted_to_room)).toBe(1);
      expect(legacyBills[0].posted_room_number).toBe("101");
      expect(Number(legacyBills[0].room_booking_id)).toBe(1);
      expect(Number(legacyBills[0].folio_entry_id)).toBe(Number(chargeRes.body.folioEntryId));
      expect(legacyBills[0].source_table_number).toBe("T1");
      expect(legacyBills[0].posted_at).toBeTruthy();

      expect(folioRows).toHaveLength(1);
      expect(Number(folioRows[0].booking_id)).toBe(1);
      expect(folioRows[0].category).toBe("Restaurant");
      expect(folioRows[0].description).toMatch(/Table T1/i);
      expect(Number(folioRows[0].amount)).toBe(525);
      expect(folioRows[0].created_by).toBe("Restaurant POS");

      expect(activeTokens).toHaveLength(0);
      expect(pendingOrders).toHaveLength(0);
    });

    test("generic pay endpoint reuses existing generated bill for the same token", async () => {
      const billRes = await api().post("/api/restaurant/bill").send({
        table: "T1",
        tokenId: 1,
        entityType: "Table",
        customerName: "Walk In",
        phone: "8888888888",
        subtotal: 500,
        gst: 25,
        total: 525,
        paymentMethod: null,
        invoiceStatus: "Generated",
      });

      expect(billRes.status).toBe(200);

      const payRes = await api().post("/api/restaurant/bill/pay").send({
        table: "T1",
        tokenId: 1,
        entityType: "Table",
        customerName: "Walk In",
        phone: "8888888888",
        subtotal: 500,
        gst: 25,
        total: 525,
        paymentMethod: "Cash",
      });

      expect(payRes.status).toBe(200);
      expect(payRes.body.billId).toBe(billRes.body.id);

      const bills = await runQuery(
        "SELECT id, invoiceStatus, paymentMethod FROM bills WHERE token_id = 1 ORDER BY id DESC",
      );

      expect(bills).toHaveLength(1);
      expect(bills[0].id).toBe(billRes.body.id);
      expect(bills[0].invoiceStatus).toBe("Paid");
      expect(bills[0].paymentMethod).toBe("Cash");
    });

    test("reuses same open bill for same table instead of creating duplicate generated bills", async () => {
      const firstBillRes = await api().post("/api/restaurant/bill").send({
        table: "T1",
        entityType: "Table",
        customerName: "Walk In",
        phone: "8888888888",
        subtotal: 60,
        gst: 3,
        total: 63,
        paymentMethod: null,
        invoiceStatus: "Generated",
      });

      const secondBillRes = await api().post("/api/restaurant/bill").send({
        table: "T1",
        entityType: "Table",
        customerName: "Walk In",
        phone: "8888888888",
        subtotal: 60,
        gst: 3,
        total: 63,
        paymentMethod: null,
        invoiceStatus: "Generated",
      });

      expect(secondBillRes.status).toBe(200);
      expect(secondBillRes.body.id).toBe(firstBillRes.body.id);

      const bills = await runQuery(
        "SELECT id, invoiceStatus, total FROM bills WHERE tableNumber = 'T1' AND entityType = 'Table' AND account_transaction_id IS NULL ORDER BY id DESC",
      );

      expect(bills.filter((bill) => Number(bill.total) === 63).length).toBe(1);
      expect(bills[0].invoiceStatus).toBe("Generated");
    });

    test("repairs legacy restaurant bill rows by attaching modern bill id", async () => {
      const billInsert = await runQuery(
        `
          INSERT INTO bills (
            tableNumber, token_id, entityType, waiter_name, customerName, phone,
            subtotal, gst, total, paymentMethod, invoiceStatus
          )
          VALUES ('T1', 1, 'Table', 'Waiter One', 'Legacy Walk In', '8888888888', 525, 26.25, 551.25, NULL, 'Generated')
        `,
      );

      const legacyInsert = await runQuery(
        `
          INSERT INTO restaurant_bills (
            modern_bill_id, tableNumber, tokenId, entityType, waiter_name, customerName, phone,
            subtotal, gst, discount, total, paymentMethod, invoiceStatus
          )
          VALUES (NULL, NULL, 1, 'Table', 'Waiter One', 'Legacy Walk In', '8888888888', 525, 26.25, 0, 551.25, NULL, 'Generated')
        `,
      );

      const res = await api().get("/api/restaurant/bills");

      expect(res.status).toBe(200);

      const repairedRow = await runQuery(
        "SELECT modern_bill_id, tableNumber, customerName, phone, total FROM restaurant_bills WHERE id = ?",
        [legacyInsert.insertId],
      );

      expect(repairedRow).toHaveLength(1);
      expect(Number(repairedRow[0].modern_bill_id)).toBe(Number(billInsert.insertId));
      expect(repairedRow[0].tableNumber).toBe("T1");
      expect(repairedRow[0].customerName).toBe("Legacy Walk In");
      expect(repairedRow[0].phone).toBe("8888888888");
      expect(Number(repairedRow[0].total)).toBeCloseTo(551.25);
    });

    test("returns saved bills", async () => {
      const res = await api().get("/api/restaurant/bills");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    test("returns waiter performance", async () => {
      const res = await api().get("/api/restaurant/waiter-performance");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe("item action requests and split bills", () => {
    test.each([
      [{}, 400],
      [{ tokenItemId: 1, tableNumber: "T1", actionType: "cancel" }, 400],
    ])("validates item action request payload %#", async (payload, status) => {
      const res = await api().post("/api/restaurant/item-action-requests").send(payload);
      expect(res.status).toBe(status);
    });

    test("creates item action request", async () => {
      const res = await api().post("/api/restaurant/item-action-requests").send({
        tokenItemId: 1,
        tableNumber: "T1",
        actionType: "cancel",
        reason: "Customer changed mind",
        requestedBy: "Waiter One",
      });

      expect(res.status).toBe(200);
      expect(res.body.id).toBeTruthy();
    });

    test("returns item action requests", async () => {
      await api().post("/api/restaurant/item-action-requests").send({
        tokenItemId: 1,
        tableNumber: "T1",
        actionType: "cancel",
        reason: "Customer changed mind",
        requestedBy: "Waiter One",
      });

      const res = await api().get("/api/restaurant/item-action-requests");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    test("validates review status", async () => {
      const res = await api().put("/api/restaurant/item-action-requests/1/review").send({});
      expect(res.status).toBe(400);
    });

    test("reviews item action request", async () => {
      await api().post("/api/restaurant/item-action-requests").send({
        tokenItemId: 1,
        tableNumber: "T1",
        actionType: "cancel",
        reason: "Customer changed mind",
        requestedBy: "Waiter One",
      });

      const res = await api().put("/api/restaurant/item-action-requests/1/review").send({
        status: "Approved",
        managerNote: "Approved",
        approvedBy: "Manager One",
      });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/updated/i);
    });

    test.each([
      [{}, 400],
      [{ tableNumber: "T1", splitLabel: "A" }, 400],
    ])("validates split bill payload %#", async (payload, status) => {
      const res = await api().post("/api/restaurant/split-bills").send(payload);
      expect(res.status).toBe(status);
    });

    test("creates split bill", async () => {
      const res = await api().post("/api/restaurant/split-bills").send({
        billId: 1,
        tableNumber: "T1",
        entityType: "Table",
        splitLabel: "Party A",
        splitNo: 1,
        splitCount: 2,
        subtotal: 250,
        gst: 12.5,
        total: 262.5,
        paymentMethod: "UPI",
        items: [{ name: "Paneer Tikka", quantity: 1 }],
      });

      expect(res.status).toBe(200);
      expect(res.body.id).toBeTruthy();
    });
  });
});
