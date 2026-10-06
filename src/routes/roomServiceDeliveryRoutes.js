const express = require("express");
const router = express.Router();
const db = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

// Assign waiter to room service order
router.post("/assign-waiter", async (req, res) => {
  try {
    const { roomNumber, waiterName, orderId } = req.body || {};
    if (!roomNumber || !waiterName) {
      return res.status(400).json({ message: "roomNumber and waiterName required" });
    }
    const [result] = await db.query(
      `UPDATE room_service_orders SET waiter_name = ?, status = 'assigned' WHERE room_number = ? AND status = 'pending' LIMIT 1`,
      [waiterName, roomNumber]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ message: "No pending order found for this room" });
    }
    res.json({ message: "Waiter assigned", roomNumber, waiterName });
  } catch (err) {
    res.status(500).json({ message: "Failed to assign waiter", error: err.message });
  }
});

// Get waiter's delivery queue
router.get("/waiter-queue", async (req, res) => {
  try {
    const { waiterName } = req.query;
    if (!waiterName) {
      return res.status(400).json({ message: "waiterName query param required" });
    }
    const [rows] = await db.query(
      `SELECT * FROM room_service_orders WHERE waiter_name = ? AND status = 'assigned' ORDER BY created_at ASC`,
      [waiterName]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch queue", error: err.message });
  }
});

// Mark order as delivered
router.post("/mark-delivered/:assignmentId", async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const [result] = await db.query(
      `UPDATE room_service_orders SET status = 'delivered', delivered_at = NOW() WHERE id = ? LIMIT 1`,
      [assignmentId]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ message: "Assignment not found" });
    }
    res.json({ message: "Order marked as delivered" });
  } catch (err) {
    res.status(500).json({ message: "Failed to mark delivered", error: err.message });
  }
});

// Cancel room service delivery
router.post("/cancel", async (req, res) => {
  try {
    const { roomNumber, reason } = req.body || {};
    if (!roomNumber) {
      return res.status(400).json({ message: "roomNumber required" });
    }
    const [result] = await db.query(
      `UPDATE room_service_orders SET status = 'cancelled' WHERE room_number = ? AND status IN ('pending', 'assigned') LIMIT 1`,
      [roomNumber]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ message: "No pending/assigned order found" });
    }
    res.json({ message: "Room service order cancelled", roomNumber });
  } catch (err) {
    res.status(500).json({ message: "Failed to cancel order", error: err.message });
  }
});

// Get ready room orders
router.get("/ready-room-orders", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM room_service_orders WHERE status = 'ready' ORDER BY created_at ASC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch ready orders", error: err.message });
  }
});

// Get cancellation log for a kitchen order
router.get("/cancellation-log/:kitchenOrderId", async (req, res) => {
  try {
    const { kitchenOrderId } = req.params;
    const [rows] = await db.query(
      `SELECT * FROM room_service_orders WHERE token_id = ? AND status = 'cancelled' ORDER BY created_at DESC`,
      [kitchenOrderId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch cancellation log", error: err.message });
  }
});

module.exports = router;
