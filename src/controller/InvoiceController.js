const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

// ─── Invoice helpers ──────────────────────────────────────────────────────────

const ensureInvoiceSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INT NOT NULL AUTO_INCREMENT,
      invoice_no VARCHAR(120) NOT NULL,
      date DATE NULL,
      customer_name VARCHAR(255) DEFAULT NULL,
      phone VARCHAR(30) DEFAULT NULL,
      room_no VARCHAR(255) DEFAULT NULL,
      check_in DATE DEFAULT NULL,
      check_out DATE DEFAULT NULL,
      price_per_day DECIMAL(12,2) DEFAULT 0,
      food_charge DECIMAL(12,2) DEFAULT 0,
      extra_charge DECIMAL(12,2) DEFAULT 0,
      gst DECIMAL(12,2) DEFAULT 0,
      discount DECIMAL(12,2) DEFAULT 0,
      final_total DECIMAL(12,2) DEFAULT 0,
      payment_mode VARCHAR(100) DEFAULT NULL,
      status VARCHAR(50) DEFAULT 'Pending',
      notes TEXT NULL,
      booking_id INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_invoice_no (invoice_no)
    )
  `);

  const columns = [
    ["customer_id", "INT DEFAULT NULL AFTER booking_id"],
    ["total_amount", "DECIMAL(12,2) DEFAULT 0 AFTER final_total"],
    ["company_name", "VARCHAR(255) DEFAULT NULL AFTER total_amount"],
    ["company_gstin", "VARCHAR(30) DEFAULT NULL AFTER company_name"],
    ["subtotal", "DECIMAL(12,2) DEFAULT 0 AFTER extra_charge"],
    ["payment_status", "VARCHAR(50) DEFAULT 'Pending' AFTER payment_mode"],
    ["items_json", "LONGTEXT NULL AFTER notes"],
  ];
  for (const [col, def] of columns) {
    const [[{ COUNT }]] = await runQuery(
      `SELECT COUNT(*) AS COUNT FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invoices' AND COLUMN_NAME = ?`,
      [col],
    );
    if (!COUNT) {
      await runQuery(`ALTER TABLE invoices ADD COLUMN ${col} ${def}`);
    }
  }
};

const parseInvoiceRow = (row) => ({
  ...row,
  items: (() => {
    try {
      return JSON.parse(row.items_json || "[]");
    } catch {
      return [];
    }
  })(),
  invoiceNo: row.invoiceNo || row.invoice_no || "",
  bookingId: row.bookingId ?? row.booking_id ?? row.customer_id ?? null,
  customerName: row.customerName || row.customer_name || "",
  phone: row.phone || "",
  roomNumber: row.roomNumber || row.room_no || "",
  checkIn: row.checkIn || row.check_in || "",
  checkOut: row.checkOut || row.check_out || "",
  paymentMode: row.paymentMode || row.payment_mode || "",
  paymentStatus: row.paymentStatus || row.payment_status || row.status || "Pending",
  companyName: row.companyName || row.company_name || null,
  companyGstin: row.companyGstin || row.company_gstin || null,
  totalAmount: Number(row.totalAmount ?? row.total_amount ?? row.final_total ?? 0),
  subtotal: Number(row.subtotal || 0),
  tax: Number(row.gst || 0),
  discount: Number(row.discount || 0),
  paidAmount: Number(row.paidAmount || 0),
});

exports.createInvoice = async (req, res) => {
  try {
    await ensureInvoiceSchema();
    const data = req.body || {};
    const invoiceNo = data.invoiceNo || `INV-${Date.now()}`;
    const result = await runQuery(
      `INSERT INTO invoices
        (invoice_no, date, customer_name, phone, room_no, check_in, check_out,
         price_per_day, food_charge, extra_charge, subtotal, gst, discount,
         final_total, total_amount, payment_mode, payment_status, status,
         notes, items_json, booking_id, customer_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        invoiceNo,
        data.date || null,
        data.customerName || null,
        data.phone || null,
        data.roomNo || null,
        data.checkIn || null,
        data.checkOut || null,
        data.pricePerDay || 0,
        data.foodCharge || 0,
        data.extraCharge || 0,
        data.subtotal || 0,
        data.gst || data.tax || 0,
        data.discount || 0,
        data.finalTotal || data.totalAmount || 0,
        data.totalAmount || data.finalTotal || 0,
        data.paymentMode || null,
        data.paymentStatus || data.status || "Pending",
        data.status || data.paymentStatus || "Pending",
        data.notes || null,
        JSON.stringify(data.items || []),
        data.bookingId || null,
        data.customerId || data.bookingId || null,
      ],
    );
    res.status(201).json({
      message: "Invoice created successfully",
      id: result.insertId,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to create invoice", details: err.message || err });
  }
};

exports.getAllInvoices = async (req, res) => {
  try {
    await ensureInvoiceSchema();
    const rows = await runQuery(
      `SELECT i.*, COALESCE(SUM(a.amount), 0) AS paidAmount,
              COALESCE(SUM(a.discount_amount), 0) AS advanceDiscount
       FROM invoices i
       LEFT JOIN advance_payment a ON a.booking_id = i.booking_id
       GROUP BY i.id
       ORDER BY i.updated_at DESC, i.id DESC`,
    );
    const seen = new Set();
    const deduped = rows.filter((row) => {
      const key = `booking:${row.booking_id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    res.json(deduped.map(parseInvoiceRow) || []);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch invoices", details: err.message || err });
  }
};

exports.getInvoiceByBookingId = async (req, res) => {
  try {
    await ensureInvoiceSchema();
    const bookingId = Number(req.params.bookingId);
    if (!bookingId) {
      return res.json({});
    }
    const rows = await runQuery(
      `SELECT * FROM invoices
       WHERE booking_id = ? OR customer_id = ?
       ORDER BY updated_at DESC, id DESC
       LIMIT 1`,
      [bookingId, bookingId],
    );
    res.json(rows[0] ? parseInvoiceRow(rows[0]) : {});
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch invoice", details: err.message || err });
  }
};

exports.updateInvoice = async (req, res) => {
  try {
    await ensureInvoiceSchema();
    const id = Number(req.params.id);
    const data = req.body || {};
    await runQuery(
      `UPDATE invoices SET
        date = ?, customer_name = ?, phone = ?, room_no = ?, check_in = ?, check_out = ?,
        price_per_day = ?, food_charge = ?, extra_charge = ?, subtotal = ?, gst = ?, discount = ?,
        final_total = ?, total_amount = ?, payment_mode = ?, payment_status = ?, status = ?,
        notes = ?, items_json = ?
       WHERE id = ?`,
      [
        data.date || null,
        data.customerName || null,
        data.phone || null,
        data.roomNo || null,
        data.checkIn || null,
        data.checkOut || null,
        data.pricePerDay || 0,
        data.foodCharge || 0,
        data.extraCharge || 0,
        data.subtotal || 0,
        data.gst || data.tax || 0,
        data.discount || 0,
        data.finalTotal || data.totalAmount || 0,
        data.totalAmount || data.finalTotal || 0,
        data.paymentMode || null,
        data.paymentStatus || data.status || "Pending",
        data.status || data.paymentStatus || "Pending",
        data.notes || null,
        JSON.stringify(data.items || []),
        id,
      ],
    );
    res.json({ message: "Invoice updated successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to update invoice", details: err.message || err });
  }
};

exports.generateCustomerInvoice = async (req, res) => {
  try {
    const customerId = Number(req.params.customerId);
    if (!customerId) {
      return res.status(400).json({ error: "customerId is required" });
    }

    await ensureInvoiceSchema();

    // Build base booking info
    const bookingRows = await runQuery(
      `SELECT
        g.id AS bookingId,
        g.guest_name AS customerName,
        g.mobile AS phone,
        g.check_in AS checkIn,
        g.check_out AS checkOut,
        g.booking_status AS bookingStatus,
        ob.booking_type AS bookingType,
        COALESCE(a.amount, 0) AS paidAmount,
        COALESCE(a.discount_amount, 0) AS advanceDiscount,
        GROUP_CONCAT(DISTINCT CAST(rt.room_number AS CHAR) ORDER BY rt.room_number SEPARATOR ', ') AS roomNumbers,
        c.company_name AS companyName,
        c.gstin AS companyGst
      FROM guests g
      LEFT JOIN other_booking ob ON ob.guest_id = g.id
      LEFT JOIN advance_payment a ON a.booking_id = g.id
      LEFT JOIN room_tariff rt ON rt.booking_id = g.id
      LEFT JOIN companies c ON c.booking_id = g.id
      WHERE g.id = ?
      GROUP BY g.id, g.guest_name, g.mobile, g.check_in, g.check_out,
        g.booking_status, ob.booking_type, a.amount, a.discount_amount,
        c.company_name, c.gstin
      LIMIT 1`,
      [customerId],
    );

    const booking = bookingRows[0];
    if (!booking) {
      return res.status(404).json({ error: `Customer/booking #${customerId} not found` });
    }

    const nights = (() => {
      if (booking.checkIn && booking.checkOut) {
        const d1 = new Date(booking.checkIn);
        const d2 = new Date(booking.checkOut);
        const diff = Math.round((d2 - d1) / 86400000);
        return diff > 0 ? diff : 1;
      }
      return 1;
    })();

    // Room items
    const roomNumbers = String(booking.roomNumbers || "").split(",").map((s) => s.trim()).filter(Boolean);
    const roomRows = await runQuery(
      `SELECT
         CAST(room_number AS CHAR) AS roomNumber,
         COALESCE(category_name, 'Room Charge') AS roomType,
         COALESCE(NULLIF(quantity, 0), 1) AS quantity,
         COALESCE(tariff, 0) AS price,
         COALESCE(gst, 0) AS gstPercent
       FROM room_tariff
       WHERE booking_id = ?
       ORDER BY room_number`,
      [customerId],
    );
    const roomItems = roomRows.map((row) => {
      const qty = Number(row.quantity || 1);
      const price = Number(row.price || 0);
      const gstPct = Number(row.gstPercent || 0);
      const rowTotal = Number((price * qty * nights + (price * qty * nights * gstPct) / 100).toFixed(2));
      return {
        category: "Hotel",
        name: `${row.roomType} - Room ${row.roomNumber}`,
        price,
        quantity: qty,
        gstPercent: gstPct,
        nights,
        total: rowTotal,
      };
    });

    // Folio items
    const folioRows = await runQuery(
      `SELECT entry_type, category, description, amount
       FROM hotel_folio_entries
       WHERE booking_id = ?
       ORDER BY entry_date ASC, id ASC`,
      [customerId],
    );
    const folioChargeItems = [];
    let folioDiscount = 0;
    folioRows.forEach((row) => {
      const amount = Number((Number(row.amount || 0)).toFixed(2));
      if (String(row.entry_type || "").toLowerCase() === "discount") {
        folioDiscount += Math.abs(amount);
        return;
      }
      if (["Payment", "Refund"].includes(String(row.entry_type || ""))) return;
      if (["Room Charge", "Extra Charge", "Adjustment"].includes(String(row.entry_type || ""))) {
        folioChargeItems.push({
          category: "Hotel",
          name: row.description || row.category || row.entry_type || "Hotel Charge",
          price: Math.abs(amount),
          quantity: 1,
          total: Math.abs(amount),
        });
      }
    });

    // Food items
    const foodItems = [];
    if (roomNumbers.length) {
      const placeholders = roomNumbers.map(() => "?").join(", ");
      const foodRows = await runQuery(
        `SELECT ro.roomNumber, roi.name, roi.price, roi.quantity
         FROM room_orders ro
         INNER JOIN room_order_items roi ON roi.order_id = ro.id
         WHERE ro.roomNumber IN (${placeholders})
           AND LOWER(COALESCE(ro.status, 'pending')) IN ('served', 'paid', 'completed', 'billed')
         ORDER BY ro.id ASC, roi.id ASC`,
        roomNumbers,
      );
      foodRows.forEach((row) => {
        const qty = Number(row.quantity || 0);
        const price = Number(row.price || 0);
        if (qty > 0 && price > 0) {
          foodItems.push({
            category: "Food",
            name: `${row.name} - Room ${row.roomNumber}`,
            price,
            quantity: qty,
            total: Number((price * qty).toFixed(2)),
          });
        }
      });
    }

    const items = [...roomItems, ...folioChargeItems, ...foodItems];
    const subtotal = Number(items.reduce((sum, item) => sum + Number(item.total || 0), 0).toFixed(2));
    const tax = Number((subtotal * 0.05).toFixed(2));
    const discount = Number((Number(booking.advanceDiscount || 0) + folioDiscount).toFixed(2));
    const totalAmount = Number((subtotal + tax - discount).toFixed(2));
    const roomCharge = Number(
      [...roomItems, ...folioChargeItems]
        .filter((item) => item.category === "Hotel")
        .reduce((sum, item) => sum + Number(item.total || 0), 0)
        .toFixed(2),
    );
    const foodCharge = Number(foodItems.reduce((sum, item) => sum + Number(item.total || 0), 0).toFixed(2));
    const extraCharge = Number(
      folioChargeItems.reduce((sum, item) => sum + Number(item.total || 0), 0).toFixed(2),
    );

    // Check for existing invoice
    const existingRows = await runQuery(
      `SELECT * FROM invoices WHERE booking_id = ? OR customer_id = ? ORDER BY updated_at DESC, id DESC LIMIT 1`,
      [customerId, customerId],
    );
    const existing = existingRows[0];

    const buildInvoiceNo = () =>
      `HOTINV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(customerId).padStart(4, "0")}`;
    const invoiceNo = existing?.invoice_no || buildInvoiceNo();
    const paymentStatus = existing?.payment_status || existing?.status || (totalAmount > Number(booking.paidAmount || 0) ? "Pending" : "Paid");
    const paymentMode = existing?.payment_mode || (Number(booking.paidAmount || 0) > 0 ? "Mixed / Recorded" : "Pending");

    if (existing) {
      await runQuery(
        `UPDATE invoices SET
          invoice_no = ?, date = ?, customer_name = ?, phone = ?, room_no = ?,
          check_in = ?, check_out = ?, price_per_day = ?, food_charge = ?, extra_charge = ?,
          subtotal = ?, gst = ?, discount = ?, final_total = ?, total_amount = ?,
          company_name = ?, company_gstin = ?, payment_mode = ?, payment_status = ?, status = ?,
          notes = ?, items_json = ?, booking_id = ?, customer_id = ?
         WHERE id = ?`,
        [
          invoiceNo,
          new Date().toISOString().slice(0, 10),
          booking.customerName || "Walk-in Guest",
          booking.phone || "",
          roomNumbers.join(", "),
          booking.checkIn || null,
          booking.checkOut || null,
          0, roomCharge, extraCharge,
          subtotal, tax, discount, totalAmount, totalAmount,
          booking.companyName || null,
          booking.companyGst || null,
          paymentMode, paymentStatus, paymentStatus,
          `Auto-generated combined invoice for booking #${customerId}`,
          JSON.stringify(items),
          customerId, customerId,
          existing.id,
        ],
      );
    } else {
      await runQuery(
        `INSERT INTO invoices
          (invoice_no, date, customer_name, phone, room_no, check_in, check_out,
           price_per_day, food_charge, extra_charge, subtotal, gst, discount,
           final_total, total_amount, company_name, company_gstin,
           payment_mode, payment_status, status, notes, items_json, booking_id, customer_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          invoiceNo,
          new Date().toISOString().slice(0, 10),
          booking.customerName || "Walk-in Guest",
          booking.phone || "",
          roomNumbers.join(", "),
          booking.checkIn || null,
          booking.checkOut || null,
          0, roomCharge, extraCharge,
          subtotal, tax, discount, totalAmount, totalAmount,
          booking.companyName || null,
          booking.companyGst || null,
          paymentMode, paymentStatus, paymentStatus,
          `Auto-generated combined invoice for booking #${customerId}`,
          JSON.stringify(items),
          customerId, customerId,
        ],
      );
    }

    const result = {
      id: existing ? existing.id : undefined,
      customerId: Number(customerId),
      bookingId: Number(customerId),
      invoiceNo,
      customerName: booking.customerName || "Walk-in Guest",
      phone: booking.phone || "",
      roomNumber: roomNumbers.join(", "),
      roomNumbers: roomNumbers.join(", "),
      companyName: booking.companyName || "",
      companyGstin: booking.companyGst || "",
      items,
      subtotal,
      tax,
      discount,
      totalAmount,
      paidAmount: Number(booking.paidAmount || 0),
      balanceDue: Number(totalAmount) - Number(booking.paidAmount || 0),
      date: new Date().toISOString().slice(0, 10),
      checkIn: booking.checkIn || "",
      checkOut: booking.checkOut || "",
      paymentMode,
      paymentStatus,
      roomCharge,
      foodCharge,
      bookingStatus: booking.bookingStatus || "Confirmed",
    };

    res.json(result);
  } catch (error) {
    const status = String(error.message || "").includes("not found") ? 404 : 500;
    res.status(status).json({ error: error.message || "Failed to generate invoice" });
  }
};

exports.updateInvoicePaymentStatus = async (req, res) => {
  const paymentStatus = String(req.body.paymentStatus || "").trim();
  if (!paymentStatus) {
    return res.status(400).json({ error: "paymentStatus is required" });
  }

  try {
    const bookingId = Number(req.params.id);
    await ensureInvoiceSchema();

    // Fetch existing invoice to know whether WhatsApp should fire
    const invoiceRows = await runQuery(
      `SELECT * FROM invoices WHERE booking_id = ? OR customer_id = ? ORDER BY updated_at DESC, id DESC LIMIT 1`,
      [bookingId, bookingId],
    );
    const invoiceRow = invoiceRows[0] || null;

    await runQuery(
      `UPDATE invoices
       SET payment_status = ?, status = ?, payment_mode = COALESCE(?, payment_mode)
       WHERE id = ?`,
      [paymentStatus, paymentStatus, req.body.paymentMode || null, invoiceRow?.id],
    );

    // Auto-send WhatsApp invoice if payment is now Paid/Completed
    const normalized = String(paymentStatus || "").trim().toLowerCase();
    const shouldNotify = normalized === "paid" || normalized === "completed";

    if (shouldNotify && invoiceRow) {
      setImmediate(async () => {
        try {
          const { generateInvoicePdf } = require("../services/invoicePdfService");
          const WhatsApp = require("../services/whatsappService");
          const UserModel = require("../models/UserModel");

          const invoice = invoiceRow
            ? {
                ...invoiceRow,
                items: (() => {
                  try {
                    return JSON.parse(invoiceRow.items_json || "[]");
                  } catch {
                    return [];
                  }
                })(),
                invoiceNo: invoiceRow.invoiceNo || invoiceRow.invoice_no || "",
                bookingId: invoiceRow.bookingId ?? invoiceRow.booking_id ?? invoiceRow.customer_id ?? null,
                customerName: invoiceRow.customerName || invoiceRow.customer_name || "",
                phone: invoiceRow.phone || "",
                roomNumber: invoiceRow.roomNumber || invoiceRow.room_no || "",
                checkIn: invoiceRow.checkIn || invoiceRow.check_in || "",
                checkOut: invoiceRow.checkOut || invoiceRow.check_out || "",
                paymentMode: invoiceRow.paymentMode || invoiceRow.payment_mode || "",
                paymentStatus: invoiceRow.paymentStatus || invoiceRow.payment_status || invoiceRow.status || "Pending",
                totalAmount: Number(invoiceRow.totalAmount ?? invoiceRow.total_amount ?? invoiceRow.final_total ?? 0),
                subtotal: Number(invoiceRow.subtotal || 0),
                tax: Number(invoiceRow.gst || 0),
                discount: Number(invoiceRow.discount || 0),
              }
            : null;

          if (!invoice) return;

          let fileUrl = null;
          let fileName = null;
          let filePath = null;
          try {
            const pdf = await generateInvoicePdf(invoice);
            const publicBase =
              (process.env.PUBLIC_BASE_URL ||
                process.env.PUBLIC_URL ||
                process.env.CLIENT_URL ||
                `http://localhost:${process.env.PORT || 5002}`
              ).replace(/\/+$/, "");
            fileUrl = `${publicBase}/uploads/invoices/${pdf.fileName}`;
            fileName = pdf.fileName;
            filePath = pdf.filePath;
          } catch (pdfErr) {
            if (process.env.NODE_ENV !== "test") {
              console.warn(
                `[auto-whatsapp] PDF generation failed for invoice #${invoice.invoiceNo || invoice.id}:`,
                pdfErr.message || pdfErr,
              );
            }
          }

          let adminNumber = "";
          try {
            const adminRows = await new Promise((resolve, reject) => {
              UserModel.findAdminUser((err, rows) =>
                err ? reject(err) : resolve(rows),
              );
            });
            adminNumber = adminRows?.phone || "";
          } catch (e) {
            // ignore — service will note no admin number
          }

          const attachment = fileUrl
            ? { fileUrl, fileName, filePath }
            : undefined;

          await WhatsApp.sendInvoiceNotifications(
            {
              customerName: invoice.customerName || "Guest",
              phone: invoice.phone || "",
              totalAmount: Number(invoice.totalAmount || 0),
              invoiceNo: invoice.invoiceNo || `#${invoice.id}`,
              checkIn: invoice.checkIn || "",
              checkOut: invoice.checkOut || "",
              paymentStatus: String(invoice.paymentStatus || "").trim(),
            },
            attachment,
            { adminNumber },
          );

          if (process.env.NODE_ENV !== "test") {
            console.log(
              `[auto-whatsapp] invoice #${invoice.invoiceNo || invoice.id} (status: ${paymentStatus}) delivered`,
            );
          }
        } catch (autoErr) {
          console.error(
            "[auto-whatsapp] auto-send failed for invoice #",
            req.params.id,
            autoErr.message || autoErr,
          );
        }
      });
    }

    res.json({ message: "Payment status updated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to update payment status" });
  }
};
