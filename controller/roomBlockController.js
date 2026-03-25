/**
 * roomBlockController.js
 * Room Blocking & Maintenance Scheduling — REST handlers.
 *
 * Routes (add to bookingRoutes.js):
 *   GET   /hotel/room-blocks          → getAll
 *   POST  /hotel/room-block           → create
 *   PUT   /hotel/room-block/:id       → updateStatus
 */

const roomBlockModel = require("../models/roomBlockModel");
const roomInventoryModel = require("../models/hotelRoomInventoryModel");

// ─── GET all blocks (optionally ?status=Active) ───────────────────────────────
exports.getAll = async (req, res) => {
  try {
    const { status } = req.query;
    const blocks = await roomBlockModel.getAllBlocks(status || null);
    res.json(blocks);
  } catch (err) {
    console.error("[roomBlock] getAll error:", err);
    res.status(500).json({ error: "Failed to fetch room blocks" });
  }
};

// ─── POST — create a new maintenance block ───────────────────────────────────
exports.create = async (req, res) => {
  const {
    room_number,
    block_type = "Maintenance",
    reason = null,
    blocked_from,
    blocked_until,
    blocked_by = "Manager",
  } = req.body;

  if (!room_number) {
    return res.status(400).json({ error: "room_number is required" });
  }
  if (!blocked_from || !blocked_until) {
    return res.status(400).json({ error: "blocked_from and blocked_until are required" });
  }
  if (blocked_from > blocked_until) {
    return res.status(400).json({ error: "blocked_until cannot be before blocked_from" });
  }

  try {
    // Optionally update the room's operational state to Blocked
    try {
      await roomInventoryModel.updateRoomOperationalState({
        roomNumber: String(room_number),
        guestName: null,
        status: "Blocked",
        checkIn: blocked_from,
        checkOut: blocked_until,
      });
    } catch (inventoryErr) {
      // Non-fatal — room might not be in inventory yet
      console.warn("[roomBlock] inventory state update skipped:", inventoryErr.message);
    }

    const result = await roomBlockModel.createBlock({
      room_number,
      block_type,
      reason,
      blocked_from,
      blocked_until,
      blocked_by,
    });

    res.status(201).json({ message: "Room blocked successfully", ...result });
  } catch (err) {
    console.error("[roomBlock] create error:", err);
    res.status(500).json({ error: err.message || "Failed to create block" });
  }
};

// ─── PUT — update block status (Active → Completed / Cancelled) ──────────────
exports.updateStatus = async (req, res) => {
  const blockId = req.params.id;
  const { status } = req.body;

  if (!blockId || isNaN(Number(blockId))) {
    return res.status(400).json({ error: "Valid block id required" });
  }

  const validStatuses = ["Active", "Completed", "Cancelled"];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      error: `status must be one of: ${validStatuses.join(", ")}`,
    });
  }

  try {
    await roomBlockModel.updateBlockStatus(Number(blockId), status);

    // When completing a block, reset the room to Available
    if (status === "Completed" || status === "Cancelled") {
      const blocks = await roomBlockModel.getAllBlocks();
      const block = blocks.find((b) => Number(b.id) === Number(blockId));

      if (block) {
        // Check if there are still other active blocks for this room
        const otherActiveBlocks = blocks.filter(
          (b) =>
            b.status === "Active" &&
            Number(b.id) !== Number(blockId) &&
            b.room_number === block.room_number,
        );

        if (!otherActiveBlocks.length) {
          try {
            await roomInventoryModel.updateRoomOperationalState({
              roomNumber: String(block.room_number),
              guestName: null,
              status: "Available",
              checkIn: null,
              checkOut: null,
            });
          } catch (inventoryErr) {
            console.warn("[roomBlock] room release skipped:", inventoryErr.message);
          }
        }
      }
    }

    res.json({ message: `Block status updated to ${status}` });
  } catch (err) {
    console.error("[roomBlock] updateStatus error:", err);
    res.status(500).json({ error: err.message || "Failed to update block status" });
  }
};
