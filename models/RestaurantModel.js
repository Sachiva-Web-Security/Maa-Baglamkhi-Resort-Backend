const db = require("../config/db");

const ensureRestaurantSchema = () => {
    const ddl = [
        `CREATE TABLE IF NOT EXISTS \`tables\` (
            id INT AUTO_INCREMENT PRIMARY KEY,
            number VARCHAR(50) NOT NULL UNIQUE
        )`,
        `CREATE TABLE IF NOT EXISTS \`menu_items\` (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            price DECIMAL(10,2) NOT NULL,
            category VARCHAR(100) NOT NULL,
            table_number VARCHAR(50) NULL
        )`,
        `CREATE TABLE IF NOT EXISTS \`orders\` (
            id INT AUTO_INCREMENT PRIMARY KEY,
            tableNumber VARCHAR(50) NOT NULL,
            status ENUM('pending', 'paid') DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS \`order_items\` (
            id INT AUTO_INCREMENT PRIMARY KEY,
            order_id INT NOT NULL,
            name VARCHAR(255) NOT NULL,
            price DECIMAL(10,2) NOT NULL,
            quantity INT DEFAULT 1,
            FOREIGN KEY (order_id) REFERENCES \`orders\`(id) ON DELETE CASCADE
        )`,
        `CREATE TABLE IF NOT EXISTS \`bills\` (
            id INT AUTO_INCREMENT PRIMARY KEY,
            tableNumber VARCHAR(50) NOT NULL,
            subtotal DECIMAL(10,2) NOT NULL,
            gst DECIMAL(10,2) NOT NULL,
            total DECIMAL(10,2) NOT NULL,
            paymentMethod VARCHAR(50) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS \`table_menu_map\` (
            menu_item_id INT NOT NULL,
            table_number VARCHAR(50) NOT NULL,
            PRIMARY KEY (menu_item_id, table_number)
        )`,
    ];

    ddl.forEach((sql) => {
        db.query(sql, (err) => {
            if (err) console.error("Restaurant schema init error:", err.message);
        });
    });

    // Backward-compatible migration
    db.query("ALTER TABLE `menu_items` ADD COLUMN table_number VARCHAR(50) NULL", (err) => {
        if (err && err.code !== "ER_DUP_FIELDNAME" && err.code !== "ER_NO_SUCH_TABLE") {
            console.error("Restaurant schema migrate error:", err.message);
        }
    });
};

ensureRestaurantSchema();

const tableExists = (tableName, callback) => {
    db.query("SHOW TABLES LIKE ?", [tableName], (err, rows) => {
        if (err) return callback(err);
        callback(null, Array.isArray(rows) && rows.length > 0);
    });
};

const getTableColumns = (tableName, callback) => {
    db.query(`SHOW COLUMNS FROM \`${tableName}\``, (err, rows) => {
        if (err) return callback(err);
        callback(null, (rows || []).map((r) => r.Field));
    });
};

const ensureColumnIfMissing = (tableName, columnName, definitionSql, callback) => {
    getTableColumns(tableName, (err, cols) => {
        if (err) return callback(err);
        if (cols.includes(columnName)) return callback(null, true);
        db.query(`ALTER TABLE \`${tableName}\` ADD COLUMN ${definitionSql}`, (alterErr) => {
            if (alterErr && alterErr.code !== "ER_DUP_FIELDNAME") return callback(alterErr);
            callback(null, true);
        });
    });
};

const ensureTableMenuMap = (callback) => {
    const sql = `CREATE TABLE IF NOT EXISTS \`table_menu_map\` (
        menu_item_id INT NOT NULL,
        table_number VARCHAR(50) NOT NULL,
        PRIMARY KEY (menu_item_id, table_number)
    )`;
    db.query(sql, callback);
};

exports.addTable = (data, callback) => {
    const ensureSql = `CREATE TABLE IF NOT EXISTS \`tables\` (
        id INT AUTO_INCREMENT PRIMARY KEY,
        number VARCHAR(50) NOT NULL UNIQUE
    )`;
    db.query(ensureSql, (ensureErr) => {
        if (ensureErr) return callback(ensureErr);
        const sql = "INSERT INTO `tables` (number) VALUES (?)";
        db.query(sql, [data.number], callback);
    });
};

exports.getTables = (callback) => {
    db.query("SELECT * FROM `tables` ORDER BY id DESC", (err, rows) => {
        if (!err) return callback(null, rows);
        if (err.code === "ER_NO_SUCH_TABLE") return callback(null, []);
        callback(err);
    });
};

exports.addMenuItem = (data, callback) => {
    const insertIntoMenuItems = () => {
        ensureColumnIfMissing("menu_items", "table_number", "`table_number` VARCHAR(50) NULL", (migErr) => {
            if (migErr && migErr.code !== "ER_NO_SUCH_TABLE") return callback(migErr);

            getTableColumns("menu_items", (colErr, cols) => {
                if (colErr) {
                    if (colErr.code === "ER_NO_SUCH_TABLE") return afterNoSuchTable();
                    return callback(colErr);
                }

                const hasTableNumber = cols.includes("table_number");
                if (hasTableNumber) {
                    const sql = "INSERT INTO `menu_items` (name, price, category, table_number) VALUES (?,?,?,?)";
                    const params = [data.name, data.price, data.category, data.tableNumber || null];
                    return db.query(sql, params, (err, result) => {
                        if (!err) return callback(null, result);
                        if (err.code !== "ER_NO_SUCH_TABLE") return callback(err);
                        return afterNoSuchTable();
                    });
                }

                // Fallback: if column can't be added, store menu in menu_items and table mapping in table_menu_map.
                const sql = "INSERT INTO `menu_items` (name, price, category) VALUES (?,?,?)";
                db.query(sql, [data.name, data.price, data.category], (err, result) => {
                    if (err) return callback(err);
                    const tableNo = data.tableNumber ? String(data.tableNumber) : null;
                    if (!tableNo) return callback(null, result);

                    ensureTableMenuMap((mapEnsureErr) => {
                        if (mapEnsureErr) return callback(mapEnsureErr);
                        db.query(
                            "INSERT IGNORE INTO `table_menu_map` (menu_item_id, table_number) VALUES (?, ?)",
                            [result.insertId, tableNo],
                            (mapErr) => (mapErr ? callback(mapErr) : callback(null, result))
                        );
                    });
                });
            });
        });
    };

    const afterNoSuchTable = () => {
        const ensureSql = `CREATE TABLE IF NOT EXISTS \`menu_items\` (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            price DECIMAL(10,2) NOT NULL,
            category VARCHAR(100) NOT NULL,
            table_number VARCHAR(50) NULL
        )`;
        db.query(ensureSql, (ensureErr) => {
            if (ensureErr) {
                // If creation is blocked (permissions), fallback to legacy `menu` table.
                return insertIntoLegacyMenu();
            }

            const sql = "INSERT INTO `menu_items` (name, price, category, table_number) VALUES (?,?,?,?)";
            db.query(sql, [data.name, data.price, data.category, data.tableNumber || null], callback);
        });
    };

    const insertIntoLegacyMenu = () => {
        tableExists("menu", (existsErr, exists) => {
            if (existsErr) return callback(existsErr);
            if (!exists) return callback(new Error("No menu table found"));
            ensureColumnIfMissing("menu", "table_number", "`table_number` VARCHAR(50) NULL", () => {
            getTableColumns("menu", (colsErr, cols) => {
                if (colsErr) return callback(colsErr);

                const hasCategory = cols.includes("category");
                const hasPrice = cols.includes("price");
                const hasName = cols.includes("name");
                const hasTableNumber = cols.includes("table_number");

                if (!hasName || !hasPrice) {
                    return callback(new Error("Legacy menu schema missing required columns"));
                }

                if (hasCategory && hasTableNumber) {
                    const legacySql = "INSERT INTO `menu` (name, price, category, table_number) VALUES (?,?,?,?)";
                    return db.query(legacySql, [data.name, data.price, data.category, data.tableNumber || null], callback);
                }
                // Legacy fallback: keep save working even on old schema.
                if (hasCategory) {
                    const legacySql = "INSERT INTO `menu` (name, price, category) VALUES (?,?,?)";
                    return db.query(legacySql, [data.name, data.price, data.category], callback);
                }
                const legacySqlNoCategory = "INSERT INTO `menu` (name, price) VALUES (?,?)";
                return db.query(legacySqlNoCategory, [data.name, data.price], callback);
            });
            });
        });
    };

    insertIntoMenuItems();
};

exports.getMenuItems = (filters, callback) => {
    if (typeof filters === "function") {
        callback = filters;
        filters = {};
    }
    const tableNumber = filters?.tableNumber ? String(filters.tableNumber) : null;

    getTableColumns("menu_items", (colErr, cols) => {
        if (!colErr) {
            const hasTableNumber = cols.includes("table_number");
            const sql = hasTableNumber && tableNumber
                ? "SELECT * FROM `menu_items` WHERE table_number = ? ORDER BY id DESC"
                : "SELECT * FROM `menu_items` ORDER BY id DESC";
            const params = hasTableNumber && tableNumber ? [tableNumber] : [];

            return db.query(sql, params, (err, rows) => {
                if (!err) return callback(null, rows);
                if (err.code !== "ER_NO_SUCH_TABLE" && err.code !== "ER_BAD_FIELD_ERROR") return callback(err);
                return queryLegacyMenu(tableNumber, callback);
            });
        }

        if (colErr.code !== "ER_NO_SUCH_TABLE") return callback(colErr);
        return queryLegacyMenu(tableNumber, callback);
    });
};

const queryLegacyMenu = (tableNumber, callback) => {
    // Mapping fallback for schema without table_number column in menu_items.
    tableExists("table_menu_map", (mapExistsErr, mapExists) => {
        if (!mapExistsErr && mapExists && tableNumber) {
            const mapSql = `
              SELECT m.*, tmm.table_number AS table_number
              FROM \`menu_items\` m
              INNER JOIN \`table_menu_map\` tmm ON tmm.menu_item_id = m.id
              WHERE tmm.table_number = ?
              ORDER BY m.id DESC
            `;
            return db.query(mapSql, [tableNumber], (mapErr, mappedRows) => {
                if (!mapErr) return callback(null, mappedRows);
                // If mapped query fails, continue with legacy fallback below.
                return queryLegacyMenuTable(tableNumber, callback);
            });
        }
        return queryLegacyMenuTable(tableNumber, callback);
    });
};

const queryLegacyMenuTable = (tableNumber, callback) => {
    getTableColumns("menu", (legacyColErr, legacyCols) => {
        if (legacyColErr) return callback(legacyColErr);

        const hasTableNumber = legacyCols.includes("table_number");
        const sql = hasTableNumber && tableNumber
            ? "SELECT * FROM `menu` WHERE table_number = ? ORDER BY id DESC"
            : hasTableNumber
                ? "SELECT * FROM `menu` ORDER BY id DESC"
                : "SELECT * FROM `menu` ORDER BY id DESC";
        const params = hasTableNumber && tableNumber ? [tableNumber] : [];

        db.query(sql, params, (legacyErr, legacyRows) => {
            if (legacyErr) return callback(legacyErr);
            const normalized = (legacyRows || []).map((r) => ({
                ...r,
                category: r.category || "Others",
            }));
            callback(null, normalized);
        });
    });
};

exports.createOrder = (tableNumber, callback) => {
    db.query("INSERT INTO `orders` (tableNumber) VALUES (?)", [tableNumber], callback);
};

exports.getPendingOrder = (tableNumber, callback) => {
    const sql = "SELECT * FROM `orders` WHERE tableNumber=? AND status='pending'";
    db.query(sql, [tableNumber], (err, results) => {
        callback(err, results[0]);
    });
};

exports.addItemToOrder = (orderId, item, callback) => {
    const sql =
        "INSERT INTO `order_items` (order_id, name, price, quantity) VALUES (?,?,?,?)";

    db.query(sql, [orderId, item.name, item.price, item.quantity || 1], callback);
};

exports.createBill = (data, callback) => {
    const sql = `
    INSERT INTO \`bills\` (tableNumber, subtotal, gst, total, paymentMethod)
    VALUES (?,?,?,?,?)
  `;

    db.query(
        sql,
        [data.table, data.subtotal, data.gst, data.total, data.paymentMethod],
        callback
    );
};

exports.markOrderPaid = (orderId, callback) => {
    db.query("UPDATE `orders` SET status='paid' WHERE id=?", [orderId], callback);
};
