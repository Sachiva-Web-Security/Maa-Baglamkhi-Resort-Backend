const Report = require("../models/ReportModel");

// DAYWISE
exports.daywise = (req, res) => {
  const { start, end } = req.query;

  Report.daywiseReport(start, end, (err, data) => {
    if (err) return res.status(500).json(err);

    res.json(data);
  });
};

// ITEM CONSUMPTION
exports.itemConsumption = (req, res) => {
  Report.itemConsumption((err, data) => {
    if (err) return res.status(500).json(err);

    res.json(data);
  });
};