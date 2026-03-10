const Housekeeping = require("../models/Housekeeping");

exports.getAllRooms = (req, res) => {

    Housekeeping.getAllRooms((err, results) => {

        if (err) {
            return res.status(500).json({
                message: "Database error",
                error: err
            });
        }

        res.json(results);
    });

};

exports.createRoom = (req, res) => {

    const data = {
        roomNo: req.body.roomNumber,
        status: req.body.status,
        assignee: req.body.assignee
    };

    Housekeeping.createRoom(data, (err, result) => {

        if (err) {
            return res.status(500).json({
                message: "Insert failed",
                error: err
            });
        }

        res.json({
            message: "Room created",
            id: result.insertId
        });

    });

};


exports.updateStatus = (req, res) => {

    const id = req.params.id;
    const { status } = req.body;

    Housekeeping.updateStatus(id, status, (err, result) => {

        if (err) {
            return res.status(500).json(err);
        }

        res.json({
            message: "Status updated"
        });

    });

};


exports.updateAssignee = (req, res) => {

    const id = req.params.id;
    const { assignee } = req.body;

    Housekeeping.updateAssignee(id, assignee, (err, result) => {

        if (err) {
            return res.status(500).json(err);
        }

        res.json({
            message: "Assignee updated"
        });

    });

};


exports.deleteRoom = (req, res) => {

    const id = req.params.id;

    Housekeeping.deleteRoom(id, (err, result) => {

        if (err) {
            return res.status(500).json(err);
        }

        res.json({
            message: "Room deleted"
        });

    });

};