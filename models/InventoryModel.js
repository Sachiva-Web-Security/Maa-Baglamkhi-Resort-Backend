const db = require("../config/db");

const Inventory = {

  create: (data, callback) => {

    const sql = `
    INSERT INTO inventory
    (name, category, stock, unit, price, expiry, branch)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(sql, [
      data.name,
      data.category,
      data.stock,
      data.unit,
      data.price,
      data.expiry,
      data.branch
    ], callback);

  },

  getAll: (callback) => {
    db.query("SELECT * FROM inventory", callback);
  },

  update: (id, data, callback) => {

    const sql = `
    UPDATE inventory
    SET name=?, category=?, stock=?, unit=?, price=?, expiry=?, branch=?
    WHERE id=?
    `;

    db.query(sql, [
      data.name,
      data.category,
      data.stock,
      data.unit,
      data.price,
      data.expiry,
      data.branch,
      id
    ], callback);

  },

  delete: (id, callback) => {
    db.query("DELETE FROM inventory WHERE id=?", [id], callback);
  }

};

module.exports = Inventory;