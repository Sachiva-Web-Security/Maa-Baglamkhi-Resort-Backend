/**
 * SettingsController — admin-only endpoints for runtime configuration.
 *
 * Routes:
 *   GET   /api/settings                    → return current settings (any authed user, but admin only writes)
 *   PUT   /api/settings                    → update settings (admin only)
 */

const Settings = require("../models/settingsModel");

exports.getSettings = async (_req, res) => {
  try {
    const settings = await Settings.getSettings();
    res.json(settings);
  } catch (err) {
    console.error("getSettings error:", err);
    res.status(500).json({ error: err.message || "Failed to load settings" });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const allowed = [
      "adminWhatsappNumber",
      "adminWhatsappUsername",
      "smsEnabled",
      "businessName",
      "businessContact",
    ];
    const patch = {};
    for (const key of allowed) {
      if (key in (req.body || {})) {
        patch[key] = req.body[key];
      }
    }

    if (patch.adminWhatsappNumber) {
      // Validate format — must be a string of digits, length 10–15
      const digits = String(patch.adminWhatsappNumber).replace(/\D+/g, "");
      if (digits.length < 10 || digits.length > 15) {
        return res.status(400).json({
          error:
            "adminWhatsappNumber must be a valid phone number (10–15 digits, with country code)",
        });
      }
      // store as digits-only, with country code preserved
      patch.adminWhatsappNumber = digits;
    }

    const settings = await Settings.updateSettings(patch);
    res.json({ message: "Settings updated", settings });
  } catch (err) {
    console.error("updateSettings error:", err);
    res
      .status(500)
      .json({ error: err.message || "Failed to update settings" });
  }
};