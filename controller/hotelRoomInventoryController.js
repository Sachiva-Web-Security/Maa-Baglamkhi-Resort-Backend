const roomInventoryModel = require("../models/hotelRoomInventoryModel");

exports.bootstrap = async (_req, _res, next) => {
  try {
    await roomInventoryModel.ensureSchema();
    next();
  } catch (error) {
    next(error);
  }
};

exports.getRoomSetup = async (_req, res) => {
  try {
    const setup = await roomInventoryModel.getRoomSetup();
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
    console.error(error);
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
