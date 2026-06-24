const express = require("express");
const router = express.Router();
const controller = require("../controller/wasendController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// WASend talks to a third-party service and spends paid credits, so the
// entire surface is locked behind admin-only auth.
router.use(authMiddleware, roleMiddleware(["admin"]));

router.post("/send-message", controller.sendMessage);
router.get("/balance", controller.getBalance);
router.get("/reports", controller.getReports);
router.get("/contacts", controller.listContacts);
router.post("/contacts", controller.createContact);
router.post("/contacts/import", controller.importContacts);
router.get("/campaigns", controller.listCampaigns);
router.post("/campaigns", controller.createCampaign);

module.exports = router;
