import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import API from "../../api";

const PAYMENT_MODES = ["Cash", "Card", "UPI", "Bank Transfer"];

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const CollectPayment = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const { bookingId, remainingAmount } = location.state || {};

  if (!bookingId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[linear-gradient(135deg,#f8fbff_0%,#f7fff9_52%,#fff8ef_100%)] p-6">
        <div className="w-full max-w-md rounded-[28px] border border-white/70 bg-white/90 p-8 text-center shadow-[0_24px_70px_rgba(15,23,42,0.16)] backdrop-blur">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 text-2xl font-black text-rose-600">
            !
          </div>
          <h2 className="mt-5 text-2xl font-black text-slate-900">Invalid Access</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Payment screen direct open hua hai. Booking list se dobara open kijiye.
          </p>
          <button
            onClick={() => navigate("/hotel/all-bookings")}
            className="mt-6 rounded-full bg-slate-950 px-6 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const [amount, setAmount] = useState("");
  const [discount, setDiscount] = useState("");
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [loading, setLoading] = useState(false);

  const safeRemaining = Number(remainingAmount || 0);
  const enteredAmount = Number(amount || 0);
  const enteredDiscount = Number(discount || 0);
  const safeDiscount = Math.min(Math.max(enteredDiscount, 0), safeRemaining);
  const newRemaining = Math.max(safeRemaining - enteredAmount - safeDiscount, 0);

  const handleApplyDiscount = () => {
    if (enteredDiscount < 0) {
      alert("Discount cannot be negative");
      return;
    }

    setDiscount(String(Math.min(enteredDiscount || 0, safeRemaining)));
  };

  const handleSubmit = async () => {
    if (enteredAmount <= 0 && safeDiscount <= 0) {
      alert("Payment ya discount me se kuch valid enter karo");
      return;
    }

    if (enteredAmount + safeDiscount > safeRemaining) {
      alert("Payment + discount cannot exceed remaining balance");
      return;
    }

    try {
      setLoading(true);

      await API.post(`/hotel/advance/${bookingId}`, {
        amount: enteredAmount,
        discount: safeDiscount,
        paymentMode,
      });

      alert("Payment/discount saved successfully");
      navigate("/hotel/all-bookings");
    } catch (err) {
      console.error(err);
      alert(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Payment failed",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.14),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.12),_transparent_25%),linear-gradient(135deg,#f8fbff_0%,#f7fff9_52%,#fff8ef_100%)] p-4 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="overflow-hidden rounded-[34px] border border-white/70 bg-white/88 shadow-[0_28px_80px_rgba(15,23,42,0.14)] backdrop-blur">
          <div className="bg-[linear-gradient(135deg,#020617_0%,#1d4ed8_50%,#0f766e_100%)] px-6 py-7 text-white sm:px-8">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)] lg:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200">
                  Payment Desk
                </p>
                <h1 className="mt-3 text-3xl font-black sm:text-4xl">
                  Collect booking payment with discount
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-100/85">
                  Front desk ke liye ek clean payment panel jahan remaining balance,
                  discount aur final payable amount live update hota rahe.
                </p>
              </div>

              <div className="rounded-[26px] border border-white/15 bg-white/10 p-5 backdrop-blur">
                <div className="text-xs uppercase tracking-[0.24em] text-cyan-100/75">
                  Booking Reference
                </div>
                <div className="mt-2 text-3xl font-black">#{bookingId}</div>
                <div className="mt-2 text-sm text-slate-100/80">
                  Ready to receive payment
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-[24px] border border-blue-100 bg-[linear-gradient(135deg,#eef5ff_0%,#f8fbff_100%)] p-5 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-600">
                  Remaining
                </div>
                <div className="mt-2 text-3xl font-black text-blue-950">
                  {formatCurrency(safeRemaining)}
                </div>
                <p className="mt-2 text-sm text-blue-700/75">Current open balance</p>
              </div>

              <div className="rounded-[24px] border border-amber-100 bg-[linear-gradient(135deg,#fff8e6_0%,#fffdf6_100%)] p-5 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-700">
                  Discount
                </div>
                <div className="mt-2 text-3xl font-black text-amber-900">
                  {formatCurrency(safeDiscount)}
                </div>
                <p className="mt-2 text-sm text-amber-700/75">Applied concession value</p>
              </div>

              <div className="rounded-[24px] border border-emerald-100 bg-[linear-gradient(135deg,#ecfdf5_0%,#f7fffb_100%)] p-5 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">
                  After Payment
                </div>
                <div className="mt-2 text-3xl font-black text-emerald-900">
                  {formatCurrency(newRemaining)}
                </div>
                <p className="mt-2 text-sm text-emerald-700/75">Balance after this action</p>
              </div>
            </div>

            <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(240px,0.8fr)]">
              <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-5 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-700">
                  Payment Form
                </p>
                <h2 className="mt-2 text-2xl font-black text-slate-900">
                  Enter amount and discount
                </h2>

                <div className="mt-6 space-y-5">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Enter Amount
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="Enter payment amount"
                      className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-4 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Discount Amount
                    </label>
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
                      <input
                        type="number"
                        min="0"
                        max={safeRemaining}
                        value={discount}
                        onChange={(e) => setDiscount(e.target.value)}
                        placeholder="Enter discount amount"
                        className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-4 text-slate-900 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                      />
                      <button
                        type="button"
                        onClick={handleApplyDiscount}
                        className="rounded-[20px] bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-4 text-sm font-bold text-white shadow-[0_12px_30px_rgba(251,146,60,0.26)] transition hover:-translate-y-0.5 hover:from-amber-500 hover:to-orange-500"
                      >
                        Apply Discount
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Payment Mode
                    </label>
                    <select
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value)}
                      className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-4 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                    >
                      {PAYMENT_MODES.map((mode) => (
                        <option key={mode}>{mode}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_100%)] p-5 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-violet-600">
                  Payment Snapshot
                </p>
                <h3 className="mt-2 text-2xl font-black text-slate-900">
                  Quick summary
                </h3>

                <div className="mt-5 space-y-3">
                  <div className="rounded-[20px] bg-slate-950 p-4 text-white">
                    <div className="text-xs uppercase tracking-[0.2em] text-white/60">
                      Receive Now
                    </div>
                    <div className="mt-2 text-2xl font-black">
                      {formatCurrency(enteredAmount)}
                    </div>
                  </div>

                  <div className="rounded-[20px] bg-slate-100 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Selected Mode
                    </div>
                    <div className="mt-2 text-xl font-black text-slate-900">
                      {paymentMode}
                    </div>
                  </div>

                  <div className="rounded-[20px] bg-slate-100 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Discount Applied
                    </div>
                    <div className="mt-2 text-xl font-black text-slate-900">
                      {formatCurrency(safeDiscount)}
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-3">
                  <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="rounded-full bg-gradient-to-r from-emerald-600 to-teal-500 px-5 py-3.5 text-sm font-bold text-white shadow-[0_14px_35px_rgba(16,185,129,0.24)] transition hover:-translate-y-0.5 hover:from-emerald-700 hover:to-teal-600 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {loading ? "Processing..." : "Receive Payment"}
                  </button>

                  <button
                    onClick={() => navigate("/hotel/all-bookings")}
                    className="rounded-full border border-slate-200 bg-slate-100 px-5 py-3.5 text-sm font-bold text-slate-700 transition hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CollectPayment;
