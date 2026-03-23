const express = require("express");
const router = express.Router();

const controller = require("../controller/tokenController");

router.post("/create", controller.createToken);
router.get("/active", controller.getActiveTokens);
router.get("/transfers", controller.getTransferHistory);
router.post("/transfer", controller.transferToken);
router.get("/table/:table", controller.getTokenByTable);

router.post("/item", controller.addItem);
router.get("/items/:tokenId", controller.getItems);

router.put("/item", controller.updateItem);
router.delete("/item/:id", controller.deleteItem);
router.put("/close/:table", controller.closeTokenByTable);

module.exports = router;
