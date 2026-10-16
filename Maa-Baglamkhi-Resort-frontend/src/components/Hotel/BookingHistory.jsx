import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import API from "../../api";

const BOOKING_HISTORY_PAGE_SIZE = 9;

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

const dedupeBookings = (rows) => {
  const map = new Map();

  rows.forEach((row) => {
    const key = [
      String(row.guest_name || "").trim().toLowerCase(),
      String(row.mobile || "").trim(),
      String(row.check_in || "").trim(),
      String(row.check_out || "").trim(),
    ].join("|");

    const current = map.get(key);
    if (!current || Number(row.bookingId || 0) > Number(current.bookingId || 0)) {
      map.set(key, row);
    }
  });

  return Array.from(map.values());
};

const BookingHistory = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const response = await API.get("/hotel/booking-history");
        setRows(dedupeBookings(Array.isArray(response.data) ? response.data : []));
      } catch (error) {
        console.error(error);
        alert("Booking history could not be loaded.");
      }
    };

    loadHistory();
  }, []);

  const totalPages = Math.max(1, Math.ceil(rows.length / BOOKING_HISTORY_PAGE_SIZE));
  const paginatedRows = rows.slice(
    (page - 1) * BOOKING_HISTORY_PAGE_SIZE,
    page * BOOKING_HISTORY_PAGE_SIZE,
  );

  useEffect(() => {
    setPage(1);
  }, [rows]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return (
    <div className="min-h-screen w-full bg-[linear-gradient(135deg,#f4f8ff_0%,#eef5ff_45%,#f7fbff_100%)] p-3 sm:p-4 xl:p-6 overflow-x-hidden">
      <div className="w-full space-y-5 xl:space-y-7">
        {/* HERO */}
        <section className="relative overflow-hidden rounded-[22px] xl:rounded-[32px] border border-white/10 bg-[linear-gradient(120deg,#020617_0%,#1e3a8a_52%,#0ea5e9_100%)] px-5 py-8 text-white shadow-[0_30px_70px_rgba(2,6,23,0.35)] sm:px-6 sm:py-9 xl:px-10 xl:py-12">
          {/* decorative layer */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {/* glow orbs */}
            <div className="absolute -top-24 -right-16 h-72 w-72 rounded-full bg-sky-400/30 blur-3xl" />
            <div className="absolute -bottom-28 -left-10 h-80 w-80 rounded-full bg-blue-500/20 blur-3xl" />
            <div className="absolute top-1/2 right-1/3 h-40 w-40 -translate-y-1/2 rounded-full bg-white/10 blur-2xl" />

            {/* wave / curve pattern */}
            <svg
              className="absolute inset-0 h-full w-full opacity-40"
              viewBox="0 0 1200 400"
              preserveAspectRatio="none"
              fill="none"
            >
              <path
                d="M -50 260 C 200 180, 350 340, 600 240 C 850 140, 1000 300, 1250 200"
                stroke="url(#waveGrad1)"
                strokeWidth="1.5"
                fill="none"
              />
              <path
                d="M -50 320 C 220 250, 380 400, 640 300 C 880 210, 1020 360, 1250 260"
                stroke="url(#waveGrad2)"
                strokeWidth="1"
                fill="none"
              />
              <path
                d="M -50 120 C 180 60, 340 180, 600 110 C 860 40, 1000 160, 1250 90"
                stroke="url(#waveGrad1)"
                strokeWidth="1"
                fill="none"
              />
              <defs>
                <linearGradient id="waveGrad1" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0" />
                  <stop offset="50%" stopColor="#7dd3fc" stopOpacity="0.7" />
                  <stop offset="100%" stopColor="#7dd3fc" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="waveGrad2" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
                  <stop offset="50%" stopColor="#ffffff" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>

            {/* dotted grid accent */}
            <svg
              className="absolute -right-6 top-6 h-40 w-40 opacity-30 sm:h-52 sm:w-52"
              viewBox="0 0 100 100"
            >
              <defs>
                <pattern id="dotGridBH" width="10" height="10" patternUnits="userSpaceOnUse">
                  <circle cx="1.5" cy="1.5" r="1.5" fill="#bae6fd" />
                </pattern>
              </defs>
              <rect width="100" height="100" fill="url(#dotGridBH)" />
            </svg>

            {/* calendar glyph */}
            <svg
              className="absolute right-8 top-1/2 hidden h-28 w-28 -translate-y-1/2 text-white/10 sm:block lg:h-36 lg:w-36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
            >
              <rect x="3" y="4" width="18" height="17" rx="3" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <circle cx="17" cy="16" r="3.2" fill="currentColor" fillOpacity="0.25" />
            </svg>
          </div>

          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 backdrop-blur-sm ring-1 ring-white/20 xl:px-4">
              <svg className="h-3.5 w-3.5 text-sky-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <rect x="3" y="4" width="18" height="17" rx="3" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="16" y1="2" x2="16" y2="6" />
              </svg>
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-sky-200">Booking History</p>
            </div>
            <h1 className="mt-4 text-2xl font-black sm:text-3xl xl:text-4xl">Checked-out bookings archive</h1>
            <p className="mt-3 max-w-3xl text-[15px] leading-6 text-slate-100/85 sm:text-base xl:text-[19px] xl:leading-7">
              Review past stays, guest details, room allocation, and payment balance in one clean table.
            </p>
          </div>
        </section>

        {/* CONTENT */}
        <section className="rounded-[22px] xl:rounded-[30px] border border-sky-100 bg-white/90 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:p-5 xl:p-7">
          <div className="mb-5 flex flex-col gap-4 border-b border-sky-100 pb-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between xl:mb-6 xl:pb-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#1e3a8a_0%,#0ea5e9_100%)] text-white shadow-[0_10px_24px_rgba(14,165,233,0.35)] xl:h-12 xl:w-12">
                <svg className="h-5 w-5 xl:h-6 xl:w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="17" rx="3" />
                  <line x1="3" y1="9" x2="21" y2="9" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                </svg>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-sky-700 xl:text-[11px]">History Table</p>
                <h2 className="mt-1 text-xl font-black leading-tight text-slate-900 sm:text-2xl xl:mt-1.5 xl:text-[31px]">Archived guest stays</h2>
              </div>
            </div>
            <div className="self-start rounded-full bg-[linear-gradient(135deg,#eff6ff_0%,#e0f2fe_100%)] px-4 py-2 text-sm font-bold text-blue-800 ring-1 ring-sky-200 sm:self-auto xl:px-5 xl:py-2.5 xl:text-[16px]">
              {rows.length} records
            </div>
          </div>

          {rows.length ? (
            <>
              {/* DESKTOP TABLE (xl and up) — unchanged */}
              <div className="hidden overflow-hidden rounded-[28px] border border-sky-100 bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)] shadow-[0_8px_30px_rgba(15,23,42,0.04)] xl:block">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1380px] text-left">
                    <thead className="bg-[linear-gradient(120deg,#0f172a_0%,#1e3a8a_60%,#0ea5e9_100%)]">
                      <tr className="text-[16px] font-bold uppercase tracking-[0.2em] text-sky-50 xl:text-[17px]">
                        <th className="px-6 py-5">Booking</th>
                        <th className="px-6 py-5">Guest</th>
                        <th className="px-6 py-5">Contact</th>
                        <th className="px-6 py-5">Stay Dates</th>
                        <th className="px-6 py-5">Room Details</th>
                        <th className="px-6 py-5">Total</th>
                        <th className="px-6 py-5">Remaining</th>
                        <th className="px-6 py-5">Status</th>
                        <th className="px-6 py-5">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedRows.map((row) => {
                        const remaining = Number(row.remainingAmount || 0);
                        const roomDetails = String(row.roomDetails || row.rooms || "--")
                          .split(" || ")
                          .join("\n");

                        return (
                          <tr
                            key={row.bookingId}
                            className="border-t border-sky-100 align-top text-[17px] text-slate-800 transition-colors duration-200 hover:bg-sky-50/60 xl:text-[18px]"
                          >
                            <td className="px-6 py-6">
                              <div className="inline-flex flex-col gap-1.5 rounded-2xl bg-sky-50/80 px-4 py-3 ring-1 ring-sky-100">
                                <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-sky-700">
                                  Booking Ref
                                </div>
                                <div className="text-lg font-black text-slate-900 xl:text-2xl">
                                  #{row.bookingCode || row.bookingId}
                                </div>
                                <div className="text-[15px] text-slate-500">
                                  {row.company_name || "Direct booking"}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-6">
                              <div className="space-y-2">
                                <div className="text-lg font-black text-slate-900 xl:text-2xl">
                                  {row.guest_name || "Walk-in Guest"}
                                </div>
                                <div className="text-[15px] text-slate-500">
                                  {row.booking_source || row.bookingPoint || "--"}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-6">
                              <div className="space-y-2">
                                <div className="font-semibold text-slate-900 xl:text-xl">{row.mobile || "--"}</div>
                                <div className="max-w-[260px] break-words text-[15px] text-slate-500">
                                  {row.guest_email || "--"}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-6">
                              <div className="space-y-1">
                                <div className="font-semibold text-slate-900 xl:text-xl">{formatDate(row.check_in)}</div>
                                <div className="text-[13px] font-semibold uppercase tracking-[0.18em] text-sky-500">to</div>
                                <div className="font-semibold text-slate-900 xl:text-xl">{formatDate(row.check_out)}</div>
                              </div>
                            </td>
                            <td className="px-6 py-6">
                              <div className="max-w-[320px] whitespace-pre-line rounded-2xl bg-slate-50/80 px-4 py-3 font-semibold leading-7 text-slate-900 ring-1 ring-slate-100 xl:text-xl">
                                {roomDetails}
                              </div>
                            </td>
                            <td className="px-6 py-6 text-lg font-black text-slate-900 xl:text-2xl">
                              {formatCurrency(row.totalAmount)}
                            </td>
                            <td className={`px-6 py-6 text-lg font-black xl:text-2xl ${remaining > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                              {formatCurrency(row.remainingAmount)}
                            </td>
                            <td className="px-6 py-6">
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-[linear-gradient(135deg,#0f172a_0%,#1e3a8a_100%)] px-4 py-2 text-[15px] font-bold uppercase tracking-[0.2em] text-white shadow-[0_6px_16px_rgba(15,23,42,0.25)] xl:text-[16px]">
                                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <path d="M20 6 9 17l-5-5" />
                                </svg>
                                {row.booking_status || "Checked Out"}
                              </span>
                            </td>
                            <td className="px-6 py-6">
                              <div className="flex min-w-[220px] flex-wrap gap-2.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    navigate("/hotel/payment-history", {
                                      state: { bookingId: row.bookingId, bookingCode: row.bookingCode },
                                    })
                                  }
                                  className="rounded-full bg-[linear-gradient(135deg,#1d4ed8_0%,#0ea5e9_100%)] px-5 py-2.5 text-[17px] font-bold text-white shadow-[0_10px_22px_rgba(29,78,216,0.28)] transition-all duration-200 hover:shadow-[0_14px_28px_rgba(29,78,216,0.38)] hover:brightness-105 active:scale-[0.97]"
                                >
                                  Payment History
                                </button>
                                <button
                                  type="button"
                                  onClick={() => navigate("/hotel/all-bookings")}
                                  className="rounded-full border-2 border-blue-200 bg-white px-5 py-2.5 text-[17px] font-bold text-blue-700 transition-all duration-200 hover:border-blue-400 hover:bg-blue-50 active:scale-[0.97]"
                                >
                                  Back
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* MOBILE & TABLET CARD VIEW (below xl) */}
              <div className="grid grid-cols-1 gap-4 xl:hidden sm:grid-cols-2 md:grid-cols-2">
                {paginatedRows.map((row) => {
                  const remaining = Number(row.remainingAmount || 0);
                  const roomDetails = String(row.roomDetails || row.rooms || "--")
                    .split(" || ")
                    .join(", ");

                  return (
                    <div
                      key={row.bookingId}
                      className="rounded-[18px] border border-sky-100 bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)] p-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] sm:rounded-[20px] sm:p-4"
                    >
                      {/* Card header: booking ref + status */}
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <div className="min-w-0 flex-1 rounded-2xl bg-sky-50/80 px-3 py-2 ring-1 ring-sky-100">
                          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-sky-700">
                            Booking Ref
                          </div>
                          <div className="truncate text-base font-black text-slate-900">
                            #{row.bookingCode || row.bookingId}
                          </div>
                        </div>
                        <span className="inline-flex max-w-full shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-[linear-gradient(135deg,#0f172a_0%,#1e3a8a_100%)] px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-white shadow-[0_6px_16px_rgba(15,23,42,0.25)] sm:px-3 sm:text-[12px] sm:tracking-[0.16em]">
                          <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                          {row.booking_status || "Checked Out"}
                        </span>
                      </div>

                      {/* Guest name */}
                      <div className="mb-3">
                        <div className="text-base font-black text-slate-900">
                          {row.guest_name || "Walk-in Guest"}
                        </div>
                        <div className="text-[13px] text-slate-500">
                          {row.company_name || "Direct booking"} · {row.booking_source || row.bookingPoint || "--"}
                        </div>
                      </div>

                      {/* Label/value grid */}
                      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 rounded-2xl bg-slate-50/70 p-3 ring-1 ring-slate-100">
                        <div>
                          <div className="text-[13px] font-semibold text-slate-500">Contact</div>
                          <div className="text-[14px] font-semibold text-slate-900">{row.mobile || "--"}</div>
                        </div>
                        <div>
                          <div className="text-[13px] font-semibold text-slate-500">Email</div>
                          <div className="break-words text-[14px] font-semibold text-slate-900">
                            {row.guest_email || "--"}
                          </div>
                        </div>
                        <div>
                          <div className="text-[13px] font-semibold text-slate-500">Check-in</div>
                          <div className="text-[14px] font-semibold text-slate-900">{formatDate(row.check_in)}</div>
                        </div>
                        <div>
                          <div className="text-[13px] font-semibold text-slate-500">Check-out</div>
                          <div className="text-[14px] font-semibold text-slate-900">{formatDate(row.check_out)}</div>
                        </div>
                        <div className="col-span-2">
                          <div className="text-[13px] font-semibold text-slate-500">Room Details</div>
                          <div className="text-[14px] font-semibold leading-5 text-slate-900">{roomDetails}</div>
                        </div>
                        <div>
                          <div className="text-[13px] font-semibold text-slate-500">Total</div>
                          <div className="text-[15px] font-black text-slate-900">
                            {formatCurrency(row.totalAmount)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[13px] font-semibold text-slate-500">Remaining</div>
                          <div className={`text-[15px] font-black ${remaining > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                            {formatCurrency(row.remainingAmount)}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="mt-3.5 flex gap-2.5">
                        <button
                          type="button"
                          onClick={() =>
                            navigate("/hotel/payment-history", {
                              state: { bookingId: row.bookingId, bookingCode: row.bookingCode },
                            })
                          }
                          className="flex-1 rounded-full bg-[linear-gradient(135deg,#1d4ed8_0%,#0ea5e9_100%)] px-4 py-2.5 text-[14px] font-bold text-white shadow-[0_10px_22px_rgba(29,78,216,0.28)] transition-all duration-200 active:scale-[0.97]"
                        >
                          Payment History
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate("/hotel/all-bookings")}
                          className="flex-1 rounded-full border-2 border-blue-200 bg-white px-4 py-2.5 text-[14px] font-bold text-blue-700 transition-all duration-200 active:scale-[0.97]"
                        >
                          Back
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="rounded-[22px] border border-dashed border-sky-200 bg-sky-50/50 px-4 py-12 text-center text-base font-medium text-slate-500 sm:rounded-[28px] sm:px-5 sm:py-16 xl:text-[21px]">
              Abhi tak koi checked-out booking history me nahi hai.
            </div>
          )}

          {rows.length ? (
            <div className="mt-5 rounded-[20px] border border-sky-100 bg-[linear-gradient(180deg,#f8fbff_0%,#f0f6ff_100%)] p-3.5 sm:p-4 xl:mt-6 xl:rounded-[24px] xl:p-5">
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-center text-sm text-slate-500 sm:text-left xl:text-[17px]">
                  Showing{" "}
                  <span className="font-bold text-slate-900">
                    {(page - 1) * BOOKING_HISTORY_PAGE_SIZE + 1}
                  </span>{" "}
                  to{" "}
                  <span className="font-bold text-slate-900">
                    {Math.min(page * BOOKING_HISTORY_PAGE_SIZE, rows.length)}
                  </span>{" "}
                  of <span className="font-bold text-slate-900">{rows.length}</span> records
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={page === 1}
                    className="inline-flex min-w-[80px] items-center justify-center rounded-full bg-[linear-gradient(135deg,#0f172a_0%,#1e3a8a_100%)] px-3.5 py-2 text-[13px] font-bold text-white transition-all duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:bg-none disabled:text-slate-400 sm:min-w-[96px] sm:px-4 sm:py-2.5 sm:text-[15px]"
                  >
                    Previous
                  </button>

                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                    <button
                      key={pageNumber}
                      type="button"
                      onClick={() => setPage(pageNumber)}
                      className={`h-9 min-w-[38px] rounded-full border px-2.5 text-[13px] font-bold transition-all duration-200 sm:h-10 sm:min-w-[44px] sm:px-3 sm:text-[15px] ${
                        pageNumber === page
                          ? "border-transparent bg-[linear-gradient(135deg,#1d4ed8_0%,#0ea5e9_100%)] text-white shadow-[0_10px_22px_rgba(29,78,216,0.3)]"
                          : "border-sky-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-sky-50"
                      }`}
                    >
                      {pageNumber}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                    disabled={page === totalPages}
                    className="inline-flex min-w-[80px] items-center justify-center rounded-full bg-[linear-gradient(135deg,#1d4ed8_0%,#0ea5e9_100%)] px-3.5 py-2 text-[13px] font-bold text-white transition-all duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:bg-blue-100 disabled:bg-none disabled:text-blue-300 sm:min-w-[96px] sm:px-4 sm:py-2.5 sm:text-[15px]"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
};

export default BookingHistory;