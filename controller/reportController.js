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

// DAYWISE FOOD (Invoices)
exports.daywiseFood = (req, res) => {
  const { startDate, endDate } = req.query;

  const start = startDate ? `${startDate} 00:00:00` : "1970-01-01 00:00:00";
  const end = endDate ? `${endDate} 23:59:59` : "2999-12-31 23:59:59";

  Report.daywiseFood(start, end, (err, data) => {
    if (err) return res.status(500).json(err);
    res.json(data || []);
  });
};

// DAILY ROOMWISE FOOD
exports.dailyRoomFood = (req, res) => {
  const { date } = req.query;
  const target = date || new Date().toISOString().slice(0, 10);

  Report.dailyRoomFood(target, (err, data) => {
    if (err) {
      console.error("dailyRoomFood report error:", err);
      return res.json([]);
    }
    res.json(data || []);
  });
};
