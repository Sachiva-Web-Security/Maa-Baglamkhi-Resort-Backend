import React, { useState } from "react";
import { FaExclamationTriangle, FaTimes } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

import API from "../../api";
import { clearBookingSession } from "./bookingSession";

const fieldCls =
  "w-full rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-rose-400 focus:ring-4 focus:ring-rose-100";

const BookingCancelAction = ({
  bookingId,
  bookingCode,
  buttonClassName = "",
  fullWidth = false,
}) => {
  const navigate = useNavigate();
  const [modal, setModal] = useState({ open: false, reason: "", submitting: false, error: "" });

  const activeRef = bookingCode || bookingId;

  const closeModal = () => {
    if (modal.submitting) return;
    setModal({ open: false, reason: "", submitting: false, error: "" });
  };

  const handleConfirm = async () => {
    const reason = String(modal.reason || "").trim();

    if (bookingId) {
      if (!reason) {
        setModal((current) => ({
          ...current,
          error: "Cancellation reason dalna zaroori hai.",
        }));
        return;
      }

      try {
        setModal((current) => ({ ...current, submitting: true, error: "" }));
        await API.put(`/hotel/cancel/${bookingId}`, { reason });
        clearBookingSession();
        closeModal();
        navigate("/hotel/all-bookings");
        return;
      } catch (error) {
        setModal((current) => ({
          ...current,
          submitting: false,
          error: error.response?.data?.message || "Booking could not be cancelled.",
        }));
        return;
      }
    }

    clearBookingSession();
    closeModal();
    navigate("/hotel/all-bookings");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setModal({ open: true, reason: "", submitting: false, error: "" })}
        className={`${fullWidth ? "w-full" : ""} inline-flex items-center justify-center gap-2 rounded-[22px] border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-bold text-rose-700 transition hover:bg-rose-100 ${buttonClassName}`.trim()}
      >
        {bookingId ? "Cancel Booking" : "Discard Booking"}
      </button>

      {modal.open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-[28px] bg-white shadow-[0_28px_80px_rgba(15,23,42,0.28)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-4 bg-gradient-to-r from-rose-500 to-red-500 px-6 py-5 text-white">
              <div className="rounded-2xl bg-white/15 p-3">
                <FaExclamationTriangle className="text-xl" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-2 inline-flex rounded-full bg-rose-50 px-3 py-1 text-[17px] font-bold uppercase tracking-[0.22em] text-rose-700 ring-1 ring-rose-100">
                  {bookingId ? "Cancel Booking" : "Discard Draft"}
                </div>
                <h2 className="text-lg font-black leading-tight">
                {bookingId ? "Guest isn't interested at this time?" : "Do you want to discard this booking draft?"}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full p-2 text-white/85 transition hover:bg-white/10 hover:text-white"
              >
                <FaTimes />
              </button>
            </div>

            <div className="px-6 py-6">
              <p className="text-sm leading-6 text-slate-600">
                {bookingId
                  ? `Booking #${activeRef} cancel hogi, room release hoga, aur flow active bookings se hat jayega.`
                  : "Unsaved booking draft clear ho jayega aur aap All Bookings page par wapas chale jaoge."}
              </p>

              {bookingId ? (
                <label className="mt-4 block">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Cancellation Reason
                  </span>
                  <textarea
                    value={modal.reason}
                    onChange={(event) =>
                      setModal((current) => ({
                        ...current,
                        reason: event.target.value,
                        error: "",
                      }))
                    }
                    rows={4}
                    placeholder="Guest changed mind, wrong date, pricing issue..."
                    className={fieldCls}
                  />
                </label>
              ) : null}

              {modal.error ? (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                  {modal.error}
                </div>
              ) : null}

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={modal.submitting}
                  className={`inline-flex items-center justify-center rounded-2xl bg-rose-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-rose-700 ${
                    modal.submitting ? "cursor-not-allowed opacity-70" : ""
                  }`}
                >
                  {modal.submitting
                    ? bookingId
                      ? "Cancelling..."
                      : "Discarding..."
                    : bookingId
                      ? "Confirm Cancel"
                      : "Discard Booking"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default BookingCancelAction;
