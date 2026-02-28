const HotelModel = require("../models/HotelModel");

exports.getRoomsAndBookings = (req, res) => {
  HotelModel.getRooms((err, rooms) => {
    if (err) {
      console.error("Error fetching rooms:", err);
      return res.status(500).json({ message: "Error fetching rooms" });
    }

    HotelModel.getBookings((err2, bookings) => {
      if (err2) {
        console.error("Error fetching bookings:", err2);
        return res.status(500).json({ message: "Error fetching bookings" });
      }

      res.json({ rooms, bookings });
    });
  });
};

exports.createBooking = (req, res) => {
  const { guestName, room, checkIn, checkOut } = req.body;

  if (!guestName || !room || !checkIn || !checkOut) {
    return res.status(400).json({ message: "Missing booking fields" });
  }

  const bookingData = {
    guestName,
    room,
    checkIn,
    checkOut,
    status: "Occupied",
  };

  HotelModel.createBooking(bookingData, (err, result) => {
    if (err) {
      console.error("Error creating booking:", err);
      return res.status(500).json({ message: "Error creating booking" });
    }

    HotelModel.updateRoomForBooking(bookingData, (err2) => {
      if (err2) {
        console.error("Error updating room for booking:", err2);
        return res
          .status(500)
          .json({ message: "Booking saved but room not updated" });
      }

      res.json({
        message: "Booking created successfully",
        bookingId: result.insertId,
      });
    });
  });
};

exports.checkout = (req, res) => {
  const { id, room } = req.body;

  if (!id || !room) {
    return res.status(400).json({ message: "Missing booking id or room" });
  }

  HotelModel.checkoutBooking(id, (err) => {
    if (err) {
      console.error("Error checking out booking:", err);
      return res.status(500).json({ message: "Error updating booking" });
    }

    HotelModel.setRoomCleaning(room, (err2) => {
      if (err2) {
        console.error("Error setting room to cleaning:", err2);
        return res
          .status(500)
          .json({ message: "Booking updated but room not updated" });
      }

      res.json({ message: "Checked out successfully" });
    });
  });
};

exports.extendBooking = (req, res) => {
  const { id, checkOut } = req.body;
  if (!id || !checkOut) return res.status(400).json({ message: "Missing fields" });

  HotelModel.updateBookingDates(id, checkOut, (err) => {
    if (err) return res.status(500).json({ message: "Error extending booking" });
    res.json({ message: "Booking extended successfully" });
  });
};

exports.shiftRoom = (req, res) => {
  const { id, oldRoom, newRoom, guestName, checkIn, checkOut } = req.body;
  if (!id || !oldRoom || !newRoom) return res.status(400).json({ message: "Missing fields" });

  // Update booking with new room
  HotelModel.updateBookingRoom(id, newRoom, (err) => {
    if (err) return res.status(500).json({ message: "Error updating booking room" });

    // Free old room
    HotelModel.clearRoomGuest(oldRoom, (err2) => {
      if (err2) return res.status(500).json({ message: "Error clearing old room" });

      // Occupy new room
      const bookingData = { status: "Occupied", guestName, checkIn, checkOut, room: newRoom };
      HotelModel.updateRoomForBooking(bookingData, (err3) => {
        if (err3) return res.status(500).json({ message: "Error updating new room" });
        res.json({ message: "Room shifted successfully" });
      });
    });
  });
};

exports.updateRoomStatus = (req, res) => {
  const { number } = req.params;
  const { status } = req.body;

  if (!number || !status) return res.status(400).json({ message: "Missing fields" });

  if (status === 'Available') {
    // Make sure we clear guest data if it's becoming Available
    HotelModel.updateRoomStatus(number, status, (err) => {
      if (err) return res.status(500).json({ message: "Error updating room status" });
      // Also clear guest fields just in case
      HotelModel.clearRoomGuest(number, () => { });
      res.json({ message: "Room marked Available" });
    });
  } else if (status === 'Cleaning') {
    HotelModel.setRoomCleaning(number, (err) => {
      if (err) return res.status(500).json({ message: "Error marking room for cleaning" });
      res.json({ message: "Room marked for cleaning" });
    });
  } else {
    HotelModel.updateRoomStatus(number, status, (err) => {
      if (err) return res.status(500).json({ message: "Error updating room status" });
      res.json({ message: "Room status updated" });
    });
  }
};

exports.nightAudit = (req, res) => {
  // Simplified night audit - in a real system this would summarize revenue, update statuses, etc.
  res.json({ message: "Night audit completed successfully" });
};

exports.addRoom = (req, res) => {
  const { roomNumber } = req.body;
  if (!roomNumber) return res.status(400).json({ message: "Missing room number" });

  HotelModel.addRoom(roomNumber, (err, result) => {
    if (err) {
      if (err.code === "ER_DUP_ENTRY") {
        return res.status(400).json({ message: "Room number already exists" });
      }
      console.error("Error adding room:", err);
      return res.status(500).json({ message: "Error adding room" });
    }
    res.json({ message: "Room added successfully", id: result.insertId });
  });
};
