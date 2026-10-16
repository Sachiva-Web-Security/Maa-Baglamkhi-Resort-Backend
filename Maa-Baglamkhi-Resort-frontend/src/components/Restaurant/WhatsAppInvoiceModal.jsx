import React, { useEffect, useState } from "react";
import { FaTimes, FaWhatsapp } from "react-icons/fa";
import { FiCheckCircle, FiAlertCircle, FiInfo, FiPhone, FiUser } from "react-icons/fi";
import { restaurantService } from "../../services/restaurantService";

const STATUS = {
  IDLE: "idle",
  SENDING: "sending",
  SUCCESS: "success",
  FAILED: "failed",
  INVALID_PHONE: "invalid_phone",
  UNAVAILABLE: "unavailable",
};

const STATUS_LABELS = {
  [STATUS.IDLE]: "Ready",
  [STATUS.SENDING]: "Sending...",
  [STATUS.SUCCESS]: "Invoice sent successfully",
  [STATUS.FAILED]: "Failed to send invoice",
  [STATUS.INVALID_PHONE]: "Invalid phone number",
  [STATUS.UNAVAILABLE]: "WhatsApp service unavailable",
};

const COUNTRY_CODES = [
  { code: "+91", label: "India (+91)", iso: "IN" },
  { code: "+1", label: "USA / Canada (+1)", iso: "US" },
  { code: "+44", label: "United Kingdom (+44)", iso: "GB" },
  { code: "+61", label: "Australia (+61)", iso: "AU" },
  { code: "+971", label: "UAE (+971)", iso: "AE" },
  { code: "+966", label: "Saudi Arabia (+966)", iso: "SA" },
  { code: "+65", label: "Singapore (+65)", iso: "SG" },
  { code: "+60", label: "Malaysia (+60)", iso: "MY" },
];

const stripCountryCode = (rawPhone, defaultCountry = "+91") => {
  if (!rawPhone) return { country: defaultCountry, local: "" };
  const trimmed = String(rawPhone).trim();
  const matched = COUNTRY_CODES.find((c) => trimmed.startsWith(c.code));
  if (matched) {
    return { country: matched.code, local: trimmed.slice(matched.code.length).replace(/\D/g, "") };
  }
  return { country: defaultCountry, local: trimmed.replace(/\D/g, "") };
};

const validateLocalNumber = (local, countryCode) => {
  const digits = String(local || "").replace(/\D/g, "");
  if (!digits) return "Phone number required.";
  if (countryCode === "+91") {
    if (digits.length !== 10) return "Indian number must be exactly 10 digits.";
    if (!/^[6-9]/.test(digits)) return "Indian mobile must start with 6/7/8/9.";
  } else if (digits.length < 6 || digits.length > 15) {
    return "Phone number must be 6–15 digits.";
  }
  return null;
};

const buildFullNumber = (countryCode, local) => {
  const digits = String(local || "").replace(/\D/g, "");
  return digits ? `${countryCode}${digits}` : "";
};

const WhatsAppInvoiceModal = ({ invoice, generatedBill, onClose, onSuccess }) => {
  const initialName = invoice?.customerName || "";
  const initialPhone = stripCountryCode(invoice?.phone || "");

  const [customerName, setCustomerName] = useState(initialName);
  const [countryCode, setCountryCode] = useState(initialPhone.country);
  const [phoneLocal, setPhoneLocal] = useState(initialPhone.local);
  const [phoneError, setPhoneError] = useState("");
  const [status, setStatus] = useState(STATUS.IDLE);
  const [statusMessage, setStatusMessage] = useState("");
  const [responseData, setResponseData] = useState(null);

  // Re-sync when invoice prop changes (e.g. user opens modal for a different bill)
  useEffect(() => {
    const parsed = stripCountryCode(invoice?.phone || "");
    setCustomerName(invoice?.customerName || "");
    setCountryCode(parsed.country);
    setPhoneLocal(parsed.local);
    setStatus(STATUS.IDLE);
    setStatusMessage("");
    setResponseData(null);
  }, [invoice]);

  // Validate on phone change
  useEffect(() => {
    const err = validateLocalNumber(phoneLocal, countryCode);
    setPhoneError(err || "");
  }, [phoneLocal, countryCode]);

  const isSending = status === STATUS.SENDING;
  const isDone = status === STATUS.SUCCESS || status === STATUS.FAILED;
  const billId = generatedBill?.id || invoice?.billId || null;
  const hasBillId = Boolean(billId);

  const handleSend = async () => {
    if (!hasBillId) {
      setStatus(STATUS.UNAVAILABLE);
      setStatusMessage("Bill has not been generated yet. Please save the bill first.");
      return;
    }
    if (!customerName.trim()) {
      setPhoneError("");
      setStatus(STATUS.INVALID_PHONE);
      setStatusMessage("Customer name is required.");
      return;
    }
    if (phoneError) {
      setStatus(STATUS.INVALID_PHONE);
      setStatusMessage(phoneError);
      return;
    }
    setStatus(STATUS.SENDING);
    setStatusMessage("");
    setResponseData(null);

    try {
      const fullNumber = buildFullNumber(countryCode, phoneLocal);
      const result = await restaurantService.sendRestaurantInvoiceWhatsApp(billId, {
        customerNumber: fullNumber,
        customerName: customerName.trim(),
      });
      const customerWa = result?.customer?.whatsapp;
      const adminWa = result?.admin?.whatsapp;

      if (customerWa?.ok || adminWa?.ok) {
        const modeHint =
          result?.sendMode === "text-only"
            ? " Sent as text (PDF attachment could not be delivered)."
            : "";
        setStatus(STATUS.SUCCESS);
        setStatusMessage((result?.message || "Invoice sent successfully.") + modeHint);
        setResponseData(result);
        if (typeof onSuccess === "function") onSuccess(result);
      } else if (customerWa?.error || adminWa?.error) {
        setStatus(STATUS.FAILED);
        setStatusMessage(
          customerWa?.error || adminWa?.error || "WhatsApp gateway returned an error.",
        );
        setResponseData(result);
      } else {
        setStatus(STATUS.FAILED);
        setStatusMessage("Unable to send invoice. Please try again later.");
        setResponseData(result);
      }
    } catch (error) {
      const status = error?.response?.status;
      const message =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        "Failed to send WhatsApp invoice.";
      if (status === 404) {
        setStatus(STATUS.UNAVAILABLE);
        setStatusMessage("Bill not found. It may have been deleted.");
      } else if (status === 500 && /wasachiva|key not configured/i.test(message)) {
        setStatus(STATUS.UNAVAILABLE);
        setStatusMessage("WhatsApp gateway key not configured on server.");
      } else if (/invalid phone/i.test(message)) {
        setStatus(STATUS.INVALID_PHONE);
        setStatusMessage(message);
      } else {
        setStatus(STATUS.FAILED);
        setStatusMessage(message);
      }
    }
  };

  const statusColor =
    {
      [STATUS.IDLE]: "bg-blue-50 border-blue-200 text-blue-700",
      [STATUS.SENDING]: "bg-amber-50 border-amber-200 text-amber-700",
      [STATUS.SUCCESS]: "bg-emerald-50 border-emerald-200 text-emerald-700",
      [STATUS.FAILED]: "bg-rose-50 border-rose-200 text-rose-700",
      [STATUS.INVALID_PHONE]: "bg-rose-50 border-rose-200 text-rose-700",
      [STATUS.UNAVAILABLE]: "bg-slate-100 border-slate-300 text-slate-700",
    }[status] || "bg-slate-100 border-slate-300 text-slate-700";

  const statusIcon =
    {
      [STATUS.SENDING]: <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />,
      [STATUS.SUCCESS]: <FiCheckCircle className="text-emerald-600" />,
      [STATUS.FAILED]: <FiAlertCircle className="text-rose-600" />,
      [STATUS.INVALID_PHONE]: <FiAlertCircle className="text-rose-600" />,
      [STATUS.UNAVAILABLE]: <FiInfo className="text-slate-600" />,
    }[status] || <FiInfo className="text-blue-600" />;

  const inputCls = (hasError) =>
    `h-[50px] w-full rounded-xl border sm:h-[56px] ${
      hasError ? "border-rose-300 bg-rose-50/60 focus:ring-rose-300" : "border-blue-100 bg-white focus:ring-blue-400"
    } px-3.5 text-[15px] text-slate-800 placeholder:text-[14px] placeholder:text-slate-400 shadow-[inset_0_1px_2px_rgba(15,23,42,0.03)] transition focus:outline-none focus:ring-2 focus:border-blue-300 sm:px-4 sm:text-[17px] sm:placeholder:text-[16px]`;

  return (
    <div
      className="fixed inset-0 z-[970] flex items-center justify-center bg-slate-950/70 px-3 py-4 backdrop-blur-sm sm:px-6"
      onClick={onClose}
    >
      <div
        className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-[0_30px_90px_rgba(15,23,42,0.35)] sm:rounded-[28px]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-gradient-to-r from-emerald-600 to-green-500 px-5 py-4 text-white">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20">
              <FaWhatsapp size={20} />
            </span>
            <div className="min-w-0">
              <h3 className="text-base font-black sm:text-lg">Send WhatsApp Invoice</h3>
              <p className="mt-0.5 text-[12px] opacity-90 sm:text-[13px]">
                Table booking · Bill #{billId || "--"}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close modal"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 text-base font-bold text-white transition hover:bg-white/30"
          >
            <FaTimes />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 p-4 sm:p-5">
          {!hasBillId ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[14px] font-semibold text-amber-800">
              Bill has not been generated yet. Please save the bill before sending via WhatsApp.
            </div>
          ) : null}

          {/* Customer name */}
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-slate-500 sm:text-[13px]">
              <FiUser /> Customer Name
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Customer name"
              className={inputCls(false)}
              maxLength={60}
              autoComplete="off"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-slate-500 sm:text-[13px]">
              <FiPhone /> WhatsApp Number
            </label>
            <div className="flex gap-2">
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="h-[50px] w-[120px] rounded-xl border border-blue-100 bg-white px-2 text-[14px] text-slate-800 shadow-[inset_0_1px_2px_rgba(15,23,42,0.03)] focus:outline-none focus:ring-2 focus:ring-blue-400 sm:h-[56px] sm:w-[130px] sm:text-[16px]"
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                value={phoneLocal}
                onChange={(e) => setPhoneLocal(e.target.value.replace(/\D/g, ""))}
                placeholder="Phone number"
                inputMode="numeric"
                maxLength={countryCode === "+91" ? 10 : 15}
                className={inputCls(Boolean(phoneError))}
                autoComplete="off"
              />
            </div>
            {phoneError ? (
              <div className="mt-1.5 text-[12px] font-semibold text-rose-600 sm:text-[13px]">{phoneError}</div>
            ) : (
              <div className="mt-1.5 text-[11px] text-slate-500 sm:text-[12px]">
                Will be sent to: <span className="font-bold text-slate-700">{buildFullNumber(countryCode, phoneLocal) || "--"}</span>
              </div>
            )}
          </div>

          {/* Status banner */}
          {status !== STATUS.IDLE ? (
            <div className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[13px] font-semibold sm:text-[14px] ${statusColor}`}>
              <span className="mt-0.5">{statusIcon}</span>
              <div className="min-w-0 flex-1">
                <div className="font-bold">{STATUS_LABELS[status]}</div>
                {statusMessage ? <div className="mt-0.5 break-words text-[12px] sm:text-[13px]">{statusMessage}</div> : null}
                {responseData?.fileUrl ? (
                  <a
                    href={responseData.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-[12px] font-bold underline"
                  >
                    View invoice PDF
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Buttons */}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="h-[48px] w-full rounded-xl border border-slate-200 bg-white px-5 text-[14px] font-bold text-slate-700 transition hover:bg-slate-50 sm:h-[52px] sm:w-auto sm:text-[15px]"
            >
              {isDone ? "Close" : "Cancel"}
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={isSending || !hasBillId || Boolean(phoneError) || !customerName.trim() || !phoneLocal}
              className="flex h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-green-500 px-5 text-[14px] font-bold text-white shadow-[0_10px_26px_-10px_rgba(16,185,129,0.55)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 sm:h-[52px] sm:w-auto sm:text-[15px]"
            >
              {isSending ? (
                <>
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Sending...
                </>
              ) : (
                <>
                  <FaWhatsapp size={16} />
                  Send WhatsApp Invoice
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppInvoiceModal;