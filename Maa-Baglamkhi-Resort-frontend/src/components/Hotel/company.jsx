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
  "w-full rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100";

const labelCls =
  "mb-2 block text-base font-bold uppercase tracking-[0.18em] text-slate-700";

const infoCardCls =
  "rounded-2xl border border-slate-200/80 bg-slate-50 p-4";

const Company = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const bookingId = location.state?.bookingId || getStoredBookingId();
  const bookingCode = location.state?.bookingCode || getStoredBookingCode();
  const bookingRef = bookingCode || bookingId;
  const guestDraft = getBookingDraft("guest") || {};
  const otherBookingDraft = getBookingDraft("otherBooking") || {};
  const referenceDraft = getBookingDraft("reference") || {};

  const [formData, setFormData] = useState(
    getBookingDraft("company") || {
      companyName: "Direct Booking",
      gst: "",
    },
  );
  const [companies, setCompanies] = useState(["Direct Booking", "Tata", "Infosys", "Reliance"]);
  const [selectedCompany, setSelectedCompany] = useState(
    getBookingDraft("company")?.companyName || "Direct Booking",
  );
  const [showInput, setShowInput] = useState(false);
  const [newCompany, setNewCompany] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (bookingId) {
      setStoredBookingId(bookingId);
    }
  }, [bookingId]);

  const locationSummary = useMemo(
    () =>
      [otherBookingDraft.city, otherBookingDraft.state, otherBookingDraft.country]
        .filter(Boolean)
        .join(", "),
    [otherBookingDraft.city, otherBookingDraft.country, otherBookingDraft.state],
  );

  const syncCompany = (companyName) => {
    const next = { ...formData, companyName };
    setFormData(next);
    setBookingDraft("company", next);
  };

  const handleAddCompany = () => {
    const trimmed = newCompany.trim();
    if (!trimmed) return;
    setCompanies((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
    setSelectedCompany(trimmed);
    syncCompany(trimmed);
    setNewCompany("");
    setShowInput(false);
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (!bookingId) {
      alert("Booking ID is missing. Please start a new booking.");
      return;
    }



    try {
      setIsSubmitting(true);
      const companyName =
        (formData.companyName || selectedCompany || "Direct Booking").trim() || "Direct Booking";
      const payload = {
        companyName,
        gst: formData.gst,
      };

      const next = { ...formData, companyName };
      setFormData(next);
      setBookingDraft("company", next);

      await API.post(`/hotel/company/${bookingId}`, payload);

      navigate("/hotel/room", { state: { bookingId, bookingCode } });
    } catch (err) {
      console.error("FRONTEND ERROR:", err.response?.data || err);
      alert("Error saving company");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    const next = {
      ...formData,
      companyName: formData.companyName || selectedCompany || "Direct Booking",
    };

    setFormData(next);
    setBookingDraft("company", next);
    navigate("/hotel/room", { state: { bookingId, bookingCode } });
  };

  return (
    <div className="min-h-screen w-full bg-[linear-gradient(135deg,#f4fbff_0%,#fbfff8_42%,#fffaf1_100%)] p-4 sm:p-6">
      <div className="w-full space-y-6">
        <section className="grid gap-6 xl:grid-cols-[minmax(0,3.15fr)_minmax(300px,0.85fr)]">
          <div className="rounded-[26px] border border-slate-200/80 bg-white/90 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
            <div className="grid gap-6">
              <div className="rounded-[24px] border border-slate-200/80 bg-white p-5">
                <div className="mb-4 text-3xl font-black tracking-[-0.03em] text-slate-900">Company Information</div>
                <div className="mb-4 rounded-2xl bg-slate-50 px-4 py-3 text-lg font-semibold text-slate-600">
                  Booking Ref:{" "}
                  <span className="text-xl font-black text-slate-900">{bookingRef || "Pending"}</span>
                </div>
                <div className="grid gap-4">
                  <div>
                    <label className={labelCls}>Company Name</label>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <select
                        value={selectedCompany}
                        onChange={(e) => {
                          setSelectedCompany(e.target.value);
                          syncCompany(e.target.value);
                        }}
                        className={fieldCls}
                      >
                        <option value="">Select</option>
                        {companies.map((company, index) => (
                          <option key={`${company}-${index}`} value={company}>
                            {company}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => setShowInput(true)}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base font-bold text-sky-700 transition hover:bg-slate-100"
                      >
                        Add New
                      </button>
                    </div>
                  </div>

                  {showInput ? (
                    <div className="rounded-[20px] bg-slate-50 p-4">
                      <label className={labelCls}>New Company</label>
                      <div className="flex gap-3">
                        <input
                          type="text"
                          value={newCompany}
                          onChange={(e) => setNewCompany(e.target.value)}
                          placeholder="Enter company name"
                          className={fieldCls}
                        />
                        <button
                          onClick={handleAddCompany}
                          className="rounded-2xl bg-emerald-500 px-4 py-3 text-base font-bold text-white"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div>
                    <label className={labelCls}>GSTIN</label>
                    <input
                      type="text"
                      value={formData.gst}
                      onChange={(e) => {
                        const next = { ...formData, gst: e.target.value };
                        setFormData(next);
                        setBookingDraft("company", next);
                      }}
                      placeholder="Enter GSTIN"
                      className={fieldCls}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200/80 bg-white p-5">
                <div className="mb-4 text-xl font-bold text-slate-900">Booking Overview</div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className={infoCardCls}>
                    <div className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
                      Booking ID
                    </div>
                    <div className="mt-2 text-xl font-black text-slate-900">
                      {bookingRef || "Pending"}
                    </div>
                  </div>

                  <div className={infoCardCls}>
                    <div className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
                      Source
                    </div>
                    <div className="mt-2 text-xl font-black text-slate-900">
                      {otherBookingDraft.bookingSource || "Not selected"}
                    </div>
                  </div>

                  <div className={infoCardCls}>
                    <div className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
                      Guest Name
                    </div>
                    <div className="mt-2 text-xl font-black text-slate-900">
                      {guestDraft.guestName || "Not entered"}
                    </div>
                  </div>

                  <div className={infoCardCls}>
                    <div className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
                      Guest Type
                    </div>
                    <div className="mt-2 text-xl font-black text-slate-900">
                      {referenceDraft.guestType || "Not selected"}
                    </div>
                  </div>

                  <div className={infoCardCls}>
                    <div className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
                      Booking Type
                    </div>
                    <div className="mt-2 text-xl font-black text-slate-900">
                      {otherBookingDraft.bookingType || "Not selected"}
                    </div>
                  </div>

                  <div className={infoCardCls}>
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

                  <div className="md:col-span-2 rounded-2xl border border-slate-200/80 bg-slate-50 p-4">
                    <div className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
                      Notes
                    </div>
                    <div className="mt-2 text-base font-semibold leading-7 text-slate-700">
                      {referenceDraft.guestNotes || "No guest notes added yet."}
                    </div>
                    <div className="mt-3 border-t border-slate-200 pt-3 text-base font-medium leading-7 text-slate-600">
                      {referenceDraft.internalNotes || "No internal notes added yet."}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-amber-100/80 bg-[linear-gradient(180deg,#fffaf0_0%,#fff7ea_100%)] p-5 shadow-[0_18px_45px_rgba(245,158,11,0.08)]">
                <div className="text-3xl font-black tracking-[-0.03em] text-slate-900">
                  Go to Room Selection
                </div>
                <p className="mt-3 text-base leading-7 text-slate-600">
                  After saving the company data, open the room inventory section.
                </p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="inline-flex w-full items-center justify-center rounded-[22px] bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-4 text-lg font-extrabold text-white shadow-[0_16px_35px_rgba(245,158,11,0.24)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto sm:min-w-[170px]"
                  >
                    {isSubmitting ? "Saving..." : "Save & Next"}
                  </button>
                  <button
                    onClick={handleSkip}
                    disabled={isSubmitting}
                    className="inline-flex w-full items-center justify-center rounded-[22px] border border-dashed border-slate-300 bg-white px-5 py-4 text-base font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto sm:min-w-[170px]"
                  >
                    Skip
                  </button>
                  <button
                    onClick={() => navigate("/hotel/reference", { state: { bookingId, bookingCode } })}
                     disabled={isSubmitting}
                    className="inline-flex w-full items-center justify-center rounded-[22px] border border-slate-200 bg-white px-5 py-4 text-base font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto sm:min-w-[170px]"
                   >
                    Go Back
                  </button>
                  <BookingCancelAction
                    bookingId={bookingId}
                    bookingCode={bookingCode}
                    buttonClassName="w-full !rounded-[22px] !py-4 !text-base !font-bold sm:w-auto sm:min-w-[170px]"
                    fullWidth
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 xl:flex xl:flex-col xl:items-start">
            <div className="w-full rounded-[24px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
              <div className="text-sm font-black uppercase tracking-[0.22em] text-amber-700">
                Snapshot
              </div>
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-sm font-bold uppercase tracking-wide text-slate-500">
                    Selected Company
                  </div>
                  <div className="mt-1 text-lg font-black text-slate-900">
                    {formData.companyName || "Direct Booking"}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-sm font-bold uppercase tracking-wide text-slate-500">GSTIN</div>
                  <div className="mt-1 text-lg font-black text-slate-900">{formData.gst || "Not added"}</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Company;
