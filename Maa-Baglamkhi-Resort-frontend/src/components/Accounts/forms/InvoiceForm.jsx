import React from "react";
import { useState, useEffect } from "react";
import API from "../../../api";

const todayISO = () => new Date().toISOString().slice(0, 10);
const EMPTY_INITIAL_DATA = Object.freeze({});
const padNumber = (value, length = 2) => String(value).padStart(length, "0");

const generateInvoiceNo = () => {
  const now = new Date();
  const timestamp = [
    now.getFullYear(),
    padNumber(now.getMonth() + 1),
    padNumber(now.getDate()),
    padNumber(now.getHours()),
    padNumber(now.getMinutes()),
    padNumber(now.getSeconds()),
    padNumber(now.getMilliseconds(), 3),
  ].join("");

  const cryptoSuffix =
    typeof window !== "undefined" &&
    window.crypto &&
    typeof window.crypto.getRandomValues === "function"
      ? String(window.crypto.getRandomValues(new Uint32Array(1))[0] % 1000).padStart(3, "0")
      : String(Math.floor(Math.random() * 1000)).padStart(3, "0");

  return `INV-${timestamp}-${cryptoSuffix}`;
};

const InvoiceForm = ({
  onCancel,
  initialData = EMPTY_INITIAL_DATA,
  bookingId,
  invoiceId,
  onSuccess,
}) => {
  const [invoiceNo] = useState(initialData.invoiceNo || generateInvoiceNo());

  const [form, setForm] = useState({
    invoiceNo,
    date: todayISO(),
    customerName: "",
    phone: "",
    roomNo: "",
    checkIn: todayISO(),
    checkOut: todayISO(),
    pricePerDay: "",
    foodCharge: "0",
    extraCharge: "0",
    gst: "18",
    discount: "0",
    paymentMode: "UPI",
    status: "Paid",
    notes: "",
  });

  const [calculated, setCalculated] = useState({
    days: 0,
    roomCharge: 0,
    subtotal: 0,
    gstAmount: 0,
    finalTotal: 0,
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      ...initialData,
      invoiceNo: initialData.invoiceNo || prev.invoiceNo,
    }));
  }, [initialData]);

  useEffect(() => {
    const checkInDate = new Date(form.checkIn);
    const checkOutDate = new Date(form.checkOut);

    const diff = checkOutDate - checkInDate;

    const days = diff > 0 ? Math.ceil(diff / (1000 * 60 * 60 * 24)) : 0;

    const roomCharge = days * Number(form.pricePerDay || 0);
    const subtotal =
      roomCharge +
      Number(form.foodCharge || 0) +
      Number(form.extraCharge || 0);

    const gstAmount = subtotal * (Number(form.gst || 0) / 100);
    const finalTotal = subtotal + gstAmount - Number(form.discount || 0);

    setCalculated({
      days,
      roomCharge,
      subtotal,
      gstAmount,
      finalTotal,
    });
  }, [
    form.checkIn,
    form.checkOut,
    form.pricePerDay,
    form.foodCharge,
    form.extraCharge,
    form.gst,
    form.discount,
  ]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.customerName.trim()) {
      return alert("Customer name required");
    }

    if (calculated.finalTotal <= 0) {
      return alert("Invalid total amount - please enter Price Per Day and dates");
    }

    setLoading(true);

    try {
      const dataToSend = {
        ...form,
        ...calculated,
        amount: calculated.finalTotal,
        bookingId: bookingId || null,
      };

      let savedData;

      if (invoiceId) {
        await API.put(`/invoices/update/${invoiceId}`, dataToSend);
        savedData = { ...dataToSend, id: invoiceId };
      } else {
        const res = await API.post("/invoices/create", dataToSend);
        savedData = { ...dataToSend, id: res.data.id };
      }

      if (onSuccess) {
        onSuccess(savedData);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to save invoice");
    } finally {
      setLoading(false);
    }
  };

  const inputClassName =
    "w-full rounded-xl border border-blue-200 bg-white px-3.5 py-2.5 text-[15px] font-semibold text-slate-900 outline-none transition-all duration-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 sm:px-4 sm:py-2.5 sm:text-base md:text-base";

  const labelClassName =
    "mb-1.5 block text-[13px] font-semibold text-slate-600 sm:mb-2 sm:text-[14px] md:text-base";

  return (
    <div className="bg-gradient-to-b from-white to-blue-50/30 px-3.5 py-4 sm:px-5 sm:py-5 md:px-6 md:py-6">
      <form onSubmit={handleSubmit}>
        {/* Header Section */}
        <div className="mb-4 rounded-[20px] border border-blue-100 bg-gradient-to-r from-blue-50 to-sky-50 px-4 py-3.5 shadow-sm sm:mb-5 sm:rounded-[24px] sm:px-5 sm:py-4 md:mb-6 md:rounded-[24px] md:px-6 md:py-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="text-center sm:text-left">
              <p className="text-[13px] font-semibold uppercase tracking-[0.2em] text-blue-800 sm:text-[15px] sm:tracking-[0.24em]">
                Invoice Form
              </p>
              <h2 className="mt-1 text-[1.5rem] font-black text-slate-900 sm:text-[2rem] md:text-[2.25rem] lg:text-[2.45rem]">
                {invoiceId ? "Edit Invoice" : "Generate Invoice"}
              </h2>
              <p className="mt-1 text-[14px] font-semibold text-slate-500 sm:text-[15px] md:text-[18px]">
                Fill guest, stay, and billing details. Final total updates automatically.
              </p>
            </div>

            <div className="mx-auto sm:mx-0 rounded-[16px] border border-blue-200 bg-white px-4 py-2.5 sm:min-w-[200px] sm:rounded-[18px] sm:px-5 md:min-w-[220px]">
              <div className="text-[13px] font-semibold uppercase tracking-[0.2em] text-blue-800 sm:text-[15px]">
                Invoice No
              </div>
              <div className="mt-1.5 text-[16px] font-bold text-slate-900 sm:text-[18px]">{form.invoiceNo}</div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-4 md:gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
          {/* Left Column - Form Fields */}
          <div className="space-y-4">
            {/* Basic Details */}
            <div className="rounded-[20px] border border-blue-100 bg-white p-4 shadow-[0_12px_30px_rgba(30,64,175,0.06)] sm:rounded-[22px] sm:p-5 md:rounded-[22px] md:p-5">
              <div className="mb-3 text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500 sm:text-xs">
                Basic Details
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                <div>
                  <label className={labelClassName}>Invoice No</label>
                  <input
                    className={inputClassName}
                    name="invoiceNo"
                    value={form.invoiceNo}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label className={labelClassName}>Date</label>
                  <input
                    type="date"
                    className={inputClassName}
                    name="date"
                    value={form.date}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label className={labelClassName}>Customer Name</label>
                  <input
                    className={inputClassName}
                    name="customerName"
                    value={form.customerName}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div>
                  <label className={labelClassName}>Phone</label>
                  <input
                    className={inputClassName}
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label className={labelClassName}>Room No</label>
                  <input
                    className={inputClassName}
                    name="roomNo"
                    value={form.roomNo}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label className={labelClassName}>Price Per Day (Rs.)</label>
                  <input
                    type="number"
                    className={inputClassName}
                    name="pricePerDay"
                    value={form.pricePerDay}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            {/* Stay And Charges */}
            <div className="rounded-[20px] border border-blue-100 bg-white p-4 shadow-[0_12px_30px_rgba(30,64,175,0.06)] sm:rounded-[22px] sm:p-5 md:rounded-[22px] md:p-5">
              <div className="mb-3 text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500 sm:text-xs">
                Stay And Charges
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                <div>
                  <label className={labelClassName}>Check In</label>
                  <input
                    type="date"
                    className={inputClassName}
                    name="checkIn"
                    value={form.checkIn}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label className={labelClassName}>Check Out</label>
                  <input
                    type="date"
                    className={inputClassName}
                    name="checkOut"
                    value={form.checkOut}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label className={labelClassName}>Food Charge (Rs.)</label>
                  <input
                    type="number"
                    className={inputClassName}
                    name="foodCharge"
                    value={form.foodCharge}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label className={labelClassName}>Extra Charge (Rs.)</label>
                  <input
                    type="number"
                    className={inputClassName}
                    name="extraCharge"
                    value={form.extraCharge}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label className={labelClassName}>GST %</label>
                  <input
                    type="number"
                    className={inputClassName}
                    name="gst"
                    value={form.gst}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label className={labelClassName}>Discount (Rs.)</label>
                  <input
                    type="number"
                    className={inputClassName}
                    name="discount"
                    value={form.discount}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            {/* Payment And Notes */}
            <div className="rounded-[20px] border border-blue-100 bg-white p-4 shadow-[0_12px_30px_rgba(30,64,175,0.06)] sm:rounded-[22px] sm:p-5 md:rounded-[22px] md:p-5">
              <div className="mb-3 text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500 sm:text-xs">
                Payment And Notes
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className={labelClassName}>Payment Mode</label>
                  <select
                    name="paymentMode"
                    value={form.paymentMode}
                    onChange={handleChange}
                    className={inputClassName}
                  >
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                    <option value="UPI">UPI</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>

                <div>
                  <label className={labelClassName}>Status</label>
                  <select
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                    className={inputClassName}
                  >
                    <option value="Paid">Paid</option>
                    <option value="Pending">Pending</option>
                    <option value="Partially Paid">Partially Paid</option>
                  </select>
                </div>
              </div>

              <div className="mt-3">
                <label className={labelClassName}>Notes</label>
                <textarea
                  className="min-h-[72px] w-full rounded-xl border border-blue-200 bg-white px-3.5 py-2.5 text-[15px] font-semibold text-slate-900 outline-none transition-all duration-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 sm:min-h-[80px] sm:px-4"
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Optional notes for the invoice"
                />
              </div>
            </div>
          </div>

          {/* Right Column - Summary */}
          <div className="mt-4 space-y-4 md:mt-0">
            <div className="rounded-[20px] border border-blue-100 bg-gradient-to-br from-blue-50 to-sky-50 p-4 shadow-[0_14px_36px_rgba(30,64,175,0.05)] sm:rounded-[22px] sm:p-5 md:rounded-[22px] md:p-5">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-blue-800 sm:text-xs">
                Invoice Summary
              </div>
              <div className="mt-3 space-y-2 sm:space-y-2.5">
                <div className="flex items-center justify-between gap-3 rounded-[12px] bg-white/70 px-3 py-2">
                  <span className="text-[14px] font-semibold text-slate-600 sm:text-[15px]">Total Days</span>
                  <span className="text-[14px] font-semibold text-slate-900 sm:text-[15px]">{String(calculated.days)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-[12px] bg-white/70 px-3 py-2">
                  <span className="text-[14px] font-semibold text-slate-600 sm:text-[15px]">Room Charge</span>
                  <span className="text-[14px] font-semibold text-blue-900 sm:text-[15px]">Rs. {calculated.roomCharge.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-[12px] bg-white/70 px-3 py-2">
                  <span className="text-[14px] font-semibold text-slate-600 sm:text-[15px]">Subtotal</span>
                  <span className="text-[14px] font-semibold text-blue-900 sm:text-[15px]">Rs. {calculated.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-[12px] bg-white/70 px-3 py-2">
                  <span className="text-[14px] font-semibold text-slate-600 sm:text-[15px]">GST ({form.gst}%)</span>
                  <span className="text-[14px] font-semibold text-blue-900 sm:text-[15px]">Rs. {calculated.gstAmount.toFixed(2)}</span>
                </div>
                {Number(form.discount) > 0 ? (
                  <div className="flex items-center justify-between gap-3 rounded-[12px] bg-white/70 px-3 py-2">
                    <span className="text-[14px] font-semibold text-slate-600 sm:text-[15px]">Discount</span>
                    <span className="text-[14px] font-semibold text-sky-700 sm:text-[15px]">- Rs. {Number(form.discount).toFixed(2)}</span>
                  </div>
                ) : null}
              </div>

              <div className="mt-4 rounded-[16px] border border-blue-200 bg-white px-4 py-3 sm:rounded-[18px] sm:px-5 sm:py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[15px] font-semibold text-slate-900 sm:text-[16px]">Final Total</span>
                  <span className="text-[1.5rem] font-black text-blue-900 sm:text-[1.6rem] md:text-[1.8rem]">
                    Rs. {calculated.finalTotal.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-[20px] border border-blue-100 bg-white/90 p-4 shadow-[0_12px_30px_rgba(30,64,175,0.05)] sm:rounded-[22px] sm:p-5 md:rounded-[22px] md:p-5">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500 sm:text-xs">
                Quick Info
              </div>
              <div className="mt-3 space-y-2.5 text-[14px] font-semibold text-slate-600 sm:text-[15px]">
                <div className="flex items-center justify-between gap-3">
                  <span>Payment Mode</span>
                  <span className="font-semibold text-slate-900">{form.paymentMode}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Status</span>
                  <span className={`font-semibold ${
                    form.status === "Paid"
                      ? "text-emerald-600"
                      : form.status === "Pending"
                      ? "text-amber-600"
                      : "text-sky-600"
                  }`}>{form.status}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Customer</span>
                  <span className="font-semibold text-slate-900">{form.customerName || "--"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-4 flex flex-col-reverse gap-2.5 border-t border-blue-100 pt-4 sm:mt-5 sm:flex-row sm:justify-end sm:gap-3 sm:border-t md:mt-6 md:pt-5">
          <button
            type="button"
            className="w-full rounded-xl border border-blue-200 bg-white px-5 py-2.5 text-[14px] font-semibold text-slate-700 transition-all duration-200 hover:bg-blue-50 active:scale-[0.98] sm:w-auto sm:text-[15px] md:text-base"
            onClick={onCancel}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="w-full rounded-xl bg-gradient-to-r from-blue-700 to-sky-500 px-5 py-2.5 text-[14px] font-semibold text-white shadow-[0_8px_25px_rgba(30,64,175,0.25)] transition-all duration-200 hover:from-blue-800 hover:to-sky-600 hover:shadow-[0_12px_30px_rgba(30,64,175,0.3)] active:scale-[0.98] disabled:opacity-60 sm:w-auto sm:text-[15px] md:text-base md:px-5 md:py-2.5"
            disabled={loading}
          >
            {loading ? "Saving..." : invoiceId ? "Update Invoice" : "Generate Invoice"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default InvoiceForm;
