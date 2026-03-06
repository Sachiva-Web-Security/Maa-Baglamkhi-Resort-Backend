const Restaurant = require("../models/RestaurantModel");

// TABLE
exports.addTable = (req, res) => {
    Restaurant.addTable(req.body, (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ message: "Table added", id: result.insertId });
    });
};

exports.getTables = (req, res) => {
    Restaurant.getTables((err, data) => {
        if (err) return res.status(500).json(err);
        res.json(data);
    });
};

// MENU
exports.addMenuItem = (req, res) => {
    Restaurant.addMenuItem(req.body, (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ message: "Menu item added", id: result.insertId });
    });
};

exports.getMenuItems = (req, res) => {
    Restaurant.getMenuItems((err, data) => {
        if (err) return res.status(500).json(err);
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