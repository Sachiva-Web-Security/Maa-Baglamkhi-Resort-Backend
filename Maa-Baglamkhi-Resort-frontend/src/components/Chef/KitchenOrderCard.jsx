import { useState, useEffect } from "react";
import { FiClock, FiCheckCircle, FiAlertCircle } from "react-icons/fi";

const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    bg: "bg-orange-50",
    text: "text-orange-600",
    ring: "ring-orange-100",
    nextStatus: "preparing",
    nextLabel: "Start Preparing",
    nextIcon: FiClock,
    nextClass: "from-orange-500 to-amber-400",
  },
  preparing: {
    label: "Preparing",
    bg: "bg-sky-50",
    text: "text-sky-600",
    ring: "ring-sky-100",
    nextStatus: "ready",
    nextLabel: "Order Ready",
    nextIcon: FiCheckCircle,
    nextClass: "from-emerald-500 to-emerald-400",
  },
  ready: {
    label: "Ready",
    bg: "bg-emerald-50",
    text: "text-emerald-600",
    ring: "ring-emerald-100",
    nextStatus: null,
    nextLabel: null,
    nextIcon: null,
    nextClass: null,
  },
};

const PREP_TIME_OPTIONS = [5, 10, 15, 20, 30, 45, 60, 90];

const toMillis = (value) => {
  if (!value) return null;
  if (typeof value === "string") {
    const mysqlMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (mysqlMatch) {
      const [, year, month, day, hours, minutes, seconds = "00"] = mysqlMatch;
      const parsed = new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes), Number(seconds)).getTime();
      if (!Number.isNaN(parsed)) return parsed;
    }
  }
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
};

const formatTime = (value) => {
  const parsed = toMillis(value);
  if (!parsed) return "--";
  return new Date(parsed).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
};

const getRemainingMinutes = (expectedReadyAt) => {
  const dueAt = toMillis(expectedReadyAt);
  if (!dueAt) return null;
  return Math.ceil((dueAt - Date.now()) / 60000);
};

const formatCountdown = (totalSeconds) => {
  if (totalSeconds === null || totalSeconds === undefined) return "--:--";
  const safe = Math.max(0, Number(totalSeconds) || 0);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const KitchenOrderCard = ({ order, onStatusUpdate }) => {
  const status = String(order.status || "Pending").toLowerCase();
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;

  const [eta, setEta] = useState(order.prepTimeMinutes || 20);
  const [readyMsg, setReadyMsg] = useState(order.readyMessage || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEta(order.prepTimeMinutes || 20);
    setReadyMsg(order.readyMessage || "");
  }, [order.id, order.prepTimeMinutes, order.readyMessage]);

  const expectedAt = order.expectedReadyAt;
  const remainingSec = expectedAt
    ? Math.max(0, Math.ceil((toMillis(expectedAt) - Date.now()) / 1000))
    : null;
  const isOverdue = status !== "ready" && expectedAt && getRemainingMinutes(expectedAt) !== null && getRemainingMinutes(expectedAt) < 0;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const handleStatusChange = async () => {
    if (!config.nextStatus) return;
    setSaving(true);
    try {
      await onStatusUpdate(order.id, {
        status: config.nextStatus,
        prepTimeMinutes: eta,
        readyMessage: readyMsg,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEtaChange = async () => {
    setSaving(true);
    try {
      await onStatusUpdate(order.id, { prepTimeMinutes: eta });
    } finally {
      setSaving(false);
    }
  };

  const handleReadyMsgChange = async () => {
    setSaving(true);
    try {
      await onStatusUpdate(order.id, { readyMessage: readyMsg });
    } finally {
      setSaving(false);
    }
  };

  const items = Array.isArray(order.items) ? order.items : [];

  return (
    <div
      className={`flex flex-col rounded-[22px] border p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(30,64,175,0.1)] sm:p-5 ${
        isOverdue
          ? "border-rose-100 bg-rose-50/40"
          : "border-slate-100 bg-white"
      }`}
    >
      {/* Header: status badge + order id */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`inline-flex rounded-full px-3 py-1 text-[13px] font-bold ring-1 ring-inset ${config.bg} ${config.text} ${config.ring}`}>
              {isOverdue ? "Overdue" : config.label}
            </span>
            <span className="text-[13px] font-medium text-slate-400">#{order.id}</span>
          </div>
          <div className="mt-2 text-[20px] font-black text-slate-900 sm:text-[22px]">
            {order.entityType || "Table"} {order.table || "--"}
          </div>
          {order.readyMessage && status === "ready" && (
            <div className="mt-2 break-words rounded-[12px] border border-emerald-100 bg-emerald-50 px-3 py-2 text-[14px] font-semibold text-emerald-700">
              {order.readyMessage}
            </div>
          )}
        </div>
        <div className="text-right text-[13px] text-slate-400">
          {order.created_at
            ? new Date(order.created_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })
            : ""}
        </div>
      </div>

      {/* Waiter */}
      <div className="mt-3 flex items-center gap-2 text-[15px] text-slate-500">
        <span className="font-semibold text-slate-600">Waiter:</span>
        <span>{order.waiter_name || order.waiter || "--"}</span>
      </div>

      {/* Items */}
      <div className="mt-4 space-y-2">
        {items.map((item, idx) => (
          <div
            key={idx}
            className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] border border-slate-100 bg-slate-50/70 px-3 py-2.5"
          >
            <div className="min-w-0">
              <div className="break-words text-[16px] font-semibold text-slate-900">
                {item.name || item.item_name || `Item ${idx + 1}`}
              </div>
              <div className="text-[13px] text-slate-400">
                Qty: {item.qty ?? item.quantity ?? "-"}
              </div>
            </div>
            <div className="shrink-0 text-[15px] font-bold text-slate-600">
              Rs. {item.price || 0}
            </div>
          </div>
        ))}
      </div>

      {/* ETA countdown (for non-ready orders) */}
      {status !== "ready" && (
        <div className={`mt-4 flex items-center gap-2 rounded-[14px] border px-3 py-2.5 ${
          isOverdue
            ? "border-rose-100 bg-rose-50"
            : "border-slate-100 bg-slate-50/50"
        }`}>
          <FiClock className={`text-lg ${isOverdue ? "text-rose-500" : "text-sky-500"}`} />
          <div className="flex-1">
            <div className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">Expected Ready</div>
            <div className="flex items-center gap-2">
              <span className="text-[18px] font-black text-slate-900">
                {formatCountdown(remainingSec)}
              </span>
              {remainingSec !== null && remainingSec > 0 && (
                <span className="text-[13px] text-slate-400">remaining</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Controls: prep time + ready message + action buttons */}
      <div className="mt-4 space-y-3">
        {/* Prep time */}
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Prep Time (minutes)
          </label>
          <div className="flex gap-2">
            <select
              value={eta}
              onChange={(e) => setEta(Number(e.target.value))}
              disabled={saving}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[15px] font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
            >
              {PREP_TIME_OPTIONS.map((m) => (
                <option key={m} value={m}>{m} min</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleEtaChange}
              disabled={saving}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[14px] font-bold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-60"
            >
              Set
            </button>
          </div>
        </div>

        {/* Ready message */}
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Ready Message
          </label>
          <input
            type="text"
            value={readyMsg}
            onChange={(e) => setReadyMsg(e.target.value)}
            placeholder="e.g. Extra spicy, ready to serve"
            disabled={saving}
            onBlur={handleReadyMsgChange}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[15px] font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
          />
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-2 pt-1">
          {config.nextStatus && (
            <button
              type="button"
              onClick={handleStatusChange}
              disabled={saving}
              className={`inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r ${config.nextClass} px-4 py-2.5 text-[15px] font-bold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60`}
            >
              {config.nextIcon && <config.nextIcon />}
              {config.nextLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default KitchenOrderCard;
