const roomInventoryModel = require("../models/hotelRoomInventoryModel");

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
    const room = await roomInventoryModel.addRoom(req.body);
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
    await roomInventoryModel.updateCategoryPrice({
      categoryId: req.params.id,
      defaultPrice: req.body.defaultPrice,
    });

    res.json({ message: "Price updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update category price" });
  }
};

exports.updateRoomOperationalState = async (req, res) => {
  try {
    await roomInventoryModel.updateRoomOperationalState({
      roomNumber: req.params.roomNumber,
      guestName: req.body.guestName ?? null,
      status: req.body.status,
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
