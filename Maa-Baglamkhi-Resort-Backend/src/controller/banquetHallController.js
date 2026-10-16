/**
 * CRUD for banquet halls.
 *
 * Schema (banquet_halls): capacity_min / capacity_max hold the range, the rate
 * columns are rate_per_hour / rate_per_day, images live in image_url, and
 * status is an enum of available | booked | maintenance.
 */

const db = require("../config/db");
const { getHallById } = require("../utils/banquetHelpers");

const HALL_SELECT = `SELECT id, name, description,
       capacity_min AS capacityMin, capacity_max AS capacityMax,
       rate_per_hour AS ratePerHour, rate_per_day AS ratePerDay,
       is_ac AS isAc, has_projector AS hasProjector,
       has_sound_system AS hasSoundSystem, has_stage AS hasStage,
       has_dance_floor AS hasDanceFloor, image_url AS imageUrl, status
FROM banquet_halls`;

const boolValue = (value) =>
  typeof value === "string" ? value === "true" || value === "1" : Boolean(value);

const normalizeHallStatus = (value) => {
  const status = String(value || "available").trim().toLowerCase();
  return ["available", "booked", "maintenance"].includes(status) ? status : "available";
};

const addBanquetHall = async (req, res) => {
  try {
    const body = req.body || {};
    const {
      name,
      capacity,
      capacityMin,
      capacityMax,
      ratePerHour,
      ratePerDay,
      is_ac,
      image,
      description,
    } = body;

    const imageValue = req.file ? `/uploads/${req.file.filename}` : image || null;

    if (!name) {
      return res.status(400).json({ message: "name is required" });
    }

    const minCapacity = Number(capacityMin ?? capacity ?? 0);
    const maxCapacity = Number(capacityMax ?? capacity ?? minCapacity);

    const [result] = await db.query(
      `INSERT INTO banquet_halls
        (name, description, capacity_min, capacity_max, rate_per_hour, rate_per_day,
         is_ac, has_projector, has_sound_system, has_stage, has_dance_floor,
         image_url, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        description || null,
        minCapacity,
        maxCapacity,
        Number(ratePerHour || 0),
        Number(ratePerDay || 0),
        boolValue(is_ac) ? 1 : 0,
        boolValue(body.has_projector) ? 1 : 0,
        boolValue(body.has_sound_system) ? 1 : 0,
        boolValue(body.has_stage) ? 1 : 0,
        boolValue(body.has_dance_floor) ? 1 : 0,
        imageValue,
        normalizeHallStatus(body.status),
      ]
    );

    const [rows] = await db.query(`${HALL_SELECT} WHERE id = ?`, [result.insertId]);

    res.status(201).json({
      message: "Hall added successfully",
      id: result.insertId,
      ...(rows[0] || {}),
    });
  } catch (error) {
    console.error("addBanquetHall error:", error);
    res.status(500).json({ message: "Failed to add banquet hall", error: error.message });
  }
};

const updateBanquetHall = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const {
      name,
      capacity,
      capacityMin,
      capacityMax,
      ratePerHour,
      ratePerDay,
      is_ac,
      image,
      status,
      description,
    } = body;

    const imageValue = req.file ? `/uploads/${req.file.filename}` : image || null;

    // Only touch columns that were actually sent, so partial updates work.
    const sets = [];
    const params = [];

    if (name !== undefined) {
      sets.push("name = ?");
      params.push(name);
    }
    if (description !== undefined) {
      sets.push("description = ?");
      params.push(description);
    }
    if (capacityMin !== undefined || capacity !== undefined) {
      sets.push("capacity_min = ?");
      params.push(Number(capacityMin ?? capacity ?? 0));
    }
    if (capacityMax !== undefined || capacity !== undefined) {
      sets.push("capacity_max = ?");
      params.push(Number(capacityMax ?? capacity ?? 0));
    }
    if (ratePerHour !== undefined) {
      sets.push("rate_per_hour = ?");
      params.push(Number(ratePerHour || 0));
    }
    if (ratePerDay !== undefined) {
      sets.push("rate_per_day = ?");
      params.push(Number(ratePerDay || 0));
    }
    if (is_ac !== undefined) {
      sets.push("is_ac = ?");
      params.push(boolValue(is_ac) ? 1 : 0);
    }
    if (imageValue !== null && imageValue !== undefined) {
      sets.push("image_url = ?");
      params.push(imageValue);
    }
    if (status !== undefined) {
      sets.push("status = ?");
      params.push(normalizeHallStatus(status));
    }

    if (!sets.length) {
      return res.status(400).json({ message: "No fields to update" });
    }

    params.push(id);
    const [result] = await db.query(
      `UPDATE banquet_halls SET ${sets.join(", ")} WHERE id = ?`,
      params
    );

    if (result.affectedRows === 0) {
      // Distinguish "not found" from "found but unchanged" so a no-op update
      // is not reported as a 404.
      const [existing] = await db.query("SELECT id FROM banquet_halls WHERE id = ?", [id]);
      if (!existing.length) {
        return res.status(404).json({ message: "Hall not found" });
      }
    }

    const hall = await getHallById(id);
    res.status(200).json({ message: "Hall updated successfully", id: Number(id), ...(hall || {}) });
  } catch (error) {
    console.error("updateBanquetHall error:", error);
    res.status(500).json({ message: "Failed to update banquet hall", error: error.message });
  }
};

const deleteBanquetHall = async (req, res) => {
  try {
    const { id } = req.params;

    const [activeBookings] = await db.query(
      `SELECT id FROM banquet_bookings
       WHERE hall_id = ?
         AND LOWER(COALESCE(status, '')) IN ('confirmed', 'completed', 'billed')
       LIMIT 1`,
      [id]
    );

    if (activeBookings.length) {
      return res.status(409).json({
        message: "Hall has active banquet bookings and cannot be deleted",
      });
    }

    const [result] = await db.query("DELETE FROM banquet_halls WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Hall not found" });
    }

    res.status(200).json({ message: "Hall deleted successfully" });
  } catch (error) {
    console.error("deleteBanquetHall error:", error);
    res.status(500).json({ message: "Failed to delete banquet hall", error: error.message });
  }
};

module.exports = {
  addBanquetHall,
  updateBanquetHall,
  deleteBanquetHall,
};
