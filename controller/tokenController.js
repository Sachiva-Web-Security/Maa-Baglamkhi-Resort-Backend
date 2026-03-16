const Token = require("../models/TokenModel");

// CREATE TOKEN
exports.createToken = (req, res) => {
  const { tableNumber, waiter } = req.body;

  if (!tableNumber)
    return res.status(400).json({ message: "Table required" });

  Token.createToken({ tableNumber, waiter }, (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Token creation failed" });
    }

    res.json({
      message: "Token created",
      tokenId: result.insertId,
    });
  });
};

// GET TOKEN
exports.getTokenByTable = (req, res) => {
  const table = req.params.table;

  Token.getTokenByTable(table, (err, data) => {
    if (err) return res.status(500).json(err);

    res.json(data || {});
  });
};

// ADD ITEM
exports.addItem = (req, res) => {
  Token.addTokenItem(req.body, (err) => {
    if (err) return res.status(500).json(err);

    res.json({ message: "Item added" });
  });
};

// GET ITEMS
exports.getItems = (req, res) => {
  const tokenId = req.params.tokenId;

  Token.getTokenItems(tokenId, (err, data) => {
    if (err) return res.status(500).json(err);

    res.json(data);
  });
};

// UPDATE ITEM
exports.updateItem = (req, res) => {
  Token.updateTokenItem(req.body, (err) => {
    if (err) return res.status(500).json(err);

    res.json({ message: "Item updated" });
  });
};

// DELETE ITEM
exports.deleteItem = (req, res) => {
  const id = req.params.id;

  Token.deleteTokenItem(id, (err) => {
    if (err) return res.status(500).json(err);

    res.json({ message: "Item deleted" });
  });
};