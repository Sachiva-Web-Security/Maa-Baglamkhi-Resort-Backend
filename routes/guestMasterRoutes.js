const router = require("express").Router();
const multer = require("multer");
const {
  listGuests,
  createGuest,
  updateGuest,
  deleteGuest,
} = require("../models/guestMasterModel");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const csvEscape = (value) => {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[,"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const EXPORT_COLUMNS = [
  ["name", "Name"],
  ["age", "Age"],
  ["gender", "Gender"],
  ["address", "Address"],
  ["mobile", "Mobile Number"],
  ["alternate_mobile", "Alternate Numbers"],
  ["email", "Email Id"],
  ["nationality", "Nationality"],
  ["company", "Company"],
  ["company_gst", "Company GST"],
  ["company_address", "Company Address"],
  ["id_type", "ID Type"],
  ["id_number", "ID Number"],
];

router.get("/", async (req, res) => {
  try {
    const rows = await listGuests({
      mobile: req.query.mobile || "",
      name: req.query.name || "",
    });
    res.json(rows);
  } catch (error) {
    console.error("Guest master GET failed:", error);
    res.status(500).json({ message: "Failed to load guests" });
  }
});

router.get("/export", async (req, res) => {
  try {
    const rows = await listGuests({
      mobile: req.query.mobile || "",
      name: req.query.name || "",
    });
    const header = EXPORT_COLUMNS.map(([, label]) => csvEscape(label)).join(",");
    const lines = rows.map((r) =>
      EXPORT_COLUMNS.map(([key]) => csvEscape(r[key])).join(","),
    );
    const csv = [header, ...lines].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="guests-${Date.now()}.csv"`,
    );
    res.send(csv);
  } catch (error) {
    console.error("Guest master export failed:", error);
    res.status(500).json({ message: "Export failed" });
  }
});

router.post("/import", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    const content = req.file.buffer.toString("utf-8").trim();
    if (!content) return res.status(400).json({ message: "Empty file" });

    const lines = content.split(/\r?\n/);
    if (lines.length < 2) {
      return res.status(400).json({ message: "File must contain a header and at least one row" });
    }

    const splitCsv = (line) => {
      const out = [];
      let cur = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
          if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
          else if (ch === '"') inQuotes = false;
          else cur += ch;
        } else {
          if (ch === ',') { out.push(cur); cur = ""; }
          else if (ch === '"') inQuotes = true;
          else cur += ch;
        }
      }
      out.push(cur);
      return out;
    };

    const headers = splitCsv(lines[0]).map((h) => h.trim().toLowerCase());
    const labelToKey = new Map(EXPORT_COLUMNS.map(([k, l]) => [l.toLowerCase(), k]));

    let added = 0;
    let skipped = 0;
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      const cells = splitCsv(line);
      const row = {};
      headers.forEach((h, idx) => {
        const key = labelToKey.get(h) || h;
        row[key] = cells[idx] ?? "";
      });
      if (!row.name) { skipped++; continue; }
      try {
        await createGuest(row);
        added++;
      } catch {
        skipped++;
      }
    }

    res.json({ added, skipped });
  } catch (error) {
    console.error("Guest master import failed:", error);
    res.status(500).json({ message: "Import failed" });
  }
});

router.post("/", async (req, res) => {
  try {
    const created = await createGuest(req.body);
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ message: error.message || "Failed to create" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const updated = await updateGuest(req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message || "Failed to update" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await deleteGuest(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ message: error.message || "Failed to delete" });
  }
});

module.exports = router;
