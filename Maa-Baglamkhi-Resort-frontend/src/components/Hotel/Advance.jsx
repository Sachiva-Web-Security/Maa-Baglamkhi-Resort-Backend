import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import API from "../../api";
import BookingCancelAction from "./BookingCancelAction";
import {
  getBookingDraft,
  getStoredBookingCode,
  getStoredBookingId,
  setBookingDraft,
  setStoredBookingId,
} from "./bookingSession";

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

const PAYMENT_MODES = ["Cash", "Card", "UPI", "Bank Transfer", "Mixed"];

const fieldCls =
  "w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3.5 text-lg font-semibold text-slate-900 outline-none transition placeholder:text-base placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100";

const panelCls =
  "rounded-[28px] border border-slate-200/70 bg-white/90 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur";

const Advance = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const bookingId = location.state?.bookingId || getStoredBookingId();
  const bookingCode = location.state?.bookingCode || getStoredBookingCode();
  const bookingRef = bookingCode || bookingId;
  const rows = location.state?.rows || getBookingDraft("roomTariff")?.rows || [];
  const savedAdvance = getBookingDraft("advance") || {};
  const paxDraft = getBookingDraft("pax") || {};
  const guestDraft = getBookingDraft("guest") || {};

  const [paidAmount, setPaidAmount] = useState(savedAdvance.paidAmount || "");
  const [discountAmount] = useState(savedAdvance.discountAmount || 0);
  const [paymentMode, setPaymentMode] = useState(savedAdvance.paymentMode || "Cash");
  const [notes, setNotes] = useState(savedAdvance.notes || "");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (bookingId) {
      setStoredBookingId(bookingId);
    }
  }, [bookingId]);

  const roomSummary = useMemo(
    () =>
      rows.map((row) => {
        const base = Number(row.price || 0) * Number(row.quantity || 0);
        const gstAmount = (base * Number(row.gst || 0)) / 100;
        const total = base + gstAmount;

        return {
          ...row,
          base,
          gstAmount,
          total,
        };
      }),
    [rows],
  );

  const totalAmount = useMemo(
    () => roomSummary.reduce((sum, row) => sum + row.total, 0),
    [roomSummary],
  );

  const enteredPaidAmount = Number(paidAmount || 0);
  const enteredDiscountAmount = Number(discountAmount || 0);
  const remainingAmount = Math.max(totalAmount - enteredPaidAmount - enteredDiscountAmount, 0);
  const isOverPayment = enteredPaidAmount > totalAmount;
  const isOverAllocation = enteredPaidAmount + enteredDiscountAmount > totalAmount;

  const totalGuests = Object.values(paxDraft.paxData || {}).reduce(
    (sum, row) => sum + Number(row.adults || 0) + Number(row.children || 0),
    0,
  );

  useEffect(() => {
    setBookingDraft("advance", {
      totalAmount,
      paidAmount: enteredPaidAmount,
      discountAmount,
      remainingAmount,
      paymentMode,
      notes,
    });
  }, [discountAmount, enteredPaidAmount, notes, paymentMode, remainingAmount, totalAmount]);

  const handleProceed = async () => {
    if (!bookingId) {
      alert("Booking ID is missing.");
      return;
    }

    if (enteredPaidAmount < 0) {
      setErrorMessage("Paid amount cannot be negative.");
      return;
    }

    if (isOverPayment) {
      setErrorMessage(
        `Paid amount cannot be greater than the total amount. Maximum allowed is ${formatCurrency(totalAmount)}.`,
      );
      return;
    }

    if (isOverAllocation) {
      setErrorMessage("Payment plus discount cannot be greater than the total amount.");
      return;
    }

    if (enteredPaidAmount <= 0 && enteredDiscountAmount <= 0) {
      setErrorMessage("Enter at least one valid amount for payment or discount.");
      return;
    }

    setErrorMessage("");

    try {
      await API.post(`/hotel/advance/${bookingId}`, {
        amount: enteredPaidAmount,
        discount: enteredDiscountAmount,
        totalAmount,
        paidAmount: enteredPaidAmount,
        discountAmount: enteredDiscountAmount,
        remainingAmount,
        paymentMode,
        remarks: notes,
        notes,
      });

      navigate("/hotel/communication", {
        state: {
          bookingId,
          bookingCode,
          totalAmount,
          paidAmount: enteredPaidAmount,
          discountAmount: enteredDiscountAmount,
          remainingAmount,
          rooms: roomSummary,
        },
      });
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || "Unable to save advance payment.");
    }
  };

  return (
    <div className="min-h-screen w-full bg-[linear-gradient(135deg,#f8fbff_0%,#fdfbf6_100%)] p-4 sm:p-6">
      <div className="w-full space-y-6">
        <section className="overflow-hidden rounded-[28px] border border-white/70 bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_58%,#0f766e_100%)] px-6 py-7 text-white shadow-[0_22px_60px_rgba(15,23,42,0.22)]">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-100/80">
                Advance Payment
              </p>
              <h1 className="mt-3 text-4xl font-black leading-tight sm:text-5xl">
                Collect and review the booking advance
              </h1>
              <p className="mt-3 max-w-2xl text-lg leading-8 text-white/85 sm:text-xl">
                Review the room-wise totals, collect the advance, and move to the
                communication step with a clear payment summary.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <div className="rounded-[22px] border border-white/15 bg-white/10 p-4 backdrop-blur">
                <div className="text-sm uppercase tracking-[0.22em] text-sky-100/80">
                  Booking ID
                </div>
                <div className="mt-2 text-3xl font-black">{bookingRef || "Pending"}</div>
              </div>

              <div className="rounded-[22px] border border-white/15 bg-white/10 p-4 backdrop-blur">
                <div className="text-sm uppercase tracking-[0.22em] text-sky-100/80">
                  Guests
                </div>
                <div className="mt-2 text-3xl font-black">{totalGuests || 0}</div>
              </div>

              <div className="rounded-[22px] border border-white/15 bg-white/10 p-4 backdrop-blur">
                <div className="text-sm uppercase tracking-[0.22em] text-sky-100/80">
                  Rooms
                </div>
                <div className="mt-2 text-3xl font-black">{roomSummary.length}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(390px,0.75fr)]">
          <div className={panelCls}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[15px] font-semibold uppercase tracking-[0.28em] text-sky-700">
                  Billing Breakdown
                </p>
                <h2 className="mt-2 text-[36px] font-black text-slate-900">
                  Booking amount summary
                </h2>
                <p className="mt-2 max-w-3xl text-lg leading-8 text-slate-600">
                  Check each room tariff, quantity, GST, and final amount before
                  collecting advance payment.
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate("/hotel/room-tariff")}
                className="rounded-full border border-slate-200 bg-slate-50 px-5 py-3 text-base font-bold text-slate-700 transition hover:bg-slate-100"
              >
                Edit Tariff
              </button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Booking Ref
                </p>
                <p className="mt-2 text-2xl font-black text-slate-900">
                  {bookingRef || "Pending"}
                </p>
              </div>

              <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Guest
                </p>
                <p className="mt-2 text-2xl font-black text-slate-900">
                  {guestDraft.guestName || guestDraft.guest_name || "Walk-in Guest"}
                </p>
              </div>

              <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Payment Status
                </p>
                <p className="mt-2 text-2xl font-black text-emerald-700">
                  {enteredPaidAmount > 0 ? "Advance entered" : "Awaiting advance"}
                </p>
              </div>
            </div>

            {roomSummary.length ? (
              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full overflow-hidden rounded-[22px] border border-slate-200">
                  <thead className="bg-slate-100 text-left text-base font-bold text-slate-700">
                    <tr>
                      <th className="px-5 py-4">Room</th>
                      <th className="px-5 py-4">Type</th>
                      <th className="px-5 py-4">Qty</th>
                      <th className="px-5 py-4">Tariff</th>
                      <th className="px-5 py-4">GST</th>
                      <th className="px-5 py-4">Total</th>
                    </tr>
                  </thead>

                  <tbody>
                    {roomSummary.map((row, index) => (
                      <tr
                        key={`${row.roomNo || row.name}-${index}`}
                        className="border-t border-slate-200 bg-white"
                      >
                        <td className="px-5 py-4 text-xl font-black text-slate-900">
                          {row.roomNo || row.name}
                        </td>
                        <td className="px-5 py-4 text-lg font-semibold text-slate-600">
                          {row.roomType || "-"}
                        </td>
                        <td className="px-5 py-4 text-lg font-semibold text-slate-600">
                          {row.quantity}
                        </td>
                        <td className="px-5 py-4 text-lg font-semibold text-slate-600">
                          {formatCurrency(row.price)}
                        </td>
                        <td className="px-5 py-4 text-lg font-semibold text-slate-600">
                          {row.gst}%
                        </td>
                        <td className="px-5 py-4 text-xl font-black text-emerald-700">
                          {formatCurrency(row.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-6 rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-5 py-12 text-center text-base font-semibold text-slate-500">
                No room tariff data is available yet.
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className={panelCls}>
              <p className="text-[15px] font-semibold uppercase tracking-[0.28em] text-emerald-600">
                Payment Collection
              </p>
              <h2 className="mt-2 text-[36px] font-black text-slate-900">
                Receive advance payment
              </h2>
              <p className="mt-2 text-lg leading-8 text-slate-600">
                Enter the received amount, choose the payment mode, and save notes
                for the front desk team.
              </p>

              <div className="mt-6 grid gap-5">
                {errorMessage ? (
                  <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                    {errorMessage}
                  </div>
                ) : null}

                <div className="rounded-[22px] bg-slate-50 p-5">
                  <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Guest
                  </div>
                <div className="mt-2 text-2xl font-black text-slate-900">
                    {guestDraft.guestName || guestDraft.guest_name || "Walk-in Guest"}
                  </div>
                  <div className="mt-2 text-base text-slate-500">
                    {guestDraft.mobile || "No mobile"} | {guestDraft.city || "No city"}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[22px] bg-blue-50 p-5">
                    <div className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
                      Total
                    </div>
                    <div className="mt-3 text-[34px] font-black leading-none text-blue-900">
                      {formatCurrency(totalAmount)}
                    </div>
                  </div>

                  <div className="rounded-[22px] bg-emerald-50 p-5">
                    <div className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
                      Received
                    </div>
                    <div className="mt-3 text-[34px] font-black leading-none text-emerald-900">
                      {formatCurrency(enteredPaidAmount)}
                    </div>
                  </div>

                  <div className="rounded-[22px] bg-amber-50 p-5">
                    <div className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
                      Balance
                    </div>
                    <div className="mt-3 text-[34px] font-black leading-none text-amber-900">
                      {formatCurrency(remainingAmount)}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-base font-semibold text-slate-700">
                      Paid Amount
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={totalAmount}
                      value={paidAmount}
                      onChange={(event) => setPaidAmount(event.target.value)}
                      placeholder="Enter received amount"
                      className={fieldCls}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-base font-semibold text-slate-700">
                      Payment Mode
                    </label>
                    <select
                      value={paymentMode}
                      onChange={(event) => setPaymentMode(event.target.value)}
                      className={fieldCls}
                    >
                      {PAYMENT_MODES.map((mode) => (
                        <option key={mode} value={mode}>
                          {mode}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                        Discount
                      </p>
                      <p className="mt-2 text-lg font-black text-slate-900">
                        {formatCurrency(enteredDiscountAmount)}
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-500 shadow-sm">
                      Fixed for this step
                    </span>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Notes
                  </label>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    rows={4}
                    placeholder="Payment reference, remarks, or partial advance reason"
                    className={`${fieldCls} min-h-[132px] resize-none`}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200/70 bg-[linear-gradient(135deg,#f8fdff_0%,#eff8ff_100%)] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
              <p className="text-[13px] font-semibold uppercase tracking-[0.28em] text-sky-700">
                Next Step
              </p>
              <h3 className="mt-2 text-[28px] font-black text-slate-900">
                Communication preview
              </h3>
              <p className="mt-3 text-base leading-7 text-slate-600">
                After saving the advance, the final amount, received amount, and
                remaining balance will appear on the communication page for final
                review.
              </p>

              <div className="mt-5 grid gap-3">
                <div className="rounded-[20px] border border-sky-100 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-700">
                  Final total:{" "}
                  <span className="font-black text-slate-900">
                    {formatCurrency(totalAmount)}
                  </span>
                </div>
                <div className="rounded-[20px] border border-sky-100 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-700">
                  Ready to carry forward:{" "}
                  <span className="font-black text-slate-900">
                    {paymentMode} payment with {formatCurrency(enteredPaidAmount)} received
                  </span>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => navigate("/hotel/room-tariff")}
                  className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 sm:flex-1"
                >
                  Go Back
                </button>
                <BookingCancelAction
                  bookingId={bookingId}
                  bookingCode={bookingCode}
                  buttonClassName="rounded-full sm:flex-1"
                />
                <button
                  type="button"
                  onClick={handleProceed}
                  className="rounded-full bg-gradient-to-r from-sky-600 to-blue-500 px-6 py-3 text-sm font-bold text-white shadow-[0_12px_30px_rgba(37,99,235,0.24)] transition hover:-translate-y-0.5 sm:flex-1"
                >
                  Save Advance & Continue
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Advance;
