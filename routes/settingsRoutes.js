/**
 * settingsRoutes.js
 *
 * Admin-only settings endpoints. Any authenticated user can READ,
 * but only admin role can WRITE.
 */

const express = require("express");
const router = express.Router();
const settingsController = require("../controller/settingsController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// Anyone with a valid token can read settings
router.get("/", authMiddleware, settingsController.getSettings);

// Only admin can update settings
router.put("/", authMiddleware, roleMiddleware(["admin"]), settingsController.updateSettings);

module.exports = router;