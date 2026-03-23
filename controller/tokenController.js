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

// CLOSE TOKEN FOR A TABLE
exports.closeTokenByTable = (req, res) => {
  const table = req.params.table;

  Token.closeActiveToken(table, (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Token closed" });
  });
};

exports.getActiveTokens = async (req, res) => {
  try {
    const data = await Token.getActiveTokens();
    res.json(data || []);
  } catch (error) {
    console.error("getActiveTokens error:", error);
    res.status(500).json({ message: "Active tokens fetch failed" });
  }
};

exports.getTransferHistory = async (req, res) => {
  try {
    const data = await Token.getTransferHistory(req.query || {});
    res.json(data || []);
  } catch (error) {
    console.error("getTransferHistory error:", error);
    res.status(500).json({ message: "Transfer history fetch failed" });
  }
};

exports.transferToken = async (req, res) => {
  try {
    const { tokenId, sourceType, sourceRef, targetType, targetRef, transferredBy, notes } = req.body;

    if (!tokenId || !sourceRef || !targetRef || !sourceType || !targetType) {
      return res.status(400).json({ message: "Token, source and target are required" });
    }

    if (String(sourceRef) === String(targetRef)) {
      return res.status(400).json({ message: "Source and target cannot be same" });
    }

    const result = await Token.transferToken({
      tokenId,
      sourceType,
      sourceRef,
      targetType,
      targetRef,
      transferredBy,
      notes,
    });

    res.json({
      message: "Token transferred successfully",
      data: result,
    });
  } catch (error) {
    console.error("transferToken error:", error);
    res.status(500).json({ message: error.message || "Token transfer failed" });
  }
};
