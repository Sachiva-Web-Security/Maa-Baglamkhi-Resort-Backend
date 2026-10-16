import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FaCalendarAlt,
  FaChartPie,
  FaChartLine,
  FaSyncAlt,
  FaFileAlt,
  FaMoneyBillWave,
  FaStore,
  FaUtensils,
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

const TOTAL_KEYS = ["total", "amount", "grand_total", "net_amount", "bill_total", "total_amount"];
const DAY_KEYS = ["date", "invoice_date", "created_at", "transaction_date", "entry_date", "billing_date", "day"];
const REF_KEYS = ["invoice_no", "invoiceNumber", "booking_id", "bookingId", "reference", "booking_code"];
const STATUS_KEYS = ["status", "payment_status", "invoiceStatus", "paymentStatus"];

function Card({ icon, label, value, note, tone }) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    cyan: "bg-cyan-50 text-cyan-700 ring-cyan-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    violet: "bg-violet-50 text-violet-700 ring-violet-200",
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
  if (["paid", "settled", "completed", "issued"].some((word) => text.includes(word))) return "bg-emerald-50 text-emerald-700";
  if (["partial"].some((word) => text.includes(word))) return "bg-amber-50 text-amber-700";
  if (["unpaid", "pending", "due"].some((word) => text.includes(word))) return "bg-rose-50 text-rose-700";
  return "bg-slate-100 text-slate-600";
}

const barTones = ["bg-cyan-500", "bg-emerald-500", "bg-amber-500", "bg-violet-500", "bg-sky-500", "bg-rose-400"];

export default function SalesReport() {
  const [from, setFrom] = useState(startOfMonthISO());
  const [to, setTo] = useState(endOfMonthISO());
  const [invoices, setInvoices] = useState([]);
  const [bills, setBills] = useState([]);
  const [banquets, setBanquets] = useState([]);
  const [department, setDepartment] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = from || to ? { from, to } : {};
    const results = await Promise.allSettled([
      API.get("/invoices/all", { params }),
      API.get("/restaurant/bills", { params }),
      API.get("/banquet", { params }),
      API.get("/accounts/department-summary", { params }),
    ]);
    const toArray = (value) => (Array.isArray(value) ? value : value?.data || value?.rows || []);
    setInvoices(results[0].status === "fulfilled" ? toArray(results[0].value.data) : []);
    setBills(results[1].status === "fulfilled" ? toArray(results[1].value.data) : []);
    setBanquets(results[2].status === "fulfilled" ? toArray(results[2].value.data) : []);
    setDepartment(results[3].status === "fulfilled" ? results[3].value.data || {} : {});
    if (results.every((r) => r.status !== "fulfilled")) {
      setError("Sales data could not be loaded from the server.");
    }
    setLoading(false);
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const sales = useMemo(() => {
    const rows = [];
    const inWindow = (day) => {
      if (!day) return true;
      if (from && day < from) return false;
      if (to && day > to) return false;
      return true;
    };
    const add = (row, departmentName, statusKeys) => {
      const amount = pickNumber(row, TOTAL_KEYS);
      if (!Number.isFinite(amount) || amount <= 0) return;
      const day = String(pickText(row, DAY_KEYS) || "").slice(0, 10);
      if (!inWindow(day)) return;
      rows.push({
        day,
        amount,
        department: departmentName,
        reference: pickText(row, REF_KEYS) || "--",
        status: pickText(row, statusKeys || STATUS_KEYS) || "--",
        customer: pickText(row, ["customer_name", "customerName", "name", "guest_name", "booking_code"]) || "--",
      });
    };

    invoices.forEach((row) => add(row, "Hotel / Front Office"));
    bills.forEach((row) => add(row, "Restaurant"));
    banquets.forEach((row) => add(row, "Banquet"));

    const total = rows.reduce((sum, row) => sum + row.amount, 0);
    const byDepartment = new Map();
    const byDay = new Map();
    rows.forEach((row) => {
      byDepartment.set(row.department, (byDepartment.get(row.department) || 0) + row.amount);
      byDay.set(row.day || "undated", (byDay.get(row.day || "undated") || 0) + row.amount);
    });

    const departments = [...byDepartment.entries()]
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
    const days = [...byDay.entries()]
      .map(([day, amount]) => ({ day, amount }))
      .sort((a, b) => a.day.localeCompare(b.day))
      .slice(-31);

    const collected = rows.reduce((sum, row) => {
      const status = row.status.toLowerCase();
      if (["paid", "settled", "completed", "issued"].some((word) => status.includes(word))) return sum + row.amount;
      return sum;
    }, 0);
    const outstanding = total - collected;

    return { rows, total, departments, days, collected, outstanding };
  }, [invoices, bills, banquets, from, to]);

  const maxDepartment = Math.max(1, ...sales.departments.map((row) => row.amount));
  const maxDay = Math.max(1, ...sales.days.map((row) => row.amount));
  const collectionRate = sales.total > 0 ? Math.round((sales.collected / sales.total) * 100) : 0;

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
            <FaStore size={15} /> Sales Report
          </div>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Sales by Department</h1>
          <p className="mt-1 text-sm text-slate-500">Billed revenue across the front office, restaurant and banquet.</p>
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
        <Card icon={<FaMoneyBillWave size={18} />} label="Total Billed" value={formatINR(sales.total)} note={`${sales.rows.length} bill${sales.rows.length === 1 ? "" : "s"}`} tone="emerald" />
        <Card icon={<FaChartLine size={18} />} label="Collected" value={formatINR(sales.collected)} note={`${collectionRate}% of billed`} tone="cyan" />
        <Card icon={<FaFileAlt size={18} />} label="Outstanding" value={formatINR(sales.outstanding)} note="Balance yet to be paid" tone="amber" />
        <Card icon={<FaUtensils size={18} />} label="Active Departments" value={sales.departments.length} note="Reporting in this window" tone="violet" />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800"><FaChartPie size={13} /> Department share</h2>
            <p className="text-[12px] text-slate-400">Billed revenue split by department</p>
          </div>
          <div className="divide-y divide-slate-100">
            {sales.departments.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm font-semibold text-slate-400">No sales recorded in this window.</div>
            ) : (
              sales.departments.map((row, index) => (
                <div key={row.name} className="px-4 py-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-700">{row.name}</span>
                    <span className="font-bold text-slate-800">
                      {formatINR(row.amount)}
                      <span className="ml-2 text-[12px] font-semibold text-slate-400">{sales.total ? Math.round((row.amount / sales.total) * 100) : 0}%</span>
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${barTones[index % barTones.length]}`} style={{ width: `${(row.amount / maxDepartment) * 100}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800"><FaChartLine size={13} /> Sales per day</h2>
            <p className="text-[12px] text-slate-400">Last 31 days in the selected window</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[12px] font-bold uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Billed</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sales.days.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-sm font-semibold text-slate-400">No sales recorded in this window.</td>
                  </tr>
                ) : (
                  sales.days.map((row) => (
                    <tr key={row.day} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-semibold text-slate-700">{row.day === "undated" ? "Undated" : formatDay(row.day)}</td>
                      <td className="px-4 py-3">
                        <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-cyan-500" style={{ width: `${(row.amount / maxDay) * 100}%` }} />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800">{formatINR(row.amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-bold text-slate-800">Sales lines</h2>
          <p className="text-[12px] text-slate-400">Showing {Math.min(250, sales.rows.length)} of {sales.rows.length} bill(s)</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-[12px] font-bold uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sales.rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm font-semibold text-slate-400">No sales recorded in this window.</td>
                </tr>
              ) : (
                sales.rows.slice(0, 250).map((row, index) => (
                  <tr key={`${row.day}-${index}`} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-semibold text-slate-700">{row.day ? formatDay(row.day) : "--"}</td>
                    <td className="px-4 py-3 text-slate-600">{row.department}</td>
                    <td className="px-4 py-3 text-slate-600">{row.reference}</td>
                    <td className="px-4 py-3 text-slate-600">{row.customer}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-lg px-2 py-1 text-[11px] font-bold uppercase ${statusTone(row.status)}`}>{row.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800">{formatINR(row.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {sales.rows.length > 0 ? (
              <tfoot className="bg-slate-50 text-sm font-bold text-slate-800">
                <tr>
                  <td className="px-4 py-3" colSpan={5}>Total billed</td>
                  <td className="px-4 py-3 text-right">{formatINR(sales.total)}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </div>

      {loading ? <div className="text-center text-sm font-semibold text-slate-400">Loading sales report...</div> : null}
    </div>
  );
}
