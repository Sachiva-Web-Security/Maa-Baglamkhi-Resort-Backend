import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FaBed,
  FaBoxOpen,
  FaChartBar,
  FaClipboardList,
  FaMoneyBillWave,
  FaUsers,
  FaArrowRight,
} from "react-icons/fa";

import API from "../api";
import useDashboardAutoRefresh from "../hooks/useDashboardAutoRefresh";

const formatINR = (amount) =>
  `Rs. ${Number(amount || 0).toLocaleString("en-IN")}`;

const todayISO = () => new Date().toISOString().slice(0, 10);

const ManagerDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [metrics, setMetrics] = useState({});
  const [bookings, setBookings] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [banquets, setBanquets] = useState([]);
  const [attendance, setAttendance] = useState([]);

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError("");

      const results = await Promise.allSettled([
        API.get("/dashboard/metrics"),
        API.get("/hotel/all-bookings"),
        API.get("/inventory"),
        API.get("/banquet"),
        API.get("/attendance", { params: { date: todayISO() } }),
      ]);

      const [metricsRes, bookingsRes, inventoryRes, banquetRes, attendanceRes] = results;

      setMetrics(metricsRes.status === "fulfilled" ? metricsRes.value.data || {} : {});
      setBookings(bookingsRes.status === "fulfilled" ? bookingsRes.value.data || [] : []);
      setInventory(inventoryRes.status === "fulfilled" ? inventoryRes.value.data || [] : []);
      setBanquets(banquetRes.status === "fulfilled" ? banquetRes.value.data || [] : []);
      setAttendance(attendanceRes.status === "fulfilled" ? attendanceRes.value.data || [] : []);

      if (
        metricsRes.status !== "fulfilled" &&
        bookingsRes.status !== "fulfilled" &&
        inventoryRes.status !== "fulfilled"
      ) {
        setError("Manager dashboard data could not be loaded.");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useDashboardAutoRefresh(load);

  const stats = useMemo(() => {
    const totalRooms = Number(metrics.totalRooms) || 0;
    const occupiedRooms = Number(metrics.occupiedRooms) || 0;
    const arrivals = bookings.filter((item) => String(item.checkIn || "").slice(0, 10) === todayISO()).length;
    const departures = bookings.filter((item) => String(item.checkOut || "").slice(0, 10) === todayISO()).length;
    const lowInventory = inventory.filter((item) => {
      const quantity = Number(item.quantity ?? item.stock ?? item.currentStock ?? 0);
      const threshold = Number(item.minStock ?? item.threshold ?? item.reorderLevel ?? 10);
      return quantity <= threshold;
    }).length;
    const presentStaff = attendance.filter((item) => String(item.status || "").toLowerCase() === "present").length;

    return [
      {
        label: "Hotel Occupancy",
        value: totalRooms ? `${Math.round((occupiedRooms / totalRooms) * 100)}%` : "0%",
        note: "Live room occupancy based on current room metrics.",
        icon: FaBed,
        tone: "cyan",
      },
      {
        label: "Today's Revenue",
        value: formatINR(metrics.todayRevenue),
        note: "Current day collection overview for hotel operations.",
        icon: FaMoneyBillWave,
        tone: "emerald",
      },
      {
        label: "Check-ins / Check-outs",
        value: `${arrivals} / ${departures}`,
        note: "Today's front office movement snapshot.",
        icon: FaClipboardList,
        tone: "amber",
      },
      {
        label: "Staff Present",
        value: presentStaff,
        note: "Today's attendance marked as present.",
        icon: FaUsers,
        tone: "violet",
      },
      {
        label: "Low Inventory Alerts",
        value: lowInventory,
        note: "Items near reorder threshold and needing attention.",
        icon: FaBoxOpen,
        tone: "rose",
      },
      {
        label: "Banquet Bookings",
        value: banquets.length,
        note: "Current banquet items available for review.",
        icon: FaChartBar,
        tone: "slate",
      },
    ];
  }, [attendance, banquets.length, bookings, inventory, metrics]);

  const insights = useMemo(() => {
    const pendingBookings = bookings.filter((item) =>
      String(item.bookingStatus || item.status || "").toLowerCase().includes("pending")
    ).length;

    return [
      {
        label: "Pending Booking Queue",
        value: pendingBookings,
        note: "Front desk follow-up ke liye pending confirmations.",
      },
      {
        label: "Available Rooms",
        value: Math.max((Number(metrics.totalRooms) || 0) - (Number(metrics.occupiedRooms) || 0), 0),
        note: "Immediate sellable room inventory overview.",
      },
      {
        label: "Today's Check-ins",
        value: Number(metrics.todayCheckins) || 0,
        note: "Quick glance for lobby and room readiness planning.",
      },
    ];
  }, [bookings, metrics]);

  const table = useMemo(() => ({
    eyebrow: "Manager Queue",
    title: "Recent booking movement",
    meta: `${bookings.length} visible records`,
    columns: [
      { key: "guestName", label: "Guest" },
      { key: "roomNumber", label: "Room" },
      { key: "checkIn", label: "Check In" },
      { key: "checkOut", label: "Check Out" },
      { key: "status", label: "Status", render: (row) => row.bookingStatus || row.status || "--" },
    ],
    rows: bookings.slice(0, 8).map((item, index) => ({
      id: item.id || item.bookingId || index,
      guestName: item.guestName || item.name || item.customerName || "Guest",
      roomNumber: item.roomNumber || item.roomNo || "--",
      checkIn: item.checkIn || "--",
      checkOut: item.checkOut || "--",
      status: item.bookingStatus || item.status || "--",
    })),
    emptyText: "No booking records available for manager dashboard.",
  }), [bookings]);

  const toneColors = {
    cyan: { border: "border-l-cyan-400", bg: "bg-cyan-50", text: "text-cyan-700", iconBg: "bg-gradient-to-br from-cyan-500 to-sky-500" },
    emerald: { border: "border-l-emerald-400", bg: "bg-emerald-50", text: "text-emerald-700", iconBg: "bg-gradient-to-br from-emerald-500 to-teal-500" },
    amber: { border: "border-l-amber-400", bg: "bg-amber-50", text: "text-amber-700", iconBg: "bg-gradient-to-br from-amber-500 to-orange-500" },
    violet: { border: "border-l-violet-400", bg: "bg-violet-50", text: "text-violet-700", iconBg: "bg-gradient-to-br from-violet-500 to-fuchsia-500" },
    rose: { border: "border-l-rose-400", bg: "bg-rose-50", text: "text-rose-700", iconBg: "bg-gradient-to-br from-rose-500 to-pink-500" },
    slate: { border: "border-l-slate-400", bg: "bg-slate-50", text: "text-slate-700", iconBg: "bg-gradient-to-br from-slate-700 to-slate-500" },
  };

  const getTone = (tone) => toneColors[tone] || toneColors.slate;

  const statusBadgeColor = (status) => {
    const s = String(status || "").toLowerCase();
    if (s.includes("confirmed") || s.includes("checked")) return "bg-emerald-100 text-emerald-700 border border-emerald-200";
    if (s.includes("pending")) return "bg-amber-100 text-amber-700 border border-amber-200";
    if (s.includes("cancel")) return "bg-rose-100 text-rose-700 border border-rose-200";
    if (s.includes("checkout") || s.includes("check-out")) return "bg-cyan-100 text-cyan-700 border border-cyan-200";
    return "bg-slate-100 text-slate-600 border border-slate-200";
  };

  const glassCardBase = "rounded-[24px] border border-white/20 bg-white/10 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]";

  const MobileEmptyState = () => (
    <div className="flex flex-col items-center gap-3 py-10">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
        <FaClipboardList size={24} className="text-slate-400" />
      </div>
      <p className="text-[18px] font-bold text-slate-900">{table.emptyText || "No records available"}</p>
      <p className="text-[14px] text-slate-500">No booking records to display at this time.</p>
    </div>
  );

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#F8FAFC]">
      {/* ─── Background decorative blobs ─────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full bg-blue-200/40 blur-[100px]" />
        <div className="absolute top-20 -right-40 h-[400px] w-[400px] rounded-full bg-sky-200/30 blur-[100px]" />
        <div className="absolute bottom-40 left-1/4 h-[350px] w-[350px] rounded-full bg-cyan-200/25 blur-[100px]" />
      </div>

      <div className="w-full space-y-6 sm:space-y-8 p-4 sm:p-6 lg:p-8 xl:p-10">
        {/* ─── Error State ────────────────────────────────────────── */}
        {error && (
          <div className="animate-fade-in-up rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3.5 sm:px-5 sm:py-4 text-sm font-semibold text-rose-700 shadow-sm">
            {error}
          </div>
        )}

        {/* ─── Loading State ──────────────────────────────────────── */}
        {loading && (
          <div className="animate-fade-in-up rounded-[24px] border border-cyan-200 bg-cyan-50 px-4 py-3.5 sm:px-5 sm:py-4 text-sm font-semibold text-cyan-700 shadow-sm">
            Dashboard data loading...
          </div>
        )}

        {/* ─── HERO SECTION ───────────────────────────────────────── */}
        <section className="relative overflow-hidden rounded-[28px] border border-slate-900/10 bg-[linear-gradient(135deg,#172554_0%,#1e40af_52%,#0ea5e9_100%)] px-5 py-7 shadow-[0_22px_55px_rgba(15,23,42,0.18)] sm:px-8 sm:py-10 xl:px-10 xl:py-12">
          {/* Abstract wave patterns */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-20 -right-20 h-80 w-80 rounded-full bg-sky-400/10 blur-[60px]" />
            <div className="absolute bottom-0 left-0 h-64 w-full bg-gradient-to-t from-blue-950/40 to-transparent" />
            <div className="absolute top-1/2 left-0 h-40 w-40 -translate-y-1/2 rounded-full bg-cyan-300/8 blur-[50px]" />
            <svg className="absolute bottom-0 left-0 h-32 w-full opacity-[0.06]" viewBox="0 0 1200 120" preserveAspectRatio="none">
              <path d="M0,60 C300,120 600,0 900,60 C1050,90 1150,40 1200,60 L1200,120 L0,120 Z" fill="white" />
            </svg>
            <svg className="absolute bottom-0 left-0 h-24 w-full opacity-[0.04]" viewBox="0 0 1200 80" preserveAspectRatio="none">
              <path d="M0,40 C200,80 400,0 600,40 C800,80 1000,20 1200,40 L1200,80 L0,80 Z" fill="white" />
            </svg>
          </div>

          <div className="relative z-10 grid gap-5 sm:gap-6 lg:gap-8 xl:grid-cols-[minmax(0,1.3fr)_minmax(340px,0.7fr)] xl:items-center">
            {/* Left Side */}
            <div className="space-y-3 sm:space-y-4 lg:space-y-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-cyan-200">
                Manager Command Center
              </p>
              <div className="space-y-2 sm:space-y-3">
                <h1 className="text-[28px] sm:text-[36px] lg:text-[42px] xl:text-[46px] font-black leading-[1.1] tracking-tight text-white">
                  Manager dashboard built for daily oversight
                </h1>
                <p className="max-w-2xl text-[14px] sm:text-[16px] lg:text-[17px] leading-[1.7] text-slate-100/85">
                  Occupancy, revenue, staff movement, banquet activity aur inventory alerts ko ek focused operational screen par dekhiye.
                </p>
              </div>
            </div>

            {/* Right Side - 4 Glass Stat Cards */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:gap-4">
              {stats.slice(0, 4).map((card) => {
                const Icon = card.icon;
                const tone = getTone(card.tone);
                return (
                  <div
                    key={card.label}
                    className={`group ${glassCardBase} px-3 py-3 sm:px-4 sm:py-3.5 lg:px-4 lg:py-4 text-white transition-all duration-300 hover:scale-[1.03] hover:bg-white/15`}
                  >
                    <span className="text-[10px] sm:text-[11px] font-medium text-slate-100/75">{card.label}</span>
                    <div className="mt-1.5 sm:mt-2 lg:mt-3 text-[20px] sm:text-[24px] lg:text-[28px] font-bold leading-none tracking-tight">{card.value ?? "--"}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ─── STATISTICS SECTION (6 cards) ───────────────────────── */}
        <section>
          <div className="mb-3.5 sm:mb-4 lg:mb-5">
            <h2 className="text-[26px] sm:text-[30px] lg:text-[32px] font-bold tracking-tight text-slate-900">Dashboard Overview</h2>
            <p className="mt-1 text-[14px] sm:text-[16px] lg:text-[17px] text-slate-500">Complete operational snapshot at a glance</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {stats.map((card) => {
              const Icon = card.icon;
              const tone = getTone(card.tone);
              return (
                <div
                  key={card.label}
                  className={`group rounded-[20px] sm:rounded-[24px] border-l-[4px] ${tone.border} ${tone.bg} bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(15,23,42,0.12)]`}
                >
                  <div className="flex items-start justify-between gap-3 sm:gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                        {card.label}
                      </p>
                      <p className="mt-2 sm:mt-3 text-[30px] sm:text-[36px] lg:text-[40px] font-black leading-none tracking-tight text-slate-900">
                        {card.value ?? "--"}
                      </p>
                      <p className="mt-1.5 sm:mt-2 text-[13px] sm:text-[14px] lg:text-[15px] leading-relaxed text-slate-500">
                        {card.note}
                      </p>
                    </div>
                    <span className={`inline-flex shrink-0 items-center justify-center rounded-[16px] sm:rounded-[18px] ${tone.iconBg} p-2.5 sm:p-3 lg:p-3.5 text-white shadow-lg shadow-black/10 transition-transform duration-300 group-hover:scale-110`}>
                      <Icon size={20} className="sm:hidden" />
                      <Icon size={22} className="hidden sm:block lg:hidden" />
                      <Icon size={26} className="hidden lg:block" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ─── QUICK ACTIONS + OPERATIONAL HIGHLIGHTS ─────────────── */}
        <section className="grid grid-cols-1 gap-5 sm:gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          {/* Quick Actions */}
          <div className="rounded-[24px] sm:rounded-[28px] border border-slate-900/5 bg-white p-5 sm:p-6 lg:p-8 shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
            <div className="mb-4 sm:mb-5 lg:mb-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-emerald-500">
                Quick Actions
              </p>
              <h2 className="mt-1.5 sm:mt-2 text-[24px] sm:text-[28px] lg:text-[30px] font-bold tracking-tight text-slate-900">
                Jump to active workflow
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2">
              {stats.length > 0 && (
                <>
                  {[
                    { label: "Open Reports", helper: "Review revenue and trend reports.", route: "/reports", icon: FaChartBar, tone: "emerald" },
                    { label: "All Bookings", helper: "Manage front office pipeline and arrivals.", route: "/hotel/all-bookings", icon: FaClipboardList, tone: "cyan" },
                    { label: "Inventory Alerts", helper: "Immediately review low stock items.", route: "/inventory", icon: FaBoxOpen, tone: "amber" },
                    { label: "Banquet Board", helper: "View upcoming banquet load and hall planning.", route: "/banquet", icon: FaUsers, tone: "violet" },
                  ].map((action) => {
                    const Icon = action.icon;
                    const tone = getTone(action.tone);
                    return (
                      <a
                        key={action.label}
                        href={action.route}
                        className="group flex flex-col rounded-[20px] sm:rounded-[22px] border border-slate-900/5 bg-white p-4 sm:p-5 shadow-[0_4px_16px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(15,23,42,0.1)]"
                      >
                        <div className="flex items-center justify-between">
                          <span className={`inline-flex items-center justify-center rounded-xl sm:rounded-2xl ${tone.iconBg} p-2.5 sm:p-3 text-white shadow-lg shadow-black/10 transition-transform duration-300 group-hover:scale-110`}>
                            <Icon size={18} className="sm:hidden" />
                            <Icon size={22} className="hidden sm:block" />
                          </span>
                          <span className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-50 p-1.5 sm:p-2 text-slate-400 transition-colors duration-300 group-hover:border-slate-900 group-hover:bg-slate-900 group-hover:text-white">
                            <FaArrowRight size={12} className="sm:hidden" />
                            <FaArrowRight size={14} className="hidden sm:block" />
                          </span>
                        </div>
                        <h3 className="mt-3 sm:mt-4 text-[18px] sm:text-[20px] lg:text-[22px] font-bold text-slate-900">{action.label}</h3>
                        <p className="mt-1 text-[13px] sm:text-[14px] lg:text-[15px] leading-relaxed text-slate-500">{action.helper}</p>
                      </a>
                    );
                  })}
                </>
              )}
            </div>
          </div>

          {/* Operational Highlights */}
          <div className="rounded-[24px] sm:rounded-[28px] border border-slate-900/5 bg-white p-5 sm:p-6 lg:p-8 shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
            <div className="mb-4 sm:mb-5 lg:mb-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-emerald-500">
                Snapshot
              </p>
              <h2 className="mt-1.5 sm:mt-2 text-[24px] sm:text-[28px] lg:text-[30px] font-bold tracking-tight text-slate-900">
                Operational highlights
              </h2>
            </div>
            <div className="space-y-3 sm:space-y-4">
              {insights.map((item) => (
                <div
                  key={item.label}
                  className="rounded-[18px] sm:rounded-[22px] border border-slate-900/5 bg-white p-4 sm:p-5 shadow-[0_2px_10px_rgba(15,23,42,0.03)] transition-all duration-300 hover:shadow-[0_6px_20px_rgba(15,23,42,0.07)]"
                >
                  <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                    {item.label}
                  </p>
                  <p className="mt-1.5 sm:mt-2 text-[30px] sm:text-[34px] lg:text-[38px] font-black leading-none tracking-tight text-slate-900">
                    {item.value ?? "--"}
                  </p>
                  <p className="mt-1.5 text-[13px] sm:text-[14px] lg:text-[15px] leading-relaxed text-slate-500">
                    {item.note}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── RECENT BOOKING SECTION ──────────────────────────────── */}
        <section className="rounded-[24px] sm:rounded-[28px] border border-slate-900/5 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.05)] overflow-hidden">
          {/* Section Header */}
          <div className="flex flex-col gap-2.5 sm:gap-3 border-b border-slate-900/5 px-5 py-4 sm:px-6 sm:py-5 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-6">
            <div>
              <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.24em] text-emerald-500">
                {table.eyebrow}
              </p>
              <h2 className="mt-1 sm:mt-2 text-[22px] sm:text-[26px] lg:text-[30px] font-bold tracking-tight text-slate-900">
                {table.title}
              </h2>
            </div>
            <div className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs sm:text-sm font-bold text-slate-600 w-fit">
              {table.meta}
            </div>
          </div>

          {/* ─── Mobile: Booking Cards ────────────────────────────── */}
          <div className="md:hidden p-4">
            {table.rows.length ? (
              <>
                <div className="space-y-3">
                  {table.rows.map((row) => (
                    <div
                      key={row.id || row.key}
                      className="rounded-[20px] border border-slate-900/5 bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.03)] transition-all duration-200 active:shadow-[0_4px_16px_rgba(15,23,42,0.07)]"
                    >
                      {/* Top: Guest + Status */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Guest</p>
                          <p className="mt-0.5 text-[15px] font-bold text-slate-900 truncate">{row.guestName}</p>
                        </div>
                        <span
                          className={`inline-flex shrink-0 rounded-full px-3 py-1.5 text-[12px] font-bold ${statusBadgeColor(row.status)}`}
                        >
                          {row.status}
                        </span>
                      </div>

                      {/* Divider */}
                      <div className="my-3 border-t border-slate-100" />

                      {/* Details Grid */}
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <p className="text-[11px] font-medium text-slate-400">Room</p>
                          <p className="mt-0.5 text-[14px] font-semibold text-slate-700">{row.roomNumber}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-medium text-slate-400">Check In</p>
                          <p className="mt-0.5 text-[13px] font-semibold text-slate-700">{String(row.checkIn).length > 10 ? String(row.checkIn).slice(0, 10) : row.checkIn}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-medium text-slate-400">Check Out</p>
                          <p className="mt-0.5 text-[13px] font-semibold text-slate-700">{String(row.checkOut).length > 10 ? String(row.checkOut).slice(0, 10) : row.checkOut}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Mobile: View All Button */}
                <button
                  type="button"
                  className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-[14px] border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition-all duration-300 hover:border-slate-900 hover:bg-slate-900 hover:text-white hover:shadow-md active:scale-[0.98]"
                >
                  View All
                  <FaArrowRight size={14} />
                </button>
              </>
            ) : (
              <MobileEmptyState />
            )}
          </div>

          {/* ─── Desktop & Tablet: Table ──────────────────────────── */}
          <div className="hidden md:block">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead>
                  <tr className="border-b border-slate-900/5 bg-slate-50/60">
                    {table.columns.map((column) => (
                      <th
                        key={column.key}
                        className="whitespace-nowrap px-4 py-3.5 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 sm:px-6 sm:py-4 lg:px-8"
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.length ? (
                    table.rows.map((row, index) => (
                      <tr
                        key={row.id || row.key || index}
                        className="group border-b border-slate-900/5 transition-colors duration-200 hover:bg-slate-50/60"
                      >
                        {table.columns.map((column) => (
                          <td
                            key={column.key}
                            className="whitespace-nowrap px-4 py-3.5 text-[14px] sm:px-6 sm:py-4 sm:text-[15px] lg:px-8 lg:py-5 text-slate-700"
                          >
                            {column.render ? (
                              <span
                                className={`inline-flex rounded-full px-3.5 py-1.5 text-xs font-bold ${statusBadgeColor(column.render(row))}`}
                              >
                                {column.render(row)}
                              </span>
                            ) : (
                              <span className="font-medium">{row[column.key] ?? "--"}</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={table.columns.length} className="px-6 py-12 text-center sm:px-8 sm:py-16">
                        <div className="flex flex-col items-center gap-3">
                          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                            <FaClipboardList size={24} className="text-slate-400" />
                          </div>
                          <p className="text-[18px] sm:text-[20px] font-bold text-slate-900">{table.emptyText || "No records available"}</p>
                          <p className="text-[14px] sm:text-[15px] text-slate-500">No booking records to display at this time.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer / Pagination hint */}
            {table.rows.length > 0 && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-slate-900/5 px-5 py-4 sm:px-6 sm:py-4 lg:px-8">
                <p className="text-[13px] sm:text-sm text-slate-500 text-center sm:text-left">
                  Showing <span className="font-semibold text-slate-700">{table.rows.length}</span> of{" "}
                  <span className="font-semibold text-slate-700">{table.meta?.split(" ")[0] || table.rows.length}</span> records
                </p>
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 rounded-[14px] border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-all duration-300 hover:border-slate-900 hover:bg-slate-900 hover:text-white hover:shadow-md active:scale-[0.98]"
                >
                  View All
                  <FaArrowRight size={14} />
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default ManagerDashboard;
