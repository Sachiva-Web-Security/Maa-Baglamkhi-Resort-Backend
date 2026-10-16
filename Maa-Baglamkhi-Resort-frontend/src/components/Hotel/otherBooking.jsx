import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Select } from "antd";
import { GetCity, GetCountries, GetState } from "react-country-state-city";

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
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-xl font-semibold text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none transition placeholder:text-lg placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100";

const labelCls = "mb-2 block text-2xl font-bold text-slate-900";

const panelCls =
  "rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.06)] sm:p-7";

const sectionCls =
  "rounded-[26px] text-4xl border border-slate-200/80 bg-slate-50/70 p-5 sm:p-6";

const selectCls =
  "w-full h-[68px] font-bold text-4xl [&_.ant-select-selector]:!h-[68px] [&_.ant-select-selector]:!rounded-full [&_.ant-select-selector]:!border-slate-200 [&_.ant-select-selector]:!bg-white [&_.ant-select-selector]:!px-4 [&_.ant-select-selector]:!shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] [&_.ant-select-selector]:hover:!border-sky-400 [&_.ant-select-selection-placeholder]:!text-xl [&_.ant-select-selection-placeholder]:!font-semibold [&_.ant-select-selection-placeholder]:!text-slate-500 [&_.ant-select-selection-item]:!text-xl [&_.ant-select-selection-item]:!font-semibold [&_.ant-select-selection-item]:!text-black-900";

const OtherBooking = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const bookingId = location.state?.bookingId || getStoredBookingId();
  const bookingCode = getStoredBookingCode();

  const [formData, setFormData] = useState(
    getBookingDraft("otherBooking") || {
      bookingType: "",
      bookingSource: "",
      bookingReference: "",
      address: "",
      country: "",
      state: "",
      city: "",
      pincode: "",
    },
  );
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [locationRestoreError, setLocationRestoreError] = useState("");

  useEffect(() => {
    const loadCountries = async () => {
      const countriesData = await GetCountries();
      setCountries(
        countriesData.map((country) => ({
          label: country.name,
          value: country.id,
        })),
      );
    };

    loadCountries();
  }, []);

  useEffect(() => {
    if (bookingId) {
      setStoredBookingId(bookingId);
    }
  }, [bookingId]);

  useEffect(() => {
    let cancelled = false;

    const restoreCascade = async () => {
      if (!formData.country || !countries.length) return;

      const countryOption = countries.find(
        (country) => country.label === formData.country,
      );
      if (!countryOption) return;

      let nextStates = states;
      if (!states.length) {
        try {
          const statesData = await GetState(countryOption.value);
          if (cancelled) return;

          nextStates = statesData.map((state) => ({
            label: state.name,
            value: state.id,
            countryId: countryOption.value,
          }));
          setStates(nextStates);
          setLocationRestoreError("");
        } catch (error) {
          if (cancelled) return;
          console.error("Failed to restore states for saved country:", error);
          setStates([]);
          setCities([]);
          setLocationRestoreError("Saved location details could not be fully restored.");
          return;
        }
      }

      if (!formData.state) return;

      const stateOption = nextStates.find((state) => state.label === formData.state);
      if (!stateOption || cities.length) return;

      try {
        const citiesData = await GetCity(stateOption.countryId, stateOption.value);
        if (cancelled) return;

        setCities(
          citiesData.map((city) => ({
            label: city.name,
            value: city.name,
          })),
        );
        setLocationRestoreError("");
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to restore cities for saved state:", error);
        setCities([]);
        setLocationRestoreError("Saved location details could not be fully restored.");
      }
    };

    restoreCascade();

    return () => {
      cancelled = true;
    };
  }, [cities.length, countries, formData.country, formData.state, states]);

  const updateForm = (patch) => {
    const next = { ...formData, ...patch };
    setFormData(next);
    setBookingDraft("otherBooking", next);
  };

  const onCountrySelect = async (countryId, option) => {
    const statesData = await GetState(countryId);
    updateForm({ country: option.label, state: "", city: "" });
    setStates(
      statesData.map((state) => ({
        label: state.name,
        value: state.id,
        countryId,
      })),
    );
    setCities([]);
  };

  const onStateSelect = async (stateId, option) => {
    const citiesData = await GetCity(option.countryId, stateId);
    updateForm({ state: option.label, city: "" });
    setCities(
      citiesData.map((city) => ({
        label: city.name,
        value: city.name,
      })),
    );
  };

  const handleSubmit = async () => {
    try {
      await API.post(`/hotel/other-booking/${bookingId}`, formData);
      setBookingDraft("otherBooking", formData);
      navigate("/hotel/reference", { state: { bookingId, bookingCode } });
    } catch (err) {
      console.error(err);
      alert("Error saving other booking");
    }
  };

  return (
    <div
      className="min-h-screen w-full bg-[radial-gradient(circle_at_top,_rgba(219,234,254,0.55),_rgba(255,255,255,0.96)_36%,_rgba(248,250,252,1)_100%)] p-4 sm:p-6"
      style={{ fontFamily: '"Segoe UI", "Helvetica Neue", Arial, sans-serif' }}
    >
      <div className="mx-auto w-full max-w-9xl rounded-[36px] border border-white/70 bg-[linear-gradient(180deg,#fafdff_0%,#ffffff_40%,#fffdf8_100%)] p-4 shadow-[0_30px_80px_rgba(148,163,184,0.18)] sm:p-6">
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className={panelCls}>
            <div className="space-y-6">
              <div className={sectionCls}>
                <div className="mb-5 text-2xl font-[700] tracking-[-0.02em] text-slate-900">
                  Booking Source Details
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label className={labelCls}>Booking Type</label>
                    <select
                      value={formData.bookingType}
                      onChange={(e) => updateForm({ bookingType: e.target.value })}
                      className={fieldCls}
                    >
                      <option value="">Select</option>
                      <option value="Solo">Solo</option>
                      <option value="Family/Couple">Family/Couple</option>
                      <option value="FIT">FIT</option>
                      <option value="Group">Group</option>
                      <option value="Corporate">Corporate</option>
                    </select>
                  </div>

                  <div>
                    <label className={labelCls}>Booking Source</label>
                    <select
                      value={formData.bookingSource}
                      onChange={(e) => updateForm({ bookingSource: e.target.value })}
                      className={fieldCls}
                    >
                      <option value="">Select</option>
                      <option value="Front Office">Front Office</option>
                      <option value="Walk in">Walk in</option>
                      <option value="Office">Office</option>
                      <option value="Go ibibo">Go ibibo</option>
                      <option value="Makemytrip">Makemytrip</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className={labelCls}>Booking Reference</label>
                    <input
                      type="text"
                      value={formData.bookingReference}
                      onChange={(e) => updateForm({ bookingReference: e.target.value })}
                      placeholder="Enter booking reference"
                      className={fieldCls}
                    />
                  </div>
                </div>
              </div>

              <div className={sectionCls}>
                <div className="mb-5 text-2xl font-[700] tracking-[-0.02em] text-slate-900">
                  Address Details
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className={labelCls}>Address</label>
                    <textarea
                      rows={4}
                      value={formData.address}
                      onChange={(e) => updateForm({ address: e.target.value })}
                      placeholder="Enter full address"
                      className={`${fieldCls} min-h-[116px] resize-none`}
                    />
                  </div>

                  <div>
                    <label className={labelCls}>Country</label>
                    <Select
                      options={countries}
                      value={countries.find((country) => country.label === formData.country)?.value}
                      showSearch
                      onChange={onCountrySelect}
                      placeholder="Select country"
                      className={selectCls}
                      filterOption={(input, option) =>
                        (option?.label ?? "").toString().toLowerCase().includes(input.toLowerCase())
                      }
                    />
                  </div>

                  <div>
                    <label className={labelCls}>State</label>
                    <Select
                      options={states}
                      value={states.find((state) => state.label === formData.state)?.value}
                      showSearch
                      onChange={onStateSelect}
                      placeholder="Select state"
                      className={selectCls}
                      filterOption={(input, option) =>
                        (option?.label ?? "").toString().toLowerCase().includes(input.toLowerCase())
                      }
                    />
                  </div>

                  <div>
                    <label className={labelCls}>City</label>
                    <Select
                      showSearch
                      options={cities}
                      value={formData.city || undefined}
                      onChange={(value) => updateForm({ city: value })}
                      placeholder="Select city"
                      className={selectCls}
                      filterOption={(input, option) =>
                        (option?.label ?? "").toString().toLowerCase().includes(input.toLowerCase())
                      }
                    />
                  </div>

                  <div>
                    <label className={labelCls}>PIN Code</label>
                    <input
                      type="text"
                      value={formData.pincode}
                      onChange={(e) => updateForm({ pincode: e.target.value })}
                      placeholder="Enter pin code"
                      className={fieldCls}
                    />
                  </div>

                  {locationRestoreError ? (
                    <div
                      role="alert"
                      aria-live="assertive"
                      className="md:col-span-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800"
                    >
                      {locationRestoreError}
                    </div>
                  ) : null}

                  <div className="md:col-span-2">
                    <div className="flex w-full flex-col items-end justify-end gap-3 pt-2 text-right sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                      <button
                        onClick={handleSubmit}
                        className="inline-flex min-w-[170px] items-center justify-center rounded-[22px] bg-[linear-gradient(180deg,#39a6eb_0%,#2a8fd4_100%)] px-6 py-4 text-sm font-bold text-white shadow-[0_16px_35px_rgba(14,165,233,0.24)] transition hover:brightness-105"
                      >
                        Save & Next
                      </button>

                      <button
                        onClick={() => navigate("/hotel/guest", { state: { resetBookingDraft: true } })}
                        className="inline-flex min-w-[170px] items-center justify-center rounded-[22px] border border-slate-200 bg-white px-6 py-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                      >
                        Go Back
                      </button>

                      <BookingCancelAction
                        bookingId={bookingId}
                        bookingCode={bookingCode}
                        buttonClassName="min-w-[170px] !px-6 !py-4 !text-sm !font-bold"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className={panelCls}>
              <div className="text-[15px] font-semibold uppercase tracking-[0.24em] text-sky-700">
                Quick Summary
              </div>
              <div className="mt-5 space-y-4 text-sm text-slate-600">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-[15px] font-bold uppercase tracking-[0.18em] text-slate-500">
                    Booking ID
                  </div>
                  <div className="mt-2 text-lg font-bold text-slate-900">
                    {bookingCode || bookingId || "Pending"}
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-[15px] font-bold uppercase tracking-[0.18em] text-slate-500">
                    Source
                  </div>
                  <div className="mt-2 text-lg font-bold text-slate-900">
                    {formData.bookingSource || "Not selected"}
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-[15px] font-bold uppercase tracking-[0.18em] text-slate-500">
                    Type
                  </div>
                  <div className="mt-2 text-lg font-bold text-slate-900">
                    {formData.bookingType || "Not selected"}
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-[15px] font-bold uppercase tracking-[0.18em] text-slate-500">
                    Location
                  </div>
                  <div className="mt-2 text-lg font-bold text-slate-900">
                    {[formData.city, formData.state, formData.country].filter(Boolean).join(", ") ||
                      "Pending"}
                  </div>
                  <div className="mt-2 text-[15px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {formData.pincode ? `PIN Code ${formData.pincode}` : "PIN Code Pending"}
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

export default OtherBooking;
