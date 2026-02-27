const db = require("../config/db");

// GET ALL TABLES
exports.getTables = (req, res) => {

  const sql = "SELECT * FROM restaurant_tables";

  db.query(sql, (err, result) => {

    if (err) {
      return res.status(500).json(err);
    }

    res.json(result);

  });

};


// ADD TABLE
exports.addTable = (req, res) => {

  const { id, number, status, guestCount } = req.body;

  const sql =
    "INSERT INTO restaurant_tables (id, number, status, guestCount) VALUES (?, ?, ?, ?)";

  db.query(sql, [id, number, status, guestCount], (err, result) => {

    if (err) {
      return res.status(500).json(err);
    }

    res.json({
      message: "Table added successfully"
    });

  });

};