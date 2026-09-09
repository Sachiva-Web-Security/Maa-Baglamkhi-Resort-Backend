/**
 * CRUD for banquet halls.
 */

const {
  runQuery,
  getHallRateColumn,
  getHallById,
} = require("../utils/banquetHelpers");

const addBanquetHall = async (req, res) => {
  try {
    const hallRateColumn = await getHallRateColumn();
    const { name, capacity, ratePerHour, is_ac, image } = req.body;
    const imageValue = req.file ? `/uploads/${req.file.filename}` : image || null;
    const isAcValue =
      typeof is_ac === "string"
        ? is_ac === "true" || is_ac === "1"
        : Boolean(is_ac);

    if (!name || !capacity || !ratePerHour) {
      return res.status(400).json({
        message: "name, capacity and ratePerHour are required",
      });
    }

    const result = await runQuery(
      `INSERT INTO banquet_halls (name, capacity, ${hallRateColumn}, is_ac, image, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        name,
        Number(capacity),
        Number(ratePerHour),
        isAcValue ? 1 : 0,
        imageValue,
        "Available",
      ]
    );

    const rows = await runQuery(
      `SELECT id, name, capacity, ${hallRateColumn} AS ratePerHour, is_ac, image, status
       FROM banquet_halls WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      message: "Hall added successfully",
      hall: rows[0],
    });
  } catch (error) {
    console.error("addBanquetHall error:", error);
    res.status(500).json({ message: "Failed to add banquet hall" });
  }
};

const updateBanquetHall = async (req, res) => {
  try {
    const hallRateColumn = await getHallRateColumn();
    const { id } = req.params;
    const { name, capacity, ratePerHour, is_ac, image, status } = req.body;
    const imageValue = req.file ? `/uploads/${req.file.filename}` : image || null;
    const isAcValue =
      typeof is_ac === "string"
        ? is_ac === "true" || is_ac === "1"
        : Boolean(is_ac);

    if (!name || !capacity || !ratePerHour) {
      return res.status(400).json({
        message: "name, capacity and ratePerHour are required",
      });
    }

    const result = await runQuery(
      `UPDATE banquet_halls
       SET name = ?,
           capacity = ?,
           ${hallRateColumn} = ?,
           is_ac = ?,
           image = ?,
           status = ?
       WHERE id = ?`,
      [
        name,
        Number(capacity),
        Number(ratePerHour),
        isAcValue ? 1 : 0,
        imageValue,
        status || "Available",
        id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Hall not found" });
    }

    const hall = await getHallById(id, hallRateColumn);
    res.status(200).json({ message: "Hall updated successfully", hall });
  } catch (error) {
    console.error("updateBanquetHall error:", error);
    res.status(500).json({ message: "Failed to update banquet hall" });
  }
};

const deleteBanquetHall = async (req, res) => {
  try {
    const { id } = req.params;

    const activeBookings = await runQuery(
      `SELECT id FROM banquet_bookings
       WHERE hall_id = ?
         AND status IN ('Confirmed', 'Completed', 'Billed')
       LIMIT 1`,
      [id]
    );

    if (activeBookings.length) {
      return res.status(409).json({
        message: "Hall has active banquet bookings and cannot be deleted",
      });
    }

    const result = await runQuery("DELETE FROM banquet_halls WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Hall not found" });
    }

    res.status(200).json({ message: "Hall deleted successfully" });
  } catch (error) {
    console.error("deleteBanquetHall error:", error);
    res.status(500).json({ message: "Failed to delete banquet hall" });
  }
};

module.exports = {
  addBanquetHall,
  updateBanquetHall,
  deleteBanquetHall,
};
