const db = require("../config/db");

exports.getMenu = (callback) => {
  db.query("SELECT * FROM menu", callback);
};