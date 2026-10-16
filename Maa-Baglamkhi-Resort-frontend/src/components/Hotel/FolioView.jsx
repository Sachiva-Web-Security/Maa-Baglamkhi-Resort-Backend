import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Plus,
  X,
  LayoutList,
  Wallet,
  Tag,
  CreditCard,
  PiggyBank,
  ClipboardList,
  User,
  CalendarDays,
  BedDouble,
  ReceiptText,
  Undo2,
} from "lucide-react";
import API from "../../api";
import { getStoredBookingCode, getStoredBookingId } from "./bookingSession";

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const formatDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// Two decimals matter: the backend taxes at 5% of the charges, so a ₹250 charge
// carries ₹12.50 of tax and a ₹500 payment leaves −₹237.50 net. Rounding the
// display to whole rupees (maximumFractionDigits: 0) showed ₹13 and ₹238, which
// stopped the folio reading reconciling with the generated invoice — the exact
// discrepancy this page was rewritten to remove. showFractionalDigitsOnInteger
// keeps whole-rupee figures clean (₹800, not ₹800.00) while still showing the
// paise whenever an amount actually has them.
const CURRENCY = {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
  showFractionalDigitsOnInteger: false,
};

const formatAmount = (value) => new Intl.NumberFormat("en-IN", CURRENCY).format(value);

// Deductions (discounts / refunds / payments) are stored as non-negative
// magnitudes and the sign is implied by the bucket, so render them with an
// explicit leading minus so the ledger reads as a real cash flow.
const formatDeduction = (value) => `− ${formatAmount(Math.abs(Number(value) || 0))}`;

const round2 = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(Math.abs(n) * 100 + Number.EPSILON) / 100 * Math.sign(n) : 0;
};

// Both folio tables are supported: 'Room Charge' and 'room_charge' are the same
// bucket, so the client-side fallback normalises entry_type the same way the
// backend's canonicalFolioType() does.
const canonicalFolioType = (raw) =>
  String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "_")
    .replace(/^_+|_+$/g, "");

const CHARGE_TYPES = ["room_charge", "extra_charge", "adjustment"];

// Discount, Refund and Payment all reduce what the guest owes, so all three are
// rendered with a leading minus in the ledger rows.
const DEDUCTION_TYPES = new Set(["discount", "refund", "payment"]);

const TYPE_COLORS = {
  "Room Charge":  "bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 border-blue-200",
  "Extra Charge": "bg-gradient-to-r from-violet-50 to-violet-100 text-violet-700 border-violet-200",
  Discount:       "bg-gradient-to-r from-amber-50 to-amber-100 text-amber-700 border-amber-200",
  Payment:        "bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-700 border-emerald-200",
  Refund:         "bg-gradient-to-r from-rose-50 to-rose-100 text-rose-700 border-rose-200",
  Adjustment:     "bg-gradient-to-r from-slate-100 to-slate-200 text-slate-700 border-slate-300",
};

const ENTRY_TYPES = [
  "Room Charge",
  "Extra Charge",
  "Discount",
  "Payment",
  "Refund",
  "Adjustment",
];

const CATEGORIES = [
  "Room Rent",
  "Minibar",
  "Laundry",
  "Restaurant",
  "Room Service",
  "Phone",
  "Business Centre",
  "Spa / Wellness",
  "Parking",
  "Early Check-In",
  "Late Check-Out",
  "Miscellaneous",
];

// ─── Add Entry Modal ───────────────────────────────────────────────────────────
const AddEntryModal = ({ bookingId, onClose, onSaved }) => {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    entry_date: today,
    entry_type: "Extra Charge",
    category: "Minibar",
    description: "",
    amount: "",
    created_by: "Front Desk",
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.description.trim() || !form.amount) {
      alert("Description aur amount required hai");
      return;
    }
    try {
      setSaving(true);
      await API.post(`/hotel/folio/${bookingId}`, form);
      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center overflow-y-auto bg-slate-950/60 px-3 py-6 backdrop-blur-sm sm:px-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.28)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative shrink-0 overflow-hidden bg-[linear-gradient(90deg,#172554_0%,#1d4ed8_55%,#0ea5e9_100%)] px-5 py-5 text-white sm:px-7 sm:py-6">
          <div className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 sm:h-11 sm:w-11">
              <ReceiptText size={22} strokeWidth={2.2} />
            </div>
            <div className="min-w-0">
              <p className="text-[15px] font-bold uppercase tracking-[0.28em] text-sky-200">
                Folio Entry
              </p>
              <h2 className="mt-1 text-3xl font-black">Add New Charge</h2>
            </div>
          </div>
        </div>

        <div className="space-y-5 overflow-y-auto p-5 sm:p-7">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[17px] font-bold uppercase tracking-[0.14em] text-slate-600">
                Date
              </label>
              <input
                type="date"
                value={form.entry_date}
                onChange={(e) => set("entry_date", e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-[17px] font-semibold text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[17px] font-bold uppercase tracking-[0.14em] text-slate-600">
                Entry Type
              </label>
              <select
                value={form.entry_type}
                onChange={(e) => set("entry_type", e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-[17px] font-semibold text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              >
                {ENTRY_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[17px] font-bold uppercase tracking-[0.14em] text-slate-600">
              Category
            </label>
            <select
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-[17px] font-semibold text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            >
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-[17px] font-bold uppercase tracking-[0.14em] text-slate-600">
              Description
            </label>
            <input
              type="text"
              placeholder="E.g. 2 Bottles of Water — ₹120 each"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-[17px] font-semibold text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[17px] font-bold uppercase tracking-[0.14em] text-slate-600">
                Amount (₹)
              </label>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={form.amount}
                onChange={(e) => set("amount", e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-[17px] font-semibold text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[17px] font-bold uppercase tracking-[0.14em] text-slate-600">
                Created By
              </label>
              <input
                type="text"
                value={form.created_by}
                onChange={(e) => set("created_by", e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-[17px] font-semibold text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <button
              onClick={handleSave}
              disabled={saving}
              className="order-1 w-full flex-1 rounded-full bg-gradient-to-r from-blue-700 to-sky-500 py-3.5 text-[17px] font-bold text-white shadow-[0_14px_32px_rgba(29,78,216,0.28)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(29,78,216,0.34)] active:translate-y-0 disabled:opacity-60 sm:order-none sm:w-auto"
            >
              {saving ? "Saving…" : "Save Entry"}
            </button>
            <button
              onClick={onClose}
              className="order-2 w-full rounded-full border border-slate-200 bg-slate-50 px-7 py-3.5 text-[17px] font-bold text-slate-700 transition hover:bg-slate-100 sm:order-none sm:w-auto"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main FolioView ─────────────────────────────────────────────────────────
const FolioView = ({
  bookingId: bookingIdProp,
  bookingCode: bookingCodeProp,
  isModal = false,
  onClose,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const bookingId = bookingIdProp || location.state?.bookingId || getStoredBookingId();
  const bookingCode = bookingCodeProp || location.state?.bookingCode || getStoredBookingCode();

  const [booking, setBooking] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [filterType, setFilterType] = useState("All");
  const [totalsApi, setTotalsApi] = useState(null);

  const load = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    try {
      const [bookingRes, folioRes, totalsRes] = await Promise.all([
        API.get(`/hotel/full-booking/${bookingId}`),
        API.get(`/hotel/folio/${bookingId}`),
        API.get(`/hotel/folio/${bookingId}/totals`),
      ]);
      setBooking(bookingRes.data || null);
      setEntries(Array.isArray(folioRes.data) ? folioRes.data : []);
      // Server totals are the single source of truth: they add room rent from
      // booking_rooms and the booking advance, and the refund sign is fixed there.
      const body = totalsRes.data;
      const net = Number(body?.netAmount ?? body?.netBalance);
      setTotalsApi(
        body && body.charges !== undefined && Number.isFinite(net)
          ? { ...body, netAmount: net }
          : null,
      );
    } catch (err) {
      // The /totals endpoint is optional — on failure the page falls back to
      // recomputing from the entries that were loaded in the same request.
      console.error("[folio] load error:", err);
      setTotalsApi(null);
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    load();
    // Auto-reload when a Room Service add-on is posted from Roomitem.jsx
    window.addEventListener("folioUpdated", load);
    return () => window.removeEventListener("folioUpdated", load);
  }, [load]);

  useEffect(() => {
    if (!isModal) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isModal, onClose]);

  const filteredEntries = useMemo(
    () =>
      filterType === "All"
        ? entries
        : entries.filter((e) => e.entry_type === filterType),
    [entries, filterType],
  );

  // Group entries by date for night audit view
  const groupedByDate = useMemo(() => {
    const map = {};
    for (const entry of filteredEntries) {
      const d = entry.entry_date
        ? new Date(entry.entry_date).toISOString().slice(0, 10)
        : "Unknown";
      if (!map[d]) map[d] = [];
      map[d].push(entry);
    }
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
  }, [filteredEntries]);

  // Fallback used only when GET /hotel/folio/:bookingId/totals fails. It mirrors
  // the canonical money contract but necessarily ignores room rent (booking_rooms)
  // and the booking advance, so those buckets understate the server figures.
  const totalsFallback = useMemo(() => {
    const buckets = { charges: 0, discounts: 0, refunds: 0, payments: 0 };
    for (const entry of entries) {
      const amt = Math.abs(Number(entry?.amount || 0)) || 0;
      const type = canonicalFolioType(entry?.entry_type);
      if (CHARGE_TYPES.includes(type)) buckets.charges += amt;
      else if (type === "discount") buckets.discounts += amt;
      else if (type === "refund") buckets.refunds += amt;
      else if (type === "payment") buckets.payments += amt;
    }
    return {
      charges: round2(buckets.charges),
      discounts: round2(buckets.discounts),
      refunds: round2(buckets.refunds),
      payments: round2(buckets.payments),
    };
  }, [entries]);

  // Server totals win; the fallback keeps the page rendering if the endpoint is
  // down. `tax` is carried through so the arithmetic line below shows exactly
  // how the net was reached.
  const totals = totalsApi
    ? {
        charges: round2(totalsApi.charges),
        tax: round2(totalsApi.tax),
        discounts: round2(totalsApi.discounts),
        refunds: round2(totalsApi.refunds),
        payments: round2(totalsApi.payments),
      }
    : { ...totalsFallback, tax: 0 };

  // Net amount comes from the server whenever it is available. The backend and
  // InvoiceModel both fold GST into netAmount so the folio and the generated
  // invoice reconcile; recomputing it here without the tax line would silently
  // diverge from both. The fallback reproduces the contract minus tax, which is
  // the most it can do without the room rent / advance / tax figures.
  //
  //   netAmount = charges + tax − discounts − refunds − payments
  //
  // Refunds SUBTRACT: a refund reverses money the resort had already counted as
  // received, so it LOWERS what the guest still owes. An earlier version added
  // refunds — that was the sign error being fixed here.
  const netAmount =
    totalsApi && Number.isFinite(Number(totalsApi.netAmount))
      ? round2(totalsApi.netAmount)
      : round2(
          totals.charges - totals.discounts - totals.refunds - totals.payments,
        );
  const netLabel =
    netAmount > 0 ? "Payable" : netAmount < 0 ? "Refundable" : "Settled";

  if (!bookingId) {
    return (
      <div className="p-8 text-center text-[18px] font-semibold text-slate-500">
        Booking ID is missing. Please open it from All Bookings.
      </div>
    );
  }

  const bookingRef = booking?.bookingCode || bookingCode || bookingId;
  const handleBackToBookings = () => {
    if (isModal) {
      onClose?.();
      return;
    }
    navigate("/hotel/all-bookings");
  };

  // Same five buckets are shown in the hero banner and in the footer grid.
  // Deductions are rendered visibly negative with a leading minus.
  //
  // Colours come from a literal map, NOT from string interpolation like
  // `bg-${color}-600`. Tailwind's JIT scans the source for complete class
  // names; an interpolated name never appears as a literal token, so it is
  // never generated and the element silently renders with no background or
  // text colour. This is why the Net Amount card was unstyled.
  const netPalette =
    netAmount < 0
      ? { iconBg: "bg-emerald-600", valueColor: "text-emerald-700", badge: "bg-emerald-100 text-emerald-800" }
      : netAmount > 0
        ? { iconBg: "bg-rose-600", valueColor: "text-rose-700", badge: "bg-rose-100 text-rose-800" }
        : { iconBg: "bg-sky-600", valueColor: "text-sky-700", badge: "bg-sky-100 text-sky-800" };
  const netMoney = Math.abs(netAmount);

  const heroStats = [
    {
      label: "Total Charges",
      display: formatAmount(totals.charges),
      icon: CreditCard,
      iconBg: "bg-blue-600",
      valueColor: "text-slate-900",
    },
    {
      label: "Total Discounts",
      display: formatDeduction(totals.discounts),
      icon: Tag,
      iconBg: "bg-amber-500",
      valueColor: "text-amber-700",
    },
    {
      label: "Total Refunds",
      display: formatDeduction(totals.refunds),
      icon: Undo2,
      iconBg: "bg-rose-500",
      valueColor: "text-rose-700",
    },
    {
      label: "Total Payments",
      display: formatDeduction(totals.payments),
      icon: Wallet,
      iconBg: "bg-emerald-600",
      valueColor: "text-emerald-700",
    },
    {
      label: "Net Amount",
      display: `${netAmount < 0 ? "−" : ""} ${formatAmount(netMoney)}`,
      icon: PiggyBank,
      iconBg: netPalette.iconBg,
      valueColor: netPalette.valueColor,
    },
  ];

  return (
    <div
      className={
        isModal
          ? "fixed inset-0 z-[1000] flex items-center justify-center overflow-y-auto bg-slate-950/70 px-2 py-4 backdrop-blur-sm sm:px-4 sm:py-6 lg:px-6"
          : ""
      }
      onClick={isModal ? onClose : undefined}
    >
      <div
        className={
          isModal
            ? "relative max-h-[95vh] w-full max-w-[96rem] overflow-y-auto rounded-2xl bg-white shadow-[0_30px_90px_rgba(15,23,42,0.35)] sm:rounded-[32px]"
            : "w-full"
        }
        role={isModal ? "dialog" : undefined}
        aria-modal={isModal ? "true" : undefined}
        onClick={isModal ? (event) => event.stopPropagation() : undefined}
      >
        {isModal && (
          <button
            type="button"
            aria-label="Close folio"
            onClick={onClose}
            className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-lg ring-1 ring-slate-200 transition hover:bg-slate-100 hover:scale-105 sm:right-5 sm:top-5 sm:h-11 sm:w-11"
          >
            <X size={20} strokeWidth={2.4} />
          </button>
        )}
        {showAdd && (
          <AddEntryModal
            bookingId={bookingId}
            onClose={() => setShowAdd(false)}
            onSaved={load}
          />
        )}

        <div
          className={`${
            isModal ? "" : "min-h-screen"
          } w-full max-w-full overflow-x-hidden bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.10),_transparent_35%),linear-gradient(160deg,#f8fbff_0%,#ffffff_50%,#f5f9ff_100%)] p-3 sm:p-6 lg:p-8`}
        >
          <div className="mx-auto w-full max-w-[96rem] space-y-5 sm:space-y-6">
            {/* Header / Hero */}
            <section className="relative overflow-hidden rounded-2xl border border-white/60 bg-[linear-gradient(90deg,#172554_0%,#1d4ed8_55%,#0ea5e9_100%)] px-4 py-6 text-white shadow-[0_25px_80px_rgba(15,23,42,0.28)] sm:rounded-[32px] sm:px-9 sm:py-10">
              {/* soft abstract wave / glass accents */}
              <svg
                className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.18]"
                viewBox="0 0 1200 400"
                preserveAspectRatio="none"
              >
                <path
                  d="M0,220 C220,300 380,120 620,180 C860,240 980,120 1200,170 L1200,400 L0,400 Z"
                  fill="rgba(255,255,255,0.5)"
                />
                <path
                  d="M0,280 C260,340 420,200 660,250 C900,300 1020,200 1200,240 L1200,400 L0,400 Z"
                  fill="rgba(255,255,255,0.35)"
                />
              </svg>
              <div className="pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-20 right-10 h-72 w-72 rounded-full bg-sky-300/20 blur-3xl" />

              <div className="relative grid gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.95fr)] lg:items-center">
                <div className="min-w-0">
                  <p className="text-[12px] font-bold uppercase tracking-[0.32em] text-cyan-200">
                    Guest Folio — Night Audit
                  </p>
                  <h1 className="mt-3 break-words text-4xl font-black sm:text-3xl">
                    Booking #{bookingRef}
                  </h1>
                  <p className="mt-4 max-w-xl text-[16px] font-medium leading-8 text-slate-100/85">
                    An itemized ledger of daily room charges, additional charges (such as minibar, laundry, etc.), and payments
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-3.5 md:grid-cols-3 lg:gap-4">
                  {heroStats.map((s) => {
                    const Icon = s.icon;
                    return (
                      <div
                        key={s.label}
                        className="min-w-0 rounded-2xl border border-white/40 bg-white/95 p-3 shadow-[0_14px_34px_rgba(15,23,42,0.18)] backdrop-blur transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(15,23,42,0.24)] sm:rounded-[22px] sm:p-4 lg:p-5"
                      >
                        <div className="flex items-center gap-2.5 sm:gap-3">
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${s.iconBg} text-white shadow-md sm:h-11 sm:w-11 sm:rounded-2xl`}>
                            <Icon size={20} strokeWidth={2.2} className="sm:hidden" />
                            <Icon size={22} strokeWidth={2.2} className="hidden sm:block" />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                              {s.label}
                            </div>
                            <div className={`mt-1 truncate text-2xl font-black ${s.valueColor}`}>
                              {s.display}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Guest Info Bar */}
            {booking && (
              <div className="flex w-full flex-col gap-4 rounded-2xl border border-blue-100 bg-white/95 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.06)] sm:flex-row sm:items-center sm:gap-6 sm:rounded-[26px] sm:p-5 lg:p-6">
                <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-700 to-sky-500 text-white shadow-md sm:h-16 sm:w-16">
                    <User size={26} strokeWidth={2} className="sm:hidden" />
                    <User size={30} strokeWidth={2} className="hidden sm:block" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-2xl font-black text-slate-900">
                      {booking.guest_name || "Guest"}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[17px] font-medium text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <BedDouble size={18} className="shrink-0 text-blue-500" />
                        Room: {booking.rooms?.map((r) => r.room_number).join(", ") || "—"}
                      </span>
                      <span className="hidden text-slate-300 sm:inline">•</span>
                      <span className="flex items-center gap-1.5">
                        <CalendarDays size={18} className="shrink-0 text-blue-500" />
                        {formatDate(booking.check_in)} → {formatDate(booking.check_out)}
                      </span>
                    </div>
                  </div>
                </div>
                <span className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-[16px] font-bold text-emerald-700 ring-1 ring-emerald-200 sm:ml-auto">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />
                  {booking.booking_status || "Active"}
                </span>
              </div>
            )}

            {/* Controls */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2 sm:gap-2.5">
                {["All", ...ENTRY_TYPES].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFilterType(t)}
                    className={`rounded-full px-4 py-2 text-[16px] font-bold transition-all duration-200 sm:px-5 sm:py-2.5 ${
                      filterType === t
                        ? "bg-gradient-to-r from-blue-700 to-sky-500 text-white shadow-[0_10px_24px_rgba(29,78,216,0.28)]"
                        : "border border-blue-200 bg-white text-blue-700 hover:-translate-y-0.5 hover:bg-blue-50"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  onClick={() => setShowAdd(true)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-700 to-sky-500 px-6 py-3.5 text-[14px] font-bold text-white shadow-[0_14px_32px_rgba(29,78,216,0.26)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(29,78,216,0.32)] active:translate-y-0 sm:w-auto"
                >
                  <Plus size={22} strokeWidth={2.4} />
                  Add Charge
                </button>
                <button
                  type="button"
                  onClick={handleBackToBookings}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-blue-200 bg-white px-6 py-3.5 text-[14px] font-bold text-blue-700 transition hover:-translate-y-0.5 hover:bg-blue-50 sm:w-auto"
                >
                  <LayoutList size={22} strokeWidth={2.2} />
                  All Bookings
                </button>
              </div>
            </div>

            {/* Folio Ledger */}
            <section className="overflow-hidden rounded-2xl border border-blue-100 bg-white/95 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:rounded-[32px]">
              {loading ? (
                <div className="p-8 text-center text-[20px] font-bold text-slate-400 sm:p-14">
                  Loading folio…
                </div>
              ) : groupedByDate.length === 0 ? (
                <div className="m-3 rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/30 p-8 text-center sm:m-6 sm:rounded-[28px] sm:p-16">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-600 sm:h-20 sm:w-20">
                    <ClipboardList size={32} strokeWidth={1.8} className="sm:hidden" />
                    <ClipboardList size={40} strokeWidth={1.8} className="hidden sm:block" />
                  </div>
                  <p className="mt-6 text-[21px] font-black text-slate-600">
                    There are currently no folio entries available
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowAdd(true)}
                    className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-700 to-sky-500 px-7 py-3.5 text-[17px] font-bold text-white shadow-[0_14px_32px_rgba(29,78,216,0.26)] transition hover:-translate-y-0.5"
                  >
                    <Plus size={20} strokeWidth={2.4} />
                    Add First Entry
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {groupedByDate.map(([date, dayEntries]) => {
                    const dayTotal = round2(
                      dayEntries
                        .filter((e) =>
                          CHARGE_TYPES.includes(canonicalFolioType(e.entry_type)),
                        )
                        .reduce(
                          (s, e) => s + (Math.abs(Number(e.amount || 0)) || 0),
                          0,
                        ),
                    );

                    return (
                      <div key={date} className="px-3 py-4 sm:px-5 sm:py-5 lg:px-7">
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="rounded-full bg-gradient-to-r from-blue-900 to-blue-700 px-4 py-1.5 text-[16px] font-bold text-white shadow-sm">
                              {formatDate(date)}
                            </span>
                            <span className="text-[16px] font-medium text-slate-500">
                              {dayEntries.length} entries
                            </span>
                          </div>
                          {dayTotal > 0 && (
                            <span className="text-[17px] font-bold text-slate-700">
                              Day Charges: {formatCurrency(dayTotal)}
                            </span>
                          )}
                        </div>

                        <div className="overflow-x-auto rounded-[22px] border border-slate-100">
                          <table className="w-full min-w-[720px] text-[17px]">
                            <thead className="sticky top-0 z-[1] bg-slate-50 text-left text-[16px] text-slate-500">
                              <tr>
                                <th className="px-5 py-3.5 font-bold uppercase tracking-[0.1em]">
                                  Type
                                </th>
                                <th className="px-5 py-3.5 font-bold uppercase tracking-[0.1em]">
                                  Category
                                </th>
                                <th className="px-5 py-3.5 font-bold uppercase tracking-[0.1em]">
                                  Description
                                </th>
                                <th className="px-5 py-3.5 text-right font-bold uppercase tracking-[0.1em]">
                                  Amount
                                </th>
                                <th className="px-5 py-3.5 font-bold uppercase tracking-[0.1em]">
                                  By
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {dayEntries.map((entry, idx) => (
                                <tr
                                  key={entry.id}
                                  className={`border-t border-slate-100 text-[17px] transition-colors hover:bg-blue-50/50 ${
                                    idx % 2 === 1 ? "bg-slate-50/40" : "bg-white"
                                  }`}
                                >
                                  <td className="px-5 py-3.5">
                                    <span
                                      className={`inline-block whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[15px] font-bold ${
                                        TYPE_COLORS[entry.entry_type] ||
                                        "bg-slate-100 text-slate-600 border-slate-200"
                                      }`}
                                    >
                                      {entry.entry_type}
                                    </span>
                                  </td>
                                  <td className="px-5 py-3.5 font-medium text-slate-600">
                                    {entry.category || "—"}
                                  </td>
                                  <td className="px-5 py-3.5 font-semibold text-slate-800">
                                    {entry.description}
                                  </td>
                                  <td
                                    className={`px-5 py-3.5 text-right font-black ${
                                      DEDUCTION_TYPES.has(canonicalFolioType(entry.entry_type))
                                        ? "text-emerald-600"
                                        : "text-slate-900"
                                    }`}
                                  >
                                    {DEDUCTION_TYPES.has(canonicalFolioType(entry.entry_type))
                                      ? "− "
                                      : ""}
                                    {formatCurrency(entry.amount)}
                                  </td>
                                  <td className="px-5 py-3.5 font-medium text-slate-400">
                                    {entry.created_by || "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Balance Summary Footer — same five buckets as the hero banner.
                Formula: netAmount = charges − discounts − refunds − payments.
                Refunds SUBTRACT. */}
            <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-[0_14px_40px_rgba(15,23,42,0.06)] sm:rounded-[28px] sm:p-6 lg:p-7">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-5">
                <div className="min-w-0 rounded-2xl bg-gradient-to-br from-blue-50 to-white p-3 text-center shadow-sm sm:rounded-[22px] sm:p-5">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md sm:h-12 sm:w-12 sm:rounded-2xl">
                    <CreditCard size={22} strokeWidth={2.1} className="sm:hidden" />
                    <CreditCard size={26} strokeWidth={2.1} className="hidden sm:block" />
                  </div>
                  <div className="mt-3 text-[16px] font-bold uppercase tracking-wide text-blue-700">
                    Total Charges
                  </div>
                  <div className="mt-2 truncate text-3xl font-black text-slate-900">
                    {formatAmount(totals.charges)}
                  </div>
                </div>

                <div className="min-w-0 rounded-2xl bg-gradient-to-br from-amber-50 to-white p-3 text-center shadow-sm sm:rounded-[22px] sm:p-5">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white shadow-md sm:h-12 sm:w-12 sm:rounded-2xl">
                    <Tag size={22} strokeWidth={2.1} className="sm:hidden" />
                    <Tag size={26} strokeWidth={2.1} className="hidden sm:block" />
                  </div>
                  <div className="mt-3 text-[16px] font-bold uppercase tracking-wide text-amber-600">
                    Total Discounts
                  </div>
                  <div className="mt-2 truncate text-3xl font-black text-amber-700">
                    {formatDeduction(totals.discounts)}
                  </div>
                </div>

                <div className="min-w-0 rounded-2xl bg-gradient-to-br from-rose-50 to-white p-3 text-center shadow-sm sm:rounded-[22px] sm:p-5">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500 text-white shadow-md sm:h-12 sm:w-12 sm:rounded-2xl">
                    <Undo2 size={22} strokeWidth={2.1} className="sm:hidden" />
                    <Undo2 size={26} strokeWidth={2.1} className="hidden sm:block" />
                  </div>
                  <div className="mt-3 text-[16px] font-bold uppercase tracking-wide text-rose-600">
                    Total Refunds
                  </div>
                  <div className="mt-2 truncate text-3xl font-black text-rose-700">
                    {formatDeduction(totals.refunds)}
                  </div>
                </div>

                <div className="min-w-0 rounded-2xl bg-gradient-to-br from-emerald-50 to-white p-3 text-center shadow-sm sm:rounded-[22px] sm:p-5">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md sm:h-12 sm:w-12 sm:rounded-2xl">
                    <Wallet size={22} strokeWidth={2.1} className="sm:hidden" />
                    <Wallet size={26} strokeWidth={2.1} className="hidden sm:block" />
                  </div>
                  <div className="mt-3 text-[16px] font-bold uppercase tracking-wide text-emerald-600">
                    Total Payments
                  </div>
                  <div className="mt-2 truncate text-3xl font-black text-emerald-700">
                    {formatDeduction(totals.payments)}
                  </div>
                </div>

                <div
                  className={`min-w-0 rounded-2xl p-3 text-center shadow-sm sm:rounded-[22px] sm:p-5 ${
                    netAmount < 0
                      ? "bg-gradient-to-br from-emerald-50 to-white ring-1 ring-emerald-200"
                      : netAmount > 0
                        ? "bg-gradient-to-br from-rose-50 to-white ring-1 ring-rose-200"
                        : "bg-gradient-to-br from-sky-50 to-white ring-1 ring-sky-200"
                  }`}
                >
                  <div
                    className={`mx-auto flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-md sm:h-12 sm:w-12 sm:rounded-2xl ${
                      netPalette.iconBg
                    }`}
                  >
                    <PiggyBank size={22} strokeWidth={2.1} className="sm:hidden" />
                    <PiggyBank size={26} strokeWidth={2.1} className="hidden sm:block" />
                  </div>
                  <div className="mt-3 text-[16px] font-bold uppercase tracking-wide text-slate-600">
                    Net Amount
                  </div>
                  <div
                    className={`mt-2 truncate text-3xl font-black ${
                      netPalette.valueColor
                    }`}
                  >
                    {netAmount < 0 ? "− " : ""}
                    {formatAmount(netMoney)}
                  </div>
                  <div
                    className={`mt-2 inline-block rounded-full px-3 py-1 text-[13px] font-bold uppercase tracking-wide ${
                      netPalette.badge
                    }`}
                  >
                    {netLabel}
                  </div>
                </div>
              </div>

              {/* Explicit arithmetic line, so the user can see exactly how the
                  net amount was reached rather than trusting a bare number.
                  Matches the backend/invoice formula, GST included. */}
              <p className="mt-4 text-center text-[14px] font-semibold text-slate-500 sm:text-[15px]">
                {formatAmount(totals.charges)} charges
                {totals.tax > 0 ? ` + ${formatAmount(totals.tax)} GST` : ""}
                {totals.discounts > 0 ? ` − ${formatAmount(totals.discounts)} discount` : ""}
                {totals.refunds > 0 ? ` − ${formatAmount(totals.refunds)} refund` : ""}
                {totals.payments > 0 ? ` − ${formatAmount(totals.payments)} paid` : ""}
                {" = "}
                <span
                  className={`font-black ${netPalette.valueColor}`}
                >
                  {formatAmount(netAmount)}
                </span>{" "}
                {netLabel}
              </p>

              {totalsApi === null && !loading && (
                <p className="mt-2 text-center text-[13px] font-semibold text-amber-600">
                  Server totals unavailable — showing entry-only totals. Room rent and
                  advance payments are not included.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FolioView;