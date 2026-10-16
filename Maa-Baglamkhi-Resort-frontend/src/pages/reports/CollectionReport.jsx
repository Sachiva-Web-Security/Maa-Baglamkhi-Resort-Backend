import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FaCalendarAlt,
  FaCheckCircle,
  FaFileAlt,
  FaMoneyCheckAlt,
  FaQuestionCircle,
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
const METHOD_KEYS = ["payment_method", "paymentMethod", "method", "mode"];
const REF_KEYS = ["invoice_no", "invoiceNumber", "booking_id", "bookingId", "reference", "token_id", "table_number"];
const STATUS_KEYS = ["status", "payment_status", "paymentStatus"];

function Card({ icon, label, value, note, tone }) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    cyan: "bg-cyan-50 text-cyan-700 ring-cyan-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    rose: "bg-rose-50 text-rose-700 ring-rose-200",
  };
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_10px_30px_-18px rgba(15,23,42,0.25)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</div>
          <div className="mt-1 truncate text-xl font-bold text-slate-900">{value}</div>
          {note ? <div className="mt-1 truncate text-[12px] text-slate-400">{note}</div> : null}
        </div>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${tones[tone] || tones.cyan}`}>
          {icon}
        </span>
      </div>
    </div>
  );
}

function statusTone(value) {
  const text = String(value || "").toLowerCase();
  if (!text || text === "--") return "bg-slate-100 text-slate-600";
  if (["paid", "completed", "settled", "matched", "collected", "cleared"].some((word) => text.includes(word))) {
    return "bg-emerald-50 text-emerald-700";
  }
  if (["refund", "cancelled", "canceled", "void"].some((word) => text.includes(word))) return "bg-rose-50 text-rose-700";
  return "bg-amber-50 text-amber-700";
}

export default function CollectionReport() {
  const [from, setFrom] = useState(startOfMonthISO());
  const [to, setTo] = useState(endOfMonthISO());
  const [methodFilter, setMethodFilter] = useState("");
  const [payments, setPayments] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [reconciliation, setReconciliation] = useState({});
  const [bankLedger, setBankLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = from || to ? { from, to } : {};
    const results = await Promise.allSettled([
      API.get("/accounts/payment-history", { params }),
      API.get("/accounts/transactions", { params }),
      API.get("/accounts/reconciliation/summary"),
      API.get("/accounts/bank-ledger"),
    ]);
    setPayments(results[0].status === "fulfilled" ? results[0].value.data || [] : []);
    setLedger(results[1].status === "fulfilled" ? results[1].value.data || [] : []);
    setReconciliation(results[2].status === "fulfilled" ? results[2].value.data || {} : {});
    setBankLedger(results[3].status === "fulfilled" ? results[3].value.data || [] : []);
    if (
      results[0].status !== "fulfilled" &&
      results[1].status !== "fulfilled" &&
      results[2].status !== "fulfilled" &&
      results[3].status !== "fulfilled"
    ) {
      setError("Collection report data could not be loaded from the server.");
    }
    setLoading(false);
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const useLedger = payments.length === 0;

  const rows = useMemo(() => {
    const entries = [];
    const consider = (row, source) => {
      const amount = pickNumber(row, TOTAL_KEYS);
      if (!Number.isFinite(amount)) return;
      const day = String(pickText(row, DAY_KEYS) || "").slice(0, 10);
      if (from && day && day < from) return;
      if (to && day && day > to) return;
      entries.push({
        day,
        amount,
        method: pickText(row, METHOD_KEYS) || (source === "ledger" ? "Ledger" : "--"),
        reference: pickText(row, REF_KEYS) || "--",
        description: pickText(row, ["description", "note", "title", "memo"]) || "--",
        status: pickText(row, STATUS_KEYS) || (source === "ledger" ? "ledger entry" : "--"),
        source,
      });
    };
    if (useLedger) ledger.forEach((row) => consider(row, "ledger"));
    else payments.forEach((row) => consider(row, "payments"));
    return entries;
  }, [ledger, payments, useLedger, from, to]);

  const methods = useMemo(() => [...new Set(rows.map((row) => row.method))].sort(), [rows]);

  const view = useMemo(() => {
    const filtered = methodFilter ? rows.filter((row) => row.method === methodFilter) : rows;
    const collected = filtered.reduce((sum, row) => sum + row.amount, 0);
    const byMethod = new Map();
    filtered.forEach((row) => {
      byMethod.set(row.method, (byMethod.get(row.method) || 0) + row.amount);
    });
    return {
      filtered,
      collected,
      entries: filtered.length,
      byMethod: [...byMethod.entries()].map(([method, total]) => ({ method, total })).sort((a, b) => b.total - a.total),
    };
  }, [rows, methodFilter]);

  const reconciliationView = useMemo(() => {
    // Live shape: { totalBankIn, totalBankOut, matchedAmount, unmatchedAmount, partialAmount,
    // reconciledAmount, totalItems, unmatchedItems, partialItems, matchedItems }
    const matched = pickNumber(reconciliation, ["matchedAmount", "reconciledAmount", "matched", "matched_amount"]);
    const unmatched = pickNumber(reconciliation, ["unmatchedAmount", "partialAmount", "unmatched", "unmatched_amount"]);
    const total = pickNumber(reconciliation, ["totalBankIn", "totalBankOut", "totalAmount", "total", "bankTotal"]);
    const balance = pickNumber(reconciliation, ["variance", "difference", "balance"]);
    const matchedCount = pickNumber(reconciliation, ["matchedItems", "matchedCount", "matched_count"]);
    const unmatchedCount = pickNumber(reconciliation, ["unmatchedItems", "unmatchedCount", "unmatched_count"]);
    const totalItems = pickNumber(reconciliation, ["totalItems", "total_items"]);
    const hasCounts = matchedCount > 0 || unmatchedCount > 0 || totalItems > 0;
    return { matched, unmatched, total, balance, matchedCount, unmatchedCount, totalItems, hasCounts };
  }, [reconciliation]);

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
            <FaMoneyCheckAlt size={15} /> Finance Report
          </div>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Collection Report</h1>
          <p className="mt-1 text-sm text-slate-500">
            Full collection statement for the window, with the bank reconciliation position alongside.
          </p>
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
          <label className="flex flex-col gap-1 text-[12px] font-bold uppercase tracking-wide text-slate-400">
            <span>Mode</span>
            <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">
              <option value="">All modes</option>
              {methods.map((method) => (
                <option key={method} value={method}>{method}</option>
              ))}
            </select>
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
        <Card icon={<FaMoneyCheckAlt size={18} />} label="Report Total" value={formatINR(view.collected)} note={`${view.entries} entr${view.entries === 1 ? "y" : "ies"}`} tone="emerald" />
        <Card icon={<FaCheckCircle size={18} />} label="Reconciled" value={formatINR(reconciliationView.matched)} note={reconciliationView.hasCounts ? `${reconciliationView.matchedCount} line items` : "Bank ledger position"} tone="cyan" />
        <Card icon={<FaQuestionCircle size={18} />} label="Unreconciled" value={formatINR(reconciliationView.unmatched)} note={reconciliationView.hasCounts ? `${reconciliationView.unmatchedCount} line items` : "Awaiting match"} tone="amber" />
        <Card icon={<FaMoneyCheckAlt size={18} />} label="Ledger Rows" value={bankLedger.length} note="Bank ledger records on file" tone="rose" />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-span-2">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-bold text-slate-800">Statement</h2>
            <p className="text-[12px] text-slate-400">
              {useLedger ? "Source: accounts ledger (no payments recorded)." : "Source: payments table."}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[12px] font-bold uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Mode</th>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {view.filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm font-semibold text-slate-400">
                      No collections match this filter.
                    </td>
                  </tr>
                ) : (
                  view.filtered.slice(0, 250).map((row, index) => (
                    <tr key={`${row.day}-${index}`} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-semibold text-slate-700">{row.day ? formatDay(row.day) : "--"}</td>
                      <td className="px-4 py-3 text-slate-600">{row.method}</td>
                      <td className="px-4 py-3 text-slate-600">{row.reference}</td>
                      <td className="px-4 py-3 text-slate-600">{row.description}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-lg px-2 py-1 text-[11px] font-bold uppercase ${statusTone(row.status)}`}>{row.status}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800">{formatINR(row.amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {view.filtered.length > 0 ? (
                <tfoot className="bg-slate-50 text-sm font-bold text-slate-800">
                  <tr>
                    <td className="px-4 py-3" colSpan={5}>Total ({Math.min(250, view.filtered.length)} of {view.filtered.length} shown)</td>
                    <td className="px-4 py-3 text-right">{formatINR(view.collected)}</td>
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
              <p className="text-[12px] text-slate-400">Within the selected filter</p>
            </div>
            <div className="divide-y divide-slate-100">
              {view.byMethod.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm font-semibold text-slate-400">No data for this window.</div>
              ) : (
                view.byMethod.map((row) => (
                  <button key={row.method} type="button" onClick={() => setMethodFilter(row.method === methodFilter ? "" : row.method)} className="block w-full px-4 py-3 text-left hover:bg-slate-50/70">
                    <div className="flex items-center justify-between text-sm">
                      <span className={`truncate font-semibold ${row.method === methodFilter ? "text-emerald-600" : "text-slate-700"}`}>{row.method}</span>
                      <span className="font-bold text-slate-800">{formatINR(row.total)}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
            {methodFilter ? (
              <div className="border-t border-slate-100 px-4 py-2">
                <button type="button" onClick={() => setMethodFilter("")} className="text-[12px] font-bold uppercase tracking-wide text-emerald-600 hover:underline">
                  Clear mode filter
                </button>
              </div>
            ) : null}
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-bold text-slate-800">Reconciliation position</h2>
              <p className="flex items-center gap-1 text-[12px] text-slate-400"><FaSyncAlt size={11} /> Live from the bank ledger</p>
            </div>
            <div className="divide-y divide-slate-100 text-sm">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-slate-500">Total</span>
                <span className="font-bold text-slate-800">{formatINR(reconciliationView.total)}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-slate-500">Matched</span>
                <span className="font-bold text-emerald-600">{formatINR(reconciliationView.matched)}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-slate-500">Unmatched</span>
                <span className="font-bold text-amber-600">{formatINR(reconciliationView.unmatched)}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-slate-500">Balance / variance</span>
                <span className="font-bold text-rose-600">{formatINR(reconciliationView.balance)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading ? <div className="text-center text-sm font-semibold text-slate-400">Loading report...</div> : null}
    </div>
  );
}
