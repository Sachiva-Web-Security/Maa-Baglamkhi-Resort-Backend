const Housekeeping = require("../models/Housekeeping");

exports.getAllRooms = (req, res) => {
  Housekeeping.getAllRooms((err, results) => {
    if (err) {
      console.error("getAllRooms error:", err);
      return res.status(500).json({
        message: "Database error",
        error: err.message,
      });
    }

    res.json(results);
  });
};

exports.createRoom = (req, res) => {
  const data = {
    roomNo: req.body.roomNo || req.body.roomNumber,
    status: req.body.status,
    assignee: req.body.assignee,
    priority: req.body.priority,
    notes: req.body.notes,
    cleaningStart: req.body.cleaningStart,
    cleaningEnd: req.body.cleaningEnd,
  };

  if (!data.roomNo) {
    return res.status(400).json({ message: "roomNo is required" });
  }

  Housekeeping.createRoom(data, (err, result) => {
    if (err) {
      console.error("createRoom error:", err);
      return res.status(500).json({
        message: "Insert failed",
        error: err.message,
      });
    }

    res.json({
      message: result.updatedExisting
        ? "Room already existed, details updated successfully"
        : "Room created successfully",
      id: result.insertId,
      updatedExisting: Boolean(result.updatedExisting),
    });
  });
};

exports.updateRoom = (req, res) => {
  const id = req.params.id;

  const data = {
    status: req.body.status || "Vacant Dirty",
    assignee: req.body.assignee || "No Housekeeper",
    priority: req.body.priority || "Normal",
    notes: req.body.notes || "",
    cleaningStart: req.body.cleaningStart || null,
    cleaningEnd: req.body.cleaningEnd || null,
  };

  Housekeeping.updateRoom(id, data, (err, result) => {
    if (err) {
      console.error("updateRoom error:", err);
      return res.status(500).json({
        message: "Update failed",
        error: err.message,
      });
    }

    res.json(result);
  });
};

exports.updateStatus = (req, res) => {
  const id = req.params.id;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ message: "status is required" });
  }

  Housekeeping.updateStatus(id, status, (err, result) => {
    if (err) {
      console.error("updateStatus error:", err);
      return res.status(500).json({
        message: "Status update failed",
        error: err.message,
      });
    }

    res.json(result);
  });
};

exports.updateAssignee = (req, res) => {
  const id = req.params.id;
  const { assignee } = req.body;

  if (!assignee) {
    return res.status(400).json({ message: "assignee is required" });
  }

  Housekeeping.updateAssignee(id, assignee, (err, result) => {
    if (err) {
      console.error("updateAssignee error:", err);
      return res.status(500).json({
        message: "Assignee update failed",
        error: err.message,
      });
    }

    res.json(result);
  });
};

exports.getLogs = (req, res) => {
  Housekeeping.getLogs((err, results) => {
    if (err) {
      console.error("getLogs error:", err);
      return res.status(500).json({
        message: "Logs fetch failed",
        error: err.message,
      });
    }

    res.json(results);
  });
};

exports.deleteRoom = (req, res) => {
  const id = req.params.id;

  Housekeeping.deleteRoom(id, (err, result) => {
    if (err) {
      console.error("deleteRoom error:", err);
      return res.status(500).json({
        message: "Delete failed",
        error: err.message,
      });
    }

    res.json(result);
  });
};
