import React, { useCallback, useEffect, useRef, useState } from "react";
import { HiOutlineEnvelope, HiOutlinePhone } from "react-icons/hi2";
import {
  HiOutlineUserCircle,
  HiOutlineMagnifyingGlass,
  HiOutlineDocumentText,
  HiOutlineCalendarDays,
  HiOutlineBanknotes,
  HiOutlineMoon,
  HiOutlinePlus,
  HiOutlineArrowLeft,
  HiOutlineUserGroup,
} from "react-icons/hi2";
import { useNavigate } from "react-router-dom";
import API, { getBackendBaseURL } from "../../api";
import { setStoredBookingId } from "./bookingSession";

const formatCurrency = (v) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(v) || 0);

const formatDate = (d) => {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const STATUS_COLORS = {
  Confirmed: "bg-blue-100 text-blue-700",
  "Checked In": "bg-emerald-100 text-emerald-700",
  "Checked Out": "bg-slate-100 text-slate-600",
  Cancelled: "bg-rose-100 text-rose-700",
};

const documentTypeLabels = {
  checkin_form: "Check-in Form",
  guest_photo: "Guest Photo",
  signature: "Signature",
  id_proof: "ID Proof",
};

const buildUploadUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${getBackendBaseURL()}${raw.startsWith("/") ? raw : `/${raw}`}`;
};

// ─── Shared premium button style (Blue-950 → Blue-700 → Sky-500) ──────────────
// Buttons: 52px mobile / 54px tablet / 56px desktop, full width on mobile, auto width on desktop
const primaryBtnCls =
  "inline-flex h-[52px] sm:h-[54px] lg:h-14 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-950 via-blue-700 to-sky-500 px-6 text-[14px] sm:text-[15px] lg:text-[16px] font-bold text-white shadow-lg shadow-blue-200 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-blue-300/50 disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-lg active:scale-[0.98]";
const secondaryBtnCls =
  "inline-flex h-[52px] sm:h-[54px] lg:h-14 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 text-[14px] sm:text-[15px] lg:text-[16px] font-bold text-slate-700 transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/60 hover:shadow-md active:scale-[0.98]";
const viewBtnCls =
  "inline-flex h-10 items-center justify-center whitespace-nowrap rounded-full bg-gradient-to-r from-blue-950 to-blue-700 px-5 text-sm font-bold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-200 active:scale-[0.98]";
// Mobile-only card action button (full width, sits at bottom of card)
const mobileCardViewBtnCls =
  "inline-flex h-11 w-full items-center justify-center whitespace-nowrap rounded-xl bg-gradient-to-r from-blue-950 to-blue-700 px-5 text-[14px] font-bold text-white shadow-sm transition-all duration-300 active:scale-[0.98]";

const GuestProfile = ({ isModal = false, onClose, bookingId: initialBookingId = null }) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const lastQueryRef = useRef("");

  // Auto-load by bookingId (used when opening from a booking row)
  useEffect(() => {
    if (!initialBookingId) return;
    let cancelled = false;
    const load = async () => {
      setSearching(true);
      setError("");
      try {
        const res = await API.get(`/hotel/guest-profile?bookingId=${initialBookingId}`);
        if (cancelled) return;
        if (res.data && (res.data.guest || res.data.bookings?.length)) {
          setProfile(res.data);
          lastQueryRef.current = res.data.guest?.guest_name || "";
          if (res.data.guest?.mobile) {
            setSearchQuery(res.data.guest.mobile);
          }
        } else {
          setError("No data for this booking.");
          setProfile(null);
        }
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          setError(err.response?.data?.error || "Failed to load this guest.");
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [initialBookingId]);

  const handleSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) return;

    lastQueryRef.current = q;
    setSearching(true);
    setProfile(null);
    setError("");

    try {
      const res = await API.get(`/hotel/guest-profile?q=${encodeURIComponent(q)}`);
      if (res.data && (res.data.guest || res.data.bookings?.length)) {
        setProfile(res.data);
      } else {
        setError("Koi guest nahi mila is mobile/naam ke sath. Naya booking karein.");
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Search failed. Please try again.");
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    const reload = async () => {
      try {
        let res;
        if (initialBookingId) {
          res = await API.get(`/hotel/guest-profile?bookingId=${initialBookingId}`);
        } else {
          const q = lastQueryRef.current.trim();
          if (!q) return;
          res = await API.get(`/hotel/guest-profile?q=${encodeURIComponent(q)}`);
        }
        if (res.data && (res.data.guest || res.data.bookings?.length)) {
          setProfile(res.data);
        }
      } catch {
        // silent — user can retry
      }
    };
    window.addEventListener("documentsUpdated", reload);
    return () => window.removeEventListener("documentsUpdated", reload);
  }, [initialBookingId]);

  const totalStats = React.useMemo(() => {
    if (!profile?.bookings?.length) {
      return { stays: 0, revenue: 0, nights: 0 };
    }

    return profile.bookings.reduce(
      (acc, b) => {
        acc.stays += 1;
        acc.revenue += Number(b.paidAmount || 0);

        if (b.check_in && b.check_out) {
          const diff = (new Date(b.check_out) - new Date(b.check_in)) / (1000 * 60 * 60 * 24);
          acc.nights += Math.max(Math.round(diff), 1);
        }

        return acc;
      },
      { stays: 0, revenue: 0, nights: 0 },
    );
  }, [profile]);

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-white p-4 sm:p-6 md:p-8 lg:p-8 xl:p-10">
      <div className="mx-auto w-full max-w-[1600px] min-w-0 space-y-5 sm:space-y-7 lg:space-y-8">

        {/* Hero */}
        <section className="relative w-full min-w-0 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-blue-950 via-blue-700 to-sky-500 px-5 py-8 text-white shadow-[0_30px_80px_rgba(15,23,42,0.25)] sm:px-8 sm:py-10 md:px-10">
          {/* Abstract wave / glass decoration */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-sky-300/25 blur-3xl sm:h-72 sm:w-72" />
            <div className="absolute -bottom-28 left-0 h-64 w-64 rounded-full bg-blue-400/20 blur-3xl sm:h-80 sm:w-80" />
            <svg
              className="absolute bottom-0 right-0 w-2/3 opacity-25"
              viewBox="0 0 800 200"
              preserveAspectRatio="none"
            >
              <path
                d="M0,120 C200,180 400,40 800,100 L800,200 L0,200 Z"
                fill="rgba(255,255,255,0.18)"
              />
              <path
                d="M0,150 C250,90 550,190 800,130 L800,200 L0,200 Z"
                fill="rgba(255,255,255,0.12)"
              />
            </svg>
          </div>

          <div className="relative min-w-0 text-center md:text-left">
            <p className="text-sm font-bold uppercase tracking-[0.32em] text-sky-200">
              Guest Intelligence
            </p>
            <h1 className="mt-3 break-words text-[28px] font-black leading-tight sm:text-[30px] md:text-[36px] lg:text-[42px]">
              Guest Profile &amp; Stay History
            </h1>
            <p className="mx-auto mt-4 max-w-2xl break-words text-[15px] font-medium leading-7 text-blue-50/90 sm:text-[16px] md:mx-0">
              "Search by mobile number or name to view all of a guest&apos;s past stays, total spend,
              and booking patterns in one place."
            </p>
          </div>
        </section>

        {/* Search */}
        <div className="w-full min-w-0 rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-xl shadow-blue-100/40 backdrop-blur sm:p-6 md:p-8">
          <label className="mb-3 block text-[13px] font-semibold uppercase tracking-[0.2em] text-slate-600 sm:text-[16px]">
            Search Guest by Mobile or Name
          </label>
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative min-w-0 flex-1">
              <HiOutlineMagnifyingGlass className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-xl text-slate-400 sm:text-2xl" />
              <input
                type="text"
                placeholder="9876543210 ya 'Rahul Sharma'"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="h-14 w-full min-w-0 rounded-xl border border-slate-200 bg-white pl-14 pr-5 text-[16px] font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 lg:h-[60px]"
              />
            </div>
            <button
              type="button"
              onClick={handleSearch}
              disabled={searching || !searchQuery.trim()}
              className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-950 via-blue-700 to-sky-500 px-8 text-[15px] font-bold text-white shadow-lg shadow-blue-200 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-blue-300/50 disabled:opacity-60 sm:text-[16px] md:w-auto md:min-w-[160px] lg:h-[60px]"
            >
              {searching ? "Searching..." : "Search"}
            </button>
          </div>
          {error && (
            <p className="mt-4 break-words rounded-xl bg-rose-50 px-4 py-3 text-[14px] font-semibold text-rose-700 sm:text-[16px]">
              Warning: {error}
            </p>
          )}
        </div>

        {profile && (
          <>
            {/* Guest Summary */}
            <div className="w-full min-w-0 rounded-3xl border border-slate-200 bg-white shadow-lg transition-all duration-300 hover:shadow-2xl">
              <div className="flex flex-col gap-6 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between lg:p-8">
                <div className="flex min-w-0 items-center gap-4 sm:gap-5">
                  <div className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-950 via-blue-700 to-sky-500 text-2xl font-black text-white shadow-lg shadow-blue-200 sm:h-[68px] sm:w-[68px] sm:text-3xl lg:h-[76px] lg:w-[76px]">
                    {(profile.guest?.guest_name || "G").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="break-words text-[20px] font-bold text-slate-900 sm:text-[28px] lg:text-[32px]">
                      {profile.guest?.guest_name || "-"}
                    </h2>
                    <div className="mt-2 flex flex-col gap-y-2 text-[14px] font-semibold text-slate-500 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:text-[16px]">
                      <span className="flex min-w-0 max-w-full items-center gap-1.5">
                        <HiOutlinePhone className="shrink-0 text-lg text-blue-600 sm:text-xl" />
                        <span className="min-w-0 break-words">{profile.guest?.mobile || "-"}</span>
                      </span>
                      <span className="hidden text-slate-300 sm:inline">|</span>
                      <span className="flex min-w-0 max-w-full items-center gap-1.5">
                        <HiOutlineEnvelope className="shrink-0 text-lg text-sky-600 sm:text-xl" />
                        <span className="min-w-0 break-all">{profile.guest?.guest_email || "-"}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 lg:min-w-[420px] lg:grid-cols-3">
                  <div className="group rounded-[20px] border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-4 text-center transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-100 sm:rounded-2xl sm:p-5">
                    <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                      <HiOutlineUserGroup className="text-[22px] sm:text-2xl lg:text-[28px]" />
                    </div>
                    <div className="text-[13px] font-semibold uppercase tracking-wide text-blue-600 sm:text-[16px]">
                      Stays
                    </div>
                    <div className="mt-1 text-[26px] font-black text-blue-950 sm:text-3xl lg:text-4xl">{totalStats.stays}</div>
                  </div>
                  <div className="group rounded-[20px] border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-4 text-center transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-100 sm:rounded-2xl sm:p-5">
                    <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                      <HiOutlineMoon className="text-[22px] sm:text-2xl lg:text-[28px]" />
                    </div>
                    <div className="text-[13px] font-semibold uppercase tracking-wide text-blue-600 sm:text-[16px]">
                      Nights
                    </div>
                    <div className="mt-1 text-[26px] font-black text-blue-950 sm:text-3xl lg:text-4xl">{totalStats.nights}</div>
                  </div>
                  <div className="group rounded-[20px] border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-4 text-center transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-100 sm:rounded-2xl sm:p-5">
                    <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                      <HiOutlineBanknotes className="text-[22px] sm:text-2xl lg:text-[28px]" />
                    </div>
                    <div className="text-[13px] font-semibold uppercase tracking-wide text-blue-600 sm:text-[16px]">
                      Total Spent
                    </div>
                    <div className="mt-1 break-words text-[20px] font-black text-blue-950 sm:text-2xl lg:text-3xl">
                      {formatCurrency(totalStats.revenue)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Uploaded Documents */}
            <div className="w-full min-w-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-lg transition-all duration-300 hover:shadow-2xl sm:p-6 md:p-8">
              <div className="mb-5 flex flex-col items-start gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h3 className="break-words text-[20px] font-bold text-slate-900 sm:text-[30px] lg:text-[34px]">
                    Uploaded Documents ({profile.documents?.length || 0})
                  </h3>
                  <p className="mt-1 text-[14px] font-medium text-slate-500 sm:text-[16px]">
                    Hardcopy check-in forms aur guest related images ab table format me available hain.
                  </p>
                </div>
                <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 sm:flex">
                  <HiOutlineDocumentText className="text-2xl lg:text-[26px]" />
                </div>
              </div>

              {!profile.documents?.length ? (
                <div className="rounded-3xl border-2 border-dashed border-blue-100 bg-blue-50/40 px-4 py-14 text-center sm:px-6">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                    <HiOutlineDocumentText className="text-[28px] sm:text-[32px]" />
                  </div>
                  <p className="break-words text-[14px] font-semibold text-slate-500 sm:text-[16px]">
                    Is guest ke liye abhi koi uploaded document nahi mila.
                  </p>
                </div>
              ) : (
                <>
                  {/* Desktop / Laptop / Tablet: table with horizontal scroll */}
                  <div className="hidden w-full min-w-0 overflow-hidden rounded-3xl border border-slate-200 shadow-sm md:block">
                    <div className="max-h-[520px] w-full overflow-auto">
                      <table className="w-full min-w-[720px] text-left">
                        <thead className="sticky top-0 z-10 bg-slate-50">
                          <tr className="text-[15px] font-bold uppercase tracking-wide text-blue-900/80">
                            <th className="px-4 py-4 sm:px-6 sm:py-5">Preview</th>
                            <th className="px-4 py-4 sm:px-6 sm:py-5">Document Type</th>
                            <th className="px-4 py-4 sm:px-6 sm:py-5">Booking</th>
                            <th className="px-4 py-4 sm:px-6 sm:py-5">Uploaded On</th>
                            <th className="px-4 py-4 sm:px-6 sm:py-5">Terms</th>
                            <th className="px-4 py-4 sm:px-6 sm:py-5">Notes</th>
                            <th className="px-4 py-4 sm:px-6 sm:py-5">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {profile.documents.map((document, idx) => (
                            <tr
                              key={document.id}
                              className={`border-t border-slate-100 align-middle text-[16px] font-medium text-slate-700 transition-colors duration-200 hover:bg-blue-50/50 ${
                                idx % 2 === 1 ? "bg-slate-50/50" : "bg-white"
                              }`}
                            >
                              <td className="px-4 py-4 sm:px-6 sm:py-5">
                                <img
                                  src={buildUploadUrl(document.file_url)}
                                  alt={documentTypeLabels[document.document_type] || "Guest document"}
                                  className="h-16 w-24 rounded-xl border border-slate-200 object-cover shadow-sm transition-transform duration-300 hover:scale-105 sm:h-20 sm:w-32 sm:rounded-2xl"
                                />
                              </td>
                              <td className="px-4 py-4 text-[16px] font-bold text-slate-900 sm:px-6 sm:py-5">
                                {documentTypeLabels[document.document_type] || "Document"}
                              </td>
                              <td className="px-4 py-4 text-[16px] font-medium text-slate-600 sm:px-6 sm:py-5">
                                {document.booking_code || `#${document.booking_id}`}
                              </td>
                              <td className="px-4 py-4 text-[16px] font-medium text-slate-600 sm:px-6 sm:py-5">
                                {formatDate(document.uploaded_at)}
                              </td>
                              <td className="px-4 py-4 sm:px-6 sm:py-5">
                                <span
                                  className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-bold uppercase tracking-wide ${
                                    Number(document.terms_accepted)
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-rose-100 text-rose-700"
                                  }`}
                                >
                                  {Number(document.terms_accepted) ? "Accepted" : "Pending"}
                                </span>
                              </td>
                              <td className="max-w-[260px] break-words px-4 py-4 text-[16px] font-medium text-slate-600 sm:px-6 sm:py-5">
                                {document.notes || "--"}
                              </td>
                              <td className="px-4 py-4 sm:px-6 sm:py-5">
                                <a
                                  href={buildUploadUrl(document.file_url)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={viewBtnCls}
                                >
                                  View
                                </a>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Mobile: one card per document */}
                  <div className="space-y-3 md:hidden">
                    {profile.documents.map((document) => (
                      <div
                        key={document.id}
                        className="w-full min-w-0 rounded-[20px] border border-slate-200 bg-white p-4 shadow-md"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={buildUploadUrl(document.file_url)}
                            alt={documentTypeLabels[document.document_type] || "Guest document"}
                            className="h-16 w-16 shrink-0 rounded-[18px] border border-slate-200 object-cover shadow-sm"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="break-words text-[15px] font-bold text-slate-900">
                              {documentTypeLabels[document.document_type] || "Document"}
                            </div>
                            <div className="mt-0.5 truncate text-[13px] font-medium text-slate-500">
                              {document.booking_code || `#${document.booking_id}`}
                            </div>
                          </div>
                          <span
                            className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-[12px] font-bold uppercase tracking-wide ${
                              Number(document.terms_accepted)
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-rose-100 text-rose-700"
                            }`}
                          >
                            {Number(document.terms_accepted) ? "Accepted" : "Pending"}
                          </span>
                        </div>

                        <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[13px] font-semibold text-slate-500">Uploaded On</span>
                            <span className="text-[14px] font-bold text-slate-800">
                              {formatDate(document.uploaded_at)}
                            </span>
                          </div>
                          <div className="flex items-start justify-between gap-3">
                            <span className="shrink-0 text-[13px] font-semibold text-slate-500">Notes</span>
                            <span className="break-words text-right text-[14px] font-medium text-slate-700">
                              {document.notes || "--"}
                            </span>
                          </div>
                        </div>

                        <a
                          href={buildUploadUrl(document.file_url)}
                          target="_blank"
                          rel="noreferrer"
                          className={`${mobileCardViewBtnCls} mt-4`}
                        >
                          View
                        </a>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Stay History */}
            <div className="w-full min-w-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-lg transition-all duration-300 hover:shadow-2xl sm:p-6 md:p-8">
              <div className="mb-5 flex flex-col gap-4 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="break-words text-[20px] font-bold text-slate-900 sm:text-[30px] lg:text-[34px]">
                  Stay History ({profile.bookings?.length || 0} bookings)
                </h3>
                <button
                  type="button"
                  onClick={() => (isModal ? onClose?.() : navigate("/hotel/guest"))}
                  className={`${primaryBtnCls} w-full sm:w-auto`}
                >
                  <HiOutlinePlus className="text-xl" />
                  New Booking
                </button>
              </div>

              {!profile.bookings?.length ? (
                <div className="rounded-3xl border-2 border-dashed border-blue-100 bg-blue-50/40 px-4 py-14 text-center sm:px-6">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                    <HiOutlineCalendarDays className="text-[28px] sm:text-[32px]" />
                  </div>
                  <p className="break-words text-[14px] font-semibold text-slate-500 sm:text-[16px]">No past bookings found.</p>
                </div>
              ) : (
                <>
                  {/* Desktop / Laptop / Tablet: table with horizontal scroll */}
                  <div className="hidden w-full min-w-0 overflow-hidden rounded-3xl border border-slate-200 shadow-sm md:block">
                    <div className="max-h-[520px] w-full overflow-auto">
                      <table className="w-full min-w-[760px] text-left">
                        <thead className="sticky top-0 z-10 bg-slate-50">
                          <tr className="text-[15px] font-bold uppercase tracking-wide text-blue-900/80">
                            <th className="px-4 py-4 sm:px-6 sm:py-5">Booking</th>
                            <th className="px-4 py-4 sm:px-6 sm:py-5">Rooms</th>
                            <th className="px-4 py-4 sm:px-6 sm:py-5">Stay Dates</th>
                            <th className="px-4 py-4 sm:px-6 sm:py-5">Status</th>
                            <th className="px-4 py-4 sm:px-6 sm:py-5">Paid</th>
                            <th className="px-4 py-4 sm:px-6 sm:py-5">Due</th>
                            <th className="px-4 py-4 sm:px-6 sm:py-5">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {profile.bookings.map((b, idx) => (
                            <tr
                              key={b.bookingId}
                              className={`border-t border-slate-100 align-middle text-[16px] font-medium text-slate-700 transition-colors duration-200 hover:bg-blue-50/50 ${
                                idx % 2 === 1 ? "bg-slate-50/50" : "bg-white"
                              }`}
                            >
                              <td className="px-4 py-4 text-[16px] font-black text-slate-900 sm:px-6 sm:py-5">#{b.bookingId}</td>
                              <td className="px-4 py-4 text-[16px] font-bold text-slate-800 sm:px-6 sm:py-5">
                                {b.rooms || "Room not set"}
                              </td>
                              <td className="whitespace-nowrap px-4 py-4 text-[16px] font-medium text-slate-600 sm:px-6 sm:py-5">
                                {formatDate(b.check_in)} to {formatDate(b.check_out)}
                              </td>
                              <td className="px-4 py-4 sm:px-6 sm:py-5">
                                <span
                                  className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-bold ${
                                    STATUS_COLORS[b.booking_status] || "bg-slate-100 text-slate-600"
                                  }`}
                                >
                                  {b.booking_status || "Unknown"}
                                </span>
                              </td>
                              <td className="px-4 py-4 text-[16px] font-black text-blue-700 sm:px-6 sm:py-5">
                                {formatCurrency(b.paidAmount)}
                              </td>
                              <td className="px-4 py-4 text-[16px] font-black text-rose-600 sm:px-6 sm:py-5">
                                {Number(b.remainingAmount) > 0
                                  ? formatCurrency(b.remainingAmount)
                                  : formatCurrency(0)}
                              </td>
                              <td className="px-4 py-4 sm:px-6 sm:py-5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setStoredBookingId(b.bookingId);
                                    if (isModal) onClose?.();
                                    else {
                                      navigate("/hotel/communication", {
                                        state: { bookingId: b.bookingId },
                                      });
                                    }
                                  }}
                                  className={viewBtnCls}
                                >
                                  View
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Mobile: one card per booking */}
                  <div className="space-y-3 md:hidden">
                    {profile.bookings.map((b) => (
                      <div
                        key={b.bookingId}
                        className="w-full min-w-0 rounded-[20px] border border-slate-200 bg-white p-4 shadow-md"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[15px] font-black text-slate-900">#{b.bookingId}</div>
                            <div className="mt-0.5 break-words text-[13px] font-bold text-slate-600">
                              {b.rooms || "Room not set"}
                            </div>
                          </div>
                          <span
                            className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-[12px] font-bold ${
                              STATUS_COLORS[b.booking_status] || "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {b.booking_status || "Unknown"}
                          </span>
                        </div>

                        <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[13px] font-semibold text-slate-500">Stay Dates</span>
                            <span className="text-right text-[14px] font-bold text-slate-800">
                              {formatDate(b.check_in)} to {formatDate(b.check_out)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[13px] font-semibold text-slate-500">Paid</span>
                            <span className="text-[15px] font-black text-blue-700">
                              {formatCurrency(b.paidAmount)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[13px] font-semibold text-slate-500">Due</span>
                            <span className="text-[15px] font-black text-rose-600">
                              {Number(b.remainingAmount) > 0
                                ? formatCurrency(b.remainingAmount)
                                : formatCurrency(0)}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setStoredBookingId(b.bookingId);
                            if (isModal) onClose?.();
                            else {
                              navigate("/hotel/communication", {
                                state: { bookingId: b.bookingId },
                              });
                            }
                          }}
                          className={`${mobileCardViewBtnCls} mt-4`}
                        >
                          View
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {!profile && !error && !searching && (
          <div className="w-full min-w-0 rounded-3xl border-2 border-dashed border-blue-100 bg-white px-4 py-16 text-center shadow-sm sm:py-20">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-100 to-sky-50 text-blue-600 shadow-inner sm:h-24 sm:w-24">
              <HiOutlineUserCircle className="text-[48px] sm:text-[60px]" />
            </div>
            <div className="text-[22px] font-bold text-slate-800 sm:text-[28px]">Guest</div>
            <p className="mt-3 break-words text-[14px] font-semibold text-slate-500 sm:text-[16px]">Enter a guest mobile no.</p>
            <p className="mx-auto mt-2 max-w-md break-words text-[14px] font-medium leading-7 text-slate-400 sm:text-[16px]">
              "Past stays, total spend, and booking history will all be visible in one place."
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3 pt-2 sm:flex-row">
          <button
            type="button"
            onClick={() => (isModal ? onClose?.() : navigate("/hotel/all-bookings"))}
            className={`${secondaryBtnCls} w-full sm:w-auto`}
          >
            <HiOutlineArrowLeft className="text-xl" />
            Back to All Bookings
          </button>
        </div>
      </div>
    </div>
  );
};

export default GuestProfile;