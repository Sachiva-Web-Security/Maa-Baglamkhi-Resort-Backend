const Restaurant = require("../models/RestaurantModel");

// TABLE
exports.addTable = (req, res) => {
    const number = String(req.body?.number || "").trim();
    if (!number) {
        return res.status(400).json({ message: "Table number is required" });
    }

    Restaurant.addTable({ number }, (err, result) => {
        if (err) {
            if (err.code === "ER_DUP_ENTRY") {
                return res.status(400).json({ message: `Table ${number} already exists` });
            }
            console.error("Error adding table:", err);
            return res.status(500).json({ message: "Failed to add table" });
        }

        res.json({ message: "Table added", id: result.insertId });
    });
};

exports.getTables = (req, res) => {
    Restaurant.getTables((err, data) => {
        if (err) {
            console.error("Error fetching restaurant tables:", err);
            return res.json([]);
        }
        res.json(data);
    });
};

// MENU
exports.addMenuItem = (req, res) => {
    const name = String(req.body?.name || "").trim();
    const category = String(req.body?.category || "").trim() || "Others";
    const tableNumber = String(req.body?.tableNumber || "").trim() || null;
    const price = Number(req.body?.price);

    if (!name) {
        return res.status(400).json({ message: "Dish name is required" });
    }
    if (!Number.isFinite(price) || price < 0) {
        return res.status(400).json({ message: "Valid dish price is required" });
    }

    Restaurant.addMenuItem({ name, price, category, tableNumber }, (err, result) => {
        if (err) {
            console.error("Error adding menu item:", err);
            return res.status(500).json({
                message: "Failed to save dish",
                detail: err.sqlMessage || err.message || null
            });
        }
        res.json({ message: "Menu item added", id: result.insertId });
    });
};

exports.getMenuItems = (req, res) => {
    const tableNumber = String(req.query?.tableNumber || "").trim() || null;
    Restaurant.getMenuItems({ tableNumber }, (err, data) => {
        if (err) {
            console.error("Error fetching menu items:", err);
            return res.json([]);
        }
        res.json(data);
    });
};

// ORDER ADD
exports.addOrderItem = (req, res) => {
    const { tableNumber, item } = req.body;

    Restaurant.getPendingOrder(tableNumber, (err, order) => {
        if (err) return res.status(500).json(err);

        if (!order) {
            Restaurant.createOrder(tableNumber, (err2, result) => {
                if (err2) return res.status(500).json(err2);

                const orderId = result.insertId;

                Restaurant.addItemToOrder(orderId, item, (err3) => {
                    if (err3) return res.status(500).json(err3);

                    res.json({
                        message: "New order created",
                        orderId: orderId,
                    });
                });
            });
        } else {
            Restaurant.addItemToOrder(order.id, item, (err4) => {
                if (err4) return res.status(500).json(err4);

                res.json({
                    message: "Item added to existing order",
                    orderId: order.id,
                });
            });
        }
    });
};

// GET ORDER
exports.getOrder = (req, res) => {
    const tableNumber = req.params.tableNumber;

    Restaurant.getPendingOrder(tableNumber, (err, order) => {
        if (err) return res.status(500).json(err);

        res.json(order);
    });
};

// BILL
exports.createBill = (req, res) => {
    Restaurant.createBill(req.body, (err, result) => {
        if (err) return res.status(500).json(err);

        res.json({
            message: "Bill created",
            id: result.insertId,
        });
    });
};
