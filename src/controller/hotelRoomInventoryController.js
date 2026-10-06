const db = require("../config/db");
const roomInventoryModel = require("../models/RoomsModel");


exports.bootstrap = async (_req, _res, next) => {
  try {
    await roomInventoryModel.ensureSchema();
    next();
  } catch (error) {
    next(error);
  }
};

exports.getRoomSetup = async (req, res) => {
  try {
    const setup = await roomInventoryModel.getRoomSetup({
      checkIn: req.query?.checkIn || null,
      checkOut: req.query?.checkOut || null,
    });
    res.json(setup);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load room setup" });
  }
};

exports.addRoom = async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.roomNumber && !body.room_number) {
      return res.status(400).json({ message: "roomNumber is required" });
    }
    const room = await roomInventoryModel.addRoom(body);
    res.json({ message: "Room added successfully", room });
  } catch (error) {
    if (error.code !== "ER_DUP_ENTRY" && process.env.NODE_ENV !== "test") {
      console.error(error);
    }
    res.status(500).json({
      message: error.code === "ER_DUP_ENTRY" ? "Room already exists" : "Failed to add room",
    });
  }
};

exports.updateCategoryPrice = async (req, res) => {
  try {
    const body = req.body || {};
    if (body.defaultPrice === undefined && body.default_price === undefined) {
      return res.status(400).json({ message: "defaultPrice is required" });
    }
    await roomInventoryModel.updateCategoryPrice({
      categoryId: req.params.id,
      defaultPrice: body.defaultPrice,
    });

    res.json({ message: "Price updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update category price" });
  }
};

exports.updateRoomOperationalState = async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.status) {
      return res.status(400).json({ message: "status is required" });
    }
    await roomInventoryModel.updateRoomOperationalState({
      roomNumber: req.params.roomNumber,
      guestName: body.guestName ?? null,
      status: body.status,
      checkIn: req.body.checkIn ?? null,
      checkOut: req.body.checkOut ?? null,
      blockReason: req.body.blockReason ?? null,
      blockFrom: req.body.blockFrom ?? null,
      blockTo: req.body.blockTo ?? null,
      blockNotes: req.body.blockNotes ?? null,
      blockedBy: req.body.blockedBy ?? null,
    });

    res.json({ message: "Room operational state updated" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update room operational state" });
  }
};

exports.deleteRoom = async (req, res) => {
  try {
    const { roomNumber } = req.params;
    const result = await roomInventoryModel.deleteRoom({ roomNumber });
    res.json({ message: "Room deleted successfully", room: result });
  } catch (error) {
    console.error(error);
    const status = error.message === "Room not found in inventory" ? 404 : 500;
    res.status(status).json({
      message: error.message || "Failed to delete room",
    });
  }
};

exports.validateRoomAvailability = async (req, res) => {
  try {
    const { roomNumbers, checkIn, checkOut, excludeBookingId } = req.body;

    if (!roomNumbers || !Array.isArray(roomNumbers) || !roomNumbers.length) {
      return res.json({ available: true, conflicts: [] });
    }

    const result = await roomInventoryModel.validateRoomAvailability({
      roomNumbers,
      checkIn: checkIn || req.query.checkIn,
      checkOut: checkOut || req.query.checkOut,
      excludeBookingId: excludeBookingId || req.query.excludeBookingId || null,
    });

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to validate room availability" });
  }
};
