/**
 * Booking CRUD and dashboard for the banquet module.
 */

const {
  runQuery,
  toNumber,
  getHallRateColumn,
  getBookingById,
  hasTimeOverlap,
  parseBanquetMeta,
  stripBanquetMeta,
  buildBanquetNotes,
  validateBookingPayload,
} = require("../utils/banquetHelpers");

const { getBanquetPricingConfig } = require("./banquetPricingController");

// ---------------------------------------------------------------------------
// Booking-specific helpers
// ---------------------------------------------------------------------------

const normalizePaymentStatus = ({ grandTotal, advance, refundAmount, explicitStatus }) => {
  const normalizedExplicit = String(explicitStatus || "").trim();
  const netReceived = Math.max(0, toNumber(advance) - toNumber(refundAmount));
  const total = Math.max(0, toNumber(grandTotal));

  if (normalizedExplicit.toLowerCase() === "refunded") return "Refunded";
  if (total > 0 && netReceived >= total) return "Paid";
  if (netReceived > 0) return "Partial";
  return normalizedExplicit || "Pending";
};

const buildFinancialSnapshot = (payload = {}, existingBooking = null) => {
  const hallCharge =
    payload.hallCharge ?? payload.hall_charge ?? existingBooking?.hall_charge ?? 0;
  const mealCharge =
    payload.mealCharge ?? payload.meal_charge ?? existingBooking?.meal_charge ?? 0;
  const customMenuCharge =
    payload.customMenuCharge ??
    payload.custom_menu_charge ??
    existingBooking?.custom_menu_charge ??
    0;
  const lightingCharge =
    payload.lightingCharge ??
    payload.lighting_charge ??
    existingBooking?.lighting_charge ??
    0;
  const eventSupportFee =
    payload.eventSupportFee ??
    payload.event_support_fee ??
    existingBooking?.event_support_fee ??
    0;
  const decorationFee =
    payload.decorationFee ?? payload.decoration_fee ?? existingBooking?.decoration_fee ?? 0;
  const discount = payload.discount ?? existingBooking?.discount ?? 0;
  const gstPercent = payload.gstPercent ?? payload.gst_percent ?? existingBooking?.gst_percent ?? 5;
  const subtotalAmount =
    payload.subtotalAmount ?? payload.subtotal_amount ?? existingBooking?.subtotal_amount ?? 0;
  const gstAmount = payload.gstAmount ?? payload.gst_amount ?? existingBooking?.gst_amount ?? 0;
  const grandTotal =
    payload.grandTotal ??
    payload.grand_total ??
    payload.totalAmount ??
    payload.total_amount ??
    existingBooking?.grand_total ??
    existingBooking?.total_amount ??
    0;
  const advance = payload.advance ?? existingBooking?.advance ?? existingBooking?.advance_paid ?? 0;
  const refundAmount =
    payload.refundAmount ?? payload.refund_amount ?? existingBooking?.refund_amount ?? 0;
  const netReceived = Math.max(0, toNumber(advance) - toNumber(refundAmount));
  const balanceDue = Math.max(0, toNumber(grandTotal) - netReceived);
  const paymentMode =
    payload.paymentMode ?? payload.payment_mode ?? existingBooking?.payment_mode ?? null;
  const paymentReferenceNo =
    payload.paymentReferenceNo ??
    payload.payment_reference_no ??
    existingBooking?.payment_reference_no ??
    null;
  const paymentStatus = normalizePaymentStatus({
    grandTotal,
    advance,
    refundAmount,
    explicitStatus: payload.paymentStatus ?? payload.payment_status ?? existingBooking?.payment_status,
  });

  return {
    hallCharge: toNumber(hallCharge),
    mealCharge: toNumber(mealCharge),
    customMenuCharge: toNumber(customMenuCharge),
    lightingCharge: toNumber(lightingCharge),
    eventSupportFee: toNumber(eventSupportFee),
    decorationFee: toNumber(decorationFee),
    discount: toNumber(discount),
    gstPercent: toNumber(gstPercent || 5),
    subtotalAmount: toNumber(subtotalAmount),
    gstAmount: toNumber(gstAmount),
    grandTotal: toNumber(grandTotal),
    advance: toNumber(advance),
    refundAmount: toNumber(refundAmount),
    netReceived,
    balanceDue,
    paymentMode,
    paymentStatus,
    paymentReferenceNo,
  };
};

const checkBookingOverlap = async ({ hallId, date, startTime, endTime, excludeId = null }) => {
  const conflicts = await runQuery(
    `
    SELECT id, start_time, end_time
    FROM banquet_bookings
    WHERE hall_id = ?
      AND date = ?
      AND status IN ('Confirmed', 'Completed', 'Billed')
      ${excludeId ? "AND id <> ?" : ""}
    `,
    excludeId ? [hallId, date, excludeId] : [hallId, date]
  );

  return conflicts.some((row) => hasTimeOverlap(startTime, endTime, row.start_time, row.end_time));
};

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

// GET /banquet
const getBanquetDashboard = async (req, res) => {
  try {
    const hallRateColumn = await getHallRateColumn();
    const pricingConfig = await getBanquetPricingConfig();
    const halls = await runQuery(`
      SELECT
        id,
        name,
        capacity,
        ${hallRateColumn} AS ratePerHour,
        is_ac,
        image,
        status
      FROM banquet_halls
      ORDER BY id DESC
    `);

    const bookings = await runQuery(`
      SELECT
        b.id,
        b.hall_id,
        h.name AS hallName,
        b.customer_name,
        b.phone,
        b.guest_email,
        b.event_title,
        b.event_type,
        b.guests,
        b.menu_package_id,
        b.meal_section,
        b.custom_menu_items,
        b.lighting_system,
        b.custom_menu_charge,
        b.lighting_charge,
        b.event_support_fee,
        b.hall_charge,
        b.meal_charge,
        b.decoration_fee,
        b.notes,
        b.date,
        b.start_time,
        b.end_time,
        b.discount,
        b.gst_percent,
        b.subtotal_amount,
        b.gst_amount,
        b.grand_total,
        b.invoice_no,
        b.status,
        b.advance,
        b.refund_amount,
        b.net_received,
        b.balance_due,
        b.payment_mode,
        b.payment_status,
        b.payment_reference_no,
        b.billed_at,
        ${hallRateColumn} AS hallRatePerHour
      FROM banquet_bookings b
      JOIN banquet_halls h ON b.hall_id = h.id
      ORDER BY b.id DESC
    `);

    const formattedBookings = bookings.map((b) => ({
      id: b.id,
      hallId: b.hall_id,
      hallName: b.hallName,
      customerName: b.customer_name,
      phone: b.phone,
      guestEmail: b.guest_email,
      eventTitle: b.event_title,
      eventType: b.event_type,
      guests: b.guests,
      menuPackageId: b.menu_package_id,
      mealSection: b.meal_section,
      customMenuItems: b.custom_menu_items,
      lightingSystem: b.lighting_system,
      customMenuCharge: Number(b.custom_menu_charge || 0),
      lightingCharge: Number(b.lighting_charge || 0),
      eventSupportFee: Number(b.event_support_fee || 0),
      hallCharge: Number(b.hall_charge || 0),
      mealCharge: Number(b.meal_charge || 0),
      hallRatePerHour: Number(b.hallRatePerHour || 0),
      decorationFee: Number(b.decoration_fee || 0),
      notes: b.notes,
      date: b.date,
      startTime: b.start_time,
      endTime: b.end_time,
      discount: Number(b.discount || 0),
      gstPercent: Number(b.gst_percent || 5),
      subtotalAmount: Number(b.subtotal_amount || 0),
      gstAmount: Number(b.gst_amount || 0),
      grandTotal: Number(b.grand_total || 0),
      invoiceNo: b.invoice_no,
      status: b.status,
      advance: Number(b.advance || 0),
      refundAmount: Number(b.refund_amount || 0),
      netReceived: Number(b.net_received || 0),
      balanceDue: Number(b.balance_due || 0),
      paymentMode: b.payment_mode || null,
      paymentStatus: b.payment_status || "Pending",
      paymentReferenceNo: b.payment_reference_no || null,
      billedAt: b.billed_at || null,
      pricingConfig,
    }));

    res.status(200).json({
      halls,
      bookings: formattedBookings,
    });
  } catch (error) {
    console.error("getBanquetDashboard error:", error);
    res.status(500).json({ message: "Failed to load banquet data" });
  }
};

// ---------------------------------------------------------------------------
// Booking CRUD
// ---------------------------------------------------------------------------

// POST /banquet
const createBanquetBooking = async (req, res) => {
  try {
    const {
      hallId,
      customerName,
      phone,
      guestEmail,
      eventTitle,
      eventType,
      guests,
      menuPackageId,
      mealSection,
      customMenuItems,
      lightingSystem,
      customMenuCharge,
      lightingCharge,
      eventSupportFee,
      hallCharge,
      mealCharge,
      decorationFee,
      notes,
      date,
      startTime,
      endTime,
      discount,
      gstPercent,
      advance,
      subtotalAmount,
      gstAmount,
      grandTotal,
      refundAmount,
      paymentMode,
      paymentStatus,
      paymentReferenceNo,
    } = req.body;

    if (
      !validateBookingPayload({
        hallId,
        customerName,
        eventType,
        guests,
        date,
        startTime,
        endTime,
      })
    ) {
      return res.status(400).json({
        message: "Required fields missing",
      });
    }

    const hallRows = await runQuery("SELECT id FROM banquet_halls WHERE id = ? LIMIT 1", [hallId]);
    if (!hallRows.length) {
      return res.status(400).json({ message: "Invalid hallId" });
    }

    const overlapping = await checkBookingOverlap({
      hallId,
      date,
      startTime,
      endTime,
    });

    if (overlapping) {
      return res.status(409).json({
        message: "Selected hall is already booked for the chosen time slot",
      });
    }

    const financials = buildFinancialSnapshot({
      customMenuCharge,
      lightingCharge,
      eventSupportFee,
      hallCharge,
      mealCharge,
      decorationFee,
      discount,
      gstPercent,
      subtotalAmount,
      gstAmount,
      grandTotal,
      advance,
      refundAmount,
      paymentMode,
      paymentStatus,
      paymentReferenceNo,
    });

    const result = await runQuery(
      `
      INSERT INTO banquet_bookings (
        hall_id,
        customer_name,
        phone,
        guest_email,
        event_title,
        event_type,
        guests,
        menu_package_id,
        meal_section,
        custom_menu_items,
        lighting_system,
        custom_menu_charge,
        lighting_charge,
        event_support_fee,
        hall_charge,
        meal_charge,
        decoration_fee,
        notes,
        date,
        start_time,
        end_time,
        discount,
        gst_percent,
        subtotal_amount,
        gst_amount,
        grand_total,
        invoice_no,
        status,
        advance,
        refund_amount,
        net_received,
        balance_due,
        payment_mode,
        payment_status,
        payment_reference_no
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        hallId,
        customerName,
        phone || "",
        guestEmail || "",
        eventTitle || "",
        eventType,
        Number(guests),
        menuPackageId || "standard",
        mealSection || "",
        customMenuItems || "",
        lightingSystem || "classic",
        financials.customMenuCharge,
        financials.lightingCharge,
        financials.eventSupportFee,
        financials.hallCharge,
        financials.mealCharge,
        financials.decorationFee,
        notes || "",
        date,
        startTime,
        endTime,
        financials.discount,
        financials.gstPercent,
        financials.subtotalAmount,
        financials.gstAmount,
        financials.grandTotal,
        null,
        "Confirmed",
        financials.advance,
        financials.refundAmount,
        financials.netReceived,
        financials.balanceDue,
        financials.paymentMode,
        financials.paymentStatus,
        financials.paymentReferenceNo,
      ]
    );

    res.status(201).json({
      message: "Banquet booking created successfully",
      id: result.insertId,
    });
  } catch (error) {
    console.error("createBanquetBooking error:", error);
    res.status(500).json({ message: "Failed to create booking" });
  }
};

// PUT /banquet/:id
const updateBanquetBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      hallId,
      customerName,
      phone,
      guestEmail,
      eventTitle,
      eventType,
      guests,
      menuPackageId,
      mealSection,
      customMenuItems,
      lightingSystem,
      customMenuCharge,
      lightingCharge,
      eventSupportFee,
      hallCharge,
      mealCharge,
      decorationFee,
      notes,
      date,
      startTime,
      endTime,
      discount,
      gstPercent,
      advance,
      subtotalAmount,
      gstAmount,
      grandTotal,
      refundAmount,
      paymentMode,
      paymentStatus,
      paymentReferenceNo,
      invoiceNo,
    } = req.body;

    if (
      !validateBookingPayload({
        hallId,
        customerName,
        eventType,
        guests,
        date,
        startTime,
        endTime,
      })
    ) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    const existingBooking = await getBookingById(id);
    if (!existingBooking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const hallRows = await runQuery("SELECT id FROM banquet_halls WHERE id = ? LIMIT 1", [hallId]);
    if (!hallRows.length) {
      return res.status(400).json({ message: "Invalid hallId" });
    }

    const overlapping = await checkBookingOverlap({
      hallId,
      date,
      startTime,
      endTime,
      excludeId: id,
    });

    if (overlapping) {
      return res.status(409).json({
        message: "Selected hall is already booked for the chosen time slot",
      });
    }

    const financials = buildFinancialSnapshot(
      {
        customMenuCharge,
        lightingCharge,
        eventSupportFee,
        hallCharge,
        mealCharge,
        decorationFee,
        discount,
        gstPercent,
        subtotalAmount,
        gstAmount,
        grandTotal,
        advance,
        refundAmount,
        paymentMode,
        paymentStatus,
        paymentReferenceNo,
      },
      existingBooking
    );

    const result = await runQuery(
      `
      UPDATE banquet_bookings
      SET hall_id = ?,
          customer_name = ?,
          phone = ?,
          guest_email = ?,
          event_title = ?,
          event_type = ?,
          guests = ?,
          menu_package_id = ?,
          meal_section = ?,
          custom_menu_items = ?,
          lighting_system = ?,
          custom_menu_charge = ?,
          lighting_charge = ?,
          event_support_fee = ?,
          hall_charge = ?,
          meal_charge = ?,
          decoration_fee = ?,
          notes = ?,
          date = ?,
          start_time = ?,
          end_time = ?,
          discount = ?,
          gst_percent = ?,
          subtotal_amount = ?,
          gst_amount = ?,
          grand_total = ?,
          advance = ?,
          refund_amount = ?,
          net_received = ?,
          balance_due = ?,
          payment_mode = ?,
          payment_status = ?,
          payment_reference_no = ?,
          invoice_no = ?
      WHERE id = ?
      `,
      [
        hallId,
        customerName,
        phone || "",
        guestEmail || "",
        eventTitle || "",
        eventType,
        Number(guests),
        menuPackageId || "standard",
        mealSection || "",
        customMenuItems || "",
        lightingSystem || "classic",
        financials.customMenuCharge,
        financials.lightingCharge,
        financials.eventSupportFee,
        financials.hallCharge,
        financials.mealCharge,
        financials.decorationFee,
        notes || "",
        date,
        startTime,
        endTime,
        financials.discount,
        financials.gstPercent,
        financials.subtotalAmount,
        financials.gstAmount,
        financials.grandTotal,
        financials.advance,
        financials.refundAmount,
        financials.netReceived,
        financials.balanceDue,
        financials.paymentMode,
        financials.paymentStatus,
        financials.paymentReferenceNo,
        invoiceNo || existingBooking.invoice_no || null,
        id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Booking not found" });
    }

    res.status(200).json({ message: "Booking updated successfully" });
  } catch (error) {
    console.error("updateBanquetBooking error:", error);
    res.status(500).json({ message: "Failed to update booking" });
  }
};

// PUT /banquet/:id/cancel
const cancelBanquetBooking = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await runQuery(
      `UPDATE banquet_bookings SET status = 'Cancelled' WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Booking not found" });
    }

    res.status(200).json({ message: "Booking cancelled successfully", status: "Cancelled" });
  } catch (error) {
    console.error("cancelBanquetBooking error:", error);
    res.status(500).json({ message: "Failed to cancel booking" });
  }
};

// PUT /banquet/:id/refund
const refundBanquetBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const requestedRefund = Number(req.body?.refundAmount || 0);

    if (!requestedRefund || requestedRefund <= 0) {
      return res.status(400).json({ message: "Valid refundAmount is required" });
    }

    const booking = await getBookingById(id);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const existingMeta = parseBanquetMeta(booking.notes || "");
    const existingRefund = Number(existingMeta.refundAmount || 0);
    const advancePaid = Number(booking.advance || 0);
    const remainingRefund = Math.max(0, advancePaid - existingRefund);

    if (requestedRefund > remainingRefund) {
      return res.status(400).json({
        message: "Refund amount cannot exceed received advance",
      });
    }

    const totalRefund = existingRefund + requestedRefund;
    const nextStatus =
      advancePaid > 0 && totalRefund >= advancePaid ? "Refunded" : booking.status;

    const nextMeta = {
      ...existingMeta,
      advance: advancePaid,
      refundAmount: totalRefund,
    };
    const grandTotal = Number(booking.grand_total || booking.total_amount || 0);
    const netReceived = Math.max(0, advancePaid - totalRefund);
    const balanceDue = Math.max(0, grandTotal - netReceived);
    const nextPaymentStatus =
      nextStatus === "Refunded"
        ? "Refunded"
        : normalizePaymentStatus({
            grandTotal,
            advance: advancePaid,
            refundAmount: totalRefund,
            explicitStatus: booking.payment_status,
          });

    await runQuery(
      `
      UPDATE banquet_bookings
      SET status = ?,
          notes = ?,
          refund_amount = ?,
          net_received = ?,
          balance_due = ?,
          payment_status = ?
      WHERE id = ?
      `,
      [
        nextStatus,
        buildBanquetNotes(booking.notes || "", nextMeta),
        totalRefund,
        netReceived,
        balanceDue,
        nextPaymentStatus,
        id,
      ]
    );

    res.status(200).json({
      message: "Refund recorded successfully",
      refundAmount: totalRefund,
      status: nextStatus,
      paymentStatus: nextPaymentStatus,
      netReceived,
      balanceDue,
    });
  } catch (error) {
    console.error("refundBanquetBooking error:", error);
    res.status(500).json({ message: "Failed to record refund" });
  }
};

// DELETE /banquet/:id
const deleteBanquetBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await getBookingById(id);

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (!["Cancelled", "Refunded"].includes(String(booking.status || ""))) {
      return res.status(400).json({
        message: "Only cancelled or refunded bookings can be deleted",
      });
    }

    await runQuery("DELETE FROM banquet_bookings WHERE id = ?", [id]);

    res.status(200).json({ message: "Booking deleted successfully" });
  } catch (error) {
    console.error("deleteBanquetBooking error:", error);
    res.status(500).json({ message: "Failed to delete booking" });
  }
};

// PUT /banquet/:id/complete
const completeBanquetBooking = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await runQuery(
      `UPDATE banquet_bookings SET status = 'Completed' WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Booking not found" });
    }

    res.status(200).json({ message: "Booking marked as completed" });
  } catch (error) {
    console.error("completeBanquetBooking error:", error);
    res.status(500).json({ message: "Failed to update booking status" });
  }
};

// PUT /banquet/:id/bill
const generateBanquetBill = async (req, res) => {
  try {
    const { id } = req.params;
    const { invoiceNo } = req.body;

    if (!invoiceNo) {
      return res.status(400).json({ message: "invoiceNo is required" });
    }

    const booking = await getBookingById(id);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const paymentStatus = normalizePaymentStatus({
      grandTotal: booking.grand_total || booking.total_amount || 0,
      advance: booking.advance || 0,
      refundAmount: booking.refund_amount || 0,
      explicitStatus: booking.payment_status,
    });

    const result = await runQuery(
      `
      UPDATE banquet_bookings
      SET invoice_no = ?, status = 'Billed', billed_at = NOW(), payment_status = ?
      WHERE id = ?
      `,
      [invoiceNo, paymentStatus, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Booking not found" });
    }

    res.status(200).json({ message: "Bill generated successfully" });
  } catch (error) {
    console.error("generateBanquetBill error:", error);
    res.status(500).json({ message: "Failed to generate bill" });
  }
};

module.exports = {
  getBanquetDashboard,
  createBanquetBooking,
  updateBanquetBooking,
  cancelBanquetBooking,
  refundBanquetBooking,
  deleteBanquetBooking,
  completeBanquetBooking,
  generateBanquetBill,
};
