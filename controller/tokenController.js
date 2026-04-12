const Token = require("../models/TokenModel");
const { getRequestActor, isWaiterActor, namesMatch } = require("../utils/requestActor");

const denyIfNotOwnedByWaiter = (record, actor, responseMessage, res) => {
  if (!isWaiterActor(actor)) return false;
  if (!record?.waiter) return false;
  if (namesMatch(record.waiter, actor.name)) return false;
  res.status(403).json({ message: responseMessage });
  return true;
};

// CREATE TOKEN
exports.createToken = (req, res) => {
  const actor = getRequestActor(req);
  const { tableNumber, waiter } = req.body;
  const resolvedWaiter = isWaiterActor(actor) ? actor.name || waiter : waiter;

  if (!tableNumber)
    return res.status(400).json({ message: "Table required" });

  Token.getTokenByTable(tableNumber, (lookupErr, activeToken) => {
    if (lookupErr) {
      console.error(lookupErr);
      return res.status(500).json({ message: "Token creation failed" });
    }

    if (denyIfNotOwnedByWaiter(activeToken, actor, "This table is assigned to another waiter", res)) {
      return;
    }

    Token.createToken({ tableNumber, waiter: resolvedWaiter }, (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Token creation failed" });
      }

      res.json({
        message: result?.existing ? "Token already active" : "Token created",
        tokenId: result.insertId,
        tokenCode: result?.token?.token_code || result?.token_code || null,
        existing: Boolean(result?.existing),
      });
    });
  });
};

// GET TOKEN
exports.getTokenByTable = (req, res) => {
  const actor = getRequestActor(req);
  const table = req.params.table;

  Token.getTokenByTable(table, (err, data) => {
    if (err) return res.status(500).json(err);
    if (denyIfNotOwnedByWaiter(data, actor, "This token belongs to another waiter", res)) return;

    res.json(data || {});
  });
};

// ADD ITEM
exports.addItem = (req, res) => {
  const actor = getRequestActor(req);
  const tokenId = req.body?.tokenId;

  Token.getTokenById(tokenId, (lookupErr, token) => {
    if (lookupErr) return res.status(500).json(lookupErr);
    if (!token) return res.status(404).json({ message: "Token not found" });
    if (denyIfNotOwnedByWaiter(token, actor, "You can add items only to your own token", res)) return;

    Token.addTokenItem(req.body, (err) => {
      if (err) return res.status(500).json(err);

      res.json({ message: "Item added" });
    });
  });
};

// GET ITEMS
exports.getItems = (req, res) => {
  const actor = getRequestActor(req);
  const tokenId = req.params.tokenId;

  Token.getTokenById(tokenId, (lookupErr, token) => {
    if (lookupErr) return res.status(500).json(lookupErr);
    if (!token) return res.json([]);
    if (denyIfNotOwnedByWaiter(token, actor, "You can view items only for your own token", res)) return;

    Token.getTokenItems(tokenId, (err, data) => {
      if (err) return res.status(500).json(err);

      res.json(data);
    });
  });
};

// UPDATE ITEM
exports.updateItem = (req, res) => {
  const actor = getRequestActor(req);

  Token.getTokenItemWithToken(req.body?.id, (lookupErr, row) => {
    if (lookupErr) return res.status(500).json(lookupErr);
    if (!row) return res.status(404).json({ message: "Token item not found" });
    if (denyIfNotOwnedByWaiter(row, actor, "You can update only your own token items", res)) return;

    Token.updateTokenItem(req.body, (err) => {
      if (err) return res.status(500).json(err);

      res.json({ message: "Item updated" });
    });
  });
};

// DELETE ITEM
exports.deleteItem = (req, res) => {
  const actor = getRequestActor(req);
  const id = req.params.id;

  Token.getTokenItemWithToken(id, (lookupErr, row) => {
    if (lookupErr) return res.status(500).json(lookupErr);
    if (!row) return res.status(404).json({ message: "Token item not found" });
    if (denyIfNotOwnedByWaiter(row, actor, "You can delete only your own token items", res)) return;

    Token.deleteTokenItem(id, (err) => {
      if (err) return res.status(500).json(err);

      res.json({ message: "Item deleted" });
    });
  });
};

// CLOSE TOKEN FOR A TABLE
exports.closeTokenByTable = (req, res) => {
  const actor = getRequestActor(req);
  const table = req.params.table;

  Token.getTokenByTable(table, (lookupErr, token) => {
    if (lookupErr) return res.status(500).json(lookupErr);
    if (denyIfNotOwnedByWaiter(token, actor, "You can close only your own token", res)) return;

    Token.closeActiveToken(table, (err) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Token closed" });
    });
  });
};
