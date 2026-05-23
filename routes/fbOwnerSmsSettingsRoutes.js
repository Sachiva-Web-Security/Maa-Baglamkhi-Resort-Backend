const path = require("path");
const router = require("express").Router();
const {
  getSettings,
  saveSettings,
  listTemplates,
  updateTemplate,
  sendTest,
  generateSamplePdf,
  sendTestPdf,
} = require("../models/fbOwnerSmsSettingsModel");

router.get("/", async (_req, res) => {
  try {
    res.json(await getSettings());
  } catch (error) {
    res.status(500).json({ message: "Failed to load settings" });
  }
});

router.put("/", async (req, res) => {
  try {
    res.json(await saveSettings(req.body));
  } catch (error) {
    res.status(400).json({ message: error.message || "Save failed" });
  }
});

router.get("/templates", async (_req, res) => {
  try {
    res.json(await listTemplates());
  } catch (error) {
    res.status(500).json({ message: "Failed to load templates" });
  }
});

router.put("/templates/:id", async (req, res) => {
  try {
    const updated = await updateTemplate(req.params.id, req.body);
    if (!updated) return res.status(404).json({ message: "Template not found" });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message || "Update failed" });
  }
});

router.post("/test-send", async (req, res) => {
  try {
    const result = await sendTest({
      number: req.body?.number,
      message: req.body?.message,
    });
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message || "Send failed" });
  }
});

// Generates a sample bill PDF and streams it back for direct download.
router.get("/test-pdf", async (_req, res) => {
  try {
    const { filePath, fileName } = await generateSamplePdf();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName}"`,
    );
    res.sendFile(path.resolve(filePath));
  } catch (error) {
    res.status(500).json({ message: error.message || "PDF generation failed" });
  }
});

// Generates a sample bill PDF and sends it via WASend to the given number.
// Requires PUBLIC_BASE_URL in .env (e.g. an ngrok URL) so WASend can fetch the PDF.
router.post("/test-send-pdf", async (req, res) => {
  try {
    const publicBaseUrl =
      req.body?.public_base_url ||
      process.env.PUBLIC_BASE_URL ||
      `${req.protocol}://${req.get("host")}`;
    const result = await sendTestPdf({
      number: req.body?.number,
      message: req.body?.message,
      publicBaseUrl,
    });
    res.json({ ...result, publicBaseUrl });
  } catch (error) {
    res.status(400).json({ message: error.message || "Send failed" });
  }
});

module.exports = router;
