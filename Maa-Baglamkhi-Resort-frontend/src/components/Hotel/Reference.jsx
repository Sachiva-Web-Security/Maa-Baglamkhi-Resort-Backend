import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import API from "../../api";
import BookingCancelAction from "./BookingCancelAction";
import {
  getBookingDraft,
  getStoredBookingCode,
  getStoredBookingId,
  setBookingDraft,
  setStoredBookingId,
} from "./bookingSession";

const fieldCls =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base font-semibold text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100";

const labelCls =
  "mb-2 block text-base font-bold text-slate-900";

const panelCls =
  "rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.06)] sm:p-7";

const sectionCls =
  "rounded-[26px] border border-slate-200/80 bg-slate-50/70 p-5 sm:p-6";

const overviewCardCls =
  "rounded-2xl bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)]";

const Reference = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const bookingId = location.state?.bookingId || getStoredBookingId();
  const bookingCode = location.state?.bookingCode || getStoredBookingCode();
  const bookingRef = bookingCode || bookingId;
  const guestDraft = getBookingDraft("guest") || {};
  const otherBookingDraft = getBookingDraft("otherBooking") || {};

  const [formData, setFormData] = useState(
    getBookingDraft("reference") || {
      guestType: "",
      guestNotes: "",
      internalNotes: "",
    },
  );

  useEffect(() => {
    if (bookingId) {
      setStoredBookingId(bookingId);
    }
  }, [bookingId]);

  const updateForm = (patch) => {
    const next = { ...formData, ...patch };
    setFormData(next);
    setBookingDraft("reference", next);
  };

  const handleSubmit = async () => {
    try {
      await API.post(`/hotel/reference/${bookingId}`, formData);
      setBookingDraft("reference", formData);
      navigate("/hotel/company", { state: { bookingId, bookingCode } });
    } catch (err) {
      console.error(err);
      alert("Error saving reference");
    }
  };

  const locationSummary = useMemo(
    () =>
      [otherBookingDraft.city, otherBookingDraft.state, otherBookingDraft.country]
        .filter(Boolean)
        .join(", "),
    [otherBookingDraft.city, otherBookingDraft.country, otherBookingDraft.state],
  );

  return (
    <div
      className="min-h-screen w-full bg-[radial-gradient(circle_at_top,_rgba(219,234,254,0.55),_rgba(255,255,255,0.96)_36%,_rgba(248,250,252,1)_100%)] p-4 sm:p-6"
      style={{ fontFamily: '"Segoe UI", "Helvetica Neue", Arial, sans-serif' }}
    >
      <div className="mx-auto max-w-[2000px] rounded-[36px] border border-white/70 bg-[linear-gradient(180deg,#fafdff_0%,#ffffff_40%,#fffdf8_100%)] p-4 shadow-[0_30px_80px_rgba(148,163,184,0.18)] sm:p-6">
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className={panelCls}>
            <div className="space-y-6">
              <div className={sectionCls}>
                <div className="mb-5 text-3xl font-black tracking-[-0.03em] text-slate-900">
                  Guest Classification
                </div>
                <div>
                  <label className={labelCls}>Guest Type</label>
                  <select
                    value={formData.guestType}
                    onChange={(e) => updateForm({ guestType: e.target.value })}
                    className={fieldCls}
                  >
                    <option value="">Select</option>
                    <option value="General">General</option>
                    <option value="VIP Guest">VIP Guest</option>
                    <option value="VVIP Guest">VVIP Guest</option>
                    <option value="Scanty Baggage">Scanty Baggage</option>
                  </select>
                </div>
              </div>

              <div className={sectionCls}>
                <div className="mb-5 text-3xl font-black tracking-[-0.03em] text-slate-900">
                  Notes
                </div>
                <div className="grid gap-5">
                  <div>
                    <label className={labelCls}>Guest Notes</label>
                    <textarea
                      rows={5}
                      value={formData.guestNotes}
                      onChange={(e) => updateForm({ guestNotes: e.target.value })}
                      placeholder="Preferences, requests, special arrangements..."
                      className={`${fieldCls} min-h-[136px] resize-none`}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Internal Notes</label>
                    <textarea
                      rows={5}
                      value={formData.internalNotes}
                      onChange={(e) => updateForm({ internalNotes: e.target.value })}
                      placeholder="Internal reminders for front desk or operations..."
                      className={`${fieldCls} min-h-[136px] resize-none`}
                    />
                  </div>
                </div>
              </div>

              <div className={sectionCls}>
                <div className="mb-4 text-3xl font-black tracking-[-0.03em] text-slate-900">
                  Booking Overview
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className={overviewCardCls}>
                    <div className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
                      Booking ID
                    </div>
                    <div className="mt-2 text-xl font-black text-slate-900">
                      {bookingRef || "Pending"}
                    </div>
                  </div>

                  <div className={overviewCardCls}>
                    <div className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
                      Source
                    </div>
                    <div className="mt-2 text-xl font-black text-slate-900">
                      {otherBookingDraft.bookingSource || "Not selected"}
                    </div>
                  </div>

                  <div className={overviewCardCls}>
                    <div className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
                      Guest Name
                    </div>
                    <div className="mt-2 text-xl font-black text-slate-900">
                      {guestDraft.guestName || "Not entered"}
                    </div>
                  </div>

                  <div className={overviewCardCls}>
                    <div className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
                      Guest Type
                    </div>
                    <div className="mt-2 text-xl font-black text-slate-900">
                      {formData.guestType || "Not selected"}
                    </div>
                  </div>

                  <div className={overviewCardCls}>
                    <div className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
                      Booking Type
                    </div>
                    <div className="mt-2 text-xl font-black text-slate-900">
                      {otherBookingDraft.bookingType || "Not selected"}
                    </div>
                  </div>

                  <div className={overviewCardCls}>
                    <div className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
                      Location
                    </div>
                    <div className="mt-2 text-xl font-black text-slate-900">
                      {locationSummary || "Pending"}
                    </div>
                    <div className="mt-2 text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
                      {otherBookingDraft.pincode
                        ? `PIN Code ${otherBookingDraft.pincode}`
                        : "PIN Code Pending"}
                    </div>
                  </div>

                  <div className="md:col-span-2 rounded-2xl bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
                    <div className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
                      Notes
                    </div>
                    <div className="mt-2 text-base font-semibold leading-7 text-slate-700">
                      {formData.guestNotes || "No guest notes added yet."}
                    </div>
                    <div className="mt-3 border-t border-slate-200 pt-3 text-base font-medium leading-7 text-slate-600">
                      {formData.internalNotes || "No internal notes added yet."}
                    </div>
                  </div>
                </div>
              </div>

              <div className="w-full rounded-[28px] border border-violet-100/80 bg-[linear-gradient(180deg,#f8f4ff_0%,#f3eeff_52%,#efe9ff_100%)] p-6 shadow-[0_26px_70px_rgba(109,76,246,0.10)]">
                <div className="text-3xl font-black tracking-[-0.03em] text-slate-900">
                  Move to Company
                </div>
                <p className="mt-4 text-base leading-7 text-slate-600">
                  Save guest classification and notes, then open the company section.
                </p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <button
                    onClick={handleSubmit}
                    className="inline-flex w-full items-center justify-center rounded-[24px] bg-[linear-gradient(90deg,#6e49f6_0%,#6d44f2_55%,#6b46ef_100%)] px-5 py-4 text-lg font-extrabold text-white shadow-[0_20px_40px_rgba(109,76,246,0.22)] transition hover:brightness-105 sm:w-auto sm:min-w-[170px]"
                  >
                    Save & Next
                  </button>
                  <button
                    onClick={() => navigate("/hotel/other-booking", { state: { bookingId, bookingCode } })}
                    className="inline-flex w-full items-center justify-center rounded-[24px] border border-slate-200/90 bg-white px-5 py-4 text-base font-bold text-slate-700 transition hover:bg-slate-50 sm:w-auto sm:min-w-[170px]"
                  >
                    Go Back
                  </button>
                  <BookingCancelAction
                    bookingId={bookingId}
                    bookingCode={bookingCode}
                    buttonClassName="w-full !rounded-[24px] !border-rose-200 !bg-rose-50/80 !py-4 !text-base !font-bold !text-rose-700 hover:!bg-rose-100 sm:w-auto sm:min-w-[170px]"
                    fullWidth
                  />
                </div>
              </div>

            </div>
          </div>

          <div className="space-y-4 xl:flex xl:flex-col xl:items-start">
              <div className="w-full rounded-[24px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
              <div className="text-sm font-bold uppercase tracking-[0.24em] text-violet-700">
                Snapshot
              </div>
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
                    Booking ID
                  </div>
                  <div className="mt-2 text-xl font-black text-slate-900">
                    {bookingRef || "Pending"}
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
                    Source
                  </div>
                  <div className="mt-2 text-xl font-black text-slate-900">
                    {otherBookingDraft.bookingSource || "Not selected"}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </section>
      </div>
    </div>
  );
};

export default Reference;
