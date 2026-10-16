import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FaCalendarAlt,
  FaCalendarCheck,
  FaCashRegister,
  FaFileAlt,
  FaHandHoldingUsd,
  FaSyncAlt,
} from "react-icons/fa";
import API from "../../api";
import {
  addDays,
  endOfMonthISO,
  formatDay,
  formatINR,
  pickNumber,
  pickText,
  startOfMonthISO,
  toISODate,
  todayISO,
} from "./reportUtils";

const TOTAL_KEYS = ["total", "amount", "net_amount", "grand_total"];
const DAY_KEYS = ["date", "transaction_date", "entry_date", "created_at", "payment_date", "txn_date", "day"];
const PAYMENT_TYPE_KEYS = ["payment_type", "paymentType", "type"];
const METHOD_KEYS = ["payment_method", "paymentMethod", "method", "mode"];
const REF_KEYS = ["invoice_no", "invoiceNumber", "booking_id", "bookingId", "reference", "token_id", "table_number"];

function Card({ icon, label, value, tone }) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    cyan: "bg-cyan-50 text-cyan-700 ring-cyan-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    rose: "bg-rose-50 text-rose-700 ring-rose-200",
  };
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_10px_30px_-18px rgba(15,23,42,0.25)]">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</div>
          <div className="mt-1 truncate text-xl font-bold text-slate-900">{value}</div>
        </div>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${tones[tone] || tones.cyan}`}>
          {icon}
        </span>
      </div>
    </div>
  );
}

function isRefund(row) {
  return String(pickText(row, PAYMENT_TYPE_KEYS)).toLowerCase().includes("refund");
}

export default function DaywiseCollection() {
  const [from, setFrom] = useState(startOfMonthISO());
  const [to, setTo] = useState(endOfMonthISO());
  const [payments, setPayments] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showRefunds, setShowRefunds] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = from || to ? { from, to } : {};
    const results = await Promise.allSettled([
      API.get("/accounts/payment-history", { params }),
      API.get("/accounts/transactions", { params }),
    ]);
    setPayments(results[0].status === "fulfilled" ? results[0].value.data || [] : []);
    setLedger(results[1].status === "fulfilled" ? results[1].value.data || [] : []);
    if (results.every((r) => r.status !== "fulfilled")) {
      setError("Collection data could not be loaded from the server.");
    }
    setLoading(false);
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const useLedger = payments.length === 0;

  const view = useMemo(() => {
    const dayTotals = new Map();
    const dayCounts = new Map();
    const dayRefunds = new Map();
    const entries = [];

    const consider = (row, source) => {
      const day = String(pickText(row, DAY_KEYS) || "").slice(0, 10);
      const amount = pickNumber(row, TOTAL_KEYS);
      if (!day || !Number.isFinite(amount)) return;
      if (
        source === "ledger" &&
        !String(pickText(row, ["type", "txn_type", "transaction_type"])).toLowerCase().includes("income")
      ) {
        return;
      }
      const refund = isRefund(row);
      if (refund) dayRefunds.set(day, (dayRefunds.get(day) || 0) + amount);
      dayTotals.set(day, (dayTotals.get(day) || 0) + amount);
      dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
      entries.push({
        day,
        amount,
        refund,
        method: pickText(row, METHOD_KEYS) || (source === "ledger" ? "Ledger" : "--"),
        reference: pickText(row, REF_KEYS) || "--",
        description: pickText(row, ["description", "note", "title", "memo"]) || "--",
      });
    };

    if (useLedger) ledger.forEach((row) => consider(row, "ledger"));
    else payments.forEach((row) => consider(row, "payments"));

    const collected = [...dayTotals.values()].reduce((sum, value) => sum + value, 0);
    const refunded = [...dayRefunds.values()].reduce((sum, value) => sum + value, 0);
    const activeDays = [...dayTotals.entries()].filter(([, total]) => total > 0).length;

    const days = [...new Set([...dayTotals.keys(), ...dayRefunds.keys()])].sort();
    const table = days.map((day) => ({
      day,
      total: dayTotals.get(day) || 0,
      count: dayCounts.get(day) || 0,
      refunds: dayRefunds.get(day) || 0,
    }));

    const methodTotals = new Map();
    entries.filter((entry) => !entry.refund).forEach((entry) => {
      const key = entry.method && entry.method !== "--" ? entry.method : "Other";
      methodTotals.set(key, (methodTotals.get(key) || 0) + entry.amount);
    });
    const methods = [...methodTotals.entries()]
      .map(([method, total]) => ({ method, total }))
      .sort((a, b) => b.total - a.total);

    return {
      table,
      collected,
      refunded,
      net: collected - refunded,
      activeDays,
      methods,
      entries,
    };
  }, [ledger, payments, useLedger]);

  const maxDayTotal = Math.max(1, ...view.table.map((row) => Math.max(row.total, 0)));
  const maxMethodTotal = Math.max(1, ...view.methods.map((row) => row.total));

  const applyPreset = (kind) => {
    if (kind === "today") {
      setFrom(todayISO());
      setTo(todayISO());
    } else if (kind === "month") {
      setFrom(startOfMonthISO());
      setTo(endOfMonthISO());
    } else {
      setFrom(toISODate(addDays(new Date(), -30)));
      setTo(todayISO());
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.16em] text-emerald-600">
            <FaCalendarCheck size={15} /> Collections Report
          </div>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Daywise Collections</h1>
          <p className="mt-1 text-sm text-slate-500">Collections rolled up by day, with refunds shown separately.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <label className="flex flex-col gap-1 text-[12px] font-bold uppercase tracking-wide text-slate-400">
            <span className="flex items-center gap-1"><FaCalendarAlt size={12} /> From</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700" />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-bold uppercase tracking-wide text-slate-400">
            <span>To</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700" />
          </label>
          <div className="flex gap-1">
            {["today", "month", "30d"].map((kind) => (
              <button key={kind} type="button" onClick={() => applyPreset(kind)} className="rounded-xl border border-slate-300 px-3 py-2 text-[12px] font-bold uppercase tracking-wide text-slate-600 hover:bg-slate-50">
                {kind === "30d" ? "Last 30d" : kind}
              </button>
            ))}
          </div>
          <button type="button" onClick={load} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700">
            <FaSyncAlt size={13} /> Reload
          </button>
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          <FaFileAlt size={15} /> {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card icon={<FaHandHoldingUsd size={18} />} label="Total Collected" value={formatINR(view.collected)} tone="emerald" />
        <Card icon={<FaCalendarCheck size={18} />} label="Net After Refunds" value={formatINR(view.net)} tone="cyan" />
        <Card icon={<FaFileAlt size={18} />} label="Refunds Given" value={formatINR(view.refunded)} tone="rose" />
        <Card icon={<FaCashRegister size={18} />} label="Active Collection Days" value={view.activeDays} tone="amber" />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-span-2">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-bold text-slate-800">Collections by day</h2>
            <p className="text-[12px] text-slate-400">
              {useLedger ? "Source: accounts ledger (no payments recorded)." : "Source: payments table."}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[12px] font-bold uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Collection</th>
                  <th className="px-4 py-3 text-center">Entries</th>
                  <th className="px-4 py-3 text-right">Refunds</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {view.table.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-sm font-semibold text-slate-400">
                      No collections recorded in this window.
                    </td>
                  </tr>
                ) : (
                  view.table.map((row) => (
                    <tr key={row.day} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-semibold text-slate-700">{formatDay(row.day)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-2 w-24 shrink-0 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(row.total / maxDayTotal) * 100}%` }} />
                          </div>
                          <span className="font-semibold text-slate-800">{formatINR(row.total)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-slate-600">{row.count || "--"}</td>
                      <td className="px-4 py-3 text-right font-semibold text-rose-600">{row.refunds ? formatINR(row.refunds) : "--"}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {view.table.length > 0 ? (
                <tfoot className="bg-slate-50 text-sm font-bold text-slate-800">
                  <tr>
                    <td className="px-4 py-3">Total</td>
                    <td className="px-4 py-3">{formatINR(view.collected)}</td>
                    <td className="px-4 py-3 text-center">{view.table.reduce((sum, row) => sum + row.count, 0)}</td>
                    <td className="px-4 py-3 text-right">{formatINR(view.refunded)}</td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        </div>

        <div className="space-y-5">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-bold text-slate-800">By payment mode</h2>
              <p className="text-[12px] text-slate-400">Excludes refunds</p>
            </div>
            <div className="divide-y divide-slate-100">
              {view.methods.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm font-semibold text-slate-400">No data for this window.</div>
              ) : (
                view.methods.map((row) => (
                  <div key={row.method} className="px-4 py-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate font-semibold text-slate-700">{row.method}</span>
                      <span className="font-bold text-slate-800">{formatINR(row.total)}</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-cyan-500" style={{ width: `${(row.total / maxMethodTotal) * 100}%` }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div>
              <div className="text-sm font-bold text-slate-800">Show refunds</div>
              <div className="text-[12px] text-slate-400">List refunded rows in the detail table</div>
            </div>
            <button
              type="button"
              onClick={() => setShowRefunds((value) => !value)}
              className={`relative h-7 w-12 rounded-full transition-colors ${showRefunds ? "bg-emerald-500" : "bg-slate-300"}`}
              aria-pressed={showRefunds}
            >
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${showRefunds ? "left-6" : "left-1"}`} />
            </button>
          </div>
        </div>
      </div>

      {view.entries.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-bold text-slate-800">Collection detail</h2>
            <p className="text-[12px] text-slate-400">Showing {Math.min(200, view.entries.length)} of {view.entries.length} entries</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[12px] font-bold uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Mode</th>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {view.entries
                  .filter((entry) => showRefunds || !entry.refund)
                  .slice(0, 200)
                  .map((entry, index) => (
                    <tr key={`${entry.day}-${index}`} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-semibold text-slate-700">{formatDay(entry.day)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-lg px-2 py-1 text-[11px] font-bold uppercase ${entry.refund ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
                          {entry.method}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{entry.reference}</td>
                      <td className="px-4 py-3 text-slate-600">{entry.description}</td>
                      <td className={`px-4 py-3 text-right font-bold ${entry.refund ? "text-rose-600" : "text-slate-800"}`}>
                        {entry.refund ? "-" : ""}{formatINR(entry.amount)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 text-sm font-semibold text-slate-400">
          <FaSyncAlt size={14} /> Loading collections...
        </div>
      ) : null}
    </div>
  );
}
