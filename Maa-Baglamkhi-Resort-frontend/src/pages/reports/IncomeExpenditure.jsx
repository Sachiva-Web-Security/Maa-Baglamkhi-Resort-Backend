import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FaArrowDown,
  FaArrowUp,
  FaBalanceScale,
  FaCalendarAlt,
  FaCoins,
  FaFileAlt,
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

const TOTAL_KEYS = ["total", "gross", "subtotal", "net_amount", "amount"];
const DAY_KEYS = ["date", "transaction_date", "entry_date", "created_at", "payment_date", "txn_date", "day"];
const TYPE_KEYS = ["type", "txn_type", "transaction_type", "nature"];
const DESC_KEYS = ["description", "note", "title", "memo"];

function Card({ icon, label, value, tone }) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    rose: "bg-rose-50 text-rose-700 ring-rose-200",
    cyan: "bg-cyan-50 text-cyan-700 ring-cyan-200",
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

function windowParams(from, to) {
  return from || to ? { from, to } : {};
}

export default function IncomeExpenditure() {
  const [from, setFrom] = useState(startOfMonthISO());
  const [to, setTo] = useState(endOfMonthISO());
  const [ledger, setLedger] = useState([]);
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = windowParams(from, to);
    const results = await Promise.allSettled([
      API.get("/accounts/transactions", { params }),
      API.get("/accounts/payment-history", { params }),
      API.get("/accounts/summary", { params }),
    ]);
    setLedger(results[0].status === "fulfilled" ? results[0].value.data || [] : []);
    setPayments(results[1].status === "fulfilled" ? results[1].value.data || [] : []);
    setSummary(results[2].status === "fulfilled" ? results[2].value.data || {} : {});
    if (results.every((r) => r.status !== "fulfilled")) {
      setError("Income and expenditure data could not be loaded from the server.");
    }
    setLoading(false);
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    const dayIncome = new Map();
    const dayExpense = new Map();
    const entries = [];

    const addEntry = (day, type, amount, raw) => {
      const key = String(day || "").slice(0, 10);
      if (!key || !Number.isFinite(amount)) return;
      entries.push({ day: key, type, amount, raw });
      if (type === "income") dayIncome.set(key, (dayIncome.get(key) || 0) + amount);
      else dayExpense.set(key, (dayExpense.get(key) || 0) + amount);
    };

    ledger.forEach((row) => {
      const type = String(pickText(row, TYPE_KEYS)).toLowerCase();
      const isIncome = type.includes("income") || type.includes("revenue") || type === "credit";
      addEntry(
        pickText(row, DAY_KEYS),
        isIncome ? "income" : "expense",
        pickNumber(row, TOTAL_KEYS),
        row,
      );
    });

    payments.forEach((row) => {
      const paymentType = String(pickText(row, ["payment_type", "paymentType"])).toLowerCase();
      const isRefund = paymentType.includes("refund");
      addEntry(
        pickText(row, DAY_KEYS),
        isRefund ? "expense" : "income",
        pickNumber(row, TOTAL_KEYS),
        row,
      );
    });

    const days = [...new Set([...dayIncome.keys(), ...dayExpense.keys()])].sort();
    let income = 0;
    let expense = 0;
    const daily = days.map((day) => {
      income += dayIncome.get(day) || 0;
      expense += dayExpense.get(day) || 0;
      return { day, income: dayIncome.get(day) || 0, expense: dayExpense.get(day) || 0 };
    });

    if (!days.length) {
      income = pickNumber(summary, ["income"]);
      expense = pickNumber(summary, ["expense"]);
    }

    return { daily, income, expense, net: income - expense, entries };
  }, [ledger, payments, summary]);

  const showLedger = rows.daily.length === 0 && rows.entries.length > 0;
  const ledgerTotal = rows.entries.reduce((sum, row) => sum + row.amount, 0);

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
            <FaBalanceScale size={15} /> Finance Report
          </div>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Income vs Expenditure</h1>
          <p className="mt-1 text-sm text-slate-500">
            Every ledger entry and collected payment inside the selected window.
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card icon={<FaArrowUp size={18} />} label="Total Income" value={formatINR(rows.income)} tone="emerald" />
        <Card icon={<FaArrowDown size={18} />} label="Total Expenditure" value={formatINR(rows.expense)} tone="rose" />
        <Card icon={<FaCoins size={18} />} label="Net Position" value={formatINR(rows.net)} tone="cyan" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-bold text-slate-800">Daily breakdown</h2>
          <p className="text-[12px] text-slate-400">{rows.daily.length} day(s) in range</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-[12px] font-bold uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Income</th>
                <th className="px-4 py-3 text-right">Expenditure</th>
                <th className="px-4 py-3 text-right">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.daily.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-sm font-semibold text-slate-400">
                    No income or expenditure recorded in this window.
                  </td>
                </tr>
              ) : (
                rows.daily.map((row) => (
                  <tr key={row.day} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-semibold text-slate-700">{formatDay(row.day)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-600">{formatINR(row.income)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-rose-600">{formatINR(row.expense)}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800">{formatINR(row.income - row.expense)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {rows.daily.length > 0 ? (
              <tfoot className="bg-slate-50 text-sm font-bold text-slate-800">
                <tr>
                  <td className="px-4 py-3">Total</td>
                  <td className="px-4 py-3 text-right">{formatINR(rows.income)}</td>
                  <td className="px-4 py-3 text-right">{formatINR(rows.expense)}</td>
                  <td className="px-4 py-3 text-right">{formatINR(rows.net)}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </div>

      {showLedger ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-bold text-slate-800">Ledger entries</h2>
            <p className="text-[12px] text-slate-400">
              Daily roll-up unavailable; showing raw entries totalling {formatINR(ledgerTotal)}.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[12px] font-bold uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.entries.slice(0, 200).map((row, index) => (
                  <tr key={`${row.day}-${index}`} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <span className={`rounded-lg px-2 py-1 text-[11px] font-bold uppercase ${row.type === "income" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                        {row.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{pickText(row.raw, DESC_KEYS) || "--"}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDay(row.day)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatINR(row.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {loading ? <div className="text-center text-sm font-semibold text-slate-400">Loading report...</div> : null}
    </div>
  );
}
