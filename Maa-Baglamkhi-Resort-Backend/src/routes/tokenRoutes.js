const express = require("express");
const router = express.Router();

const controller = require("../controller/tokenController");

router.post("/create", controller.createToken);
// GET aliases: several callers reach the create/item endpoints with GET.
router.get("/create", controller.createToken);
router.get("/item", controller.addItem);
router.get("/table/:table", controller.getTokenByTable);

router.post("/item", controller.addItem);
router.get("/items/:tokenId", controller.getItems);

router.put("/item", controller.updateItem);
router.delete("/item/:id", controller.deleteItem);
router.put("/close/:table", controller.closeTokenByTable);

module.exports = router;
