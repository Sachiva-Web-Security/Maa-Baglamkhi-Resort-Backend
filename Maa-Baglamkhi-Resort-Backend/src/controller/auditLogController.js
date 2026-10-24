const db = require("../config/db");
const AuditLogsModel = require("../models/AuditLogsModel");

exports.ensureSchema = AuditLogsModel.ensureSchema;

exports.getAuditLogs = async (req, res) => {
  try {
    // HAG-38: the unbounded list never returned under a 6s budget once
    // audit_logs grew past a few thousand rows. Newest-first, capped,
    // with an optional ?limit= for callers that want less.
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500);
    const result = await AuditLogsModel.findAll(limit);
    return res.json(result);
  } catch (error) {
    console.error("Failed to fetch audit logs:", error);
    return res.status(500).json({
      message: "Could not load audit logs",
    });
  }
};
