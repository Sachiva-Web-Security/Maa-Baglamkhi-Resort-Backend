const Reports = require("../models/ReportsModel");

exports.summary = async (req, res) => {
  try {
    const data = await Reports.getSummaryCounts();
    res.json(data);
  } catch (err) {
    console.error("Error fetching report summary:", err);
    res.status(500).json({ message: "Error fetching report summary" });
  }
};

exports.getReportData = async (req, res) => {
  const { type, dateFrom, dateTo, status, hall, roomType, paymentMode } = req.query;
  if (!type) return res.status(400).json({ message: "Report type required" });

  try {
    const rows = await Reports.getReportData({ type, dateFrom, dateTo, status, hall, roomType, paymentMode });
    res.json(rows);
  } catch (err) {
    console.error(`Error fetching ${type} report:`, err);
    res.status(500).json({ message: "Failed to fetch report data" });
  }
};
