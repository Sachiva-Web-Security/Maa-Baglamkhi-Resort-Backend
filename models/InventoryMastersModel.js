const db = require("../config/db");

const SECTION_DEFINITIONS = {
  "menu-categories": {
    table: "inventory_menu_categories",
    required: ["name"],
    fields: [
      { key: "name", column: "name" },
      { key: "parent", column: "parent" },
      { key: "status", column: "status" },
    ],
  },
  segments: {
    table: "inventory_segments",
    required: ["name"],
    fields: [
      { key: "name", column: "name" },
      { key: "description", column: "description" },
      { key: "status", column: "status" },
    ],
  },
  vendors: {
    table: "inventory_vendors",
    required: ["name"],
    fields: [
      { key: "name", column: "name" },
      { key: "contact", column: "contact" },
      { key: "phone", column: "phone" },
      { key: "email", column: "email" },
      { key: "city", column: "city" },
      { key: "gstin", column: "gstin" },
      { key: "status", column: "status" },
    ],
  },
  units: {
    table: "inventory_units",
    required: ["name", "shortName"],
    fields: [
      { key: "name", column: "name" },
      { key: "shortName", column: "short_name" },
      { key: "type", column: "type" },
    ],
  },
  "unit-conversions": {
    table: "inventory_unit_conversions",
    required: ["fromUnit", "toUnit", "factor"],
    fields: [
      { key: "fromUnit", column: "from_unit" },
      { key: "toUnit", column: "to_unit" },
      { key: "factor", column: "factor", numeric: true },
      { key: "notes", column: "notes" },
    ],
  },
  locations: {
    table: "inventory_locations",
    required: ["name", "type"],
    fields: [
      { key: "name", column: "name" },
      { key: "type", column: "type" },
      { key: "manager", column: "manager" },
      { key: "status", column: "status" },
    ],
  },
  "item-groups": {
    table: "inventory_item_groups",
    required: ["name"],
    fields: [
      { key: "name", column: "name" },
      { key: "segment", column: "segment" },
      { key: "status", column: "status" },
    ],
  },
  gravies: {
    table: "inventory_gravies",
    required: ["name"],
    fields: [
      { key: "name", column: "name" },
      { key: "base", column: "base" },
      { key: "spiceLevel", column: "spice_level" },
    ],
  },
  ingredients: {
    table: "inventory_ingredients",
    required: ["name"],
    fields: [
      { key: "name", column: "name" },
      { key: "group", column: "group_name" },
      { key: "unit", column: "unit" },
      { key: "status", column: "status" },
    ],
  },
  "purchase-items": {
    table: "inventory_purchase_items",
    required: ["itemName", "vendor", "quantity", "amount", "date"],
    fields: [
      { key: "itemName", column: "item_name" },
      { key: "vendor", column: "vendor" },
      { key: "quantity", column: "quantity", numeric: true },
      { key: "unit", column: "unit" },
      { key: "ratePerUnit", column: "rate_per_unit", numeric: true },
      { key: "amount", column: "amount", numeric: true },
      { key: "invoiceNo", column: "invoice_no" },
      { key: "date", column: "purchase_date", date: true },
    ],
  },
  "purchase-services": {
    table: "inventory_purchase_services",
    required: ["serviceName", "vendor", "amount", "date"],
    fields: [
      { key: "serviceName", column: "service_name" },
      { key: "vendor", column: "vendor" },
      { key: "amount", column: "amount", numeric: true },
      { key: "date", column: "service_date", date: true },
      { key: "status", column: "status" },
    ],
  },
};

const query = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });

const CREATE_STATEMENTS = [
  `
    CREATE TABLE IF NOT EXISTS inventory_menu_categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      parent VARCHAR(255) NULL,
      status VARCHAR(60) NOT NULL DEFAULT 'Active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS inventory_segments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT NULL,
      status VARCHAR(60) NOT NULL DEFAULT 'Active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS inventory_vendors (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      contact VARCHAR(255) NULL,
      phone VARCHAR(60) NULL,
      email VARCHAR(255) NULL,
      city VARCHAR(120) NULL,
      gstin VARCHAR(80) NULL,
      status VARCHAR(60) NOT NULL DEFAULT 'Active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS inventory_units (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      short_name VARCHAR(60) NOT NULL,
      type VARCHAR(80) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS inventory_unit_conversions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      from_unit VARCHAR(60) NOT NULL,
      to_unit VARCHAR(60) NOT NULL,
      factor DECIMAL(12,4) NOT NULL DEFAULT 1,
      notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS inventory_locations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(80) NOT NULL,
      manager VARCHAR(255) NULL,
      status VARCHAR(60) NOT NULL DEFAULT 'Open',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS inventory_item_groups (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      segment VARCHAR(255) NULL,
      status VARCHAR(60) NOT NULL DEFAULT 'Active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS inventory_gravies (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      base VARCHAR(255) NULL,
      spice_level VARCHAR(80) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS inventory_ingredients (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      group_name VARCHAR(255) NULL,
      unit VARCHAR(60) NULL,
      status VARCHAR(60) NOT NULL DEFAULT 'Active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS inventory_purchase_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      item_name VARCHAR(255) NOT NULL,
      vendor VARCHAR(255) NOT NULL,
      quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
      unit VARCHAR(60) NULL,
      rate_per_unit DECIMAL(10,2) NOT NULL DEFAULT 0,
      amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      invoice_no VARCHAR(120) NULL,
      purchase_date DATE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS inventory_purchase_services (
      id INT AUTO_INCREMENT PRIMARY KEY,
      service_name VARCHAR(255) NOT NULL,
      vendor VARCHAR(255) NOT NULL,
      amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      service_date DATE NOT NULL,
      status VARCHAR(60) NOT NULL DEFAULT 'Pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `,
];

const getDefinition = (sectionKey) => SECTION_DEFINITIONS[sectionKey] || null;

const quoteIdentifier = (value) => `\`${String(value).replace(/`/g, "``")}\``;

const normalizePayload = (sectionKey, payload = {}) => {
  const definition = getDefinition(sectionKey);
  if (!definition) return null;

  return definition.fields.reduce((acc, field) => {
    const raw = payload[field.key];
    if (field.numeric) {
      acc[field.column] = Number(raw || 0);
    } else if (field.date) {
      acc[field.column] = raw || null;
    } else {
      acc[field.column] = String(raw ?? "").trim() || null;
    }
    return acc;
  }, {});
};

const validatePayload = (sectionKey, payload = {}) => {
  const definition = getDefinition(sectionKey);
  if (!definition) return "Invalid inventory master section.";

  const missing = definition.required.find(
    (key) => String(payload[key] ?? "").trim() === "",
  );
  if (missing) {
    return `${missing} is required.`;
  }

  return null;
};

const selectColumns = (definition) =>
  definition.fields.map((field) => {
    if (field.date) {
      return `DATE_FORMAT(${quoteIdentifier(field.column)}, '%Y-%m-%d') AS ${quoteIdentifier(field.key)}`;
    }
    return `${quoteIdentifier(field.column)} AS ${quoteIdentifier(field.key)}`;
  });

const InventoryMastersModel = {
  SECTION_DEFINITIONS,
  getDefinition,
  validatePayload,

  async ensureSchema() {
    for (const statement of CREATE_STATEMENTS) {
      await query(statement);
    }
  },

  async listSections() {
    return Object.entries(SECTION_DEFINITIONS).map(([key, value]) => ({
      key,
      table: value.table,
      fields: value.fields.map((field) => field.key),
      required: value.required,
    }));
  },

  async list(sectionKey) {
    const definition = getDefinition(sectionKey);
    if (!definition) {
      const error = new Error("Invalid inventory master section.");
      error.statusCode = 404;
      throw error;
    }

    const columns = [quoteIdentifier("id"), ...selectColumns(definition)];
    return query(
      `SELECT ${columns.join(", ")} FROM ${quoteIdentifier(definition.table)} ORDER BY ${quoteIdentifier("id")} DESC`,
    );
  },

  async getById(sectionKey, id) {
    const definition = getDefinition(sectionKey);
    if (!definition) {
      const error = new Error("Invalid inventory master section.");
      error.statusCode = 404;
      throw error;
    }

    const columns = [quoteIdentifier("id"), ...selectColumns(definition)];
    const rows = await query(
      `SELECT ${columns.join(", ")} FROM ${quoteIdentifier(definition.table)} WHERE ${quoteIdentifier("id")} = ? LIMIT 1`,
      [id],
    );
    return rows[0] || null;
  },

  async create(sectionKey, payload) {
    const definition = getDefinition(sectionKey);
    const normalized = normalizePayload(sectionKey, payload);
    if (!definition || !normalized) {
      const error = new Error("Invalid inventory master section.");
      error.statusCode = 404;
      throw error;
    }

    const columns = Object.keys(normalized);
    const values = columns.map((column) => normalized[column]);
    const placeholders = columns.map(() => "?");

    const result = await query(
      `INSERT INTO ${quoteIdentifier(definition.table)} (${columns.map(quoteIdentifier).join(", ")}) VALUES (${placeholders.join(", ")})`,
      values,
    );

    return this.getById(sectionKey, result.insertId);
  },

  async update(sectionKey, id, payload) {
    const definition = getDefinition(sectionKey);
    const normalized = normalizePayload(sectionKey, payload);
    if (!definition || !normalized) {
      const error = new Error("Invalid inventory master section.");
      error.statusCode = 404;
      throw error;
    }

    const columns = Object.keys(normalized);
    const assignments = columns.map((column) => `${quoteIdentifier(column)} = ?`);
    const values = columns.map((column) => normalized[column]);

    await query(
      `UPDATE ${quoteIdentifier(definition.table)} SET ${assignments.join(", ")} WHERE ${quoteIdentifier("id")} = ?`,
      [...values, id],
    );

    return this.getById(sectionKey, id);
  },

  async remove(sectionKey, id) {
    const definition = getDefinition(sectionKey);
    if (!definition) {
      const error = new Error("Invalid inventory master section.");
      error.statusCode = 404;
      throw error;
    }

    await query(`DELETE FROM ${quoteIdentifier(definition.table)} WHERE ${quoteIdentifier("id")} = ?`, [id]);
  },
};

module.exports = InventoryMastersModel;
