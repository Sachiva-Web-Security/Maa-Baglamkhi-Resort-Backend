const GuestModel = require("../models/guestModel");
const OtherBookingModel = require("../models/otherBookingModel");
const CompanyModel = require("../models/companyModel");
const PaxModel = require("../models/paxModel");
const AdvanceModel = require("../models/advanceModel");
const ReferenceModel = require("../models/referenceModel");
const RoomTariffModel = require("../models/roomTariffModel");


// CREATE GUEST
exports.createGuest = (req, res) => {

  GuestModel.createGuest(req.body, (err, result) => {

    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Guest creation failed" });
    }

    res.json({
      message: "Guest Created",
      bookingId: result.insertId
    });

  });

};


// OTHER BOOKING
exports.updateOtherBooking = (req, res) => {

  const data = {
    booking_id: req.params.id,
    ...req.body
  };

  OtherBookingModel.createOtherBooking(data, (err, result) => {

    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Other booking failed" });
    }

    res.json({ message: "Other Booking Saved" });

  });

};


// REFERENCE NOTES
exports.updateReference = (req, res) => {

  const data = {
    booking_id: req.params.id,
    ...req.body
  };

  ReferenceModel.createReference(data, (err, result) => {

    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Reference save failed" });
    }

    res.json({ message: "Reference Saved" });

  });

};


// COMPANY
exports.updateCompany = (req, res) => {

  const data = {
    booking_id: req.params.id,
    ...req.body
  };

  CompanyModel.addCompany(data, (err, result) => {

    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Company save failed" });
    }

    res.json({ message: "Company Added" });

  });

};


// PAX
exports.updatePax = (req, res) => {

  const data = {
    booking_id: req.params.id,
    ...req.body
  };

  PaxModel.addPax(data, (err, result) => {

    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Pax save failed" });
    }

    res.json({ message: "Pax Added" });

  });

};


// ROOM TARIFF
exports.updateTariff = (req, res) => {

  const data = {
    booking_id: req.params.id,
    ...req.body
  };

  RoomTariffModel.addTariff(data, (err, result) => {

    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Tariff save failed" });
    }

    res.json({ message: "Tariff Added" });

  });

};


// ADVANCE PAYMENT
exports.updateAdvance = (req, res) => {

  const data = {
    booking_id: req.params.id,
    ...req.body
  };

  AdvanceModel.addAdvance(data, (err, result) => {

    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Advance save failed" });
    }

    res.json({ message: "Advance Added" });

  });

};