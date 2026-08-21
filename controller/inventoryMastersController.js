const InventoryMastersModel = require("../models/InventoryMastersModel");

const withMastersSchema = async (res, task) => {
  try {
    await InventoryMastersModel.ensureSchema();
    await task();
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || "Failed to prepare inventory masters schema.",
      error,
    });
  }
};

exports.listSections = (req, res) => {
  withMastersSchema(res, async () => {
    const rows = await InventoryMastersModel.listSections();
    res.json(rows);
  });
};

exports.listRecords = (req, res) => {
  withMastersSchema(res, async () => {
    const rows = await InventoryMastersModel.list(req.params.sectionKey);
    res.json(rows);
  });
};

exports.getRecord = (req, res) => {
  withMastersSchema(res, async () => {
    const row = await InventoryMastersModel.getById(req.params.sectionKey, req.params.id);
    if (!row) {
      return res.status(404).json({ message: "Record not found." });
    }
    res.json(row);
  });
};

exports.createRecord = (req, res) => {
  const validation = InventoryMastersModel.validatePayload(req.params.sectionKey, req.body);
  if (validation) {
    return res.status(400).json({ message: validation });
  }

  withMastersSchema(res, async () => {
    const row = await InventoryMastersModel.create(req.params.sectionKey, req.body);
    res.status(201).json({
      message: "Inventory master record created.",
      record: row,
    });
  });
};

exports.updateRecord = (req, res) => {
  const validation = InventoryMastersModel.validatePayload(req.params.sectionKey, req.body);
  if (validation) {
    return res.status(400).json({ message: validation });
  }

  withMastersSchema(res, async () => {
    const row = await InventoryMastersModel.update(req.params.sectionKey, req.params.id, req.body);
    res.json({
      message: "Inventory master record updated.",
      record: row,
    });
  });
};

exports.deleteRecord = (req, res) => {
  withMastersSchema(res, async () => {
    await InventoryMastersModel.remove(req.params.sectionKey, req.params.id);
    res.json({ message: "Inventory master record deleted." });
  });
};
