const express = require("express");
const router = require("express").Router();
console.log("✅ inventoryRoutes loaded");
const {
  createItem,
  getItems,
  updateItem,
  deleteItem
} = require("../controller/inventoryController");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");


// ADD ITEM
router.post(
  "/",
  authMiddleware,
  roleMiddleware(["admin"]),
 (req, res, next) => {
  console.log("📦 POST /api/inventory hit");
  next();
},
  createItem
);


// GET ALL ITEMS
router.get(
  "/",
  authMiddleware,
  getItems
);


// UPDATE ITEM
router.put(
  "/:id",
  authMiddleware,
  roleMiddleware(["admin"]),
  updateItem
);


// DELETE ITEM
router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware(["admin"]),
  deleteItem
);

module.exports = router;