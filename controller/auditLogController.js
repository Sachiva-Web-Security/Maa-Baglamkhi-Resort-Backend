const db = require("../config/db");
const AuditLogsModel = require("../models/AuditLogsModel");

exports.ensureSchema = AuditLogsModel.ensureSchema;

exports.getAuditLogs = async (req, res) => {
  try {
    const result = await AuditLogsModel.findAll();
    return res.json(result);
  } catch (error) {
    console.error("Failed to fetch audit logs:", error);
    return res.status(500).json({
      message: "Could not load audit logs",
    });
  }
};
