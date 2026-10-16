import React, { useEffect, useMemo, useRef, useState } from "react";
import { FaCheckCircle, FaExclamationTriangle, FaTimes } from "react-icons/fa";
import { useLocation, useNavigate } from "react-router-dom";
import API, { getBackendBaseURL } from "../../api";
import BookingCancelAction from "./BookingCancelAction";
import {
  clearBookingSession,
  getBookingDraft,
  getStoredBookingCode,
  getStoredBookingId,
} from "./bookingSession";
import { pushDashboardNotification } from "../Dashboard/dashboardNotifications";

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

const formatDate = (value) => {
  if (!value) return "-";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const sanitizeBookingPoint = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "-";

  const normalized = raw.replace(/\s*\(ID:\s*\d+\)\s*$/i, "").trim();
  return normalized || "-";
};

const sectionEyebrowCls =
  "text-[11px] font-semibold uppercase tracking-[0.28em] xl:text-sm";

const compactActionButtonCls =
  "inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-bold transition xl:px-5 xl:text-lg";

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

const Communication = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const printRef = useRef(null);
  const documentInputRef = useRef(null);
  const guestDraft = getBookingDraft("guest") || {};
  const advanceDraft = getBookingDraft("advance") || {};
  const tariffDraft = getBookingDraft("roomTariff") || {};
  const paxDraft = getBookingDraft("pax") || {};
  const [liveBooking, setLiveBooking] = useState(null);
  const [guestDocuments, setGuestDocuments] = useState([]);
  const [documentLoading, setDocumentLoading] = useState(false);
  const [documentSubmitting, setDocumentSubmitting] = useState(false);
  const [documentForm, setDocumentForm] = useState({
    documentType: "checkin_form",
    termsAccepted: true,
    notes: "",
    file: null,
  });
  const [quickActionBookings, setQuickActionBookings] = useState([]);
  const [quickActionLoading, setQuickActionLoading] = useState(false);
  const [feedbackModal, setFeedbackModal] = useState({
    open: false,
    type: "success",
    title: "",
    message: "",
    actionLabel: "Close",
    redirectPath: "",
  });

  const bookingAction = String(
    new URLSearchParams(location.search).get("mode") || location.state?.bookingAction || "",
  ).toLowerCase();
  const hasQuickActionMode = Boolean(bookingAction);
  const bookingId = location.state?.bookingId || (hasQuickActionMode ? "" : getStoredBookingId());
  const bookingCode = location.state?.bookingCode || (hasQuickActionMode ? "" : getStoredBookingCode());
  const bookingRef = liveBooking?.bookingCode || bookingCode || bookingId;
  const totalAmount = Number(
    liveBooking?.totalAmount || location.state?.totalAmount || advanceDraft.totalAmount || 0,
  );
  const paidAmount = Number(
    liveBooking?.paidAmount || location.state?.paidAmount || advanceDraft.paidAmount || 0,
  );
  const discountAmount = Number(
    liveBooking?.discountAmount || location.state?.discountAmount || advanceDraft.discountAmount || 0,
  );
  const remainingAmount = Number(
    liveBooking?.remainingAmount ||
      location.state?.remainingAmount ||
      advanceDraft.remainingAmount ||
      Math.max(totalAmount - paidAmount - discountAmount, 0),
  );

  useEffect(() => {
    if (!bookingId) return;

    let ignore = false;

    const loadBooking = async () => {
      try {
        const response = await API.get(`/hotel/full-booking/${bookingId}`);
        if (!ignore) {
          setLiveBooking(response.data || null);
        }
      } catch (error) {
        console.error("Failed to load booking invoice data:", error);
      }
    };

    loadBooking();

    return () => {
      ignore = true;
    };
  }, [bookingId]);

  useEffect(() => {
    if (!bookingId) return;

    let ignore = false;

    const loadDocuments = async () => {
      try {
        setDocumentLoading(true);
        const response = await API.get(`/hotel/guest-documents/${bookingId}`);
        if (!ignore) {
          setGuestDocuments(Array.isArray(response.data) ? response.data : []);
        }
      } catch (error) {
        console.error("Failed to load guest documents:", error);
      } finally {
        if (!ignore) {
          setDocumentLoading(false);
        }
      }
    };

    loadDocuments();

    return () => {
      ignore = true;
    };
  }, [bookingId]);

  useEffect(() => {
    if (bookingId || !bookingAction) return;

    let ignore = false;

    const loadQuickActionBookings = async () => {
      try {
        setQuickActionLoading(true);
        const response = await API.get("/hotel/all-bookings");
        const rows = Array.isArray(response.data) ? response.data : [];

        const filteredRows = rows
          .filter((booking) => {
            const status = String(booking.booking_status || "").toLowerCase();

            if (bookingAction === "check-in") {
              return (
                !status.includes("checked in") &&
                !status.includes("checked out") &&
                !status.includes("cancel")
              );
            }

            if (bookingAction === "check-out") {
              return status.includes("checked in");
            }

            return true;
          })
          .sort((left, right) => {
            const leftDate = new Date(left.check_in || left.createdAt || 0).getTime();
            const rightDate = new Date(right.check_in || right.createdAt || 0).getTime();
            return leftDate - rightDate;
          });

        if (!ignore) {
          setQuickActionBookings(filteredRows);
        }
      } catch (error) {
        console.error("Failed to load quick action bookings:", error);
      } finally {
        if (!ignore) {
          setQuickActionLoading(false);
        }
      }
    };

    loadQuickActionBookings();

    return () => {
      ignore = true;
    };
  }, [bookingAction, bookingId]);

  useEffect(() => {
    if (!feedbackModal.open) return undefined;

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setFeedbackModal((current) => ({ ...current, open: false }));
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [feedbackModal.open]);

  const quickActionMeta = useMemo(() => {
    if (bookingAction === "check-in") {
      return {
        title: "Check-in booking data",
        buttonLabel: "Open Check In",
        emptyLabel: "There are currently no active bookings ready for check-in.",
      };
    }

    if (bookingAction === "check-out") {
      return {
        title: "Check-out booking data",
        buttonLabel: "Open Check Out",
        emptyLabel: "There are currently no checked-in guests available for check-out.",
      };
    }

    return null;
  }, [bookingAction]);

  const rooms = useMemo(() => {
    if (Array.isArray(liveBooking?.rooms) && liveBooking.rooms.length) {
      return liveBooking.rooms.map((room) => ({
        roomNo: room.room_number,
        roomType: room.room_type || "Booked Room",
        quantity: room.quantity,
        price: Number(room.tariff || 0),
        gst: Number(room.gst || 0),
        total: Number(room.total || 0),
      }));
    }

    const stateRooms = location.state?.rooms;

    if (Array.isArray(stateRooms) && stateRooms.length) {
      return stateRooms;
    }

    if (Array.isArray(tariffDraft.rows) && tariffDraft.rows.length) {
      return tariffDraft.rows;
    }

    return paxDraft.rooms || [];
  }, [liveBooking?.rooms, location.state?.rooms, paxDraft.rooms, tariffDraft.rows]);
  const guestName = liveBooking?.guest_name || guestDraft.guestName || "Walk-in Guest";
  const guestEmail = liveBooking?.guest_email || guestDraft.guestEmail || "-";
  const guestMobile = liveBooking?.mobile || guestDraft.mobile || "-";
  const checkIn = liveBooking?.check_in || guestDraft.checkIn || "-";
  const checkOut = liveBooking?.check_out || guestDraft.checkOut || "-";
  const paymentMode = liveBooking?.payment_mode || advanceDraft.paymentMode || "-";
  const remarks = liveBooking?.remarks || advanceDraft.notes || "-";
  const bookingPoint = sanitizeBookingPoint(
    liveBooking?.booking_point || guestDraft.bookingPoint || "",
  );
  const bookingStatus = liveBooking?.booking_status || guestDraft.bookingStatus || "Pending";
  const arrivalTime = liveBooking?.arrival || guestDraft.arrival || "-";
  const departureTime = liveBooking?.departure || guestDraft.departure || "-";
  const roomNumbers = rooms
    .map((room) => room.roomNo || room.name || "-")
    .filter(Boolean)
    .join(", ");

  const totalGuests = Object.values(paxDraft.paxData || {}).reduce(
    (sum, row) => sum + Number(row.adults || 0) + Number(row.children || 0),
    0,
  );

  const openFeedbackModal = (type, title, message, options = {}) => {
    setFeedbackModal({
      open: true,
      type,
      title,
      message,
      actionLabel: options.actionLabel || "Close",
      redirectPath: options.redirectPath || "",
    });
  };

  const closeFeedbackModal = () => {
    const redirectPath = feedbackModal.redirectPath;
    setFeedbackModal((current) => ({ ...current, open: false, redirectPath: "" }));

    if (redirectPath) {
      navigate(redirectPath);
    }
  };

  if (!bookingId && quickActionMeta) {
    return (
      <div className="min-h-screen w-full bg-[linear-gradient(135deg,#f8fbff_0%,#f8fffc_45%,#fff9f2_100%)] p-4 sm:p-6">
        <div className="w-full">
          <section className="rounded-[28px] border border-slate-200/70 bg-white/90 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-700">
                  Guest Records
                </p>
                <h2 className="mt-2 text-2xl font-black text-slate-900">
                  {quickActionMeta.title}
                </h2>
              </div>
              <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                {quickActionBookings.length} records
              </div>
            </div>

            {quickActionLoading ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-slate-500">
                Loading booking data...
              </div>
            ) : quickActionBookings.length ? (
              <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1380px] text-left">
                    <thead className="bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)]">
                      <tr className="text-xs font-bold uppercase tracking-[0.24em] text-slate-600 xl:text-sm">
                        <th className="px-6 py-5">Booking</th>
                        <th className="px-6 py-5">Guest</th>
                        <th className="px-6 py-5">Contact</th>
                        <th className="px-6 py-5">Stay Dates</th>
                        <th className="px-6 py-5">Room Details</th>
                        <th className="px-6 py-5">Total</th>
                        <th className="px-6 py-5">Balance</th>
                        <th className="px-6 py-5">Status</th>
                        <th className="px-6 py-5">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quickActionBookings.map((booking) => (
                        <tr
                          key={booking.bookingId}
                          className="border-t border-slate-200 align-top text-base text-slate-800 transition hover:bg-slate-50/70 xl:text-lg"
                        >
                          <td className="px-6 py-6">
                            <div className="space-y-2">
                              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 xl:text-sm">
                                Booking Ref
                              </div>
                              <div className="text-lg font-black text-slate-900 xl:text-2xl">
                                #{booking.bookingCode || booking.bookingId}
                              </div>
                              <div className="text-sm text-slate-600 xl:text-base">
                                {booking.company_name || "Direct booking"}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-6">
                            <div className="text-lg font-black text-slate-900 xl:text-2xl">
                              {booking.guest_name || "Walk-in Guest"}
                            </div>
                          </td>
                          <td className="px-6 py-6">
                            <div className="space-y-2">
                              <div className="font-semibold text-slate-900 xl:text-xl">{booking.mobile || "-"}</div>
                              <div className="max-w-[260px] break-words text-sm text-slate-600 xl:text-base">
                                {booking.guest_email || "-"}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-6">
                            <div className="space-y-1">
                              <div className="font-semibold text-slate-900 xl:text-xl">{formatDate(booking.check_in)}</div>
                              <div className="text-xs uppercase tracking-[0.18em] text-slate-500 xl:text-sm">to</div>
                              <div className="font-semibold text-slate-900 xl:text-xl">{formatDate(booking.check_out)}</div>
                            </div>
                          </td>
                          <td className="px-6 py-6">
                            <div className="max-w-[320px] whitespace-pre-line font-semibold leading-7 text-slate-900 xl:text-xl">
                              {String(booking.roomDetails || booking.rooms || "-").split(" || ").join("\n")}
                            </div>
                          </td>
                          <td className="px-6 py-6 text-lg font-black text-slate-900 xl:text-2xl">
                            {formatCurrency(booking.totalAmount)}
                          </td>
                          <td className="px-6 py-6 text-lg font-black text-emerald-700 xl:text-2xl">
                            {formatCurrency(booking.remainingAmount)}
                          </td>
                          <td className="px-6 py-6">
                            <span className="rounded-full bg-slate-900 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-white xl:text-sm">
                              {booking.booking_status || "-"}
                            </span>
                          </td>
                          <td className="px-6 py-6">
                            <div className="flex min-w-[260px] flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  navigate(
                                    {
                                      pathname: "/hotel/communication",
                                      search: bookingAction ? `?mode=${bookingAction}` : "",
                                    },
                                    {
                                      state: {
                                        bookingId: booking.bookingId,
                                        bookingCode: booking.bookingCode,
                                        bookingAction,
                                      },
                                    },
                                  )
                                }
                                className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 xl:text-base"
                              >
                                {quickActionMeta.buttonLabel}
                              </button>
                              <button
                                type="button"
                                onClick={() => navigate("/hotel/all-bookings")}
                                className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 xl:text-base"
                              >
                                Open All Bookings
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-slate-500">
                {quickActionMeta.emptyLabel}
              </div>
            )}
          </section>
        </div>
      </div>
    );
  }

  if (!bookingId) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-slate-500">
    Booking data cant' be at that time
    
        </div>
      </div>
    );
  }

  const handlePrint = () => {
    if (!printRef.current) return;

    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Booking Invoice</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
            h1,h2,h3,p { margin: 0; }
            .header { margin-bottom: 20px; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 20px 0; }
            .card { border: 1px solid #cbd5e1; border-radius: 14px; padding: 14px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; }
            th { background: #f1f5f9; }
          </style>
        </head>
        <body>${printRef.current.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handleSubmitBooking = () => {
    clearBookingSession();
    navigate("/hotel/all-bookings");
  };

  const refreshBooking = async () => {
    if (!bookingId) return;
    const response = await API.get(`/hotel/full-booking/${bookingId}`);
    setLiveBooking(response.data || null);
  };

  const refreshDocuments = async () => {
    if (!bookingId) return;
    const response = await API.get(`/hotel/guest-documents/${bookingId}`);
    setGuestDocuments(Array.isArray(response.data) ? response.data : []);
  };

  const handleDocumentFieldChange = (field, value) => {
    setDocumentForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleDocumentUpload = async () => {
    if (!bookingId) {
      openFeedbackModal("error", "Booking missing", "Document upload ke liye valid booking required hai.");
      return;
    }

    if (!documentForm.file) {
      openFeedbackModal("error", "Image required", "Hardcopy form ki image select kijiye.");
      return;
    }

    try {
      setDocumentSubmitting(true);
      const payload = new FormData();
      payload.append("document", documentForm.file);
      payload.append("documentType", documentForm.documentType);
      payload.append("termsAccepted", documentForm.termsAccepted ? "true" : "false");
      payload.append("notes", documentForm.notes);
      payload.append("uploadedBy", localStorage.getItem("email") || localStorage.getItem("name") || "");

      await API.post(`/hotel/guest-documents/${bookingId}`, payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      await refreshDocuments();
      setDocumentForm({
        documentType: "checkin_form",
        termsAccepted: true,
        notes: "",
        file: null,
      });
      if (documentInputRef.current) {
        documentInputRef.current.value = "";
      }

      openFeedbackModal(
        "success",
        "Document uploaded",
        "The guest’s hard copy form or related image has been saved along with the booking",
      );
    } catch (error) {
      console.error(error);
      openFeedbackModal(
        "error",
        "Upload failed",
        error.response?.data?.message || "Guest document could not be uploaded. Please try again.",
      );
    } finally {
      setDocumentSubmitting(false);
    }
  };

  const handleLifecycle = async (action) => {
    try {
      await API.put(`/hotel/${action}/${bookingId}`);
      pushDashboardNotification({
        title: action === "check-out" ? `Guest checked out - ${bookingRef}` : `Guest checked in - ${bookingRef}`,
        message:
          action === "check-out"
            ? "The booking was moved to booking history."
            : "The guest stay is now active.",
        type: action === "check-out" ? "warning" : "success",
        route: action === "check-out" ? "/hotel/booking-history" : "/hotel/all-bookings",
      });
      if (action === "check-out") {
        clearBookingSession();
        openFeedbackModal(
          "success",
          "Check-out completed",
          "The guest was checked out successfully and the booking has been moved to booking history.",
          { actionLabel: "Open Booking History", redirectPath: "/hotel/booking-history" },
        );
        return;
      }
      await refreshBooking();
      openFeedbackModal(
        "success",
        "Check-in completed",
        "The guest was checked in successfully.",
      );
    } catch (error) {
      console.error(error);
      openFeedbackModal(
        "error",
        action === "check-out" ? "Check-out failed" : "Check-in failed",
        action === "check-out"
          ? "We could not complete the guest check-out. Please try again."
          : "We could not complete the guest check-in. Please try again.",
      );
    }
  };

  return (
    <div className="min-h-screen w-full bg-[linear-gradient(135deg,#f8fbff_0%,#f8fffc_45%,#fff9f2_100%)] p-4 sm:p-6">
      <div className="w-full space-y-5">
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
                  <div className={`mb-2 inline-flex rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] ${feedbackToneClasses[feedbackModal.type].badge}`}>
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
                  <p className="mt-2 text-sm leading-6 text-slate-700">{feedbackModal.message}</p>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={closeFeedbackModal}
                    className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-slate-900 to-slate-700 px-5 py-3 text-sm font-bold text-white shadow-[0_14px_30px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 hover:from-slate-800 hover:to-slate-700"
                  >
                    {feedbackModal.actionLabel}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <section className="overflow-hidden rounded-[30px] border border-white/70 bg-[linear-gradient(135deg,#0f172a_0%,#1e40af_55%,#0f766e_100%)] px-5 py-5 text-white shadow-[0_22px_60px_rgba(15,23,42,0.22)] sm:px-6 xl:px-7 xl:py-6">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)] xl:items-center">
            <div className="max-w-4xl">
              <p className={`${sectionEyebrowCls} text-sky-200`}>
                Communication & Invoice
              </p>
              <h1 className="mt-2 text-[1.9rem] font-black leading-tight sm:text-[2.15rem] xl:text-[2.55rem]">
                Final booking summary ready for guest communication
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-100/85 xl:text-lg xl:leading-7">
                Review the invoice, payment summary, room details, and guest highlights in one compact front-desk view.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-3">
              <div className="rounded-[22px] border border-white/15 bg-white/10 p-4 backdrop-blur">
                <div className="text-[11px] uppercase tracking-[0.22em] text-sky-100/80 xl:text-xs">
                  Booking ID
                </div>
                <div className="mt-2 break-words text-xl font-black leading-tight xl:text-[1.65rem]">
                  {bookingRef}
                </div>
              </div>
              <div className="rounded-[22px] border border-white/15 bg-white/10 p-4 backdrop-blur">
                <div className="text-[11px] uppercase tracking-[0.22em] text-sky-100/80 xl:text-xs">
                  Guest Count
                </div>
                <div className="mt-2 text-xl font-black xl:text-[1.65rem]">{totalGuests || 0}</div>
              </div>
              <div className="rounded-[22px] border border-white/15 bg-white/10 p-4 backdrop-blur">
                <div className="text-[11px] uppercase tracking-[0.22em] text-sky-100/80 xl:text-xs">
                  Rooms
                </div>
                <div className="mt-2 text-xl font-black xl:text-[1.65rem]">{rooms.length}</div>
              </div>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() =>
              handleLifecycle(
                String(bookingStatus || "").toLowerCase().includes("checked in") ? "check-out" : "check-in",
              )
            }
            className={`${compactActionButtonCls} bg-emerald-600 text-white hover:bg-emerald-700`}
          >
            {String(bookingStatus || "").toLowerCase().includes("checked in") ? "Check Out" : "Check In"}
          </button>
          {!String(bookingStatus || "").toLowerCase().includes("checked in") ? (
            <BookingCancelAction
              bookingId={bookingId}
              bookingCode={bookingRef}
              buttonClassName="rounded-full"
            />
          ) : null}
          <button
            type="button"
            onClick={() => navigate(`/invoice/${bookingId}`)}
            className={`${compactActionButtonCls} bg-indigo-600 text-white hover:bg-indigo-700`}
          >
            Generate Invoice
          </button>
        </div>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.52fr)_360px] 2xl:grid-cols-[minmax(0,1.6fr)_380px]">
          <div className="rounded-[28px] border border-slate-200/70 bg-white/90 p-4 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur xl:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className={`${sectionEyebrowCls} text-sky-700`}>
                  Final Invoice
                </p>
                <h2 className="mt-2 text-2xl font-black text-slate-900 xl:text-[2rem]">
                  Booking billing preview
                </h2>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={handleSubmitBooking}
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-sky-600 to-blue-500 px-4 py-2.5 text-sm font-bold text-white shadow-[0_12px_30px_rgba(37,99,235,0.24)] transition hover:-translate-y-0.5 xl:px-5 xl:py-3 xl:text-lg"
              >
                Submit Booking
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 xl:px-5 xl:py-3 xl:text-lg"
              >
                Print Invoice
              </button>
              <button
                type="button"
                onClick={handleSubmitBooking}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100 xl:px-5 xl:py-3 xl:text-lg"
              >
                Open All Bookings
              </button>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 xl:px-5 xl:py-3 xl:text-lg"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={() => {
                  clearBookingSession();
                  navigate("/hotel/guest", { state: { resetBookingDraft: true } });
                }}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 xl:px-5 xl:py-3 xl:text-lg"
              >
                Start New Booking
              </button>
            </div>

            <div ref={printRef} className="mt-5 space-y-4">
              <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 xl:p-5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 xl:text-sm">
                    Guest Details
                  </div>
                  <div className="mt-3 text-xl font-black text-slate-900 xl:text-[2rem]">
                    {guestName}
                  </div>
                  <div className="mt-2 text-sm text-slate-600 xl:text-lg">
                    Mobile: {guestMobile}
                  </div>
                  <div className="mt-1 text-sm text-slate-600 xl:text-lg">
                    Email: {guestEmail}
                  </div>
                  <div className="mt-1 text-sm text-slate-600 xl:text-lg">
                    Check-In: {checkIn}
                  </div>
                  <div className="mt-1 text-sm text-slate-600 xl:text-lg">
                    Check-Out: {checkOut}
                  </div>
                </div>

                <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 xl:p-5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 xl:text-sm">
                    Payment Snapshot
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl bg-blue-50 p-3 xl:p-3.5">
                      <div className="text-[11px] uppercase tracking-wide text-blue-700 xl:text-sm">
                        Total
                      </div>
                      <div className="mt-1 text-lg font-black text-blue-900 xl:text-[1.65rem]">
                        {formatCurrency(totalAmount)}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-emerald-50 p-3 xl:p-3.5">
                      <div className="text-[11px] uppercase tracking-wide text-emerald-700 xl:text-sm">
                        Paid
                      </div>
                      <div className="mt-1 text-lg font-black text-emerald-900 xl:text-[1.65rem]">
                        {formatCurrency(paidAmount)}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-amber-50 p-3 xl:p-3.5">
                      <div className="text-[11px] uppercase tracking-wide text-amber-700 xl:text-sm">
                        Discount
                      </div>
                      <div className="mt-1 text-lg font-black text-amber-900 xl:text-[1.65rem]">
                        {formatCurrency(discountAmount)}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-orange-50 p-3 xl:p-3.5">
                      <div className="text-[11px] uppercase tracking-wide text-orange-700 xl:text-sm">
                        Remaining
                      </div>
                      <div className="mt-1 text-lg font-black text-orange-900 xl:text-[1.65rem]">
                        {formatCurrency(remainingAmount)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 text-sm text-slate-600 xl:text-lg">
                    Payment Mode: {paymentMode}
                  </div>
                  <div className="mt-1 text-sm text-slate-600 xl:text-lg">
                    Notes: {remarks}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto rounded-[22px] border border-slate-200">
                <table className="min-w-full bg-white">
                  <thead className="bg-slate-100 text-left text-sm text-slate-700 xl:text-lg">
                    <tr>
                      <th className="px-4 py-3.5">Room</th>
                      <th className="px-4 py-3.5">Type</th>
                      <th className="px-4 py-3.5">Qty</th>
                      <th className="px-4 py-3.5">Tariff</th>
                      <th className="px-4 py-3.5">GST</th>
                      <th className="px-4 py-3.5">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rooms.map((room, index) => (
                      <tr
                        key={`${room.roomNo || room.name || index}-${index}`}
                        className="border-t border-slate-200 text-sm xl:text-lg"
                      >
                        <td className="px-4 py-4 font-semibold text-slate-900 xl:text-xl">
                          {room.roomNo || room.name || "-"}
                        </td>
                        <td className="px-4 py-4 text-slate-600 xl:text-lg">
                          {room.roomType || "-"}
                        </td>
                        <td className="px-4 py-4 text-slate-600 xl:text-lg">
                          {room.quantity || 1}
                        </td>
                        <td className="px-4 py-4 text-slate-600 xl:text-lg">
                          {formatCurrency(room.price || 0)}
                        </td>
                        <td className="px-4 py-4 text-slate-600 xl:text-lg">{room.gst || 0}%</td>
                        <td className="px-4 py-4 font-bold text-emerald-700 xl:text-xl">
                          {formatCurrency(room.total || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-4 xl:w-full xl:max-w-[380px]">
            <div className="rounded-[28px] border border-slate-200/70 bg-white/90 p-4 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur xl:p-5">
              <p className={`${sectionEyebrowCls} text-violet-600`}>
                Communication Snapshot
              </p>
              <h2 className="mt-2 text-2xl font-black text-slate-900 xl:text-[2rem]">
                Guest-ready highlights
              </h2>

              <div className="mt-4 space-y-2.5">
                <div className="rounded-[20px] bg-slate-50 p-4">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500 xl:text-sm">
                    Booking Point
                  </div>
                  <div className="mt-1 font-bold text-slate-900 xl:text-2xl">
                    {bookingPoint}
                  </div>
                </div>

                <div className="rounded-[20px] bg-slate-50 p-4">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500 xl:text-sm">
                    Mobile Number
                  </div>
                  <div className="mt-1 font-bold text-slate-900 xl:text-2xl">
                    {guestMobile}
                  </div>
                </div>

                <div className="rounded-[20px] bg-slate-50 p-4">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500 xl:text-sm">
                    Room Numbers
                  </div>
                  <div className="mt-1 font-bold text-slate-900 xl:text-2xl">
                    {roomNumbers || "-"}
                  </div>
                </div>

                <div className="rounded-[20px] bg-slate-50 p-4">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500 xl:text-sm">
                    Status
                  </div>
                  <div className="mt-1 font-bold text-slate-900 xl:text-2xl">
                    {bookingStatus}
                  </div>
                </div>

                <div className="rounded-[20px] bg-slate-50 p-4">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500 xl:text-sm">
                    Arrival / Departure
                  </div>
                  <div className="mt-1 font-bold text-slate-900 xl:text-2xl">
                    {arrivalTime} / {departureTime}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200/70 bg-white/90 p-4 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur xl:p-5">
              <p className={`${sectionEyebrowCls} text-emerald-700`}>
                Guest Documents
              </p>
              <h2 className="mt-2 text-2xl font-black text-slate-900 xl:text-[2rem]">
                Upload hardcopy form
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 xl:text-base">
                Form fill hone ke baad uski photo yahin upload karo. Ye same guest profile search me future stay ke time dikhegi.
              </p>

              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Document Type
                  </span>
                  <select
                    value={documentForm.documentType}
                    onChange={(event) => handleDocumentFieldChange("documentType", event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  >
                    {Object.entries(documentTypeLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Upload Image
                  </span>
                  <input
                    ref={documentInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(event) => handleDocumentFieldChange("file", event.target.files?.[0] || null)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition file:mr-4 file:rounded-full file:border-0 file:bg-emerald-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-emerald-700 hover:file:bg-emerald-100 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Notes
                  </span>
                  <textarea
                    value={documentForm.notes}
                    onChange={(event) => handleDocumentFieldChange("notes", event.target.value)}
                    rows={3}
                    placeholder="Front page, signed copy, ID attached, etc."
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  />
                </label>

                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={documentForm.termsAccepted}
                    onChange={(event) => handleDocumentFieldChange("termsAccepted", event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-slate-700">
                    Terms & conditions formalities completed
                  </span>
                </label>

                <button
                  type="button"
                  onClick={handleDocumentUpload}
                  disabled={documentSubmitting}
                  className={`inline-flex w-full items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 ${
                    documentSubmitting ? "cursor-not-allowed opacity-70" : ""
                  }`}
                >
                  {documentSubmitting ? "Uploading..." : "Upload Document"}
                </button>
              </div>

              <div className="mt-5 border-t border-slate-200 pt-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Saved Documents
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-700">
                      {guestDocuments.length} files attached
                    </div>
                  </div>
                </div>

                {documentLoading ? (
                  <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-5 text-sm text-slate-500">
                    Loading documents...
                  </div>
                ) : guestDocuments.length ? (
                  <div className="mt-3 space-y-3">
                    {guestDocuments.map((document) => (
                      <div
                        key={document.id}
                        className="overflow-hidden rounded-[22px] border border-slate-200 bg-slate-50"
                      >
                        <img
                          src={buildUploadUrl(document.file_url)}
                          alt={documentTypeLabels[document.document_type] || "Guest document"}
                          className="h-40 w-full object-cover"
                        />
                        <div className="space-y-2 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-bold text-slate-900">
                              {documentTypeLabels[document.document_type] || "Document"}
                            </div>
                            <div className="text-xs text-slate-500">
                              {new Date(document.uploaded_at).toLocaleDateString("en-IN")}
                            </div>
                          </div>
                          <div className="text-xs text-slate-500">
                            Terms accepted: {Number(document.terms_accepted) ? "Yes" : "No"}
                          </div>
                          {document.notes ? (
                            <div className="text-sm text-slate-600">{document.notes}</div>
                          ) : null}
                          <a
                            href={buildUploadUrl(document.file_url)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-800"
                          >
                            View Full Image
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">
                    Is booking ke saath abhi koi uploaded form nahi hai.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Communication;
