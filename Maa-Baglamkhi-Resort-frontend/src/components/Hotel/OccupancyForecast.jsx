import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../api";
import {
  BedDouble,
  TrendingUp,
  Star,
  ChevronLeft,
  ChevronRight,
  Wrench,
  CalendarCheck2,
  CalendarPlus,
  ShieldAlert,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";

const MONTHS = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
];
const DAYS_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const SELECTED_DATE_PAGE_SIZE = 5;

const formatDate = (y, m, d) => {
  const mm = String(m + 1).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
};

const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

const AVATAR_PALETTE = [
  "from-blue-500 to-sky-400",
  "from-rose-500 to-orange-400",
  "from-emerald-500 to-teal-400",
  "from-violet-500 to-indigo-400",
  "from-amber-500 to-yellow-400",
];

const OccupancyForecast = ({ isModal = false, onClose }) => {
  const navigate = useNavigate();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [bookings, setBookings] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedDatePage, setSelectedDatePage] = useState(1);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [bookingsRes, blocksRes, setupRes] = await Promise.all([
        API.get("/hotel/all-bookings"),
        API.get("/hotel/room-blocks").catch(() => ({ data: [] })),
        API.get("/hotel/rooms/setup"),
      ]);
      setBookings(Array.isArray(bookingsRes.data) ? bookingsRes.data : []);
      setBlocks(Array.isArray(blocksRes.data) ? blocksRes.data : []);
      const allRooms = [];
      if (Array.isArray(setupRes.data)) {
        for (const cat of setupRes.data) {
          for (const rn of cat.rooms || []) {
            allRooms.push({ roomNumber: rn, categoryName: cat.name });
          }
        }
      }
      setRooms(allRooms);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Build occupancy data per date
  const occupancyMap = useMemo(() => {
    const map = {};

    for (const b of bookings) {
      if (!b.check_in || !b.check_out) continue;
      const start = new Date(b.check_in);
      const end = new Date(b.check_out);
      const cur = new Date(start);
      while (cur < end) {
        const key = cur.toISOString().slice(0, 10);
        if (!map[key]) map[key] = { bookings: [], blocks: [] };
        map[key].bookings.push(b);
        cur.setDate(cur.getDate() + 1);
      }
    }

    for (const bl of blocks) {
      if (bl.status !== "Active" || !bl.blocked_from || !bl.blocked_until) continue;
      const start = new Date(bl.blocked_from);
      const end = new Date(bl.blocked_until);
      const cur = new Date(start);
      while (cur <= end) {
        const key = cur.toISOString().slice(0, 10);
        if (!map[key]) map[key] = { bookings: [], blocks: [] };
        map[key].blocks.push(bl);
        cur.setDate(cur.getDate() + 1);
      }
    }

    return map;
  }, [bookings, blocks]);

  const totalRooms = rooms.length || 1;

  // Month stats
  const monthStats = useMemo(() => {
    const days = daysInMonth(year, month);
    let totalOccupancy = 0;
    let peakOccupancy = 0;

    for (let d = 1; d <= days; d++) {
      const key = formatDate(year, month, d);
      const data = occupancyMap[key] || { bookings: [], blocks: [] };
      const occupied = data.bookings.length + data.blocks.length;
      totalOccupancy += occupied;
      if (occupied > peakOccupancy) peakOccupancy = occupied;
    }

    const avgOccupancy = ((totalOccupancy / (days * totalRooms)) * 100).toFixed(0);
    return { avgOccupancy, peakOccupancy };
  }, [year, month, occupancyMap, totalRooms]);

  // Selected date details
  const selectedData = useMemo(() => {
    if (!selectedDate) return null;
    return occupancyMap[selectedDate] || { bookings: [], blocks: [] };
  }, [selectedDate, occupancyMap]);

  const totalSelectedDatePages = Math.max(
    1,
    Math.ceil((selectedData?.bookings?.length || 0) / SELECTED_DATE_PAGE_SIZE),
  );
  const paginatedSelectedBookings = (selectedData?.bookings || []).slice(
    (selectedDatePage - 1) * SELECTED_DATE_PAGE_SIZE,
    selectedDatePage * SELECTED_DATE_PAGE_SIZE,
  );

  useEffect(() => {
    setSelectedDatePage(1);
  }, [selectedDate]);

  useEffect(() => {
    if (selectedDatePage > totalSelectedDatePages) {
      setSelectedDatePage(totalSelectedDatePages);
    }
  }, [selectedDatePage, totalSelectedDatePages]);

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
    setSelectedDate(null);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
    setSelectedDate(null);
  };

  const days = daysInMonth(year, month);
  const firstDay = firstDayOfMonth(year, month);
  const todayStr = now.toISOString().slice(0, 10);

  const getOccupancyColor = (pct) => {
    if (pct === 0) return "bg-white border-slate-100 hover:border-slate-200";
    if (pct < 30) return "bg-emerald-50 border-emerald-200 hover:border-emerald-400";
    if (pct < 60) return "bg-amber-50 border-amber-200 hover:border-amber-400";
    if (pct < 90) return "bg-orange-50 border-orange-200 hover:border-orange-400";
    return "bg-rose-50 border-rose-300 hover:border-rose-500";
  };

  const avatarClass = (seed) =>
    AVATAR_PALETTE[Math.abs(String(seed).split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_PALETTE.length];

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-sky-50 p-4 sm:p-6 lg:p-8 xl:p-10">
      <div className="mx-auto w-full max-w-[1800px] space-y-4 sm:space-y-5 lg:space-y-6">

        {/* ================= HERO ================= */}
        <section className="relative overflow-hidden rounded-[24px] sm:rounded-[28px] lg:rounded-[32px] bg-gradient-to-br from-blue-950 via-blue-700 to-sky-500 px-4 py-7 sm:px-6 sm:py-8 md:px-8 md:py-10 lg:px-10 lg:py-12 text-white shadow-[0_25px_80px_rgba(15,23,42,0.35)]">
          {/* decorative wave pattern */}
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full opacity-20"
            viewBox="0 0 1200 500"
            preserveAspectRatio="none"
            fill="none"
          >
            <path d="M0 380 Q150 320 300 380 T600 380 T900 380 T1200 380 V500 H0 Z" fill="url(#waveA)" />
            <path d="M0 420 Q150 460 300 420 T600 420 T900 420 T1200 420 V500 H0 Z" fill="url(#waveB)" />
            <defs>
              <linearGradient id="waveA" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#0c4a6e" />
              </linearGradient>
              <linearGradient id="waveB" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#0ea5e9" />
                <stop offset="100%" stopColor="#1e3a8a" />
              </linearGradient>
            </defs>
          </svg>

          {/* floating glow orbs */}
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 sm:h-72 sm:w-72 rounded-full bg-sky-400/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 sm:h-64 sm:w-64 rounded-full bg-blue-400/20 blur-3xl" />

          {/* decorative hotel illustration (bottom-right) */}
          <svg
            className="pointer-events-none absolute bottom-0 right-4 hidden h-40 w-40 opacity-25 sm:block lg:h-52 lg:w-52"
            viewBox="0 0 200 200"
            fill="none"
          >
            <rect x="40" y="40" width="120" height="150" rx="6" fill="white" fillOpacity="0.15" />
            {Array.from({ length: 5 }).map((_, row) =>
              Array.from({ length: 4 }).map((_, col) => (
                <rect
                  key={`${row}-${col}`}
                  x={55 + col * 24}
                  y={55 + row * 26}
                  width="14"
                  height="16"
                  rx="2"
                  fill="white"
                  fillOpacity="0.35"
                />
              )),
            )}
            <path d="M30 40 L100 5 L170 40 Z" fill="white" fillOpacity="0.25" />
          </svg>

          <div className="relative grid gap-6 sm:gap-7 md:grid-cols-[minmax(0,1.25fr)_minmax(260px,0.9fr)] md:items-center lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.9fr)] lg:gap-8">
            <div className="text-center md:text-left">
              <p className="text-[12px] sm:text-[13px] md:text-[15px] font-bold uppercase tracking-[0.28em] sm:tracking-[0.32em] text-sky-200">
                Occupancy Forecast
              </p>
              <h1 className="mt-2.5 sm:mt-3 text-[22px] sm:text-[28px] md:text-[32px] lg:text-[36px] xl:text-[42px] font-black tracking-tight leading-[1.1] sm:leading-[1.05]">
                Room Availability Calendar
              </h1>

            </div>

            {/* stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 md:gap-4">
              <div className="group flex flex-col items-center justify-center rounded-[16px] sm:rounded-[20px] border border-white/20 bg-white/10 p-2.5 sm:p-3 md:p-4 text-center shadow-[0_10px_30px_rgba(0,0,0,0.15)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:bg-white/15 hover:shadow-2xl">
                <div className="mx-auto flex h-9 w-9 sm:h-11 sm:w-11 md:h-14 md:w-14 items-center justify-center rounded-xl sm:rounded-2xl bg-white/15 shadow-inner">
                  <BedDouble className="h-5 w-5 sm:h-6 sm:w-6 md:h-[30px] md:w-[30px] text-white" strokeWidth={2.25} />
                </div>
                <div className="mt-1.5 sm:mt-2 md:mt-3 text-[10px] sm:text-[11px] md:text-[13px] font-bold uppercase tracking-wide text-white/70">
                  Total Rooms
                </div>
                <div className="mt-0.5 sm:mt-1 text-lg sm:text-2xl md:text-3xl font-black">{totalRooms}</div>
              </div>

              <div className="group flex flex-col items-center justify-center rounded-[16px] sm:rounded-[20px] border border-emerald-300/25 bg-emerald-400/10 p-2.5 sm:p-3 md:p-4 text-center shadow-[0_10px_30px_rgba(0,0,0,0.15)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:bg-emerald-400/15 hover:shadow-2xl">
                <div className="mx-auto flex h-9 w-9 sm:h-11 sm:w-11 md:h-14 md:w-14 items-center justify-center rounded-xl sm:rounded-2xl bg-emerald-300/20 shadow-inner">
                  <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 md:h-[30px] md:w-[30px] text-emerald-200" strokeWidth={2.25} />
                </div>
                <div className="mt-1.5 sm:mt-2 md:mt-3 text-[10px] sm:text-[11px] md:text-[13px] font-bold uppercase tracking-wide text-emerald-200">
                  Avg Occupancy
                </div>
                <div className="mt-0.5 sm:mt-1 text-lg sm:text-2xl md:text-3xl font-black">{monthStats.avgOccupancy}%</div>
              </div>

              <div className="group col-span-2 sm:col-span-1 flex flex-col items-center justify-center rounded-[16px] sm:rounded-[20px] border border-rose-300/25 bg-rose-400/10 p-2.5 sm:p-3 md:p-4 text-center shadow-[0_10px_30px_rgba(0,0,0,0.15)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:bg-rose-400/15 hover:shadow-2xl">
                <div className="mx-auto flex h-9 w-9 sm:h-11 sm:w-11 md:h-14 md:w-14 items-center justify-center rounded-xl sm:rounded-2xl bg-rose-300/20 shadow-inner">
                  <Star className="h-5 w-5 sm:h-6 sm:w-6 md:h-[30px] md:w-[30px] text-rose-200" strokeWidth={2.25} />
                </div>
                <div className="mt-1.5 sm:mt-2 md:mt-3 text-[10px] sm:text-[11px] md:text-[13px] font-bold uppercase tracking-wide text-rose-200">
                  Peak Day
                </div>
                <div className="mt-0.5 sm:mt-1 text-lg sm:text-2xl md:text-3xl font-black">{monthStats.peakOccupancy}</div>
              </div>
            </div>
          </div>
        </section>

        {/* ================= CALENDAR + SIDEBAR ================= */}
        <div className="grid gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.36fr)] xl:grid-cols-[minmax(0,1fr)_minmax(390px,0.4fr)] 2xl:grid-cols-[minmax(0,1fr)_minmax(430px,0.42fr)] lg:items-start">

          {/* -------- Calendar card -------- */}
          <div className="w-full min-w-0 rounded-2xl sm:rounded-3xl border border-white/70 bg-white/90 p-4 sm:p-5 md:p-6 lg:p-7 shadow-[0_15px_50px_rgba(15,23,42,0.1)] backdrop-blur transition-shadow duration-300 hover:shadow-[0_20px_60px_rgba(15,23,42,0.14)]">
            {/* Month Nav */}
            <div className="mb-4 sm:mb-5 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={prevMonth}
                className="flex shrink-0 items-center gap-1 sm:gap-1.5 rounded-xl sm:rounded-2xl border border-slate-200 bg-white px-2.5 sm:px-3.5 md:px-4 h-11 sm:h-12 md:py-2.5 text-[13px] sm:text-[14px] md:text-[15px] font-bold text-blue-900 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 hover:shadow-md"
              >
                <ChevronLeft className="h-5 w-5 sm:h-[22px] sm:w-[22px] md:h-6 md:w-6" strokeWidth={2.5} />
                <span className="hidden sm:inline">Prev</span>
              </button>
              <h2 className="truncate text-[18px] xs:text-[20px] sm:text-[24px] md:text-[28px] lg:text-[30px] xl:text-[34px] font-black tracking-tight text-blue-950 text-center px-1">
                {MONTHS[month]} {year}
              </h2>
              <button
                type="button"
                onClick={nextMonth}
                className="flex shrink-0 items-center gap-1 sm:gap-1.5 rounded-xl sm:rounded-2xl border border-slate-200 bg-white px-2.5 sm:px-3.5 md:px-4 h-11 sm:h-12 md:py-2.5 text-[13px] sm:text-[14px] md:text-[15px] font-bold text-blue-900 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 hover:shadow-md"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="h-5 w-5 sm:h-[22px] sm:w-[22px] md:h-6 md:w-6" strokeWidth={2.5} />
              </button>
            </div>

            {/* Legend chips */}
            <div className="mb-4 sm:mb-5 flex flex-wrap gap-1.5 sm:gap-2 md:gap-2.5">
              {[
                { color: "bg-slate-300", label: "Empty" },
                { color: "bg-emerald-500", label: "< 30%" },
                { color: "bg-amber-500", label: "30–60%" },
                { color: "bg-orange-500", label: "60–90%" },
                { color: "bg-rose-500", label: "90–100%" },
              ].map((l) => (
                <span
                  key={l.label}
                  className="flex items-center gap-1.5 rounded-full border border-slate-100 bg-slate-50 px-2.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-[12px] md:text-[13px] font-bold text-slate-600"
                >
                  <span className={`h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full ${l.color}`} />
                  {l.label}
                </span>
              ))}
            </div>

            {/* Day Headers + Calendar Grid — horizontally scrollable together on small screens */}
            {loading ? (
              <div className="py-16 text-center text-[15px] font-bold text-slate-400">
                Loading…
              </div>
            ) : (
              <div className="overflow-x-auto -mx-1 px-1">
                <div className="min-w-[490px] sm:min-w-0">
                  {/* Day Headers */}
                  <div className="mb-2 grid grid-cols-7 text-center">
                    {DAYS_SHORT.map((d) => (
                      <div
                        key={d}
                        className="py-1.5 sm:py-2 text-[11px] sm:text-[12px] md:text-[13px] font-bold uppercase tracking-wide text-slate-400"
                      >
                        {d}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1 sm:gap-1.5 md:gap-2">
                    {Array.from({ length: firstDay }).map((_, i) => (
                      <div key={`empty-${i}`} />
                    ))}

                    {Array.from({ length: days }, (_, i) => i + 1).map((d) => {
                      const dateStr = formatDate(year, month, d);
                      const data = occupancyMap[dateStr] || { bookings: [], blocks: [] };
                      const occupied = data.bookings.length + data.blocks.length;
                      const pct = (occupied / totalRooms) * 100;
                      const isToday = dateStr === todayStr;
                      const isSelected = dateStr === selectedDate;
                      const colorCls = getOccupancyColor(pct);

                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setSelectedDate(dateStr === selectedDate ? null : dateStr)}
                          className={`relative aspect-square rounded-lg sm:rounded-xl md:rounded-2xl border p-1 sm:p-1.5 md:p-2.5 text-center transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${colorCls} ${
                            isSelected ? "ring-2 ring-blue-600 ring-offset-1 sm:ring-offset-2 shadow-xl" : ""
                          } ${isToday ? "border-blue-400 ring-2 ring-blue-200" : ""}`}
                        >
                          <div className={`text-[12px] sm:text-[14px] md:text-[16px] font-black ${isToday ? "text-blue-600" : "text-slate-800"}`}>
                            {d}
                          </div>
                          {occupied > 0 && (
                            <div className="mt-0.5 text-[9px] sm:text-[11px] md:text-[13px] font-bold text-slate-500 truncate">
                              {occupied}/{totalRooms}
                            </div>
                          )}
                          {data.blocks.length > 0 && (
                            <div className="absolute right-1 top-1 sm:right-1.5 sm:top-1.5 h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-violet-500" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* -------- Sidebar -------- */}
          <div className="w-full min-w-0 space-y-4 sm:space-y-5">
            {selectedDate ? (
              <div className="w-full rounded-2xl sm:rounded-3xl border border-white/70 bg-white/90 p-4 sm:p-5 md:p-6 shadow-[0_15px_50px_rgba(15,23,42,0.1)] backdrop-blur">
                <p className="text-[12px] sm:text-[13px] md:text-[15px] font-bold uppercase tracking-[0.2em] sm:tracking-[0.22em] text-blue-700">
                  Selected Date
                </p>
                <h3 className="mt-2 text-[18px] sm:text-[20px] md:text-[22px] font-black tracking-tight text-blue-950 truncate">
                  {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-IN", {
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                  })}
                </h3>

                {/* Occupancy progress bar */}
                <div className="mt-4 h-3 sm:h-3.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-700 via-blue-500 to-sky-400 transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        (((selectedData?.bookings?.length || 0) + (selectedData?.blocks?.length || 0)) / totalRooms) * 100,
                        100,
                      )}%`,
                    }}
                  />
                </div>
                <p className="mt-2 text-[13px] sm:text-[14px] md:text-[15px] font-semibold text-slate-500">
                  {(selectedData?.bookings?.length || 0) + (selectedData?.blocks?.length || 0)} / {totalRooms} rooms occupied
                </p>

                {/* Bookings */}
                {selectedData?.bookings?.length > 0 && (
                  <div className="mt-5">
                    <p className="mb-2.5 text-[12px] sm:text-[13px] font-bold uppercase tracking-wide text-slate-400">
                      Active Bookings
                    </p>
                    <div className="space-y-2.5">
                      {paginatedSelectedBookings.map((b) => (
                        <div
                          key={b.bookingId}
                          className="group flex flex-col xs:flex-row items-start xs:items-center justify-between gap-2.5 sm:gap-3 rounded-2xl border border-blue-50 bg-blue-50/60 px-3 sm:px-3.5 py-2.5 sm:py-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 hover:shadow-md"
                        >
                          <div className="flex min-w-0 w-full flex-1 items-center gap-3">
                            <div
                              className={`flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[12px] sm:text-[13px] font-black text-white shadow-sm ${avatarClass(
                                b.bookingId || b.guest_name,
                              )}`}
                            >
                              {(b.guest_name || "W")[0].toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[14px] sm:text-[15px] md:text-[16px] font-bold leading-6 text-slate-800">
                                {b.guest_name || "Walk-in"}
                              </div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span className="truncate text-[12px] sm:text-[13px] md:text-[14px] font-medium text-slate-500">
                                  Room: {b.rooms || "—"}
                                </span>
                                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] sm:text-[11px] font-bold text-emerald-700">
                                  <CheckCircle2 className="h-3 w-3" /> Confirmed
                                </span>
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              isModal ? onClose?.() : navigate("/hotel/communication", { state: { bookingId: b.bookingId } })
                            }
                            className="w-full xs:w-auto shrink-0 rounded-full bg-gradient-to-r from-blue-900 to-blue-600 px-3.5 py-2 xs:py-1.5 text-[12px] sm:text-[13px] font-bold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
                          >
                            View
                          </button>
                        </div>
                      ))}
                    </div>

                    {selectedData.bookings.length > SELECTED_DATE_PAGE_SIZE ? (
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
                        <div className="text-[13px] sm:text-[14px] font-semibold text-slate-500">
                          Showing{" "}
                          <span className="text-slate-900">
                            {(selectedDatePage - 1) * SELECTED_DATE_PAGE_SIZE + 1}
                          </span>{" "}
                          to{" "}
                          <span className="text-slate-900">
                            {Math.min(selectedDatePage * SELECTED_DATE_PAGE_SIZE, selectedData.bookings.length)}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedDatePage((current) => Math.max(1, current - 1))}
                            disabled={selectedDatePage === 1}
                            className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[12px] sm:text-[13px] font-bold text-slate-600 transition-colors duration-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Prev
                          </button>

                          {Array.from({ length: totalSelectedDatePages }, (_, index) => index + 1).map((pageNumber) => (
                            <button
                              key={pageNumber}
                              type="button"
                              onClick={() => setSelectedDatePage(pageNumber)}
                              className={`rounded-full px-2.5 py-1 text-[12px] sm:text-[13px] font-bold transition-colors duration-300 ${
                                pageNumber === selectedDatePage
                                  ? "bg-blue-700 text-white"
                                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              {pageNumber}
                            </button>
                          ))}

                          <button
                            type="button"
                            onClick={() => setSelectedDatePage((current) => Math.min(totalSelectedDatePages, current + 1))}
                            disabled={selectedDatePage === totalSelectedDatePages}
                            className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[12px] sm:text-[13px] font-bold text-slate-600 transition-colors duration-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Maintenance blocks */}
                {selectedData?.blocks?.length > 0 && (
                  <div className="mt-5">
                    <p className="mb-2.5 text-[12px] sm:text-[13px] font-bold uppercase tracking-wide text-slate-400">
                      Maintenance Blocks
                    </p>
                    <div className="space-y-2.5">
                      {selectedData.blocks.map((bl) => (
                        <div
                          key={bl.id}
                          className="flex items-start gap-3 rounded-2xl border border-violet-100 bg-violet-50 px-3 sm:px-3.5 py-2.5 sm:py-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-200/70 shadow-inner">
                            <ShieldAlert className="h-5 w-5 text-violet-700" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[14px] sm:text-[15px] font-bold text-violet-900 break-words">
                              Room {bl.room_number} — {bl.block_type}
                            </div>
                            {bl.reason && (
                              <div className="text-[12px] sm:text-[13px] md:text-[14px] font-medium text-violet-600 break-words">{bl.reason}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!selectedData?.bookings?.length && !selectedData?.blocks?.length && (
                  <div className="mt-5 flex items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-3.5">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                    <p className="text-[13px] sm:text-[14px] md:text-[15px] font-bold text-emerald-700">
                      All rooms available this day
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl sm:rounded-3xl border-2 border-dashed border-slate-200 bg-white/60 py-10 sm:py-12 px-4 text-center backdrop-blur">
                <div className="mx-auto flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-blue-50 shadow-inner">
                  <CalendarPlus className="h-7 w-7 sm:h-9 sm:w-9 text-blue-400" strokeWidth={2} />
                </div>
                <p className="mx-auto mt-4 max-w-[220px] text-[13px] sm:text-[14px] md:text-[15px] font-bold text-slate-500">
                  Select any day to view the details.
                </p>
              </div>
            )}

            {/* Month Summary */}
            <div className="rounded-2xl sm:rounded-3xl border border-white/70 bg-white/90 p-4 sm:p-5 md:p-6 shadow-[0_15px_50px_rgba(15,23,42,0.1)] backdrop-blur">
              <p className="text-[16px] sm:text-[18px] md:text-[20px] lg:text-[22px] font-black tracking-tight text-blue-950">
                {MONTHS[month]} {year} Summary
              </p>
              <div className="mt-4 space-y-2.5 sm:space-y-3">
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-blue-50 px-3.5 sm:px-4 py-3 sm:py-3.5 transition-transform duration-300 hover:-translate-y-0.5">
                  <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                    <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 shadow-inner">
                      <CalendarCheck2 className="h-4 w-4 sm:h-[18px] sm:w-[18px] text-blue-700" />
                    </div>
                    <span className="truncate text-[13px] sm:text-[14px] md:text-[15px] font-bold text-blue-900">Total Active Bookings</span>
                  </div>
                  <span className="shrink-0 text-[16px] sm:text-[17px] md:text-[18px] font-black text-blue-950">{bookings.length}</span>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-2xl bg-violet-50 px-3.5 sm:px-4 py-3 sm:py-3.5 transition-transform duration-300 hover:-translate-y-0.5">
                  <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                    <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 shadow-inner">
                      <Wrench className="h-4 w-4 sm:h-[18px] sm:w-[18px] text-violet-700" />
                    </div>
                    <span className="truncate text-[13px] sm:text-[14px] md:text-[15px] font-bold text-violet-900">Maintenance Blocks</span>
                  </div>
                  <span className="shrink-0 text-[16px] sm:text-[17px] md:text-[18px] font-black text-violet-700">
                    {blocks.filter((b) => b.status === "Active").length}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-2xl bg-emerald-50 px-3.5 sm:px-4 py-3 sm:py-3.5 transition-transform duration-300 hover:-translate-y-0.5">
                  <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                    <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 shadow-inner">
                      <TrendingUp className="h-4 w-4 sm:h-[18px] sm:w-[18px] text-emerald-700" />
                    </div>
                    <span className="truncate text-[13px] sm:text-[14px] md:text-[15px] font-bold text-emerald-900">Avg Monthly Occ.</span>
                  </div>
                  <span className="shrink-0 text-[16px] sm:text-[17px] md:text-[18px] font-black text-emerald-700">{monthStats.avgOccupancy}%</span>
                </div>
              </div>
            </div>

            {/* Manage maintenance CTA */}
            <button
              type="button"
              onClick={() => (isModal ? onClose?.() : navigate("/hotel/room-maintenance"))}
              className="flex h-12 sm:h-14 w-full items-center justify-center gap-2 sm:gap-2.5 rounded-xl sm:rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-600 to-violet-500 px-4 sm:px-5 text-[14px] sm:text-[15px] md:text-[16px] font-bold text-white shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl"
            >
              <Wrench className="h-5 w-5 sm:h-[22px] sm:w-[22px]" />
              <span className="truncate">Manage Maintenance Blocks</span>
            </button>
          </div>
        </div>

        {/* Footer nav */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => (isModal ? onClose?.() : navigate("/hotel/all-bookings"))}
            className="flex h-12 sm:h-14 w-full items-center justify-center gap-2 rounded-xl sm:rounded-2xl border border-slate-200 bg-white px-4 sm:px-5 text-[13px] sm:text-[14px] md:text-[15px] font-bold text-blue-900 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 hover:shadow-md sm:w-auto"
          >
            <ArrowLeft className="h-5 w-5" />
            All Bookings
          </button>
        </div>
      </div>
    </div>
  );
};

export default OccupancyForecast;