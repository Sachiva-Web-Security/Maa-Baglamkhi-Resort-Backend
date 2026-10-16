/**
 * GroupBooking.jsx
 * Multi-room group booking — one master guest, multiple rooms, single payment.
 *
 * Flow:
 *   1. Enter master guest details + dates
 *   2. Pick multiple rooms from inventory
 *   3. Set tariff/GST per room
 *   4. Enter advance payment
 *   5. Confirm → creates booking with all rooms linked
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { FaExclamationTriangle, FaTimes } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import API from "../../api";
import {
  clearBookingSession,
  setStoredBookingCode,
  setStoredBookingId,
} from "./bookingSession";

const formatCurrency = (v) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(v) || 0);

const today = () => new Date().toISOString().slice(0, 10);
const formatStayDate = (value) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const STEPS = ["Guest", "Rooms", "Tariff", "Payment", "Confirm"];
const PAYMENT_MODES = ["Cash", "UPI", "Card", "Bank Transfer"];
const GST_RATES = [0, 5, 12, 18];
const UNAVAILABLE_ROOM_STATUSES = new Set([
  "occupied",
  "booked",
  "blocked",
  "out of service",
]);
const defaultGuestState = () => ({
  guestName: "",
  mobile: "",
  guestEmail: "",
  checkIn: today(),
  checkOut: today(),
  bookingStatus: "Confirmed",
  groupLabel: "",
});
const defaultPaymentState = () => ({
  amount: "",
  discount: "",
  paymentMode: "Cash",
  remarks: "",
});

const inputCls =
  "w-full rounded-xl border border-slate-200 px-4 py-3 text-lg font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100 xl:text-xl";
const labelCls =
  "mb-1.5 block text-sm font-bold uppercase tracking-[0.16em] text-slate-600 xl:text-base";

const modalToneClasses = {
  error: {
    accent: "from-rose-500 to-red-500",
    badge: "bg-rose-50 text-rose-700 ring-1 ring-rose-100",
    panel: "border-rose-100 bg-rose-50/70",
    label: "text-rose-600",
  },
};

// ─── Step indicator ─────────────────────────────────────────────────────────
const StepBar = ({ current }) => (
  <div className="flex items-center justify-center gap-0">
    {STEPS.map((s, i) => (
      <React.Fragment key={s}>
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-black transition xl:h-10 xl:w-10 xl:text-base ${
            i < current
              ? "bg-emerald-500 text-white"
              : i === current
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-400"
          }`}
        >
          {i < current ? "✓" : i + 1}
        </div>
        <div
          className={`mx-1 hidden text-sm font-bold sm:block xl:text-base ${
            i === current ? "text-slate-900" : "text-slate-400"
          }`}
        >
          {s}
        </div>
        {i < STEPS.length - 1 && (
          <div
            className={`mx-1 h-0.5 w-8 rounded-full ${
              i < current ? "bg-emerald-400" : "bg-slate-200"
            }`}
          />
        )}
      </React.Fragment>
    ))}
  </div>
);

// ─── Main Component ─────────────────────────────────────────────────────────
const GroupBooking = ({ isModal = false, onClose }) => {
  const navigate = useNavigate();
  const feedbackDialogRef = useRef(null);
  const feedbackCloseButtonRef = useRef(null);
  const lastFocusedElementRef = useRef(null);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [resultBooking, setResultBooking] = useState(null);
  const [feedbackModal, setFeedbackModal] = useState({
    open: false,
    type: "error",
    title: "",
    message: "",
  });

  // Step 1 — Guest
  const [guest, setGuest] = useState(defaultGuestState);

  // Step 2 — Room selection
  const [inventory, setInventory] = useState([]);
  const [selectedRooms, setSelectedRooms] = useState([]);

  // Step 3 — Tariff per room
  const [tariffs, setTariffs] = useState([]);

  // Step 4 — Payment
  const [payment, setPayment] = useState(defaultPaymentState);

  useEffect(() => {
    let ignore = false;

    API.get("/hotel/rooms/setup", {
      params: {
        checkIn: guest.checkIn || undefined,
        checkOut: guest.checkOut || undefined,
      },
    })
      .then((res) => {
        if (!ignore) {
          setInventory(Array.isArray(res.data) ? res.data : []);
        }
      })
      .catch((error) => {
        console.error(error);
        if (!ignore) {
          setInventory([]);
        }
      });

    return () => {
      ignore = true;
    };
  }, [guest.checkIn, guest.checkOut]);

  useEffect(() => {
    if (!feedbackModal.open) {
      lastFocusedElementRef.current?.focus?.();
      return undefined;
    }

    lastFocusedElementRef.current = document.activeElement;

    const focusableSelector = [
      "button:not([disabled])",
      "[href]",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "[tabindex]:not([tabindex='-1'])",
    ].join(", ");

    const handleModalKeydown = (event) => {
      if (event.key === "Escape") {
        setFeedbackModal((current) => ({ ...current, open: false }));
        return;
      }

      if (event.key !== "Tab") return;

      const dialogNode = feedbackDialogRef.current;
      if (!dialogNode) return;

      const focusableItems = Array.from(
        dialogNode.querySelectorAll(focusableSelector),
      ).filter((element) => !element.hasAttribute("disabled"));

      if (!focusableItems.length) {
        event.preventDefault();
        dialogNode.focus();
        return;
      }

      const firstItem = focusableItems[0];
      const lastItem = focusableItems[focusableItems.length - 1];

      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };

    feedbackCloseButtonRef.current?.focus();
    window.addEventListener("keydown", handleModalKeydown);
    return () => window.removeEventListener("keydown", handleModalKeydown);
  }, [feedbackModal.open]);

  // When rooms are selected, seed tariff rows
  useEffect(() => {
    setTariffs(
      selectedRooms.map((room) => ({
        roomNumber: room.roomNumber,
        categoryName: room.categoryName,
        tariff: room.defaultPrice || 0,
        gst: 12,
        adults: 1,
        children: 0,
        nights: 1,
      })),
    );
  }, [selectedRooms]);

  // Compute nights from dates
  const nightsFromDates = useMemo(() => {
    if (!guest.checkIn || !guest.checkOut) return 0;
    const diff =
      (new Date(guest.checkOut) - new Date(guest.checkIn)) /
      (1000 * 60 * 60 * 24);
    return Math.max(Math.round(diff), 0);
  }, [guest.checkIn, guest.checkOut]);

  const staySummaryText = useMemo(() => {
    if (!guest.checkIn || !guest.checkOut) return "";

    const checkInLabel = formatStayDate(guest.checkIn);
    const checkOutLabel = formatStayDate(guest.checkOut);

    if (guest.checkIn === guest.checkOut) {
      return `Stay date: ${checkInLabel} (same-day stay)`;
    }

    return `${nightsFromDates} night${nightsFromDates === 1 ? "" : "s"} stay: ${checkInLabel} to ${checkOutLabel}`;
  }, [guest.checkIn, guest.checkOut, nightsFromDates]);

  // Room totals
  const roomTotals = useMemo(
    () =>
      tariffs.map((t) => {
        const nights = Number(t.nights || nightsFromDates);
        const base = Number(t.tariff || 0) * nights;
        const gstAmt = (base * Number(t.gst || 0)) / 100;
        return { ...t, nights, base, gstAmt, total: base + gstAmt };
      }),
    [tariffs, nightsFromDates],
  );

  const grandTotal = useMemo(
    () => roomTotals.reduce((s, r) => s + r.total, 0),
    [roomTotals],
  );

  const paidAmount = Number(payment.amount || 0);
  const discountAmount = Number(payment.discount || 0);
  const remainingAmount = Math.max(grandTotal - paidAmount - discountAmount, 0);

  // Toggle room selection
  const toggleRoom = (room) => {
    setSelectedRooms((prev) => {
      const exists = prev.find((r) => r.roomNumber === room.roomNumber);
      if (exists) return prev.filter((r) => r.roomNumber !== room.roomNumber);
      return [...prev, room];
    });
  };

  const updateTariff = (index, field, value) => {
    setTariffs((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // ─── Validation per step ─────────────────────────────────────────────────
  const canNext = () => {
    if (step === 0) {
      return (
        guest.guestName.trim() &&
        guest.mobile.trim() &&
        guest.checkIn &&
        guest.checkOut &&
        guest.checkIn <= guest.checkOut
      );
    }
    if (step === 1) return selectedRooms.length > 0;
    if (step === 2) return tariffs.every((t) => Number(t.tariff) > 0);
    if (step === 3) return true;
    return true;
  };

  const getStepValidationMessage = () => {
    if (step === 0) {
      if (!guest.guestName.trim()) return "Please enter the master guest name.";
      if (!guest.mobile.trim()) return "Please enter the mobile number.";
      if (!guest.checkIn) return "Please select a check-in date.";
      if (!guest.checkOut) return "Please select a check-out date.";
      if (guest.checkIn > guest.checkOut) return "Check-out date cannot be earlier than check-in date.";
    }
    if (step === 1 && selectedRooms.length === 0) {
      return "Please select at least one room to continue.";
    }
    if (step === 2 && !tariffs.every((t) => Number(t.tariff) > 0)) {
      return "Please enter a valid tariff for every selected room.";
    }
    return "";
  };

  const openFeedbackModal = (type, title, message) => {
    setFeedbackModal({ open: true, type, title, message });
  };

  const closeFeedbackModal = () => {
    setFeedbackModal((current) => ({ ...current, open: false }));
  };

  const handleNextStep = () => {
    if (!canNext()) {
      openFeedbackModal(
        "error",
        "Required details missing",
        getStepValidationMessage() || "Please complete the required details before continuing.",
      );
      return;
    }
    setStep((s) => s + 1);
  };

  const resetGroupBookingForm = () => {
    clearBookingSession();
    setStep(0);
    setGuest(defaultGuestState());
    setSelectedRooms([]);
    setTariffs([]);
    setPayment(defaultPaymentState());
    setResultBooking(null);
  };

  const handleCancelBooking = () => {
    const hasProgress =
      guest.guestName.trim() ||
      guest.mobile.trim() ||
      guest.guestEmail.trim() ||
      guest.groupLabel.trim() ||
      selectedRooms.length > 0 ||
      payment.amount ||
      payment.discount ||
      payment.remarks ||
      step > 0;

    if (
      hasProgress &&
      !window.confirm(
        "Cancel this group booking? All entered details will be cleared.",
      )
    ) {
      return;
    }

    resetGroupBookingForm();
    if (isModal) onClose?.();
    else navigate("/hotel/all-bookings");
  };

  // ─── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSaving(true);
    try {
      const payload = {
        guest: {
          ...guest,
          groupBooking: true,
        },
        rooms: roomTotals.map((r) => ({
          roomNumber: r.roomNumber,
          categoryName: r.categoryName,
          tariff: r.tariff,
          gst: r.gst,
          adults: r.adults,
          children: r.children,
          nights: r.nights,
          total: r.total,
        })),
        payment: {
          amount: paidAmount,
          discount: discountAmount,
          paymentMode: payment.paymentMode,
          remarks: payment.remarks,
          totalAmount: grandTotal,
        },
      };

      const res = await API.post("/hotel/group-booking", payload);
      const bookingId = res.data?.bookingId || res.data?.insertId;
      const bookingCode = res.data?.bookingCode;

      setStoredBookingId(bookingId);
      if (bookingCode) setStoredBookingCode(bookingCode);
      setResultBooking({ bookingId, bookingCode, grandTotal, rooms: selectedRooms });
      setStep(4);
    } catch (err) {
      console.error(err);
      openFeedbackModal(
        "error",
        "Booking creation failed",
        err.response?.data?.error || "Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const modalTone =
    modalToneClasses[feedbackModal.type] || modalToneClasses.error;

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.12),_transparent_30%),linear-gradient(135deg,#f8fbff_0%,#f5f3ff_50%,#fff8ef_100%)] p-4 sm:p-6">
      <div className="w-full space-y-5">
        {feedbackModal.open ? (
          <div
            className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm"
            role="presentation"
            onClick={closeFeedbackModal}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="group-booking-feedback-title"
              aria-describedby="group-booking-feedback-message"
              ref={feedbackDialogRef}
              tabIndex={-1}
              className="w-full max-w-lg overflow-hidden rounded-[32px] border border-white/80 bg-[linear-gradient(180deg,#ffffff_0%,#fff7f8_100%)] shadow-[0_30px_90px_rgba(15,23,42,0.28)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className={`relative flex items-start gap-4 bg-gradient-to-r ${modalTone.accent} px-6 py-6 text-white xl:px-7 xl:py-7`}>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.22),_transparent_48%)]" />
                <div className="relative rounded-[20px] border border-white/20 bg-white/15 p-3 shadow-[0_12px_30px_rgba(255,255,255,0.08)] xl:p-3.5">
                  <FaExclamationTriangle className="text-2xl xl:text-3xl" />
                </div>
                <div className="relative min-w-0 flex-1">
                  <div className={`mb-2 inline-flex rounded-full px-3 py-1 text-sm font-bold uppercase tracking-[0.22em] ${modalTone.badge}`}>
                    Group Booking Notice
                  </div>
                  <h2
                    id="group-booking-feedback-title"
                    className="text-2xl font-black leading-tight xl:text-3xl"
                  >
                    {feedbackModal.title}
                  </h2>
                  <p className="mt-2 max-w-md text-base font-medium leading-7 text-white/85 xl:text-lg">
                    Please review the highlighted step and continue once the required details are completed.
                  </p>
                </div>
                <button
                  type="button"
                  ref={feedbackCloseButtonRef}
                  onClick={closeFeedbackModal}
                  className="relative rounded-full border border-white/15 p-2 text-white/85 transition hover:bg-white/10 hover:text-white"
                  aria-label="Close popup"
                >
                  <FaTimes />
                </button>
              </div>

              <div className="px-6 py-6">
                <div className={`rounded-[22px] border p-4 xl:p-5 ${modalTone.panel}`}>
                  <p className={`text-sm font-bold uppercase tracking-[0.22em] ${modalTone.label}`}>
                    Details
                  </p>
                  <p
                    id="group-booking-feedback-message"
                    className="mt-2 text-lg leading-8 text-slate-700 xl:text-xl"
                  >
                    {feedbackModal.message}
                  </p>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={closeFeedbackModal}
                    className="inline-flex min-w-[160px] items-center justify-center rounded-2xl bg-gradient-to-r from-slate-900 to-slate-700 px-5 py-3 text-base font-bold text-white shadow-[0_14px_30px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 hover:from-slate-800 hover:to-slate-700 xl:text-lg"
                  >
                    Continue Editing
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Header */}
        <section className="overflow-hidden rounded-[32px] border border-white/70 bg-[linear-gradient(135deg,#020617_0%,#4f46e5_48%,#0f766e_100%)] px-6 py-7 text-white shadow-[0_22px_70px_rgba(15,23,42,0.22)]">
          <p className="text-sm font-bold uppercase tracking-[0.32em] text-violet-200 xl:text-base">
            Group Booking
          </p>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl xl:text-5xl">
            Multi-Room Group Reservation
          </h1>
          <p className="mt-3 max-w-2xl text-base font-medium leading-7 text-slate-100/85 xl:text-xl xl:leading-8">
            “Book multiple rooms at once for a master guest — within a single payment flow.”
          </p>
        </section>

        {/* Step Bar */}
        {step < 4 && (
          <div className="rounded-[22px] border border-white/70 bg-white/90 px-5 py-4 shadow-sm backdrop-blur">
            <StepBar current={step} />
          </div>
        )}

        {/* ── Step 0: Guest Details ────────────────────────────────────────── */}
        {step === 0 && (
          <div className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-[0_12px_40px_rgba(15,23,42,0.08)] backdrop-blur">
            <h2 className="mb-5 text-3xl font-black text-slate-900 xl:text-5xl">
              Master Guest Details
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Guest Name *</label>
                <input
                  className={inputCls}
                  placeholder="Full name of group leader"
                  value={guest.guestName}
                  onChange={(e) =>
                    setGuest((p) => ({ ...p, guestName: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className={labelCls}>Mobile *</label>
                <input
                  className={inputCls}
                  placeholder="10 digit mobile"
                  value={guest.mobile}
                  onChange={(e) =>
                    setGuest((p) => ({ ...p, mobile: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input
                  className={inputCls}
                  type="email"
                  placeholder="group@example.com"
                  value={guest.guestEmail}
                  onChange={(e) =>
                    setGuest((p) => ({ ...p, guestEmail: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className={labelCls}>Group / Event Label</label>
                <input
                  className={inputCls}
                  placeholder="Wedding party, Corporate retreat…"
                  value={guest.groupLabel}
                  onChange={(e) =>
                    setGuest((p) => ({ ...p, groupLabel: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className={labelCls}>Check-In *</label>
                <input
                  type="date"
                  className={inputCls}
                  min={today()}
                  value={guest.checkIn}
                  onChange={(e) =>
                    setGuest((p) => ({ ...p, checkIn: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className={labelCls}>Check-Out *</label>
                <input
                  type="date"
                  className={inputCls}
                  min={guest.checkIn || today()}
                  value={guest.checkOut}
                  onChange={(e) =>
                    setGuest((p) => ({ ...p, checkOut: e.target.value }))
                  }
                />
              </div>
            </div>
            {staySummaryText ? (
              <p className="mt-4 rounded-xl bg-sky-50 px-4 py-3 text-base font-bold text-sky-700">
                <span className="hidden xl:block xl:text-base">
                📅 {nightsFromDates} night{nightsFromDates > 1 ? "s" : ""} ka stay
                </span>
                <span className="xl:text-base">{staySummaryText}</span>
              </p>
            ) : null}
          </div>
        )}

        {/* ── Step 1: Room Selection ───────────────────────────────────────── */}
        {step === 1 && (
          <div className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-[0_12px_40px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-3xl font-black text-slate-900">
                <span className="xl:text-4xl">Select Rooms</span>
              </h2>
              <span className="rounded-full bg-indigo-100 px-3 py-1 text-base font-bold text-indigo-700 xl:text-lg">
                {selectedRooms.length} selected
              </span>
            </div>

            <div className="space-y-4">
              {inventory.map((cat) => (
                <div key={cat.id}>
                  <div className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-500 xl:text-base">
                    {cat.name} — ₹{cat.defaultPrice}/night
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(cat.roomDetails || []).map((room) => {
                      const roomNo = room.roomNumber;
                      const isSelected = selectedRooms.some(
                        (r) => r.roomNumber === roomNo,
                      );
                      const normalized = String(room.status || "").trim().toLowerCase();
                      const isOccupied = normalized === "occupied";
                      const isUnavailable = UNAVAILABLE_ROOM_STATUSES.has(normalized);
                      const unavailableLabel =
                        normalized === "blocked" || normalized === "out of service"
                          ? "Blocked"
                          : isOccupied || normalized === "booked"
                          ? "Occupied"
                          : "Unavailable";
                      return (
                        <button
                          key={roomNo}
                          type="button"
                          disabled={isUnavailable}
                          onClick={() => {
                            if (isUnavailable) return;
                            toggleRoom({
                              roomNumber: roomNo,
                              categoryName: cat.name,
                              defaultPrice: cat.defaultPrice,
                            });
                          }}
                          className={`rounded-[14px] border px-4 py-2.5 text-base font-bold transition xl:text-lg ${
                            isSelected
                              ? "border-indigo-400 bg-indigo-600 text-white shadow-[0_4px_12px_rgba(79,70,229,0.3)]"
                              : isUnavailable
                              ? "cursor-not-allowed border-rose-200 bg-rose-50 text-rose-700 opacity-90"
                              : "border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:bg-indigo-50"
                          }`}
                        >
                          <span>{roomNo}</span>
                          {isUnavailable ? (
                            <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-black uppercase tracking-[0.12em] text-rose-700">
                              {unavailableLabel}
                            </span>
                          ) : null}
                          {isSelected && " ✓"}
                        </button>
                      );
                    })}
                    {(!cat.roomDetails || cat.roomDetails.length === 0) && (
                      <span className="text-sm font-medium italic text-slate-400">
                        No rooms in this category
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {selectedRooms.length > 0 && (
              <div className="mt-4 rounded-xl bg-indigo-50 px-4 py-3 text-base font-bold text-indigo-700">
                <span className="xl:text-base">
                Selected: {selectedRooms.map((r) => r.roomNumber).join(", ")}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Tariff per room ──────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="px-1 text-3xl font-black text-slate-900 xl:text-5xl">
              Set Tariff for Each Room
            </h2>
            {tariffs.map((t, i) => (
              <div
                key={t.roomNumber}
                className="rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)] backdrop-blur"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 xl:text-3xl">
                      Room {t.roomNumber}
                    </h3>
                    <p className="text-sm font-semibold text-slate-500 xl:text-base">{t.categoryName}</p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 px-4 py-2 text-right">
                    <div className="text-sm font-bold text-emerald-600">Room Total</div>
                    <div className="text-xl font-black text-emerald-800 xl:text-3xl">
                      {formatCurrency(roomTotals[i]?.total || 0)}
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-4">
                  <div>
                    <label className={labelCls}>Tariff/Night (₹)</label>
                    <input
                      type="number"
                      className={inputCls}
                      value={t.tariff}
                      onChange={(e) => updateTariff(i, "tariff", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Nights</label>
                    <input
                      type="number"
                      className={inputCls}
                      value={t.nights || nightsFromDates}
                      onChange={(e) => updateTariff(i, "nights", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>GST %</label>
                    <select
                      className={inputCls}
                      value={t.gst}
                      onChange={(e) => updateTariff(i, "gst", e.target.value)}
                    >
                      {GST_RATES.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Adults</label>
                    <input
                      type="number"
                      className={inputCls}
                      value={t.adults}
                      onChange={(e) => updateTariff(i, "adults", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}
            <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-right">
              <span className="text-base font-bold text-emerald-700 xl:text-xl">
                Grand Total:
              </span>{" "}
              <span className="text-3xl font-black text-emerald-900 xl:text-5xl">
                {formatCurrency(grandTotal)}
              </span>
            </div>
          </div>
        )}

        {/* ── Step 3: Payment ──────────────────────────────────────────────── */}
        {step === 3 && (
          <div className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-[0_12px_40px_rgba(15,23,42,0.08)] backdrop-blur">
            <h2 className="mb-5 text-3xl font-black text-slate-900 xl:text-5xl">
              Advance Payment
            </h2>

            <div className="mb-5 grid grid-cols-3 gap-3">
              <div className="rounded-[20px] bg-slate-900 p-4 text-white">
                <div className="text-sm font-bold uppercase tracking-wide text-white/70">
                  Total
                </div>
                <div className="mt-2 text-2xl font-black xl:text-4xl">
                  {formatCurrency(grandTotal)}
                </div>
              </div>
              <div className="rounded-[20px] bg-amber-50 p-4">
                <div className="text-sm font-bold uppercase tracking-wide text-amber-600">
                  Discount
                </div>
                <div className="mt-2 text-2xl font-black text-amber-900 xl:text-4xl">
                  {formatCurrency(discountAmount)}
                </div>
              </div>
              <div
                className={`rounded-[20px] p-4 ${
                  remainingAmount > 0 ? "bg-rose-50" : "bg-emerald-50"
                }`}
              >
                <div
                  className={`text-sm font-bold uppercase tracking-wide ${
                    remainingAmount > 0 ? "text-rose-600" : "text-emerald-600"
                  }`}
                >
                  Remaining
                </div>
                <div
                  className={`mt-2 text-2xl font-black xl:text-4xl ${
                    remainingAmount > 0 ? "text-rose-900" : "text-emerald-900"
                  }`}
                >
                  {formatCurrency(remainingAmount)}
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Advance Amount (₹)</label>
                <input
                  type="number"
                  min="0"
                  className={inputCls}
                  placeholder="0"
                  value={payment.amount}
                  onChange={(e) =>
                    setPayment((p) => ({ ...p, amount: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className={labelCls}>Discount (₹)</label>
                <input
                  type="number"
                  min="0"
                  className={inputCls}
                  placeholder="0"
                  value={payment.discount}
                  onChange={(e) =>
                    setPayment((p) => ({ ...p, discount: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className={labelCls}>Payment Mode</label>
                <select
                  className={inputCls}
                  value={payment.paymentMode}
                  onChange={(e) =>
                    setPayment((p) => ({ ...p, paymentMode: e.target.value }))
                  }
                >
                  {PAYMENT_MODES.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Remarks</label>
                <input
                  className={inputCls}
                  placeholder="Optional notes…"
                  value={payment.remarks}
                  onChange={(e) =>
                    setPayment((p) => ({ ...p, remarks: e.target.value }))
                  }
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Step 4: Confirmed ────────────────────────────────────────────── */}
        {step === 4 && resultBooking && (
          <div className="rounded-[32px] border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-8 text-center shadow-[0_22px_60px_rgba(16,185,129,0.12)]">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 text-3xl text-white">
              ✓
            </div>
              <h2 className="mt-5 text-4xl font-black text-emerald-900 xl:text-6xl">
                Group Booking Confirmed!
              </h2>
            <p className="mt-3 text-base font-medium text-slate-600 xl:text-xl">
              Booking #{resultBooking.bookingId} — {selectedRooms.length} room
              {selectedRooms.length > 1 ? "s" : ""} reserved for{" "}
              {guest.guestName}
            </p>
            <p className="mt-1 text-base font-medium text-slate-500 xl:text-lg">
              Total: {formatCurrency(grandTotal)} · Advance: {formatCurrency(paidAmount)}
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() =>
                  isModal
                    ? onClose?.()
                    : navigate("/hotel/communication", {
                        state: { bookingId: resultBooking.bookingId },
                      })
                }
                className="rounded-full bg-emerald-600 px-6 py-3 text-base font-bold text-white xl:text-lg"
              >
                View Invoice
              </button>
              <button
                type="button"
                onClick={() => {
                  clearBookingSession();
                  if (isModal) onClose?.();
                  else navigate("/hotel/all-bookings");
                }}
                className="rounded-full border border-slate-200 bg-white px-6 py-3 text-base font-bold text-slate-700 xl:text-lg"
              >
                All Bookings
              </button>
              <button
                type="button"
                onClick={() => {
                  resetGroupBookingForm();
                }}
                className="rounded-full border border-slate-200 bg-white px-6 py-3 text-base font-bold text-slate-700 xl:text-lg"
              >
                New Group Booking
              </button>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        {step < 4 && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() =>
                step === 0 ? (isModal ? onClose?.() : navigate(-1)) : setStep((s) => s - 1)
              }
              className="rounded-full border border-slate-200 bg-white px-6 py-3 text-base font-bold text-slate-700 transition hover:bg-slate-50 xl:text-lg"
            >
              ← Back
            </button>

            <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleCancelBooking}
              className="rounded-full border border-rose-200 bg-rose-50 px-6 py-3 text-base font-bold text-rose-700 transition hover:bg-rose-100 xl:text-lg"
            >
              Cancel Booking
            </button>

            {step < 3 ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="rounded-full bg-gradient-to-r from-indigo-600 to-violet-500 px-6 py-3 text-base font-bold text-white shadow-[0_10px_24px_rgba(79,70,229,0.22)] transition hover:-translate-y-0.5 xl:text-lg"
              >
                Next →
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="rounded-full bg-gradient-to-r from-emerald-600 to-teal-500 px-8 py-3 text-base font-bold text-white shadow-[0_10px_24px_rgba(16,185,129,0.22)] transition hover:-translate-y-0.5 disabled:opacity-60 xl:text-lg"
              >
                {saving ? "Booking…" : "Confirm Group Booking"}
              </button>
            )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupBooking;
