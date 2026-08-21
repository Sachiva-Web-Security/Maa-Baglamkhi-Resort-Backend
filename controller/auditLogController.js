const AuditLogModel = require("../models/AuditLogModel");

exports.getAuditLogs = async (req, res) => {
  try {
    const result = await AuditLogModel.listLogs({
      search: String(req.query.search || "").trim(),
      action: String(req.query.action || "").trim(),
      status: String(req.query.status || "").trim(),
      dateFrom: String(req.query.dateFrom || "").trim(),
      dateTo: String(req.query.dateTo || "").trim(),
      page: req.query.page,
      limit: req.query.limit,
    });

    return res.json(result);
  } catch (error) {
    console.error("Failed to fetch audit logs:", error);
    return res.status(500).json({
      message: "Could not load audit logs",
    });
  }
};
