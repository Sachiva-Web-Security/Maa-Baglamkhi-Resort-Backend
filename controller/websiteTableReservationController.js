const websiteTableReservationService = require("../Services/websiteTableReservationService");

const getErrorStatus = (error) => {
  const message = String(error?.message || "").toLowerCase();

  if (message.includes("not found")) return 404;
  if (message.includes("required") || message.includes("valid") || message.includes("unavailable")) return 400;
  if (message.includes("duplicate") || message.includes("already")) return 409;

  return Number(error?.statusCode || 500);
};

exports.getDiningConfig = async (_req, res) => {
  try {
    const data = await websiteTableReservationService.getDiningConfig();
    res.json({ success: true, data });
  } catch (error) {
    res.status(getErrorStatus(error)).json({ success: false, message: error.message });
  }
};

exports.getDiningAvailability = async (req, res) => {
  try {
    const data = await websiteTableReservationService.getDiningAvailability(req.query);
    res.json({ success: true, data });
  } catch (error) {
    res.status(getErrorStatus(error)).json({ success: false, message: error.message });
  }
};

exports.getAvailableTables = async (req, res) => {
  try {
    const data = await websiteTableReservationService.getAvailableTables(req.query);
    res.json({ success: true, data });
  } catch (error) {
    res.status(getErrorStatus(error)).json({ success: false, message: error.message });
  }
};

exports.createWebsiteTableReservation = async (req, res) => {
  try {
    const data = await websiteTableReservationService.createWebsiteTableReservation(req.body);
    res.status(data.reused ? 200 : 201).json({
      success: true,
      message: data.reused
        ? data.message
        : "Dining reservation request created successfully",
      data,
    });
  } catch (error) {
    res.status(getErrorStatus(error)).json({ success: false, message: error.message });
  }
};

exports.getWebsiteTableReservationByCode = async (req, res) => {
  try {
    const reservation = await websiteTableReservationService.getWebsiteTableReservationByCode(req.params.code);

    if (!reservation) {
      return res.status(404).json({ success: false, message: "Reservation not found" });
    }

    res.json({ success: true, data: reservation });
  } catch (error) {
    res.status(getErrorStatus(error)).json({ success: false, message: error.message });
  }
};

exports.cancelWebsiteTableReservationByCode = async (req, res) => {
  try {
    const reservation = await websiteTableReservationService.cancelWebsiteTableReservationByCode(
      req.params.code,
      req.body,
    );
    res.json({ success: true, message: "Reservation cancelled successfully", data: reservation });
  } catch (error) {
    res.status(getErrorStatus(error)).json({ success: false, message: error.message });
  }
};

exports.getAllWebsiteTableReservations = async (req, res) => {
  try {
    const data = await websiteTableReservationService.getAllWebsiteTableReservations(req.query);
    res.json({ success: true, data });
  } catch (error) {
    res.status(getErrorStatus(error)).json({ success: false, message: error.message });
  }
};

exports.confirmWebsiteTableReservation = async (req, res) => {
  try {
    const reservation = await websiteTableReservationService.confirmWebsiteTableReservation(
      req.params.id,
      req.body,
    );
    res.json({ success: true, message: "Reservation confirmed successfully", data: reservation });
  } catch (error) {
    res.status(getErrorStatus(error)).json({ success: false, message: error.message });
  }
};

exports.cancelWebsiteTableReservationById = async (req, res) => {
  try {
    const reservation = await websiteTableReservationService.cancelWebsiteTableReservationById(
      req.params.id,
      req.body,
    );
    res.json({ success: true, message: "Reservation cancelled successfully", data: reservation });
  } catch (error) {
    res.status(getErrorStatus(error)).json({ success: false, message: error.message });
  }
};

exports.assignWebsiteTableReservationTable = async (req, res) => {
  try {
    const reservation = await websiteTableReservationService.assignWebsiteTableReservationTable(
      req.params.id,
      req.body,
    );
    res.json({ success: true, message: "Table assigned successfully", data: reservation });
  } catch (error) {
    res.status(getErrorStatus(error)).json({ success: false, message: error.message });
  }
};

exports.seatWebsiteTableReservation = async (req, res) => {
  try {
    const reservation = await websiteTableReservationService.seatWebsiteTableReservation(
      req.params.id,
      req.body,
    );
    res.json({ success: true, message: "Reservation marked as seated", data: reservation });
  } catch (error) {
    res.status(getErrorStatus(error)).json({ success: false, message: error.message });
  }
};

exports.markNoShowWebsiteTableReservation = async (req, res) => {
  try {
    const reservation = await websiteTableReservationService.markNoShowWebsiteTableReservation(
      req.params.id,
      req.body,
    );
    res.json({ success: true, message: "Reservation marked as no show", data: reservation });
  } catch (error) {
    res.status(getErrorStatus(error)).json({ success: false, message: error.message });
  }
};


exports.createWebsiteTableReservationPaymentOrder = async (req, res) => {
  try {
    const data = await websiteTableReservationService.createWebsiteTableReservationPaymentOrder(
      req.params.code,
      req.body,
    );
    res.json({ success: true, message: "Payment order created successfully", data });
  } catch (error) {
    res.status(getErrorStatus(error)).json({ success: false, message: error.message });
  }
};

exports.verifyWebsiteTableReservationPayment = async (req, res) => {
  try {
    const data = await websiteTableReservationService.verifyWebsiteTableReservationPayment(
      req.params.code,
      req.body,
    );
    res.json({ success: true, message: "Payment verified successfully", data });
  } catch (error) {
    res.status(getErrorStatus(error)).json({ success: false, message: error.message });
  }
};
