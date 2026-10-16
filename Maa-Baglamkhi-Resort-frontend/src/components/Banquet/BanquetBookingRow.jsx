import { FaEdit, FaEnvelope, FaFileInvoice, FaWhatsapp } from "react-icons/fa";

const BanquetBookingRow = ({
  booking,
  formatINR,
  onComplete,
  onCancel,
  onEdit,
  onRefund,
  onGenerateBill,
  onDelete,
  onView,
  onSendEmail,
  onSendWhatsApp,
}) => {
  const getStatusBadge = (status) => {
    const baseClasses =
      "inline-flex rounded-full border px-3 py-1 text-xs font-bold";

    switch (status) {
      case "Confirmed":
        return `${baseClasses} border-sky-200 bg-sky-50 text-sky-700`;
      case "Completed":
        return `${baseClasses} border-amber-200 bg-amber-50 text-amber-700`;
      case "Billed":
        return `${baseClasses} border-emerald-200 bg-emerald-50 text-emerald-700`;
      case "Cancelled":
        return `${baseClasses} border-rose-200 bg-rose-50 text-rose-700`;
      case "Refunded":
        return `${baseClasses} border-violet-200 bg-violet-50 text-violet-700`;
      default:
        return `${baseClasses} border-slate-200 bg-slate-100 text-slate-600`;
    }
  };

  return (
    <tr className="border-t border-slate-200/80 align-top transition hover:bg-slate-50/80">
      <td className="px-4 py-4 text-sm font-bold text-slate-900">
        {booking.hallName}
      </td>
      <td className="px-4 py-4 text-sm text-slate-700">
        <div className="font-semibold text-slate-900">{booking.customerName}</div>
        <div className="mt-1 text-xs text-slate-500">
          {booking.guestEmail || booking.phone || "Contact pending"}
        </div>
      </td>
      <td className="px-4 py-4 text-sm text-slate-700">
        <div className="font-semibold text-slate-900">
          {booking.eventTitle || booking.eventType}
        </div>
        <div className="mt-1 text-xs text-slate-500">
          {booking.mealSection || "Meal plan"} /{" "}
          {booking.lightingSystem || "Lighting"}
        </div>
      </td>
      <td className="px-4 py-4 text-sm text-slate-700">{booking.date || "-"}</td>
      <td className="px-4 py-4 text-sm text-slate-700">
        {booking.startTime} - {booking.endTime}
      </td>
      <td className="px-4 py-4 text-sm text-slate-700">
        <div className="font-semibold text-slate-900">
          Total {formatINR?.(booking.grandTotal || booking.grand_total || 0)}
        </div>
        <div className="font-semibold text-emerald-700">
          {formatINR?.(booking.advance || booking.paymentReceived || 0)}
        </div>
        <div className="mt-1 text-xs text-amber-600">
          Refunded {formatINR?.(booking.refundAmount || 0)}
        </div>
        <div className="mt-1 text-xs text-slate-500">
          Net {formatINR?.(booking.netReceived || 0)}
        </div>
        <div className="mt-1 text-xs text-rose-500">
          Due {formatINR?.(booking.balanceDue || 0)}
        </div>
      </td>
      <td className="px-4 py-4">
        <div className="space-y-2">
          <span className={getStatusBadge(booking.status)}>{booking.status}</span>
          <div className="text-xs text-slate-500">
            Payment {booking.paymentStatus || "Pending"}
          </div>
          {booking.invoiceNo ? (
            <div className="text-xs font-semibold text-slate-700">
              {booking.invoiceNo}
            </div>
          ) : null}
        </div>
      </td>
      <td className="px-4 py-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-cyan-200 hover:text-cyan-700"
          >
            <FaEdit />
            Edit
          </button>

          {booking.status === "Confirmed" && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full bg-rose-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-rose-600"
            >
              Cancel
            </button>
          )}

          {booking.status === "Confirmed" && (
            <button
              type="button"
              onClick={onComplete}
              className="rounded-full bg-amber-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-amber-600"
            >
              Mark Completed
            </button>
          )}

          {(booking.status === "Completed" || booking.status === "Confirmed") && (
            <button
              type="button"
              onClick={onGenerateBill}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-700"
            >
              <FaFileInvoice />
              Generate Bill
            </button>
          )}

          {(booking.status === "Cancelled" || booking.status === "Refunded") &&
          Number(booking.advance || 0) > Number(booking.refundAmount || 0) ? (
            <button
              type="button"
              onClick={onRefund}
              className="rounded-full bg-violet-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-violet-700"
            >
              Refund
            </button>
          ) : null}

          {booking.invoiceNo && (
            <button
              type="button"
              onClick={onView}
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-sky-200 hover:text-sky-700"
            >
              View Bill
            </button>
          )}

          <button
            type="button"
            onClick={onSendEmail}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-sky-200 hover:text-sky-700"
          >
            <FaEnvelope />
            Email Quote
          </button>

          <button
            type="button"
            onClick={onSendWhatsApp}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-emerald-200 hover:text-emerald-700"
          >
            <FaWhatsapp />
            WhatsApp Quote
          </button>

          {["Cancelled", "Refunded"].includes(booking.status) ? (
            <button
              type="button"
              onClick={onDelete}
              className="rounded-full border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-50"
            >
              Delete
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  );
};

export default BanquetBookingRow;
