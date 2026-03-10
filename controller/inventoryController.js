const Inventory = require("../models/InventoryModel");

exports.createItem = (req, res) => {

    console.log("➡️ createItem controller called");
    console.log("Request Body:", req.body);

    Inventory.create(req.body, (err, result) => {

        if (err) {
            console.log("❌ DB ERROR while creating item:", err);
            return res.status(500).json(err);
        }

        console.log("✅ Item inserted ID:", result.insertId);

        res.json({
            message: "Item added successfully",
            id: result.insertId
        });
    });
};

// GET ALL ITEMS
exports.getItems = (req, res) => {
    Inventory.getAll((err, results) => {
        if (err) {
            return res.status(500).json(err);
        }

        res.json(results);
    });
};

// UPDATE ITEM
exports.updateItem = (req, res) => {
    const id = req.params.id;

    Inventory.update(id, req.body, (err) => {
        if (err) {
            return res.status(500).json(err);
        }

        res.json({
            message: "Item updated successfully"
        });
    });
};

// DELETE ITEM
exports.deleteItem = (req, res) => {
    const id = req.params.id;

    Inventory.delete(id, (err) => {
        if (err) {
            return res.status(500).json(err);
        }

        res.json({
            message: "Item deleted successfully"
        });
    });
};