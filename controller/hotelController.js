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

