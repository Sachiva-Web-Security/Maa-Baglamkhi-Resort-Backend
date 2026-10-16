import React, { useEffect, useMemo, useState } from "react";
import {
  FaArrowRight,
  FaBan,
  FaBed,
  FaCalendarAlt,
  FaCheckCircle,
  FaEdit,
  FaEllipsisV,
  FaEye,
  FaExclamationTriangle,
  FaFileInvoiceDollar,
  FaHistory,
  FaLayerGroup,
  FaMoneyBillWave,
  FaMoneyCheckAlt,
  FaPhone,
  FaPlus,
  FaReceipt,
  FaRedoAlt,
  FaSearch,
  FaSlidersH,
  FaTimes,
  FaTimesCircle,
  FaWallet,
  FaWhatsapp,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import API from "../../api";
import { setStoredBookingId } from "./bookingSession";

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const formatDate = (value) => {
  if (!value) return "--";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "--";
  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getBookingStatusMeta = (status) => {
  const normalized = String(status || "").toLowerCase();
  if (normalized.includes("checked in")) {
    return { label: "Checked In", classes: "bg-sky-100 text-sky-700 ring-1 ring-sky-200" };
  }
  if (normalized.includes("checked out")) {
    return { label: "Checked Out", classes: "bg-slate-100 text-slate-600 ring-1 ring-slate-200" };
  }
  if (normalized.includes("cancel")) {
    return { label: "Cancelled", classes: "bg-rose-100 text-rose-700 ring-1 ring-rose-200" };
  }
  if (normalized.includes("pencil") || normalized.includes("tentative")) {
    return { label: "Tentative", classes: "bg-amber-100 text-amber-700 ring-1 ring-amber-200" };
  }
  return { label: "Confirmed", classes: "bg-blue-100 text-blue-700 ring-1 ring-blue-200" };
};

const getPaymentStatusMeta = (remaining) =>
  Number(remaining) <= 0
    ? { label: "Fully Paid", classes: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200" }
    : { label: "Balance Due", classes: "bg-rose-100 text-rose-700 ring-1 ring-rose-200" };

const getGuestInitials = (name) =>
  String(name || "Guest")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "G";

const getActionMeta = (key) => {
  const metaMap = {
    view: {
      icon: FaEye,
      tone: "from-sky-500 to-blue-500",
      surface: "bg-sky-50 text-sky-700",
    },
    invoice: {
      icon: FaFileInvoiceDollar,
      tone: "from-violet-500 to-indigo-500",
      surface: "bg-violet-50 text-violet-700",
    },
    check: {
      icon: FaArrowRight,
      tone: "from-emerald-500 to-teal-500",
      surface: "bg-emerald-50 text-emerald-700",
    },
    edit: {
      icon: FaEdit,
      tone: "from-amber-500 to-orange-500",
      surface: "bg-amber-50 text-amber-700",
    },
    refund: {
      icon: FaMoneyCheckAlt,
      tone: "from-fuchsia-500 to-pink-500",
      surface: "bg-fuchsia-50 text-fuchsia-700",
    },
    cancel: {
      icon: FaBan,
      tone: "from-rose-500 to-red-500",
      surface: "bg-rose-50 text-rose-700",
    },
    collect: {
      icon: FaWallet,
      tone: "from-blue-600 to-cyan-500",
      surface: "bg-blue-50 text-blue-700",
    },
    folio: {
      icon: FaReceipt,
      tone: "from-violet-500 to-purple-500",
      surface: "bg-violet-50 text-violet-700",
    },
    history: {
      icon: FaHistory,
      tone: "from-slate-600 to-slate-500",
      surface: "bg-slate-100 text-slate-700",
    },
  };

  return metaMap[key] || {
    icon: FaArrowRight,
    tone: "from-slate-600 to-slate-500",
    surface: "bg-slate-100 text-slate-700",
  };
};

const SUMMARY_CARDS = [
  { key: "totalBookings", label: "Total Bookings", icon: FaLayerGroup, tone: "from-slate-950 via-slate-800 to-slate-700" },
  { key: "totalRevenue", label: "Total Revenue", icon: FaMoneyBillWave, tone: "from-blue-700 via-blue-600 to-cyan-500" },
  { key: "totalReceived", label: "Received", icon: FaWallet, tone: "from-emerald-600 via-teal-500 to-cyan-500" },
  { key: "totalBalance", label: "Balance Due", icon: FaReceipt, tone: "from-amber-500 via-orange-500 to-orange-400" },
];

const BOOKINGS_PAGE_SIZE = 10;

const viewConfig = {
  active: {
    title: "Active bookings",
    subtitle: "Upcoming arrivals, in-house guests, and payment follow-up in one clean dashboard.",
    badge: "Live Operations",
  },
  history: {
    title: "Checkout history",
    subtitle: "Review completed stays, settled folios, and post-checkout activity without clutter.",
    badge: "Past Stays",
  },
};

const actionButtonCls =
  "inline-flex min-h-[46px] w-full items-center justify-center whitespace-nowrap rounded-full px-4.5 py-3 text-base font-bold transition";

const feedbackToneClasses = {
  success: {
    accent: "from-emerald-500 to-teal-500",
    badge: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
    icon: FaCheckCircle,
  },
  error: {
    accent: "from-rose-500 to-red-500",
    badge: "bg-rose-50 text-rose-700 ring-1 ring-rose-100",
    icon: FaExclamationTriangle,
  },
};

const AllBooking = () => {
  const [bookings, setBookings] = useState([]);
  const [historyBookings, setHistoryBookings] = useState([]);
  const [viewMode, setViewMode] = useState("active");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [openActionMenu, setOpenActionMenu] = useState("");
  const [cancelModal, setCancelModal] = useState({ open: false, booking: null, reason: "", submitting: false });
  const [feedbackModal, setFeedbackModal] = useState({ open: false, type: "success", title: "", message: "" });
  const [phoneEditModal, setPhoneEditModal] = useState({ open: false, booking: null, mobile: "", saving: false });
  const navigate = useNavigate();

  // Admin-only — employees can VIEW but not edit phone numbers.
  const currentRole = (localStorage.getItem("role") || "").toLowerCase();
  const isAdmin = currentRole === "admin";

  const openFeedbackModal = (type, title, message) => {
    setFeedbackModal({ open: true, type, title, message });
  };

  const closeFeedbackModal = () => {
    setFeedbackModal((current) => ({ ...current, open: false }));
  };

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const [activeRes, historyRes] = await Promise.all([
        API.get("/hotel/all-bookings"),
        API.get("/hotel/booking-history"),
      ]);
      setBookings(Array.isArray(activeRes.data) ? activeRes.data : []);
      setHistoryBookings(Array.isArray(historyRes.data) ? historyRes.data : []);
    } catch (err) {
      console.error("Fetch Error:", err);
      alert("Server connection error");
    } finally {
      setLoading(false);
    }
  };

  const handleLifecycle = async (booking, action) => {
    try {
      await API.put(`/hotel/${action}/${booking.bookingId}`);
      await fetchBookings();
      openFeedbackModal(
        "success",
        action === "check-out" ? "Check-out completed" : "Check-in completed",
        action === "check-out"
          ? "The guest was checked out successfully. The booking is now available in booking history."
          : "The guest was checked in successfully.",
      );
    } catch (err) {
      console.error(err);
      openFeedbackModal(
        "error",
        action === "check-out" ? "Check-out failed" : "Check-in failed",
        action === "check-out"
          ? "We could not complete the guest check-out. Please try again."
          : "We could not complete the guest check-in. Please try again.",
      );
    }
  };

  const handleCancelBooking = async () => {
    const booking = cancelModal.booking;
    const reason = String(cancelModal.reason || "").trim();
    if (!booking?.bookingId) {
      alert("Valid booking nahi mili.");
      return;
    }
    if (!reason) {
      alert("Cancellation reason likhna zaroori hai.");
      return;
    }
    try {
      setCancelModal((current) => ({ ...current, submitting: true }));
      await API.put(`/hotel/cancel/${booking.bookingId}`, { reason });
      setCancelModal({ open: false, booking: null, reason: "", submitting: false });
      fetchBookings();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Booking could not be cancelled.");
      setCancelModal((current) => ({ ...current, submitting: false }));
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleRefund = async (id) => {
    const amount = prompt("Enter refund amount");
    if (!amount || Number.isNaN(Number(amount))) {
      alert("Invalid amount");
      return;
    }
    try {
      await API.post(`/hotel/refund/${id}`, { amount });
      alert("Refund Done");
      fetchBookings();
    } catch (err) {
      console.error("Refund failed:", err);
      alert("Refund Failed");
    }
  };

  // Admin-only: update the customer's phone number so WhatsApp + SMS
  // notifications go to the correct number.
  const handleSavePhone = async () => {
    const booking = phoneEditModal.booking;
    if (!booking?.bookingId) return;
    const mobile = String(phoneEditModal.mobile || "").replace(/\D+/g, "");
    if (mobile.length < 10) {
      alert("Please enter a valid phone number (at least 10 digits).");
      return;
    }
    setPhoneEditModal((current) => ({ ...current, saving: true }));
    try {
      await API.put(`/hotel/guest/phone/${booking.bookingId}`, { mobile });
      setPhoneEditModal({ open: false, booking: null, mobile: "", saving: false });
      await fetchBookings();
      openFeedbackModal(
        "success",
        "Phone Number Updated",
        `Phone number for booking #${booking.bookingId} has been updated.`,
      );
    } catch (err) {
      console.error("Phone update failed:", err);
      setPhoneEditModal((current) => ({ ...current, saving: false }));
      openFeedbackModal(
        "error",
        "Update Failed",
        err.response?.data?.error || "We could not save the phone number. Please try again.",
      );
    }
  };

  const visibleBookings = useMemo(
    () => (viewMode === "history" ? historyBookings : bookings),
    [bookings, historyBookings, viewMode],
  );

  const filteredBookings = useMemo(() => {
    const query = String(searchQuery || "").trim().toLowerCase();
    if (!query) return visibleBookings;

    return visibleBookings.filter((booking) => {
      const haystack = [
        booking.guest_name,
        booking.bookingId,
        booking.bookingCode,
        booking.rooms,
        booking.mobile,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [searchQuery, visibleBookings]);

  const summary = useMemo(() => {
    return visibleBookings.reduce(
      (acc, booking) => {
        acc.totalBookings += 1;
        acc.totalRevenue += Number(booking.totalAmount || 0);
        acc.totalReceived += Number(booking.paidAmount || 0);
        acc.totalBalance += Number(booking.remainingAmount || 0);
        acc.totalRefund += Number(booking.refundAmount || 0);
        return acc;
      },
      { totalBookings: 0, totalRevenue: 0, totalReceived: 0, totalBalance: 0, totalRefund: 0 },
    );
  }, [visibleBookings]);

  const quickSnapshot = useMemo(() => {
    return filteredBookings.reduce(
      (acc, booking) => {
        const remaining = Number(booking.remainingAmount || 0);
        const status = String(booking.booking_status || "").toLowerCase();
        if (status.includes("checked in")) acc.checkedIn += 1;
        if (status.includes("confirmed")) acc.confirmed += 1;
        if (remaining > 0) acc.balanceDue += 1;
        return acc;
      },
      { checkedIn: 0, confirmed: 0, balanceDue: 0 },
    );
  }, [filteredBookings]);

  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / BOOKINGS_PAGE_SIZE));
  const paginatedBookings = filteredBookings.slice((page - 1) * BOOKINGS_PAGE_SIZE, page * BOOKINGS_PAGE_SIZE);

  useEffect(() => {
    setPage(1);
    setOpenActionMenu("");
  }, [viewMode, bookings, historyBookings, searchQuery]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const buildActionButtons = (booking) => {
    const isCheckedIn = String(booking.booking_status || "").toLowerCase().includes("checked in");
    const remaining = Number(booking.remainingAmount || 0);
    const items = [
      {
        key: "view",
        label: "View",
        className: `${actionButtonCls} bg-slate-950 text-white hover:bg-slate-800`,
        onClick: () => {
          setStoredBookingId(booking.bookingId);
          navigate("/hotel/communication", { state: { bookingId: booking.bookingId } });
        },
      },
      {
        key: "invoice",
        label: "Invoice",
        className: `${actionButtonCls} bg-indigo-600 text-white hover:bg-indigo-700`,
        onClick: () => navigate(`/invoice/${booking.bookingId}`),
      },
    ];

    if (viewMode === "active") {
      items.push(
        {
          key: "check",
          label: isCheckedIn ? "Check Out" : "Check In",
          className: `${actionButtonCls} bg-emerald-600 text-white hover:bg-emerald-700`,
          onClick: () => handleLifecycle(booking, isCheckedIn ? "check-out" : "check-in"),
        },
        {
          key: "edit",
          label: "Edit",
          className: `${actionButtonCls} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`,
          onClick: () => {
            setStoredBookingId(booking.bookingId);
            navigate("/hotel/edit-booking", {
              state: { bookingId: booking.bookingId, bookingCode: booking.bookingCode || "", autoEdit: true },
            });
          },
        },
        {
          key: "refund",
          label: "Refund",
          className: `${actionButtonCls} bg-fuchsia-600 text-white hover:bg-fuchsia-700`,
          onClick: () => handleRefund(booking.bookingId),
        },
      );

      if (!isCheckedIn) {
        items.push({
          key: "cancel",
          label: "Cancel",
          className: `${actionButtonCls} bg-rose-600 text-white hover:bg-rose-700`,
          onClick: () => setCancelModal({ open: true, booking, reason: "", submitting: false }),
        });
      }

      if (remaining > 0) {
        items.push({
          key: "collect",
          label: "Collect",
          className: `${actionButtonCls} bg-blue-600 text-white hover:bg-blue-700`,
          onClick: () => {
            setStoredBookingId(booking.bookingId);
            navigate("/hotel/collect-payment", {
              state: { bookingId: booking.bookingId, remainingAmount: remaining },
            });
          },
        });
      }

      items.push({
        key: "folio",
        label: "Folio",
        className: `${actionButtonCls} border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100`,
        onClick: () => {
          setStoredBookingId(booking.bookingId);
          navigate("/hotel/folio", { state: { bookingId: booking.bookingId } });
        },
      });
    }

    items.push({
      key: "history",
      label: "History",
      className: `${actionButtonCls} border border-slate-200 bg-white text-slate-600 hover:bg-slate-50`,
      onClick: () => navigate("/hotel/payment-history", { state: { bookingId: booking.bookingId } }),
    });

    // Admin-only: edit phone
    if (isAdmin) {
      items.push({
        key: "editPhone",
        label: "Edit Phone",
        className: `${actionButtonCls} border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100`,
        onClick: () => setPhoneEditModal({ open: true, booking, mobile: booking.mobile || "", saving: false }),
      });
    }

    return items;
  };

  const activeView = viewConfig[viewMode];

  const renderBookingCards = (cardGridClasses = "xl:hidden") => (
    <div className={`mt-6 grid gap-4 ${cardGridClasses}`}>
      {paginatedBookings.map((booking) => {
        const paid = Number(booking.paidAmount || 0);
        const discount = Number(booking.discountAmount || 0);
        const remaining = Number(booking.remainingAmount || 0);
        const total = Number(booking.totalAmount || 0);
        const bookingStatusMeta = getBookingStatusMeta(booking.booking_status);
        const paymentStatusMeta = getPaymentStatusMeta(remaining);
        const actionButtons = buildActionButtons(booking);

        return (
          <article
            key={booking.bookingId}
            className="rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)]"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-sm font-bold uppercase tracking-[0.24em] text-slate-400">
                  Booking #{booking.bookingId}
                </div>
                <h3 className="mt-2 text-2xl font-black text-slate-900">
                  {booking.guest_name || "Walk-in Guest"}
                </h3>
                <p className="mt-1 text-base font-medium text-slate-500">Room {booking.rooms || "Not assigned"}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-bold uppercase tracking-[0.16em] ${bookingStatusMeta.classes}`}
                  >
                    {bookingStatusMeta.label}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-bold uppercase tracking-[0.16em] ${paymentStatusMeta.classes}`}
                  >
                    {paymentStatusMeta.label}
                  </span>
                </div>
              </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-bold uppercase tracking-[0.22em] text-slate-500">Stay Window</div>
                <div className="mt-2 text-base font-bold text-slate-900">{formatDate(booking.check_in)}</div>
                <div className="text-sm uppercase tracking-[0.16em] text-slate-400">to</div>
                <div className="text-base font-bold text-slate-900">{formatDate(booking.check_out)}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-sm uppercase tracking-[0.2em] font-bold text-slate-500">Total</div>
                  <div className="mt-2 text-xl font-black text-slate-900">{formatCurrency(total)}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-sm uppercase tracking-[0.2em] font-bold text-slate-500">Phone</div>
                  <div className="mt-2 text-lg font-bold text-slate-900 break-all">{booking.mobile || "--"}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-sm uppercase tracking-[0.2em] font-bold text-slate-500">Paid</div>
                  <div className="mt-2 text-xl font-black text-emerald-700">{formatCurrency(paid)}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-sm uppercase tracking-[0.2em] font-bold text-slate-500">Discount</div>
                  <div className="mt-2 text-xl font-black text-amber-700">{formatCurrency(discount)}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-sm uppercase tracking-[0.2em] font-bold text-slate-500">Balance</div>
                  <div className={`mt-2 text-xl font-black ${remaining > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                    {formatCurrency(remaining)}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {actionButtons.map((button) => (
                <button
                  key={button.key}
                  type="button"
                  onClick={button.onClick}
                  className={button.className}
                >
                  {button.label}
                </button>
              ))}
            </div>
          </article>
        );
      })}
    </div>
  );

  const renderDesktopTable = () => (
    <div className="mt-6 hidden rounded-[20px] border border-slate-200 bg-[#F9FAFB] p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)] xl:block">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-2xl font-black tracking-[-0.03em] text-slate-900">Active bookings</h3>
          <p className="mt-1 text-sm font-medium text-slate-500">Current guest stays and balances in one clean workspace.</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative min-w-[280px]">
            <FaSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search guests..."
              className="h-12 w-full rounded-[14px] border border-slate-200 bg-white pl-11 pr-4 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
            />
          </label>
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="text-sm font-bold text-indigo-600 transition hover:text-indigo-700"
          >
            View all
          </button>
        </div>
      </div>

      <div className="mt-5 rounded-[16px] border border-slate-200 bg-white">
        <table className="w-full table-fixed text-left">
          <thead className="bg-slate-50">
            <tr className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              <th className="w-[18%] px-6 py-4">Guest</th>
              <th className="w-[10%] px-6 py-4">Type</th>
              <th className="w-[10%] px-6 py-4">Phone</th>
              <th className="w-[8%] px-6 py-4">Room</th>
              <th className="w-[10%] px-6 py-4">Check-in</th>
              <th className="w-[10%] px-6 py-4">Check-out</th>
              <th className="w-[10%] px-6 py-4 text-right">Total</th>
              <th className="w-[12%] px-6 py-4">Status</th>
              <th className="w-[8%] px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedBookings.map((booking) => {
              const remaining = Number(booking.remainingAmount || 0);
              const total = Number(booking.totalAmount || 0);
              const bookingStatusMeta = getBookingStatusMeta(booking.booking_status);
              const paymentStatusMeta = getPaymentStatusMeta(remaining);
              const actionButtons = buildActionButtons(booking);
              const guestName = booking.guest_name || "Walk-in Guest";
              const bookingRef = booking.bookingCode || `Booking #${booking.bookingId}`;

              return (
                <tr
                  key={booking.bookingId}
                  className="border-t border-slate-200 text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-sm font-black text-white shadow-[0_10px_24px_rgba(99,102,241,0.22)]">
                        {getGuestInitials(guestName)}
                      </div>
                      <div className="min-w-0 overflow-hidden">
                        <div className="truncate text-base font-bold text-slate-900">{guestName}</div>
                        <div className="mt-1 text-xs font-medium text-slate-400">{bookingRef}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">
                      {booking.bookingType || "Walk-in"}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{booking.mobile || "--"}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="font-semibold text-slate-900">{booking.rooms || "--"}</div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="font-medium text-slate-700">{formatDate(booking.check_in)}</div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="font-medium text-slate-700">{formatDate(booking.check_out)}</div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="font-black text-slate-900">{formatCurrency(total)}</div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col items-start gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${paymentStatusMeta.classes}`}
                      >
                        {remaining > 0 ? "Balance Due" : "Paid"}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${bookingStatusMeta.classes}`}
                      >
                        {bookingStatusMeta.label}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="relative inline-flex justify-end">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenActionMenu((current) =>
                            current === String(booking.bookingId) ? "" : String(booking.bookingId),
                          )
                        }
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                      >
                        <FaEllipsisV className="text-sm" />
                      </button>

                      {openActionMenu === String(booking.bookingId) ? (
                        <>
                          <button
                            type="button"
                            aria-label="Close actions"
                            onClick={() => setOpenActionMenu("")}
                            className="fixed inset-0 z-10 cursor-default bg-transparent"
                          />
                          <div className="absolute right-0 top-12 z-20 w-72 overflow-hidden rounded-[20px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-3 shadow-[0_22px_55px_rgba(15,23,42,0.16)]">
                            <div className="overflow-hidden rounded-[18px] bg-[linear-gradient(135deg,#eef2ff_0%,#f5f3ff_52%,#ffffff_100%)] p-4">
                              <div className="flex items-start gap-3">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-sm font-black text-white shadow-[0_10px_24px_rgba(99,102,241,0.22)]">
                                  {getGuestInitials(guestName)}
                                </div>
                                <div className="min-w-0 flex-1 text-left">
                                  <div className="truncate text-sm font-black text-slate-900">{guestName}</div>
                                  <div className="mt-1 text-xs font-semibold text-slate-500">{bookingRef}</div>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${paymentStatusMeta.classes}`}>
                                      {remaining > 0 ? "Balance Due" : "Paid"}
                                    </span>
                                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${bookingStatusMeta.classes}`}>
                                      {bookingStatusMeta.label}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="mt-3 flex items-center justify-between px-1">
                              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
                                Quick Actions
                              </div>
                              <div className="text-[11px] font-semibold text-slate-400">Tap to continue</div>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-2">
                              {actionButtons.map((button) => {
                                const actionMeta = getActionMeta(button.key);
                                const ActionIcon = actionMeta.icon;

                                return (
                                  <button
                                    key={button.key}
                                    type="button"
                                    onClick={() => {
                                      setOpenActionMenu("");
                                      button.onClick();
                                    }}
                                    className="group rounded-[16px] border border-slate-200 bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-[0_14px_26px_rgba(99,102,241,0.12)]"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className={`rounded-2xl bg-gradient-to-br ${actionMeta.tone} p-2.5 text-white shadow-[0_10px_24px_rgba(99,102,241,0.16)]`}>
                                        <ActionIcon className="text-sm" />
                                      </div>
                                      <FaArrowRight className="mt-1 text-xs text-slate-300 transition group-hover:text-indigo-500" />
                                    </div>
                                    <div className="mt-3 text-sm font-bold text-slate-900">{button.label}</div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderPagination = () => {
    if (!filteredBookings.length) return null;

    return (
      <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 lg:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="text-base font-medium text-slate-500">
          Showing <span className="font-semibold text-slate-900">{Math.min(page * BOOKINGS_PAGE_SIZE, filteredBookings.length)}</span> of{" "}
          <span className="font-semibold text-slate-900">{filteredBookings.length}</span> bookings
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page === 1}
            className="inline-flex min-w-[96px] items-center justify-center rounded-full bg-slate-800 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-100"
          >
            Previous
          </button>

          <div className="rounded-full border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-bold text-slate-800 shadow-sm">
            Page {page} / {totalPages}
          </div>

          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={page === totalPages}
            className="inline-flex min-w-[96px] items-center justify-center rounded-full bg-blue-800 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:bg-blue-500 disabled:text-blue-50"
          >
            Next
          </button>
        </div>
      </div>
      </div>
    );
  };

  const renderEmptyState = () => (
    <div className="mt-6 rounded-[28px] border border-dashed border-slate-300 bg-slate-50 px-5 py-16 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm">
        {viewMode === "history" ? <FaHistory /> : <FaBed />}
      </div>
      <h3 className="mt-4 text-3xl font-black text-slate-900">
        {viewMode === "history" ? "No checkout history yet" : "No active booking yet"}
      </h3>
      <p className="mt-2 text-lg font-medium leading-8 text-slate-500">
        {viewMode === "history"
          ? "Once bookings are checked out, their records will be displayed here with a clean timeline."
          : "After adding a new hotel booking, all active entries will be displayed neatly here."
}
      </p>
      {viewMode === "active" ? (
        <button
          type="button"
          onClick={() => navigate("/hotel/guest")}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-lg font-bold text-white transition hover:bg-slate-800"
        >
          Start new booking
          <FaArrowRight className="text-xs" />
        </button>
      ) : null}
    </div>
  );

  const renderNoResultsState = () => (
    <div className="mt-6 rounded-[28px] border border-dashed border-slate-300 bg-slate-50 px-5 py-16 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm">
        <FaSearch />
      </div>
      <h3 className="mt-4 text-3xl font-black text-slate-900">No results found</h3>
      <p className="mt-2 text-lg font-medium leading-8 text-slate-500">
        No bookings match your search "{searchQuery}". Try a different search term.
      </p>
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.14),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.1),_transparent_24%),linear-gradient(180deg,#f8fbff_0%,#f8fafc_52%,#fefaf5_100%)] p-4 sm:p-6">
      <div className="w-full space-y-6">
        {feedbackModal.open ? (
          <div
            className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm"
            onClick={closeFeedbackModal}
          >
            <div
              className="w-full max-w-md overflow-hidden rounded-[30px] border border-white/70 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] shadow-[0_30px_90px_rgba(15,23,42,0.28)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className={`relative flex items-start gap-4 bg-gradient-to-r ${feedbackToneClasses[feedbackModal.type].accent} px-6 py-6 text-white`}>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.24),_transparent_46%)]" />
                <div className="relative rounded-[20px] border border-white/20 bg-white/15 p-3 shadow-[0_12px_30px_rgba(255,255,255,0.08)]">
                  {React.createElement(feedbackToneClasses[feedbackModal.type].icon, {
                    className: "text-xl",
                  })}
                </div>
                <div className="relative min-w-0 flex-1">
              <div className={`mb-2 inline-flex rounded-full px-3 py-1 text-sm font-bold uppercase tracking-[0.22em] ${feedbackToneClasses[feedbackModal.type].badge}`}>
                    {feedbackModal.type === "success" ? "Success" : "Action Error"}
                  </div>
                  <h2 className="text-lg font-black leading-tight">{feedbackModal.title}</h2>
                </div>
                <button
                  type="button"
                  onClick={closeFeedbackModal}
                  className="relative rounded-full border border-white/15 p-2 text-white/85 transition hover:bg-white/10 hover:text-white"
                  aria-label="Close popup"
                >
                  <FaTimes />
                </button>
              </div>

              <div className="px-6 py-6">
                <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/80 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Details
                  </p>
                  <p className="mt-2 text-base font-medium leading-7 text-slate-700">{feedbackModal.message}</p>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={closeFeedbackModal}
                    className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-slate-900 to-slate-700 px-5 py-3 text-base font-bold text-white shadow-[0_14px_30px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 hover:from-slate-800 hover:to-slate-700"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <section
          className="relative overflow-hidden rounded-[32px] border border-white/70 bg-[linear-gradient(135deg,rgba(243,244,246,0.92)_0%,rgba(238,242,255,0.88)_42%,rgba(245,243,255,0.9)_100%)] shadow-[0_28px_80px_rgba(79,70,229,0.12)]"
          style={{ fontFamily: '"Poppins", "Inter", "Segoe UI", sans-serif' }}
        >
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-10 top-0 h-36 w-36 rounded-full bg-[rgba(99,102,241,0.18)] blur-3xl" />
            <div className="absolute right-0 top-6 h-32 w-32 rounded-full bg-[rgba(139,92,246,0.16)] blur-3xl" />
            <div className="absolute bottom-0 left-1/3 h-24 w-24 rounded-full bg-[rgba(59,130,246,0.12)] blur-3xl" />
          </div>

          <div className="relative m-2 rounded-[28px] border border-white/60 bg-white/40 px-5 py-5 backdrop-blur-xl sm:px-6 sm:py-6 lg:px-7">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/55 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.28em] text-indigo-700 shadow-[0_10px_24px_rgba(99,102,241,0.08)]">
                  <span className="h-2 w-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" />
                  Hotel Booking Desk
                </div>

                <div className="relative mt-4">
                  <div className="absolute -left-2 top-3 h-12 w-12 rounded-full bg-[rgba(99,102,241,0.12)] blur-2xl" />
                  <h1 className="relative max-w-4xl text-[2rem] font-black leading-[1.08] tracking-[-0.04em] text-[#111827] sm:text-[2.6rem]">
                    All bookings in a{" "}
                    <span className="bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] bg-clip-text text-transparent">
                      cleaner
                    </span>
                    ,{" "}
                    <span className="bg-gradient-to-r from-[#4F46E5] to-[#8B5CF6] bg-clip-text text-transparent">
                      faster
                    </span>{" "}
                    workspace
                  </h1>
                </div>

                <p className="mt-4 max-w-2xl text-[15px] font-medium leading-7 text-[#6B7280] sm:text-base">
                  Track stay dates, payment balance, and guest actions in one polished page that feels lighter and easier to scan.
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-3 lg:justify-end">
                <button
                  type="button"
                  onClick={() =>
                    document.getElementById("booking-workspace-controls")?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    })
                  }
                  className="inline-flex min-h-[52px] items-center gap-2 rounded-[14px] border border-white/70 bg-white/70 px-5 py-3 text-sm font-bold text-slate-700 shadow-[0_12px_26px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:bg-white"
                >
                  <FaSlidersH className="text-xs text-slate-500" />
                  Filter
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/hotel/guest")}
                  className="inline-flex min-h-[52px] items-center gap-2 rounded-[14px] bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] px-5 py-3 text-sm font-bold text-white shadow-[0_16px_34px_rgba(99,102,241,0.28)] transition hover:scale-[1.02] hover:shadow-[0_20px_40px_rgba(99,102,241,0.34)]"
                >
                  <FaPlus className="text-xs" />
                  New Booking
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/70 bg-white/55 px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)] backdrop-blur">
                  <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">Checked In</div>
                  <div className="mt-2 text-3xl font-black text-slate-900">{quickSnapshot.checkedIn}</div>
                </div>
                <div className="rounded-2xl border border-white/70 bg-white/55 px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)] backdrop-blur">
                  <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">Confirmed</div>
                  <div className="mt-2 text-3xl font-black text-slate-900">{quickSnapshot.confirmed}</div>
                </div>
                <div className="rounded-2xl border border-white/70 bg-white/55 px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)] backdrop-blur">
                  <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">Balance Due</div>
                  <div className="mt-2 text-3xl font-black text-slate-900">{quickSnapshot.balanceDue}</div>
                </div>
              </div>

              <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/55 px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-[0_10px_24px_rgba(15,23,42,0.05)] backdrop-blur">
                <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-r from-[#6366F1] to-[#8B5CF6]" />
                {visibleBookings.length} bookings in this workspace
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {SUMMARY_CARDS.map((card) => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.key}
                    className="rounded-[22px] border border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.74)_0%,rgba(255,255,255,0.52)_100%)] p-4 shadow-[0_16px_34px_rgba(15,23,42,0.06)] backdrop-blur"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
                        {card.label}
                      </div>
                      <div className={`rounded-2xl bg-gradient-to-br ${card.tone} p-2.5 text-white shadow-[0_12px_24px_rgba(99,102,241,0.18)]`}>
                        <Icon className="text-sm" />
                      </div>
                    </div>
                    <div className="mt-4 text-[1.7rem] font-black tracking-[-0.03em] text-slate-900">
                      {card.key === "totalBookings" ? summary[card.key] : formatCurrency(summary[card.key])}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section
          id="booking-workspace-controls"
          className="rounded-[30px] border border-white/80 bg-white/90 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:p-6"
        >
          <div className="flex flex-col gap-5 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.3em] text-sky-700">{activeView.badge}</p>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.03em] text-slate-900 sm:text-4xl">{activeView.title}</h2>
              <p className="mt-2 max-w-3xl text-base font-medium leading-7 text-slate-600">{activeView.subtitle}</p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setViewMode("active")}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-base font-bold transition ${
                  viewMode === "active"
                    ? "bg-slate-950 text-white shadow-[0_14px_28px_rgba(15,23,42,0.14)]"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <FaBed className="text-xs" />
                Active
              </button>
              <button
                type="button"
                onClick={() => setViewMode("history")}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-base font-bold transition ${
                  viewMode === "history"
                    ? "bg-slate-950 text-white shadow-[0_14px_28px_rgba(15,23,42,0.14)]"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <FaHistory className="text-xs" />
                History
              </button>
              <button
                type="button"
                onClick={() => navigate("/hotel/group-booking")}
                className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2.5 text-base font-bold text-white transition hover:bg-indigo-700"
              >
                <FaLayerGroup className="text-xs" />
                Group Booking
              </button>
              <button
                type="button"
                onClick={() => navigate("/hotel/occupancy-forecast")}
                className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2.5 text-base font-bold text-white transition hover:bg-amber-600"
              >
                <FaCalendarAlt className="text-xl" />
                Occupancy
              </button>
              <button
                type="button"
                onClick={fetchBookings}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white   px-4 py-2.5 text-base font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FaRedoAlt className={`text-xs ${loading ? "animate-spin" : ""}`} />
                {loading ? "Refreshing" : "Refresh"}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="mt-6 rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-5 py-16 text-center text-base font-medium text-slate-500">
              Loading bookings...
            </div>
          ) : filteredBookings.length ? (
            <>
              {viewMode === "history"
                ? renderBookingCards("md:grid-cols-2 2xl:grid-cols-3")
                : (
                  <>
                    {renderBookingCards()}
                    {renderDesktopTable()}
                  </>
                )}
              {renderPagination()}
            </>
          ) : visibleBookings.length ? (
            renderNoResultsState()
          ) : (
            renderEmptyState()
          )}
        </section>

        {cancelModal.open ? (
          <div
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/50 px-4 backdrop-blur-sm"
            onClick={() => setCancelModal({ open: false, booking: null, reason: "", submitting: false })}
          >
            <div
              className="w-full max-w-md rounded-[28px] border border-rose-200 bg-white p-5 shadow-[0_24px_70px_rgba(15,23,42,0.22)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="inline-flex items-center gap-2 rounded-full bg-rose-100 px-3 py-1 text-sm font-bold uppercase tracking-[0.18em] text-rose-700">
                <FaTimesCircle />
                Cancel Booking
              </div>
              <h3 className="mt-4 text-2xl font-black text-slate-900">Booking #{cancelModal.booking?.bookingId}</h3>
              <p className="mt-2 text-base font-medium text-slate-600">
                {cancelModal.booking?.guest_name || "--"} | Room {cancelModal.booking?.rooms || "--"}
              </p>
              <label className="mt-4 block">
                <span className="mb-2 block text-sm font-bold uppercase tracking-[0.16em] text-slate-500">
                  Cancellation Reason
                </span>
                <textarea
                  value={cancelModal.reason}
                  onChange={(event) => setCancelModal((current) => ({ ...current, reason: event.target.value }))}
                  rows={4}
                  placeholder="Guest cancelled, no-show, wrong date, price issue..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base font-semibold text-slate-800 outline-none transition focus:border-rose-400 focus:bg-white focus:ring-4 focus:ring-rose-100"
                />
              </label>
              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCancelModal({ open: false, booking: null, reason: "", submitting: false })}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-base font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleCancelBooking}
                  disabled={cancelModal.submitting}
                  className={`inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-4 py-2.5 text-base font-bold text-white transition hover:bg-rose-700 ${
                    cancelModal.submitting ? "cursor-not-allowed opacity-70" : ""
                  }`}
                >
                  {cancelModal.submitting ? "Cancelling..." : "Confirm Cancel"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Admin-only: Edit Customer Phone Modal */}
      {phoneEditModal.open && (
        <div
          className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm"
          onClick={() => !phoneEditModal.saving && setPhoneEditModal({ open: false, booking: null, mobile: "", saving: false })}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-[30px] border border-white/70 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] shadow-[0_30px_90px_rgba(15,23,42,0.28)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative flex items-start gap-4 bg-gradient-to-r from-sky-500 to-blue-600 px-6 py-6 text-white">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.24),_transparent_46%)]" />
              <div className="relative rounded-[20px] border border-white/20 bg-white/15 p-3 shadow-[0_12px_30px_rgba(255,255,255,0.08)]">
                <FaPhone className="text-xl" />
              </div>
              <div className="relative min-w-0 flex-1">
                <div className="mb-2 inline-flex rounded-full px-3 py-1 text-sm font-bold uppercase tracking-[0.22em] bg-white/15 text-white ring-1 ring-white/20">
                  Admin Only
                </div>
                <h2 className="text-lg font-black leading-tight">Edit Customer Phone</h2>
                <p className="mt-1 text-sm leading-relaxed text-sky-50">
                  Booking #{phoneEditModal.booking?.bookingId} — {phoneEditModal.booking?.guest_name || "Guest"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPhoneEditModal({ open: false, booking: null, mobile: "", saving: false })}
                className="relative rounded-full border border-white/15 p-2 text-white/85 transition hover:bg-white/10 hover:text-white"
                aria-label="Close popup"
              >
                <FaTimes />
              </button>
            </div>
            <div className="px-6 py-6">
              <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/80 p-4">
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  value={phoneEditModal.mobile}
                  onChange={(event) =>
                    setPhoneEditModal((current) => ({ ...current, mobile: event.target.value }))
                  }
                  placeholder="e.g. 9876543210"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  autoFocus
                />
                <p className="mt-2 text-xs text-slate-500">
                  Digits only — country code (91) is added automatically if missing.
                </p>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setPhoneEditModal({ open: false, booking: null, mobile: "", saving: false })}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                  disabled={phoneEditModal.saving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSavePhone}
                  disabled={phoneEditModal.saving}
                  className={`inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-600 to-blue-600 px-6 py-3 text-sm font-bold text-white shadow-[0_14px_30px_rgba(14,165,233,0.24)] transition hover:brightness-110 ${
                    phoneEditModal.saving ? "cursor-not-allowed opacity-70" : ""
                  }`}
                >
                  {phoneEditModal.saving ? "Saving…" : "Save Phone"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AllBooking;
