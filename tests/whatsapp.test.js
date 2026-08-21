/**
 * Tests for the WhatsApp integration services.
 */

const path = require("path");
const fs = require("fs");

describe("WhatsApp + Invoice PDF services", () => {
  const WhatsAppService = require("../services/whatsappService");
  const InvoicePdfService = require("../services/invoicePdfService");

  test("normalizePhoneNumber handles Indian 10-digit", () => {
    expect(WhatsAppService.normalizePhoneNumber("9876543210")).toBe("919876543210");
  });

  test("normalizePhoneNumber strips spaces / plus / dashes", () => {
    expect(WhatsAppService.normalizePhoneNumber("+91 98765 43210")).toBe("919876543210");
    expect(WhatsAppService.normalizePhoneNumber("91-9876543210")).toBe("919876543210");
  });

  test("normalizePhoneNumber returns null for invalid input", () => {
    expect(WhatsAppService.normalizePhoneNumber("")).toBeNull();
    expect(WhatsAppService.normalizePhoneNumber(null)).toBeNull();
    expect(WhatsAppService.normalizePhoneNumber(undefined)).toBeNull();
  });

  test("generateInvoicePdf produces a PDF file", async () => {
    const invoice = {
      bookingId: 1234,
      customerId: 1234,
      invoiceNo: "HOTINV-20260101-1234",
      customerName: "Test Guest",
      phone: "9876543210",
      roomNumber: "101, 102",
      checkIn: "2026-01-01",
      checkOut: "2026-01-03",
      date: "2026-01-03",
      paymentMode: "UPI",
      paymentStatus: "Paid",
      subtotal: 5000,
      tax: 250,
      discount: 100,
      totalAmount: 5150,
      roomCharge: 4500,
      foodCharge: 500,
      extraCharge: 0,
      items: [
        { name: "Deluxe Room - 101", price: 2500, quantity: 1, total: 2500 },
        { name: "Deluxe Room - 102", price: 2000, quantity: 1, total: 2000 },
        { name: "Breakfast - 101", price: 500, quantity: 1, total: 500 },
      ],
    };

    const { filePath, fileName } = await InvoicePdfService.generateInvoicePdf(invoice);
    expect(fileName).toMatch(/^invoice_/);
    expect(fs.existsSync(filePath)).toBe(true);
    const stat = fs.statSync(filePath);
    expect(stat.size).toBeGreaterThan(500);
  });
});
