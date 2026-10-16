import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import {
  FaBuilding,
  FaBed,
  FaUserPlus,
  FaBolt,
  FaSignInAlt,
  FaSignOutAlt,
  FaEye,
  FaDownload,
  FaChevronRight,
  FaTimes,
  FaDoorOpen,
  FaChartPie,
  FaChartLine,
  FaWallet,
  FaHistory,
  FaClipboardList,
} from "react-icons/fa";

import API from "../api";
import BookingFlow from "../components/Hotel/BookingFlow";
import BookingSteps from "../components/Hotel/BookingSteps";
import { setStoredBookingId } from "../components/Hotel/bookingSession";

import FolioView from "../components/Hotel/FolioView";
import GroupBooking from "../components/Hotel/GroupBooking";
import GuestProfile from "../components/Hotel/GuestProfile";
import OccupancyForecast from "../components/Hotel/OccupancyForecast";
import Room from "../components/Hotel/Room";
import RoomMaintenance from "../components/Hotel/RoomMaintenance";

// ── All of these paths now render the SAME single-page BookingFlow component.
// Nothing here navigates between them internally anymore — BookingFlow handles
// New Booking / Booking Confirmed / All Bookings / Booking Details / Manage
// Booking as one page using local state, not routing.
const BOOKING_FLOW_PATHS = [
  "guest",
  "other-booking",
  "reference",
  "company",
  "room",
  "pax",
  "room-tariff",
  "advance",
  "communication",
  "collect-payment",
  "all-bookings",
  "edit-booking",
  "booking-history",
  "payment-history",
];

// Full-width pages that draw their own page chrome (no extra rounded-card
// wrapper from this router) — the booking flow pages, plus the new Dashboard.
const FULL_WIDTH_PATHS = [...BOOKING_FLOW_PATHS, "dashboard"];

const getStepLabel = (pathname) => {
  if (pathname.includes("/dashboard"))          return "Dashboard";
  if (pathname.includes("/booking-history"))    return "Booking History";
  if (pathname.includes("/payment-history"))    return "Payment History";
  if (pathname.includes("/folio"))              return "Guest Folio";
  if (pathname.includes("/room-maintenance"))   return "Room Maintenance";
  if (pathname.includes("/guest-profile"))      return "Guest Profile";
  if (pathname.includes("/occupancy-forecast")) return "Occupancy Forecast";
  if (pathname.includes("/group-booking"))      return "Group Booking";
  return "Booking";
};

/* ═══════════════════════════════════════════════════════════════════════
   Dashboard (Home) — redesigned overview page.
   Everything below is fetched live from the existing backend — nothing is
   hardcoded or mocked.

   Data sources (all already used elsewhere in this project):
     GET  /hotel/rooms/setup         -> room categories, room numbers, total inventory
     GET  /hotel/room-blocks         -> maintenance/blocked rooms (Out of Service)
     GET  /hotel/all-bookings        -> live bookings (Check-in/out today, All Bookings table)
     GET  /hotel/booking-history     -> Booking History table
     GET  /hotel/payment-history/:id -> Payment History table (aggregated across recent bookings)
     POST /hotel/guest               -> Quick "Book Now" guest booking
   ═══════════════════════════════════════════════════════════════════════ */

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const formatDate = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const todayISO = () => new Date().toISOString().slice(0, 10);

// Premium gradient pill badges — Blue + White enterprise theme with
// Emerald / Amber / Rose accents for state (matches Occupancy Overview).
const statusPill = (status) => {
  const s = String(status || "").toLowerCase();
  if (s.includes("checked in"))
    return "bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-sm shadow-blue-200";
  if (s.includes("checked out"))
    return "bg-gradient-to-r from-slate-400 to-slate-500 text-white shadow-sm shadow-slate-200";
  if (s.includes("cancel"))
    return "bg-gradient-to-r from-rose-500 to-rose-600 text-white shadow-sm shadow-rose-200";
  if (s.includes("pending") || s.includes("tentative"))
    return "bg-gradient-to-r from-amber-400 to-amber-500 text-white shadow-sm shadow-amber-200";
  return "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-sm shadow-emerald-200"; // Confirmed / default
};

// Small shared helper for the other premium badges used in Booking History /
// Payment History (purely presentational, mirrors statusPill's gradient style).
const premiumBadge = (variant) => {
  switch (variant) {
    case "completed":
    case "paid":
      return "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-sm shadow-emerald-200";
    case "cancelled":
      return "bg-gradient-to-r from-rose-500 to-rose-600 text-white shadow-sm shadow-rose-200";
    case "balance":
    case "pending":
      return "bg-gradient-to-r from-amber-400 to-amber-500 text-white shadow-sm shadow-amber-200";
    default:
      return "bg-gradient-to-r from-slate-400 to-slate-500 text-white shadow-sm shadow-slate-200";
  }
};

const Badge = ({ variant, children }) => (
  <span
    className={`inline-flex items-center rounded-full px-4 py-1.5 text-xs sm:text-[13px] font-bold tracking-wide ${premiumBadge(
      variant,
    )}`}
  >
    {children}
  </span>
);

// Small labeled field used inside mobile cards (label above value).
const CardField = ({ label, children }) => (
  <div>
    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
    <div className="mt-0.5 text-[14px] font-semibold text-slate-700">{children}</div>
  </div>
);

const QuickActionCard = ({ icon: Icon, iconGradient, title, description, buttonLabel, onClick }) => (
  <div className="group relative flex w-full flex-col overflow-hidden rounded-[24px] border border-blue-100/50 bg-white p-6 sm:p-7 shadow-[0_4px_20px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_20px_45px_-12px_rgba(37,99,235,0.28)]">
    <div
      className={`mb-5 flex h-16 w-16 sm:h-[72px] sm:w-[72px] items-center justify-center rounded-2xl shadow-[0_8px_20px_-6px_rgba(37,99,235,0.45)] ring-1 ring-white/40 transition-transform duration-300 group-hover:scale-105 ${iconGradient}`}
    >
      <Icon className="text-[32px] sm:text-[38px] text-white drop-shadow-sm" />
    </div>
    <h3 className="text-xl sm:text-2xl md:text-[28px] font-bold text-slate-900">{title}</h3>
    <p className="mt-2 flex-1 text-[15px] sm:text-[16px] md:text-[17px] leading-relaxed text-slate-500">
      {description}
    </p>
    <button
      type="button"
      onClick={onClick}
      className="mt-6 w-full rounded-2xl bg-gradient-to-r from-blue-900 via-blue-700 to-sky-500 py-3.5 text-[16px] sm:text-[18px] font-bold text-white shadow-[0_10px_25px_-8px_rgba(30,64,175,0.5)] transition-all duration-200 hover:shadow-[0_14px_32px_-6px_rgba(30,64,175,0.6)] hover:brightness-110 active:scale-[0.98]"
    >
      {buttonLabel}
    </button>
  </div>
);

const OccupancyDonut = ({ occupied, available, outOfService, occupiedPct }) => {
  const total = occupied + available + outOfService;
  const R = 80;
  const C = 2 * Math.PI * R;
  const segs = [
    { value: occupied, color: "#2563eb" },
    { value: available, color: "#10b981" },
    { value: outOfService, color: "#f59e0b" },
  ];
  let offset = 0;

  return (
    <div className="relative flex h-56 w-56 sm:h-60 sm:w-60 lg:h-64 lg:w-64 items-center justify-center">
      <svg viewBox="0 0 200 200" className="h-56 w-56 sm:h-60 sm:w-60 lg:h-64 lg:w-64 -rotate-90">
        <circle cx="100" cy="100" r={R} fill="none" stroke="#eef2ff" strokeWidth="20" />
        {total > 0 &&
          segs.map((seg, i) => {
            if (seg.value <= 0) return null;
            const frac = seg.value / total;
            const dash = frac * C;
            const circle = (
              <circle
                key={i}
                cx="100"
                cy="100"
                r={R}
                fill="none"
                stroke={seg.color}
                strokeWidth="20"
                strokeDasharray={`${dash} ${C - dash}`}
                strokeDashoffset={-offset}
                strokeLinecap="round"
              />
            );
            offset += dash;
            return circle;
          })}
      </svg>
      <div className="absolute flex flex-col items-center">
        <div className="text-[38px] sm:text-[42px] md:text-[46px] font-extrabold bg-gradient-to-r from-blue-900 to-blue-600 bg-clip-text text-transparent">
          {occupiedPct}%
        </div>
        <div className="text-xs sm:text-sm md:text-[15px] font-bold uppercase tracking-wide text-slate-400">
          Occupied
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, iconBg, waveBg, accent, cardBg }) => (
  <div
    className={`group relative flex flex-col items-center overflow-hidden rounded-[26px] border border-slate-100 pb-14 pt-6 shadow-[0_2px_10px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)] ${cardBg}`}
  >
    <div
      className={`mb-4 flex lg:h-18 lg:w-18 h-14 w-14 items-center justify-center rounded-2xl shadow-sm ${iconBg}`}
    >
      <Icon className="lg:text-[28px] text-[22px] text-white" />
    </div>
    <div className="text-[32px] sm:text-[36px] font-extrabold leading-none text-slate-900">{value}</div>
    <div className="mt-2 text-[14px] sm:text-[15px] font-semibold text-slate-500">{label}</div>

    {/* Wave sits flush against the card's actual bottom edge (no gap) */}
    <div className={`absolute inset-x-[-10%] bottom-0 h-14 rounded-t-[50%] ${waveBg}`} />
    
  </div>
);

const SectionHeader = ({ icon: Icon, title, subtitle, onViewAll }) => (
  <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
    <div className="flex items-start gap-3">
      {Icon ? (
        <div className="mt-1 hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-900 via-blue-700 to-sky-500 text-white shadow-[0_8px_20px_-6px_rgba(30,64,175,0.5)] sm:flex">
          <Icon className="text-lg" />
        </div>
      ) : null}
      <div>
        <h2 className="text-2xl sm:text-[28px] md:text-[34px] font-extrabold leading-tight text-blue-950">
          {title}
        </h2>
        {subtitle ? <p className="mt-1 text-[15px] sm:text-[16px] text-slate-500">{subtitle}</p> : null}
      </div>
    </div>
    {onViewAll ? (
      <button
        type="button"
        onClick={onViewAll}
        className="flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50/60 px-4 py-2 text-sm sm:text-[16px] font-bold text-blue-700 transition hover:bg-blue-600 hover:text-white"
      >
        View All <FaChevronRight className="text-xs" />
      </button>
    ) : null}
  </div>
);

const HotelDashboardHome = () => {
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]); // /hotel/rooms/setup
  const [roomBlocks, setRoomBlocks] = useState([]); // /hotel/room-blocks
  const [bookings, setBookings] = useState([]); // /hotel/all-bookings
  const [history, setHistory] = useState([]); // /hotel/booking-history
  const [payments, setPayments] = useState([]); // aggregated payment history
  const [loading, setLoading] = useState(true);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [tick, setTick] = useState(0); // forces a re-render so "X min ago" stays fresh

  const [quickForm, setQuickForm] = useState({ guestName: "", checkIn: "", checkOut: "", roomType: "" });
  const [quickSaving, setQuickSaving] = useState(false);
  const [quickMsg, setQuickMsg] = useState(null);
  const [showOccupancyForecast, setShowOccupancyForecast] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [showGuestProfile, setShowGuestProfile] = useState(false);
  const [selectedGuestId, setSelectedGuestId] = useState(null);

  // Handle escape key to close modals
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setShowOccupancyForecast(false);
        setShowRoomModal(false);
        setShowGuestProfile(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  /* ---------- navigation wiring for the quick-action buttons ---------- */
  const onAddRoom = () => setShowRoomModal(true);
  const onViewOccupancy = () => setShowOccupancyForecast(true);
  const onGuestBooking = () => navigate("/hotel/guest");
  const onViewAllBookings = () => navigate("/hotel/all-bookings");
  const onViewBookingHistory = () => navigate("/hotel/booking-history");
  const onViewPaymentHistory = () => navigate("/hotel/payment-history");
  const onOpenBooking = (booking) => {
    if (booking?.bookingId) setStoredBookingId(booking.bookingId);
    navigate("/hotel/all-bookings");
  };

  const handleCloseOccupancyForecast = () => {
    setShowOccupancyForecast(false);
  };

  /* ---------- load dashboard data ---------- */

  const loadCore = useCallback(async () => {
    setLoading(true);
    try {
      const [categoriesRes, blocksRes, bookingsRes, historyRes] = await Promise.all([
        API.get("/hotel/rooms/setup"),
        API.get("/hotel/room-blocks").catch(() => ({ data: [] })),
        API.get("/hotel/all-bookings"),
        API.get("/hotel/booking-history").catch(() => ({ data: [] })),
      ]);
      setCategories(Array.isArray(categoriesRes.data) ? categoriesRes.data : []);
      setRoomBlocks(Array.isArray(blocksRes.data) ? blocksRes.data : []);
      setBookings(Array.isArray(bookingsRes.data) ? bookingsRes.data : []);
      setHistory(Array.isArray(historyRes.data) ? historyRes.data : []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCore();
  }, [loadCore]);

  // Keep the "X min ago" label fresh without re-fetching data.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const lastUpdatedLabel = useMemo(() => {
    if (!lastUpdated) return "—";
    const diffMins = Math.floor((Date.now() - lastUpdated.getTime()) / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins === 1) return "1 min ago";
    return `${diffMins} min ago`;
  }, [lastUpdated, tick]);

  // Aggregate payment history dynamically from the most recent bookings
  // (there's no single "all payments" endpoint in the backend, so we combine
  // /hotel/payment-history/:bookingId across the latest bookings).
  useEffect(() => {
    if (!bookings.length) {
      setPaymentsLoading(false);
      return;
    }
    let cancelled = false;
    const loadPayments = async () => {
      setPaymentsLoading(true);
      try {
        const recent = [...bookings]
          .sort((a, b) => Number(b.bookingId || 0) - Number(a.bookingId || 0))
          .slice(0, 8);

        const results = await Promise.all(
          recent.map((b) =>
            API.get(`/hotel/payment-history/${b.bookingId}`)
              .then((res) => ({ booking: b, entries: Array.isArray(res.data) ? res.data : [] }))
              .catch(() => ({ booking: b, entries: [] })),
          ),
        );

        const flattened = results.flatMap(({ booking, entries }) =>
          entries.map((entry) => ({
            id: entry.id || `${booking.bookingId}-${entry.created_at || Math.random()}`,
            bookingId: booking.bookingId,
            bookingCode: booking.bookingCode || `BK-${booking.bookingId}`,
            guestName: entry.guest_name || booking.guest_name || "Guest",
            amount: entry.amount || 0,
            paymentMode: entry.payment_mode || "-",
            createdAt: entry.created_at || booking.check_in,
            status: Number(booking.remainingAmount) > 0 ? "Pending" : "Paid",
          })),
        );

        flattened.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        if (!cancelled) setPayments(flattened.slice(0, 6));
      } catch (err) {
        console.error("Failed to load payment history:", err);
        if (!cancelled) setPayments([]);
      } finally {
        if (!cancelled) setPaymentsLoading(false);
      }
    };
    loadPayments();
    return () => {
      cancelled = true;
    };
  }, [bookings]);

  /* ---------- derived occupancy numbers (all computed from real data) ---------- */

  const totalRooms = useMemo(
    () =>
      categories.reduce((sum, cat) => {
        const count = Array.isArray(cat.roomDetails)
          ? cat.roomDetails.length
          : Array.isArray(cat.rooms)
          ? cat.rooms.length
          : 0;
        return sum + count;
      }, 0),
    [categories],
  );

  const outOfServiceCount = useMemo(() => {
    const set = new Set();
    roomBlocks.forEach((b) => {
      if (String(b.status || "").toLowerCase() === "active" && b.roomNumber) {
        set.add(String(b.roomNumber).trim().toLowerCase());
      }
    });
    return set.size;
  }, [roomBlocks]);

  const occupiedCount = useMemo(() => {
    const set = new Set();
    bookings.forEach((b) => {
      if (String(b.booking_status || "").toLowerCase().includes("checked in")) {
        String(b.rooms || "")
          .split(",")
          .map((r) => r.trim().toLowerCase())
          .filter(Boolean)
          .forEach((r) => set.add(r));
      }
    });
    return Math.min(set.size, Math.max(totalRooms - outOfServiceCount, 0));
  }, [bookings, totalRooms, outOfServiceCount]);

  const availableCount = Math.max(totalRooms - occupiedCount - outOfServiceCount, 0);
  const occupiedPct = totalRooms ? Math.round((occupiedCount / totalRooms) * 100) : 0;
  const availablePct = totalRooms ? Math.round((availableCount / totalRooms) * 100) : 0;
  const outOfServicePct = totalRooms ? Math.max(0, 100 - occupiedPct - availablePct) : 0;

  const today = todayISO();
  const checkInToday = useMemo(
    () => bookings.filter((b) => String(b.check_in || "").slice(0, 10) === today).length,
    [bookings, today],
  );
  const checkOutToday = useMemo(
    () => bookings.filter((b) => String(b.check_out || "").slice(0, 10) === today).length,
    [bookings, today],
  );

  // room number -> room type/category name, for the All Bookings table
  const roomTypeByNumber = useMemo(() => {
    const map = {};
    categories.forEach((cat) => {
      const list = Array.isArray(cat.roomDetails) && cat.roomDetails.length
        ? cat.roomDetails.map((rd) => rd.roomNumber)
        : cat.rooms || [];
      list.forEach((rn) => {
        if (rn) map[String(rn).trim().toLowerCase()] = cat.name;
      });
    });
    return map;
  }, [categories]);

  const getRoomType = (roomsStr) => {
    const first = String(roomsStr || "").split(",")[0]?.trim().toLowerCase();
    return (first && roomTypeByNumber[first]) || "-";
  };

  const recentBookings = useMemo(
    () => [...bookings].sort((a, b) => Number(b.bookingId || 0) - Number(a.bookingId || 0)).slice(0, 4),
    [bookings],
  );

  const recentHistory = useMemo(
    () => [...history].sort((a, b) => Number(b.bookingId || 0) - Number(a.bookingId || 0)).slice(0, 4),
    [history],
  );

  /* ---------- quick guest booking ---------- */

  const submitQuickBooking = async () => {
    setQuickMsg(null);
    if (!quickForm.guestName.trim() || !quickForm.checkIn || !quickForm.checkOut) {
      setQuickMsg({ type: "error", text: "Please fill guest name, check-in and check-out date." });
      return;
    }
    if (quickForm.checkOut < quickForm.checkIn) {
      setQuickMsg({ type: "error", text: "Check-out date cannot be before check-in date." });
      return;
    }
    setQuickSaving(true);
    try {
      await API.post("/hotel/guest", {
        agentBooking: false,
        bookingPoint: "Dashboard Quick Book",
        mobile: "",
        guestName: quickForm.guestName.trim(),
        guestEmail: "",
        checkIn: quickForm.checkIn,
        checkOut: quickForm.checkOut,
        arrival: "12:00",
        departure: "12:00",
        bookingStatus: "Confirmed",
        roomType: quickForm.roomType || undefined,
      });
      setQuickMsg({ type: "success", text: "Booking created successfully." });
      setQuickForm({ guestName: "", checkIn: "", checkOut: "", roomType: "" });
      loadCore();
    } catch (err) {
      console.error(err);
      setQuickMsg({ type: "error", text: err.response?.data?.error || "Could not create booking. Please try again." });
    } finally {
      setQuickSaving(false);
    }
  };

  /* ─────────────────────────── render ─────────────────────────── */

  return (
    <div className="min-h-screen w-full bg-slate-50 px-4 py-6 sm:px-6 sm:py-8 md:px-8 md:py-9 lg:px-10 lg:py-10 min-[1600px]:px-12">
      <div className="w-full max-w-none space-y-6 md:space-y-8">
        {/* Quick action cards */}
        <div className="grid w-full grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <QuickActionCard
            icon={FaBuilding}
            iconGradient="bg-gradient-to-br from-blue-600 to-blue-900"
            title="Occupancy"
            description="View current occupancy and room status"
            buttonLabel="View Occupancy"
            onClick={onViewOccupancy}
          />
          <QuickActionCard
            icon={FaBed}
            iconGradient="bg-gradient-to-br from-yellow-400 to-orange-600"
            title="Add Room"
            description="Add new room to inventory"
            buttonLabel="Add Room"
            onClick={onAddRoom}
          />
          <QuickActionCard
            icon={FaUserPlus}
            iconGradient="bg-gradient-to-br from-emerald-400 to-emerald-600"
            title="Guest Profile"
            description="View and manage guest profiles"
            buttonLabel="View Profiles"
            onClick={() => setShowGuestProfile(true)}
          />
          <QuickActionCard
            icon={FaBolt}
            iconGradient="bg-gradient-to-br from-violet-500 to-indigo-700"
            title="Book Now"
            description="Quick booking for walk-in guest"
            buttonLabel="Book Now"
            onClick={onGuestBooking}
          />
        </div>

        {/* Occupancy overview — the visual highlight of the page */}
        <div className="w-full overflow-hidden rounded-[28px] border border-slate-100 bg-white p-6 sm:p-7 md:p-8 shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
          {/* Header row: icon + title/subtitle on the left, Live Updates badge on the right */}
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-900 via-blue-700 to-sky-500 text-white shadow-[0_8px_20px_-6px_rgba(30,64,175,0.5)]">
                <FaChartPie className="text-2xl" />
              </div>
              <div>
                <h2 className="text-2xl sm:text-[28px] md:text-[34px] font-extrabold leading-tight text-blue-950">
                  Occupancy Overview
                </h2>
                <p className="mt-1 text-[15px] sm:text-[16px] text-slate-500">
                  Real-time room status across your property
                </p>
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-2.5 sm:px-5 sm:py-3">
              <div className="flex items-center gap-2 text-[14px] sm:text-[15px] font-bold text-slate-800">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
                Live Updates
              </div>
              <div className="mt-0.5 text-[12px] sm:text-[13px] text-slate-400">
                Last updated: {lastUpdatedLabel}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="py-14 text-center text-slate-400">Loading occupancy…</div>
          ) : (
            <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-[440px_1fr] xl:grid-cols-[480px_1fr]">
              {/* Overall Occupancy card */}
              <div className="rounded-[26px] border border-slate-100 bg-white p-6 sm:p-8">
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <FaChartLine className="text-[16px]" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-extrabold text-blue-950">Overall Occupancy</h3>
                </div>

                <div className="flex justify-center">
                  <OccupancyDonut
                    occupied={occupiedCount}
                    available={availableCount}
                    outOfService={outOfServiceCount}
                    occupiedPct={occupiedPct}
                  />
                </div>

                <div className="mt-7 divide-y divide-slate-100 border-t border-slate-100">
                  <div className="flex items-center justify-between gap-2 py-3.5">
                    <span className="flex items-center gap-2.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                      <span className="text-[14px] sm:text-[15px] font-semibold text-slate-700">Occupied Rooms</span>
                    </span>
                    <span className="text-[14px] sm:text-[15px] font-bold text-slate-900">
                      {occupiedCount} ({occupiedPct}%)
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 py-3.5">
                    <span className="flex items-center gap-2.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      <span className="text-[14px] sm:text-[15px] font-semibold text-slate-700">Available Rooms</span>
                    </span>
                    <span className="text-[14px] sm:text-[15px] font-bold text-slate-900">
                      {availableCount} ({availablePct}%)
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 py-3.5">
                    <span className="flex items-center gap-2.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                      <span className="text-[14px] sm:text-[15px] font-semibold text-slate-700">Out of Service</span>
                    </span>
                    <span className="text-[14px] sm:text-[15px] font-bold text-slate-900">
                      {outOfServiceCount} ({outOfServicePct}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* Stat cards — narrow, minimum-width tiles that fill the
                  remaining space left by the wider Overall Occupancy card */}
              <div className=" w-full grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                <StatCard
                  icon={FaBuilding}
                  label="Total Rooms"
                  value={totalRooms}
                  cardBg="bg-gradient-to-br from-blue-50 to-blue-100/50"
                  iconBg="bg-gradient-to-br from-blue-600 to-blue-800"
                  waveBg="bg-blue-100/70"
                  accent="text-blue-600"
                />
                <StatCard
                  icon={FaBed}
                  label="Occupied Rooms"
                  value={occupiedCount}
                  cardBg="bg-gradient-to-br from-violet-50 to-purple-100/50"
                  iconBg="bg-gradient-to-br from-violet-500 to-purple-700"
                  waveBg="bg-violet-100/70"
                  accent="text-violet-600"
                />
                <StatCard
                  icon={FaDoorOpen}
                  label="Available Rooms"
                  value={availableCount}
                  cardBg="bg-gradient-to-br from-emerald-50 to-emerald-100/50"
                  iconBg="bg-gradient-to-br from-emerald-500 to-emerald-600"
                  waveBg="bg-emerald-100/70"
                  accent="text-emerald-600"
                />
                <StatCard
                  icon={FaSignInAlt}
                  label="Check-in Today"
                  value={checkInToday}
                  cardBg="bg-gradient-to-br from-yellow-50 to-orange-100/50"
                  iconBg="bg-gradient-to-br from-yellow-400 to-orange-500"
                  waveBg="bg-yellow-100/70"
                  accent="text-yellow-600"
                />
                <StatCard
                  icon={FaSignOutAlt}
                  label="Check-out Today"
                  value={checkOutToday}
                  cardBg="bg-gradient-to-br from-rose-50 to-rose-100/50"
                  iconBg="bg-gradient-to-br from-rose-400 to-rose-600"
                  waveBg="bg-rose-100/70"
                  accent="text-rose-600"
                />
              </div>
            </div>
          )}
        </div>

        {/* All Bookings */}
        <div className="w-full rounded-[24px] border border-blue-100/50 bg-white p-6 sm:p-7 md:p-8 shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
          <SectionHeader icon={FaClipboardList} title="All Bookings" onViewAll={onViewAllBookings} />
          {loading ? (
            <div className="py-8 text-center text-slate-400">Loading bookings…</div>
          ) : recentBookings.length === 0 ? (
            <div className="py-8 text-center text-slate-400">No bookings found.</div>
          ) : (
            <>
              {/* Mobile cards — phone view only */}
              <div className="space-y-4 sm:hidden">
                {recentBookings.map((b) => (
                  <div
                    key={b.bookingId}
                    className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.05)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[15px] font-bold text-slate-800">
                          {b.bookingCode || `BK-${b.bookingId}`}
                        </div>
                        <div className="mt-0.5 text-[14px] text-slate-600">{b.guest_name || "Walk-in Guest"}</div>
                      </div>
                      <span
                        className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-[11px] font-bold tracking-wide ${statusPill(
                          b.booking_status,
                        )}`}
                      >
                        {b.booking_status || "Pending"}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 border-t border-slate-100 pt-4">
                      <CardField label="Room No.">{b.rooms || "-"}</CardField>
                      <CardField label="Room Type">{getRoomType(b.rooms)}</CardField>
                      <CardField label="Check-in">{formatDate(b.check_in)}</CardField>
                      <CardField label="Check-out">{formatDate(b.check_out)}</CardField>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                      <CardField label="Amount">{formatCurrency(b.totalAmount)}</CardField>
                      <button
                        type="button"
                        onClick={() => onOpenBooking(b)}
                        className="rounded-xl border border-blue-100 bg-blue-50/60 p-2.5 text-blue-600 shadow-sm transition hover:bg-gradient-to-br hover:from-blue-600 hover:to-sky-500 hover:text-white"
                      >
                        <FaEye className="text-[15px]" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop / tablet table */}
              <div className="hidden w-full overflow-hidden rounded-2xl border border-slate-100 sm:block">
                <div className="w-full overflow-x-auto">
                  <table className="w-full min-w-[820px] text-left">
                    <thead className="sticky top-0 z-10 bg-gradient-to-r from-blue-50 to-sky-50/60 text-[15px] md:text-[16px] font-bold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="py-4 pl-5 pr-6">Booking ID</th>
                        <th className="py-4 pr-6">Guest Name</th>
                        <th className="py-4 pr-6">Room No.</th>
                        <th className="py-4 pr-6">Room Type</th>
                        <th className="py-4 pr-6">Check-in</th>
                        <th className="py-4 pr-6">Check-out</th>
                        <th className="py-4 pr-6">Status</th>
                        <th className="py-4 pr-6">Amount</th>
                        <th className="py-4 pr-5">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[16px] md:text-[17px]">
                      {recentBookings.map((b) => (
                        <tr key={b.bookingId} className="transition hover:bg-blue-50/40">
                          <td className="py-4 pl-5 pr-6 font-bold text-slate-800">{b.bookingCode || `BK-${b.bookingId}`}</td>
                          <td className="py-4 pr-6 text-slate-700">{b.guest_name || "Walk-in Guest"}</td>
                          <td className="py-4 pr-6 text-slate-600">{b.rooms || "-"}</td>
                          <td className="py-4 pr-6 text-slate-600">{getRoomType(b.rooms)}</td>
                          <td className="py-4 pr-6 text-slate-600">{formatDate(b.check_in)}</td>
                          <td className="py-4 pr-6 text-slate-600">{formatDate(b.check_out)}</td>
                          <td className="py-4 pr-6">
                            <span className={`inline-flex items-center rounded-full px-4 py-1.5 text-xs sm:text-[13px] font-bold tracking-wide ${statusPill(b.booking_status)}`}>
                              {b.booking_status || "Pending"}
                            </span>
                          </td>
                          <td className="py-4 pr-6 font-semibold text-slate-800">{formatCurrency(b.totalAmount)}</td>
                          <td className="py-4 pr-5">
                            <button
                              type="button"
                              onClick={() => onOpenBooking(b)}
                              className="rounded-xl border border-blue-100 bg-blue-50/60 p-2.5 text-blue-600 shadow-sm transition hover:bg-gradient-to-br hover:from-blue-600 hover:to-sky-500 hover:text-white"
                            >
                              <FaEye className="text-[15px]" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Booking History */}
        <div className="w-full rounded-[24px] border border-blue-100/50 bg-white p-6 sm:p-7 md:p-8 shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
          <SectionHeader icon={FaHistory} title="Booking History" onViewAll={onViewBookingHistory} />
          {loading ? (
            <div className="py-8 text-center text-slate-400">Loading history…</div>
          ) : recentHistory.length === 0 ? (
            <div className="py-8 text-center text-slate-400">No booking history yet.</div>
          ) : (
            <>
              {/* Mobile cards — phone view only */}
              <div className="space-y-4 sm:hidden">
                {recentHistory.map((row) => (
                  <div
                    key={row.bookingId}
                    className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.05)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[15px] font-bold text-slate-800">
                          {row.bookingCode || `BK-${row.bookingId}`}
                        </div>
                        <div className="mt-0.5 text-[14px] text-slate-600">{row.guest_name || "Guest"}</div>
                      </div>
                      <Badge variant={Number(row.remainingAmount) > 0 ? "balance" : "completed"}>
                        {Number(row.remainingAmount) > 0 ? "Balance Due" : "Completed"}
                      </Badge>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 border-t border-slate-100 pt-4">
                      <CardField label="Room Type">{getRoomType(row.rooms || row.roomDetails)}</CardField>
                      <CardField label="Total Amount">{formatCurrency(row.totalAmount)}</CardField>
                      <CardField label="Check-in">{formatDate(row.check_in)}</CardField>
                      <CardField label="Check-out">{formatDate(row.check_out)}</CardField>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop / tablet table */}
              <div className="hidden w-full overflow-hidden rounded-2xl border border-slate-100 sm:block">
                <div className="w-full overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left">
                    <thead className="sticky top-0 z-10 bg-gradient-to-r from-blue-50 to-sky-50/60 text-[15px] md:text-[16px] font-bold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="py-4 pl-5 pr-6">Booking ID</th>
                        <th className="py-4 pr-6">Guest Name</th>
                        <th className="py-4 pr-6">Room Type</th>
                        <th className="py-4 pr-6">Check-in</th>
                        <th className="py-4 pr-6">Check-out</th>
                        <th className="py-4 pr-6">Total Amount</th>
                        <th className="py-4 pr-5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[16px] md:text-[17px]">
                      {recentHistory.map((row) => (
                        <tr key={row.bookingId} className="transition hover:bg-blue-50/40">
                          <td className="py-4 pl-5 pr-6 font-bold text-slate-800">{row.bookingCode || `BK-${row.bookingId}`}</td>
                          <td className="py-4 pr-6 text-slate-700">{row.guest_name || "Guest"}</td>
                          <td className="py-4 pr-6 text-slate-600">{getRoomType(row.rooms || row.roomDetails)}</td>
                          <td className="py-4 pr-6 text-slate-600">{formatDate(row.check_in)}</td>
                          <td className="py-4 pr-6 text-slate-600">{formatDate(row.check_out)}</td>
                          <td className="py-4 pr-6 font-semibold text-slate-800">{formatCurrency(row.totalAmount)}</td>
                          <td className="py-4 pr-5">
                            <Badge variant={Number(row.remainingAmount) > 0 ? "balance" : "completed"}>
                              {Number(row.remainingAmount) > 0 ? "Balance Due" : "Completed"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Payment History */}
        <div className="w-full rounded-[24px] border border-blue-100/50 bg-white p-6 sm:p-7 md:p-8 shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
          <SectionHeader icon={FaWallet} title="Payment History" onViewAll={onViewPaymentHistory} />
          {paymentsLoading ? (
            <div className="py-8 text-center text-slate-400">Loading payments…</div>
          ) : payments.length === 0 ? (
            <div className="py-8 text-center text-slate-400">No payment records found.</div>
          ) : (
            <>
              {/* Mobile cards — phone view only */}
              <div className="space-y-4 sm:hidden">
                {payments.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.05)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[15px] font-bold text-slate-800">PAY-{String(p.id).slice(-4)}</div>
                        <div className="mt-0.5 text-[14px] text-slate-600">{p.guestName}</div>
                      </div>
                      <Badge variant={p.status === "Paid" ? "paid" : "pending"}>{p.status}</Badge>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 border-t border-slate-100 pt-4">
                      <CardField label="Booking ID">{p.bookingCode}</CardField>
                      <CardField label="Amount">{formatCurrency(p.amount)}</CardField>
                      <CardField label="Payment Method">{p.paymentMode}</CardField>
                      <CardField label="Payment Date">{formatDate(p.createdAt)}</CardField>
                    </div>

                    <div className="mt-4 flex justify-end border-t border-slate-100 pt-4">
                      <button
                        type="button"
                        className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-[13px] font-semibold text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
                        aria-label="Download receipt"
                      >
                        <FaDownload className="text-[13px]" />
                        Receipt
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop / tablet table */}
              <div className="hidden w-full overflow-hidden rounded-2xl border border-slate-100 sm:block">
                <div className="w-full overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left">
                    <thead className="sticky top-0 z-10 bg-gradient-to-r from-blue-50 to-sky-50/60 text-[15px] md:text-[16px] font-bold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="py-4 pl-5 pr-6">Payment ID</th>
                        <th className="py-4 pr-6">Booking ID</th>
                        <th className="py-4 pr-6">Guest Name</th>
                        <th className="py-4 pr-6">Amount</th>
                        <th className="py-4 pr-6">Payment Method</th>
                        <th className="py-4 pr-6">Payment Date</th>
                        <th className="py-4 pr-5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[16px] md:text-[17px]">
                      {payments.map((p) => (
                        <tr key={p.id} className="transition hover:bg-blue-50/40">
                          <td className="py-4 pl-5 pr-6 font-bold text-slate-800">PAY-{String(p.id).slice(-4)}</td>
                          <td className="py-4 pr-6 text-slate-600">{p.bookingCode}</td>
                          <td className="py-4 pr-6 text-slate-700">{p.guestName}</td>
                          <td className="py-4 pr-6 font-semibold text-slate-800">{formatCurrency(p.amount)}</td>
                          <td className="py-4 pr-6 text-slate-600">{p.paymentMode}</td>
                          <td className="py-4 pr-6 text-slate-600">{formatDate(p.createdAt)}</td>
                          <td className="py-4 pr-5">
                            <div className="flex items-center gap-2.5">
                              <Badge variant={p.status === "Paid" ? "paid" : "pending"}>{p.status}</Badge>
                              <button
                                type="button"
                                className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
                                aria-label="Download receipt"
                              >
                                <FaDownload className="text-[13px]" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Occupancy Forecast Modal */}
        {showOccupancyForecast && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/55 p-2 sm:p-4 backdrop-blur-sm">
            <div className="relative flex h-full max-h-[1500px] w-full max-w-[1700px] flex-col overflow-y-auto rounded-[32px] bg-white shadow-[0_30px_90px_rgba(15,23,42,0.35)]">
              <div className="h-1.5 w-full bg-gradient-to-r from-blue-900 via-blue-600 to-sky-500" />
              <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white/95 px-6 py-5 sm:px-8 sm:py-6 backdrop-blur">
                <div>
                  <h3 className="text-2xl sm:text-[28px] font-extrabold text-slate-900">Occupancy Forecast</h3>
                  <p className="mt-1 text-[15px] sm:text-[16px] text-slate-500">Detailed room occupancy analysis and forecast</p>
                </div>
                <button
                  type="button"
                  aria-label="Close modal"
                  onClick={() => setShowOccupancyForecast(false)}
                  className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  <FaTimes className="text-lg" />
                </button>
              </div>
              <div className="p-5 sm:p-7">
                <OccupancyForecast onClose={() => setShowOccupancyForecast(false)} />
              </div>
            </div>
          </div>
        )}

        {/* Room Modal */}
        {showRoomModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/55 p-2 sm:p-4 backdrop-blur-sm">
            <div className="relative flex h-full max-h-[1500px] w-full max-w-[1700px] flex-col overflow-y-auto rounded-[32px] bg-white shadow-[0_30px_90px_rgba(15,23,42,0.35)]">
              <div className="h-1.5 w-full bg-gradient-to-r from-blue-900 via-blue-600 to-sky-500" />
              <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white/95 px-6 py-5 sm:px-8 sm:py-6 backdrop-blur">
                <div>
                  <h3 className="text-2xl sm:text-[28px] font-extrabold text-slate-900">Add Room</h3>
                  <p className="mt-1 text-[15px] sm:text-[16px] text-slate-500">Add new room to inventory</p>
                </div>
                <button
                  type="button"
                  aria-label="Close modal"
                  onClick={() => setShowRoomModal(false)}
                  className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  <FaTimes className="text-lg" />
                </button>
              </div>
              <div className="p-5 sm:p-7">
                <Room />
              </div>
            </div>
          </div>
        )}

        {/* Guest Profile Modal */}
        {showGuestProfile && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/55 p-2 sm:p-4 backdrop-blur-sm">
            <div className="relative flex h-full max-h-[1500px] w-full max-w-[1700px] flex-col overflow-y-auto rounded-[32px] bg-white shadow-[0_30px_90px_rgba(15,23,42,0.35)]">
              <div className="h-1.5 w-full bg-gradient-to-r from-blue-900 via-blue-600 to-sky-500" />
              <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white/95 px-6 py-5 sm:px-8 sm:py-6 backdrop-blur">
                <div>
                  <h3 className="text-2xl sm:text-[28px] font-extrabold text-slate-900">Guest Profile</h3>
                  <p className="mt-1 text-[15px] sm:text-[16px] text-slate-500">Manage guest profiles and reservations</p>
                </div>
                <button
                  type="button"
                  aria-label="Close modal"
                  onClick={() => setShowGuestProfile(false)}
                  className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  <FaTimes className="text-lg" />
                </button>
              </div>
              <div className="p-5 sm:p-7">
                <GuestProfile onClose={() => setShowGuestProfile(false)} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════
   Router
   ═══════════════════════════════════════════════════════════════════════ */

const Hotel = () => {
  const location = useLocation();

  // True for every URL that used to be a separate wizard step / All Bookings /
  // Edit Booking page — these all now render <BookingFlow />, which draws its
  // own flow bar, so we skip the old BookingSteps top bar + extra wrapper card
  // for these paths and let BookingFlow use the full width. The new Dashboard
  // page is full-width too, so it's included via FULL_WIDTH_PATHS.
  const isBookingFlowPage =
    location.pathname === "/hotel" ||
    location.pathname === "/hotel/" ||
    FULL_WIDTH_PATHS.some((p) => location.pathname.includes(`/hotel/${p}`));

  return (
    <div className="min-h-screen w-full max-w-none bg-[radial-gradient(circle_at_top,_rgba(30,64,175,0.10),_transparent_35%),linear-gradient(180deg,#f5f8ff_0%,#ffffff_45%,#f6faff_100%)] px-4 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8 lg:px-10 lg:py-10 min-[1600px]:px-12">
      <div className="w-full max-w-none space-y-5">
        {!isBookingFlowPage ? (
          <div className="w-full rounded-[28px] border border-blue-100/60 bg-white/80 p-4 shadow-[0_15px_45px_rgba(30,64,175,0.08)] backdrop-blur">
            <BookingSteps />
          </div>
        ) : null}

        <div
          className={
            isBookingFlowPage
              ? "w-full max-w-none"
              : "w-full max-w-none rounded-[30px] border border-blue-100/60 bg-white/80 p-4 shadow-[0_18px_55px_rgba(30,64,175,0.08)] backdrop-blur"
          }
        >
          <Routes>
            {/* Landing on /hotel now goes to the Dashboard first */}
            <Route index element={<Navigate to="dashboard" replace />} />

            {/* Redesigned overview/dashboard page (matches the shared UI) */}
            <Route path="dashboard" element={<HotelDashboardHome />} />

            {/* Every old wizard step + all-bookings + edit-booking -> ONE component.
                Sidebar links like /hotel/guest and /hotel/all-bookings keep working
                unchanged; BookingFlow just opens on the right internal view. */}
            <Route path="guest"           element={<BookingFlow />} />
            <Route path="other-booking"   element={<BookingFlow />} />
            <Route path="reference"       element={<BookingFlow />} />
            <Route path="company"         element={<BookingFlow />} />
            <Route path="room"            element={<BookingFlow />} />
            <Route path="pax"             element={<BookingFlow />} />
            <Route path="room-tariff"     element={<BookingFlow />} />
            <Route path="advance"         element={<BookingFlow />} />
            <Route path="communication"   element={<BookingFlow />} />
            <Route path="collect-payment" element={<BookingFlow />} />
            <Route path="all-bookings"    element={<BookingFlow />} />
            <Route path="edit-booking"    element={<BookingFlow />} />
            {/* ── Features kept separate from the booking flow (unchanged) ── */}
            <Route path="booking-history"    element={<BookingFlow />} />
            <Route path="payment-history"    element={<BookingFlow />} />
            <Route path="folio"              element={<FolioView />} />
            <Route path="room-maintenance"   element={<RoomMaintenance />} />
            <Route path="guest-profile"      element={<GuestProfile />} />
            <Route path="occupancy-forecast" element={<OccupancyForecast />} />
            <Route path="group-booking"      element={<GroupBooking />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};

export default Hotel;