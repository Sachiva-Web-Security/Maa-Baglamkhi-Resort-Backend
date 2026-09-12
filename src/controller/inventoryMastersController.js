const db = require("../config/db");
const { ensureSchema: ensureInventoryCategoriesSchema } = require("../models/InventoryCategoriesModel");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const SECTIONS = [
  { key: "units", label: "Units", table: "inventory_units" },
  { key: "vendors", label: "Vendors", table: "inventory_vendors" },
  { key: "locations", label: "Locations", table: "inventory_locations" },
  { key: "categories", label: "Categories", table: "inventory_categories" },
];

const getSection = (sectionKey) => SECTIONS.find((s) => s.key === sectionKey);

exports.ensureSchema = ensureInventoryCategoriesSchema;

exports.listSections = async (req, res) => {
  try {
    await ensureInventoryCategoriesSchema();
    const sections = await Promise.all(
      SECTIONS.map(async (s) => {
        const [count] = await runQuery(`SELECT COUNT(*) AS cnt FROM \`${s.table}\``);
        return { ...s, count: count[0]?.cnt || 0 };
      })
    );
    res.json(sections);
  } catch (err) {
    res.status(500).json({ message: "Failed to list sections", error: err.message });
  }
};

exports.listRecords = async (req, res) => {
  const section = getSection(req.params.sectionKey);
  if (!section) return res.status(404).json({ message: "Section not found" });

  try {
    await ensureInventoryCategoriesSchema();
    const [rows] = await runQuery(`SELECT * FROM \`${section.table}\` ORDER BY \`id\` DESC`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to list records", error: err.message });
  }
};

exports.getRecord = async (req, res) => {
  const section = getSection(req.params.sectionKey);
  if (!section) return res.status(404).json({ message: "Section not found" });

  try {
    await ensureInventoryCategoriesSchema();
    const [rows] = await runQuery(
      `SELECT * FROM \`${section.table}\` WHERE \`id\` = ? LIMIT 1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: "Record not found." });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch record", error: err.message });
  }
};

exports.createRecord = async (req, res) => {
  const section = getSection(req.params.sectionKey);
  if (!section) return res.status(404).json({ message: "Section not found" });

  const body = req.body || {};
  if (!body.name && !body.title) {
    return res.status(400).json({ message: "name or title is required." });
  }

  try {
    await ensureInventoryCategoriesSchema();
    const name = body.name || body.title;
    const [result] = await runQuery(
      `INSERT INTO \`${section.table}\` (\`name\`, \`description\`, \`is_active\`) VALUES (?, ?, ?)`,
      [name, body.description || null, 1]
    );
    const [rows] = await runQuery(`SELECT * FROM \`${section.table}\` WHERE \`id\` = ? LIMIT 1`, [result.insertId]);
    res.status(201).json({ message: "Record created.", record: rows[0] });
  } catch (err) {
    res.status(500).json({ message: "Failed to create record", error: err.message });
  }
};

exports.updateRecord = async (req, res) => {
  const section = getSection(req.params.sectionKey);
  if (!section) return res.status(404).json({ message: "Section not found" });

  const body = req.body || {};

  try {
    await ensureInventoryCategoriesSchema();
    const fields = [];
    const vals = [];
    if (body.name !== undefined || body.title !== undefined) { fields.push("`name` = ?"); vals.push(body.name || body.title); }
    if (body.description !== undefined) { fields.push("`description` = ?"); vals.push(body.description); }
    if (body.is_active !== undefined) { fields.push("`is_active` = ?"); vals.push(body.is_active ? 1 : 0); }
    if (!fields.length) return res.status(400).json({ message: "Nothing to update." });
    vals.push(req.params.id);

    await runQuery(`UPDATE \`${section.table}\` SET ${fields.join(", ")} WHERE \`id\` = ?`, vals);
    const [rows] = await runQuery(`SELECT * FROM \`${section.table}\` WHERE \`id\` = ? LIMIT 1`, [req.params.id]);
    res.json({ message: "Record updated.", record: rows[0] });
  } catch (err) {
    res.status(500).json({ message: "Failed to update record", error: err.message });
  }
};

exports.deleteRecord = async (req, res) => {
  const section = getSection(req.params.sectionKey);
  if (!section) return res.status(404).json({ message: "Section not found" });

  try {
    await ensureInventoryCategoriesSchema();
    await runQuery(`DELETE FROM \`${section.table}\` WHERE \`id\` = ?`, [req.params.id]);
    res.json({ message: "Record deleted." });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete record", error: err.message });
  }
};
