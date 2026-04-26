const BanquetInquiryService = require("../Services/banquetInquiryService");

const getErrorMessage = (err) => {
  if (!err) return "Something went wrong";
  if (Array.isArray(err.message)) return err.message.join(", ");
  if (Array.isArray(err)) return err.join(", ");
  return err.message || "Something went wrong";
};

const BanquetInquiryController = {
  async getAllInquiries(req, res) {
    try {
      const data = await BanquetInquiryService.getAllInquiries();
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: getErrorMessage(err),
      });
    }
  },

  async getHalls(req, res) {
    try {
      const data = await BanquetInquiryService.getHalls();
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: getErrorMessage(err),
      });
    }
  },

  async getConfig(req, res) {
    try {
      const data = await BanquetInquiryService.getConfig();
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: getErrorMessage(err),
      });
    }
  },

  async getAvailability(req, res) {
    try {
      const { date, startTime, endTime } = req.query;

      if (!date || !startTime || !endTime) {
        return res.status(400).json({
          success: false,
          message: "date, startTime, endTime are required",
        });
      }

      const data = await BanquetInquiryService.checkAvailability({
        date,
        startTime,
        endTime,
      });

      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: getErrorMessage(err),
      });
    }
  },

  async createInquiry(req, res) {
    try {
      const data = {
        ...req.body,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      };

      await BanquetInquiryService.createInquiry(data);

      res.status(201).json({
        success: true,
        message: "Inquiry submitted successfully",
        data: {
          submitted: true,
        },
      });
    } catch (err) {
      res.status(err.status || 500).json({
        success: false,
        message: getErrorMessage(err),
      });
    }
  },

  async createBooking(req, res) {
    try {
      const data = await BanquetInquiryService.createWebsiteBooking(req.body);

      res.status(201).json({
        success: true,
        message: "Banquet booking created successfully",
        data,
      });
    } catch (err) {
      res.status(err.status || 500).json({
        success: false,
        message: getErrorMessage(err),
      });
    }
  },

  async getBookingById(req, res) {
    try {
      const data = await BanquetInquiryService.getWebsiteBookingById(req.params.id);

      res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      res.status(err.status || 500).json({
        success: false,
        message: getErrorMessage(err),
      });
    }
  },

  async createBookingPaymentOrder(req, res) {
    try {
      const data = await BanquetInquiryService.createWebsiteBookingPaymentOrder(req.body);

      res.status(200).json({
        success: true,
        message: "Banquet payment order created successfully",
        data,
      });
    } catch (err) {
      res.status(err.status || 500).json({
        success: false,
        message: getErrorMessage(err),
      });
    }
  },

  async verifyBookingPayment(req, res) {
    try {
      const data = await BanquetInquiryService.verifyWebsiteBookingPayment(req.body);

      res.status(200).json({
        success: true,
        message: "Banquet payment verified successfully",
        data,
      });
    } catch (err) {
      res.status(err.status || 500).json({
        success: false,
        message: getErrorMessage(err),
      });
    }
  },

  async cancelBookingPayment(req, res) {
    try {
      const data = await BanquetInquiryService.cancelWebsiteBookingPayment(req.body);

      res.status(200).json({
        success: true,
        message: data.cancelled ? "Banquet booking cancelled successfully" : "Banquet booking payment already completed",
        data,
      });
    } catch (err) {
      res.status(err.status || 500).json({
        success: false,
        message: getErrorMessage(err),
      });
    }
  },
};

module.exports = BanquetInquiryController;
