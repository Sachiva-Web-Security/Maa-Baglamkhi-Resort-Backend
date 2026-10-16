import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { jsPDF } from "jspdf";

import API from "../api";

const RESORT_NAME = "Maa Baglamukhi Resort";
const RESORT_ADDRESS = "Maa Baglamukhi mandir road Near iocl petrol pump  Nalkheda  ";
const RESORT_DISTRICT = "District: Agar Malwa 465445";
const RESORT_PHONE = "9522238777, 9522239777";
const RESORT_EMAIL = "maabaglamukhiresort@gmail.com";
const RESORT_WEBSITE = "www.maabaglamukhiresort.com";
const RESORT_GSTIN = "23AVDPR2928J1ZG";
const RESORT_STATE_CODE = "23"; // Madhya Pradesh

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

const formatINR = (value) =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

const formatDate = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatTime = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const toNumber = (value) => Number(value) || 0;

const CustomerInvoicePage = () => {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const printRef = useRef(null);

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paymentSettings, setPaymentSettings] = useState([]);
  const [selectedPaymentMode, setSelectedPaymentMode] = useState("UPI");
  const [selectedPaymentSettingId, setSelectedPaymentSettingId] = useState("");
  const [paymentReferenceNo, setPaymentReferenceNo] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [settlingPayment, setSettlingPayment] = useState(false);
  const [printTimestamp] = useState(() => new Date());

  useEffect(() => {
    let ignore = false;
    const loadInvoice = async () => {
      try {
        setLoading(true);
        setError("");
        const response = await API.get(`/invoice/${customerId}`);
        if (!ignore) {
          setInvoice(response.data || null);
        }
      } catch (err) {
        if (!ignore) {
          setError(err.response?.data?.error || "Invoice could not be loaded.");
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    loadInvoice();
    return () => { ignore = true; };
  }, [customerId]);

  useEffect(() => {
    let ignore = false;
    const loadPaymentSettings = async () => {
      try {
        const response = await API.get("/accounts/payment-settings");
        if (!ignore) {
          setPaymentSettings(Array.isArray(response.data) ? response.data : []);
        }
      } catch {
        if (!ignore) setPaymentSettings([]);
      }
    };
    loadPaymentSettings();
    return () => { ignore = true; };
  }, []);

  const itemRows = useMemo(
    () => (Array.isArray(invoice?.items) ? invoice.items : []),
    [invoice?.items],
  );

  const subtotal = useMemo(() => toNumber(invoice?.subtotal), [invoice?.subtotal]);
  const totalAmount = useMemo(() => toNumber(invoice?.totalAmount), [invoice?.totalAmount]);
  const taxAmount = useMemo(() => toNumber(invoice?.tax), [invoice?.tax]);
  const discount = useMemo(() => toNumber(invoice?.discount), [invoice?.discount]);
  const paidAmount = useMemo(() => toNumber(invoice?.paidAmount), [invoice?.paidAmount]);
  const balanceDue = useMemo(() => {
    const due = toNumber(invoice?.balanceDue);
    return due > 0 ? due : Math.max(0, totalAmount - paidAmount);
  }, [invoice?.balanceDue, totalAmount, paidAmount]);

  // GST split: 5% total = 2.5% SGST + 2.5% CGST
  const sgstAmount = taxAmount / 2;
  const cgstAmount = taxAmount / 2;

  const paymentStatusLabel = String(invoice?.paymentStatus || "Pending").trim();
  const invoiceNoDisplay = invoice?.invoiceNo || `INV-${customerId}`;

  const activePaymentSettings = useMemo(
    () => (paymentSettings || []).filter((row) => Number(row.is_active) === 1),
    [paymentSettings],
  );
  const paymentModeOptions = ["Cash", "UPI", "Card", "Bank Transfer", "Cheque"];
  const filteredPaymentSettings = useMemo(
    () =>
      activePaymentSettings.filter((row) => {
        if (selectedPaymentMode === "Cash") return false;
        return String(row.payment_mode || "").toLowerCase() ===
          String(selectedPaymentMode || "").toLowerCase();
      }),
    [activePaymentSettings, selectedPaymentMode],
  );
  const selectedPaymentSetting = useMemo(
    () =>
      filteredPaymentSettings.find(
        (row) => String(row.id) === String(selectedPaymentSettingId),
      ) || filteredPaymentSettings[0] || null,
    [filteredPaymentSettings, selectedPaymentSettingId],
  );

  useEffect(() => {
    if (selectedPaymentMode === "Cash") {
      setSelectedPaymentSettingId("");
      return;
    }
    setSelectedPaymentSettingId(
      filteredPaymentSettings[0] ? String(filteredPaymentSettings[0].id) : "",
    );
  }, [selectedPaymentMode, filteredPaymentSettings]);

  const reloadInvoice = async () => {
    try {
      const response = await API.get(`/invoice/${customerId}`);
      setInvoice(response.data || {});
    } catch (err) {
      console.error("Failed to reload invoice:", err);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    if (!invoice) return;

    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
    const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
    const margin = 10;
    const contentWidth = pageWidth - margin * 2; // 190mm
    const rightEdge = pageWidth - margin;
    const center = pageWidth / 2;
    let y = margin;

    const ensureSpace = (needed) => {
      if (y + needed <= pageHeight - margin) return;
      doc.addPage();
      y = margin;
    };

    // ── Header: Resort info ────────────────────────────────────
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.text(RESORT_NAME, center, y + 7, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(RESORT_ADDRESS, center, y + 12, { align: "center" });
    doc.text(`${RESORT_DISTRICT} | Ph: ${RESORT_PHONE} | ${RESORT_EMAIL}`, center, y + 17, { align: "center" });
    doc.text(`GSTIN: ${RESORT_GSTIN} | State: ${RESORT_STATE_CODE} | ${RESORT_WEBSITE}`, center, y + 22, { align: "center" });

    y += 28;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(margin, y, rightEdge, y);
    y += 5;

    // ── Invoice title + meta ────────────────────────────────────
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text("TAX INVOICE", center, y + 5, { align: "center" });
    y += 10;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);

    doc.text(`Invoice No: ${invoiceNoDisplay}`, margin, y);
    doc.text(`Date: ${formatDate(printTimestamp)}  Time: ${formatTime(printTimestamp)}`, center, y, { align: "center" });
    doc.text(`Table No: ${invoice?.roomNumber || "ROOM " + (invoice?.bookingId || "-")}`, rightEdge, y, { align: "right" });
    y += 6;

    doc.text(`Captain: RECEPTION`, margin, y);
    doc.text(`KOT No: ${invoice?.bookingId || "-"}`, center, y, { align: "center" });
    y += 8;

    // ── Bill To ─────────────────────────────────────────────────
    doc.setFillColor(245, 247, 250);
    doc.roundedRect(margin, y, contentWidth, 22, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text("BILL TO", margin + 3, y + 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(invoice?.customerName || "Guest", margin + 3, y + 11);
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(`Phone: ${invoice?.phone || "--"}`, margin + 3, y + 16);
    doc.text(`Booking ID: ${invoice?.bookingId || "--"}`, margin + 3, y + 21);
    const companyNamePdf = invoice?.companyName;
    const companyGstinPdf = invoice?.companyGstin;
    const billToTextLines = [
      `Guest: ${invoice?.customerName || "Guest"}`,
      `Phone: ${invoice?.phone || "--"}`,
      `Booking ID: ${invoice?.bookingId || "--"}`,
      companyNamePdf ? `Company: ${companyNamePdf}` : null,
      companyGstinPdf ? `Company GSTIN: ${companyGstinPdf}` : null,
    ].filter(Boolean);
    billToTextLines.forEach((line, idx) => {
      doc.text(line, margin + 3, y + 7 + idx * 5);
    });
    y += Math.max(26, 7 + billToTextLines.length * 5);

    // ── Items table ─────────────────────────────────────────────
    doc.setFillColor(240, 242, 245);
    doc.rect(margin, y, contentWidth, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);

    const colX = [margin + 2, margin + 40, margin + 130, margin + 155, rightEdge - 2];
    doc.text("#", colX[0], y + 5);
    doc.text("Description", colX[1], y + 5);
    doc.text("Qty", colX[2], y + 5, { align: "center" });
    doc.text("Rate", colX[3], y + 5, { align: "right" });
    doc.text("Amount", colX[4], y + 5, { align: "right" });
    y += 7;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);

    if (!itemRows.length) {
      doc.text("No items.", margin + 2, y + 6);
      y += 10;
    } else {
      itemRows.forEach((item, index) => {
        const nameLines = doc.splitTextToSize(String(item.name || "Charge"), 88);
        const rowHeight = Math.max(7, nameLines.length * 4.5 + 2);
        ensureSpace(rowHeight + 3);

        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.2);
        doc.line(margin, y, rightEdge, y);
        y += 1;

        doc.text(String(index + 1), colX[0], y + 4);
        doc.text(nameLines, colX[1], y + 4);
        doc.text(String(item.quantity || 1), colX[2], y + 4, { align: "center" });
        doc.text(formatINR(item.price), colX[3], y + 4, { align: "right" });
        doc.text(formatINR(item.total), colX[4], y + 4, { align: "right" });
        y += rowHeight;
      });
    }

    y += 2;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.4);
    doc.line(margin, y, rightEdge, y);
    y += 4;

    // ── Totals ──────────────────────────────────────────────────
    ensureSpace(40);
    const totalsX = rightEdge - 75;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(50, 50, 50);

    const drawTotalRow = (label, value, isBold = false) => {
      doc.setFont("helvetica", isBold ? "bold" : "normal");
      doc.text(label, totalsX, y);
      doc.text(formatINR(value), rightEdge - 2, y, { align: "right" });
      y += 5;
    };

    drawTotalRow("Subtotal", subtotal);
    drawTotalRow(`SGST @ 2.5%`, sgstAmount);
    drawTotalRow(`CGST @ 2.5%`, cgstAmount);
    if (discount > 0) {
      drawTotalRow("Discount", -discount);
    }
    if (paidAmount > 0) {
      drawTotalRow("Amount Paid", paidAmount);
    }
    const pdfBalanceDue = balanceDue > 0 ? balanceDue : (totalAmount - paidAmount - discount);
    drawTotalRow("BALANCE DUE", pdfBalanceDue > 0 ? pdfBalanceDue : 0, pdfBalanceDue > 0);
    drawTotalRow("GRAND TOTAL", totalAmount, true);

    y += 5;

    // ── Footer ──────────────────────────────────────────────────
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("Thank you for staying with us. Visit again!", center, y, { align: "center" });
    doc.text(`Powered by ${RESORT_NAME}`, center, y + 4, { align: "center" });
    doc.text(`This is a computer generated invoice. Generated on: ${formatDate(printTimestamp)}`, center, y + 8, { align: "center" });

    doc.save(`${invoiceNoDisplay}.pdf`);
  };

  const handleSettleInvoice = async () => {
    if (!invoice?.id) return;
    if (selectedPaymentMode !== "Cash" && !selectedPaymentSetting?.id) {
      return window.alert("Please select an active payment setup for this mode.");
    }
    if (selectedPaymentMode !== "Cash" && !paymentReferenceNo.trim()) {
      return window.alert("Please enter the payment reference number.");
    }
    try {
      setSettlingPayment(true);
      await API.post("/accounts/settle-pending-bill", {
        sourceType: "invoice",
        sourceId: invoice.id,
        paymentMode: selectedPaymentMode,
        paymentSettingId: selectedPaymentSetting?.id || null,
        referenceNo: paymentReferenceNo.trim(),
        notes: paymentNotes.trim(),
      });
      await reloadInvoice();
      setPaymentReferenceNo("");
      setPaymentNotes("");
    } catch (err) {
      window.alert(err.response?.data?.message || "Payment could not be saved.");
    } finally {
      setSettlingPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-10">
        <div className="text-lg text-slate-500">Invoice loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-6 text-sm text-rose-700">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#f8fafc] p-4 sm:p-6">
      {/* ── Screen wrapper (print sabko chupaega) ──────────────── */}
      <style>{`
        @page {
          size: A4 portrait;
          margin: 12mm;
        }

        @media print {
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .invoice-screen-wrapper {
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .invoice-screen-wrapper > *:not(.invoice-a4-sheet) {
            display: none !important;
          }
          .invoice-a4-sheet,
          .invoice-a4-sheet * {
            color: #000000 !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
            text-shadow: none !important;
            box-shadow: none !important;
          }
          .invoice-a4-sheet {
            display: block !important;
            width: 100% !important;
            max-width: none !important;
            border: 0 !important;
            border-radius: 0 !important;
            background: #ffffff !important;
            padding: 0 !important;
          }
          .invoice-a4-sheet table,
          .invoice-a4-sheet th,
          .invoice-a4-sheet td,
          .invoice-a4-sheet [class*="border"] {
            border-color: #000000 !important;
          }
          .invoice-a4-sheet th,
          .invoice-a4-sheet .font-semibold,
          .invoice-a4-sheet .font-bold,
          .invoice-a4-sheet .font-black {
            font-weight: 700 !important;
          }
        }
      `}</style>

      <div className="invoice-screen-wrapper mx-auto w-full max-w-[880px] space-y-4">
        {/* ── Action bar ─────────────────────────────────────────── */}
        <section className="no-print flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Hotel Tax Invoice
            </p>
            <h1 className="mt-1 text-xl font-black text-slate-900">
              Invoice #{invoiceNoDisplay}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-amber-600"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download PDF
            </button>
          </div>
        </section>

        {/* ── Invoice preview card (screen view) ─────────────────── */}
        <section className="invoice-a4-sheet rounded-2xl border-2 border-slate-900 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-center gap-3 border-b-2 border-dashed border-slate-300 pb-3">
            <h2 className="text-center text-xl font-black tracking-wide text-slate-900">
              {RESORT_NAME}
            </h2>
          </div>
          <div className="mt-1 text-center text-xs font-semibold text-slate-900">
            {RESORT_ADDRESS} | {RESORT_DISTRICT}
          </div>
          <div className="text-center text-xs font-semibold text-slate-900">
            Ph: {RESORT_PHONE} | Email: {RESORT_EMAIL} | {RESORT_WEBSITE}
          </div>
          <div className="text-center text-xs font-semibold text-slate-900">
            GSTIN: {RESORT_GSTIN} | State: {RESORT_STATE_CODE}
          </div>

          <div className="mt-3 flex items-center justify-between border-y border-slate-300 py-2">
            <div className="text-sm font-bold uppercase tracking-wider">Tax Invoice</div>
            <div className="text-sm font-semibold">#{invoiceNoDisplay}</div>
            <div className="text-sm">Date: {formatDate(invoice?.date)}</div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-4 border border-slate-200 p-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-900">Guest</div>
              <div className="mt-1 text-sm font-bold text-slate-900">{invoice?.customerName || "Guest"}</div>
              <div className="text-xs font-semibold text-slate-900">Phone: {invoice?.phone || "--"}</div>
              <div className="text-xs font-semibold text-slate-900">Booking: {invoice?.bookingId || "--"}</div>
              {invoice?.companyName && (
                <div className="text-xs font-semibold text-slate-900">Company: {invoice.companyName}</div>
              )}
              {invoice?.companyGstin && (
                <div className="text-xs font-semibold text-slate-900">GSTIN: {invoice.companyGstin}</div>
              )}
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-900">Room Details</div>
              <div className="mt-1 text-xs font-semibold text-slate-900">Room: {invoice?.roomNumber || "--"}</div>
              <div className="text-xs font-semibold text-slate-900">Check-In: {formatDate(invoice?.checkIn)}</div>
              <div className="text-xs font-semibold text-slate-900">Check-Out: {formatDate(invoice?.checkOut)}</div>
            </div>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-left">
                  <th className="border border-slate-300 px-2 py-1.5 font-bold">#</th>
                  <th className="border border-slate-300 px-2 py-1.5 font-bold">Description</th>
                  <th className="border border-slate-300 px-2 py-1.5 font-bold text-center">Qty</th>
                  <th className="border border-slate-300 px-2 py-1.5 font-bold text-right">Rate</th>
                  <th className="border border-slate-300 px-2 py-1.5 font-bold text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {itemRows.length ? (
                  itemRows.map((item, index) => (
                    <tr key={index} className="text-left">
                      <td className="border border-slate-300 px-2 py-1.5">{index + 1}</td>
                      <td className="border border-slate-300 px-2 py-1.5">
                        <div className="font-semibold">{item.name}</div>
                        {item.category && (
                          <div className="text-[10px] font-semibold text-slate-900">{item.category}</div>
                        )}
                      </td>
                      <td className="border border-slate-300 px-2 py-1.5 text-center">{item.quantity || 1}</td>
                      <td className="border border-slate-300 px-2 py-1.5 text-right">{formatINR(item.price)}</td>
                      <td className="border border-slate-300 px-2 py-1.5 text-right font-bold">{formatINR(item.total)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="border border-slate-300 px-3 py-4 text-center font-semibold text-slate-900">
                      No items found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-4">
            <div className="border border-slate-200 p-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-900">Payment Info</div>
              <div className="mt-1 text-xs font-semibold text-slate-900">
                Status: <span className="font-bold">{paymentStatusLabel}</span>
              </div>
              <div className="text-xs font-semibold text-slate-900">
                Mode: {invoice?.paymentMode || invoice?.paymentMethod || "Front Desk"}
              </div>
              {invoice?.paymentReference && (
                <div className="text-xs font-semibold text-slate-900">Ref: {invoice.paymentReference}</div>
              )}
              {paidAmount > 0 && (
                <div className="mt-1 text-xs font-semibold text-emerald-700">
                  Amount Paid: {formatINR(paidAmount)}
                </div>
              )}
              {discount > 0 && (
                <div className="text-xs font-semibold text-amber-700">
                  Discount: {formatINR(discount)}
                </div>
              )}
            </div>
            <div className="border-2 border-slate-900 bg-slate-50 p-3">
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-semibold">{formatINR(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>SGST @ 2.5%</span>
                  <span className="font-semibold">{formatINR(sgstAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>CGST @ 2.5%</span>
                  <span className="font-semibold">{formatINR(cgstAmount)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between">
                    <span>Discount</span>
                    <span className="font-semibold">-{formatINR(discount)}</span>
                  </div>
                )}
                {paidAmount > 0 && (
                  <div className="flex justify-between border-t border-slate-300 pt-1">
                    <span>Amount Paid</span>
                    <span className="font-semibold text-emerald-700">{formatINR(paidAmount)}</span>
                  </div>
                )}
                <div className="border-t-2 border-slate-900 pt-1 text-sm font-black">
                  <div className="flex justify-between">
                    <span>BALANCE DUE</span>
                    <span className={balanceDue > 0 ? "text-rose-600" : "text-emerald-700"}>{formatINR(balanceDue)}</span>
                  </div>
                </div>
                <div className="border-t-2 border-slate-900 pt-1 text-sm font-black">
                  <div className="flex justify-between">
                    <span>GRAND TOTAL</span>
                    <span>{formatINR(totalAmount)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 border-t-2 border-slate-900 pt-3 text-center">
            <div className="text-xs font-semibold italic text-slate-900">
              Thank you for staying with {RESORT_NAME}. Please visit again.
            </div>
            <div className="mt-1 text-[10px] font-semibold text-slate-900">
              This is a computer generated invoice and does not require a physical signature.
            </div>
          </div>
        </section>

        {/* ── Hidden print area ──────────────────────────────────── */}
        <div className="invoice-print-area hidden">
          <div ref={printRef}>
            {/* Content identical to screen view, optimized for thermal print */}
          </div>
        </div>

        {/* ── Pending Payment Section ────────────────────────────── */}
        {String(invoice?.paymentStatus || "Pending").toLowerCase() !== "paid" ? (
          <div className="no-print rounded-2xl border border-cyan-100 bg-cyan-50/70 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-sm font-semibold uppercase tracking-wider text-cyan-700">
                  Pending Payment Settlement
                </div>
                <h3 className="mt-2 text-2xl font-black text-slate-900">
                  Complete payment from the invoice page
                </h3>
                <p className="mt-2 max-w-3xl text-lg text-slate-600">
                  Choose the payment mode, show the saved scanner if required, collect the
                  payment reference, and mark this invoice as paid.
                </p>
              </div>
              <div className="rounded-xl border border-cyan-200 bg-white px-4 py-3 text-xl text-cyan-800">
                Invoice amount: <span className="font-bold">{formatCurrency(invoice?.totalAmount)}</span>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.1fr]">
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-1 block text-lg font-semibold uppercase tracking-wider text-slate-500">
                    Payment Mode
                  </span>
                  <select
                    value={selectedPaymentMode}
                    onChange={(event) => setSelectedPaymentMode(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-lg text-slate-900 outline-none"
                  >
                    {paymentModeOptions.map((mode) => (
                      <option key={mode} value={mode}>{mode}</option>
                    ))}
                  </select>
                </label>

                {selectedPaymentMode !== "Cash" ? (
                  <>
                    <label className="block">
                      <span className="mb-1 block text-lg font-semibold uppercase tracking-wider text-slate-500">
                        Payment Setup
                      </span>
                      <select
                        value={selectedPaymentSettingId}
                        onChange={(event) => setSelectedPaymentSettingId(event.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-lg text-slate-900 outline-none"
                      >
                        <option value="">Select setup</option>
                        {filteredPaymentSettings.map((row) => (
                          <option key={row.id} value={row.id}>
                            {row.department} - {row.provider_name || row.upi_id || row.bank_name || row.payment_mode}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-lg font-semibold uppercase tracking-wider text-slate-500">
                        Reference / UTR
                      </span>
                      <input
                        value={paymentReferenceNo}
                        onChange={(event) => setPaymentReferenceNo(event.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-lg text-slate-900 outline-none"
                        placeholder="Enter transaction reference"
                      />
                    </label>
                  </>
                ) : (
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-lg text-emerald-800">
                    Cash selected. This will mark the invoice as paid without creating a bank
                    reconciliation row.
                  </div>
                )}

                <label className="block">
                  <span className="mb-1 block text-lg font-semibold uppercase tracking-wider text-slate-500">
                    Notes
                  </span>
                  <textarea
                    value={paymentNotes}
                    onChange={(event) => setPaymentNotes(event.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-lg text-slate-900 outline-none"
                    placeholder="Optional payment note"
                  />
                </label>

                <button
                  type="button"
                  onClick={handleSettleInvoice}
                  disabled={settlingPayment}
                  className="rounded-xl bg-gradient-to-r from-cyan-600 to-teal-500 px-4 py-3 text-xl font-semibold text-white disabled:opacity-60"
                >
                  {settlingPayment ? "Saving payment..." : `Confirm ${selectedPaymentMode} Payment`}
                </button>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                  Payment Setup Preview
                </div>
                {selectedPaymentMode !== "Cash" && selectedPaymentSetting ? (
                  <div className="mt-4 grid gap-4 md:grid-cols-[180px_1fr] md:items-start">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      {selectedPaymentSetting.qr_image_url ? (
                        <img
                          src={selectedPaymentSetting.qr_image_url}
                          alt={`${selectedPaymentMode} QR`}
                          className="mx-auto h-40 w-40 rounded-xl object-contain"
                        />
                      ) : (
                        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-slate-300 text-lg text-slate-500">
                          No scanner image
                        </div>
                      )}
                    </div>
                    <div className="space-y-2 text-lg text-slate-700">
                      <div><span className="font-semibold text-slate-900">Provider:</span> {selectedPaymentSetting.provider_name || "-"}</div>
                      <div><span className="font-semibold text-slate-900">UPI ID:</span> {selectedPaymentSetting.upi_id || "-"}</div>
                      <div><span className="font-semibold text-slate-900">Account Holder:</span> {selectedPaymentSetting.account_holder_name || "-"}</div>
                      <div><span className="font-semibold text-slate-900">Bank:</span> {selectedPaymentSetting.bank_name || "-"}</div>
                      <div><span className="font-semibold text-slate-900">Department:</span> {selectedPaymentSetting.department || "-"}</div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 text-lg text-slate-500">
                    {selectedPaymentMode === "Cash"
                      ? "No scanner required for cash payment."
                      : "No active setup available for this payment mode."}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default CustomerInvoicePage;