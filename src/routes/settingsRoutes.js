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

// ── WhatsApp health probe ────────────────────────────────────────────────────
// Read-only: verifies the Wasend API key is live without sending a message.
// Exposed without auth so an admin "Test WhatsApp connection" button can call
// it before logging in.
const whatsappService = require("../services/whatsappService");

router.get("/whatsapp/health", async (req, res) => {
  try {
    const health = await whatsappService.checkHealth();
    res.json({
      ok: health.ok,
      status: health.status,
      reason: health.reason,
      keyConfigured: Boolean(process.env.wasachiva_key || process.env.WASACHIVA_KEY),
      url: process.env.wasachiva_url || "https://wasend.sachiva.cloud",
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
