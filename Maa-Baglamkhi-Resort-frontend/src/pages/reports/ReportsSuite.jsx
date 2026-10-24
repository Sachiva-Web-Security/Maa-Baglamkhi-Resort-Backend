import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FaCalendarAlt,
  FaChartBar,
  FaDownload,
  FaFileAlt,
  FaHotel,
  FaMoneyBillWave,
  FaPrint,
  FaSyncAlt,
  FaUserFriends,
} from "react-icons/fa";
import API from "../../api";
import { formatINR, todayISO } from "./reportUtils";

// The 19 reports, each mapped to its /api/reports-suite/<key> endpoint.
const REPORTS = [
  { key: "mis", label: "MIS Report", note: "Money across every department", icon: FaChartBar },
  { key: "invoice-register", label: "Invoice Register", note: "All invoices and booking charges", icon: FaFileAlt },
  { key: "service-wise", label: "Service-wise Report", note: "Revenue by service line", icon: FaChartBar },
  { key: "room-occupancy", label: "Room Occupancy", note: "Nights and % per room", icon: FaHotel },
  { key: "rooms-all", label: "All Rooms Summary", note: "Live status of every room", icon: FaHotel },
  { key: "rooms-checkin", label: "Check-in Room Summary", note: "Rooms handed over in the period", icon: FaHotel },
  { key: "rooms-checkout", label: "Check-out Room Summary", note: "Rooms picked up in the period", icon: FaHotel },
  { key: "company-ledger", label: "Company Ledger", note: "Transactions and two-leg entries", icon: FaMoneyBillWave },
  { key: "room-history", label: "Room History", note: "Every booking per room", icon: FaHotel },
  { key: "room-performance", label: "Room Performance", note: "Revenue and rate per room", icon: FaHotel },
  { key: "guest-list-police", label: "Guest List (Police)", note: "In-house + recently checked-out", icon: FaUserFriends },
  { key: "housekeeping-history", label: "Housekeeping History", note: "Room-by-room cleaning log", icon: FaPrint },
  { key: "maintenance-history", label: "Maintenance History", note: "Requests, status and cost", icon: FaPrint },
  { key: "general-ledger", label: "General Ledger", note: "Chart of accounts with period activity", icon: FaMoneyBillWave },
  { key: "cashbook-summary", label: "Cashbook Summary", note: "Payments by channel and day", icon: FaMoneyBillWave },
  { key: "night-audit", label: "Night Audit", note: "Closing snapshot by department", icon: FaMoneyBillWave },
  { key: "cash-summary", label: "Cash Summary", note: "Petty cash and cash receipts", icon: FaMoneyBillWave },
  { key: "refund-collection", label: "Refund Collection", note: "Refunded payments and cancelled bookings", icon: FaMoneyBillWave },
  { key: "stock-summary", label: "Current Stock Summary", note: "On-hand quantities and value", icon: FaChartBar },
];

const isoDate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

function DateControls({ from, to, onFrom, onTo, onReload, disabled }) {
  const presets = [
    ["today", () => { onFrom(todayISO()); onTo(todayISO()); }],
    ["month", () => { const d = new Date(); onFrom(isoDate(new Date(d.getFullYear(), d.getMonth(), 1))); onTo(todayISO()); }],
    ["30d", () => { const d = new Date(); d.setDate(d.getDate() - 29); onFrom(isoDate(d)); onTo(todayISO()); }],
  ];
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-[12px] font-bold uppercase tracking-wide text-slate-400">
        <span className="flex items-center gap-1"><FaCalendarAlt size={12} /> From</span>
        <input type="date" value={from} onChange={(e) => onFrom(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700" />
      </label>
      <label className="flex flex-col gap-1 text-[12px] font-bold uppercase tracking-wide text-slate-400">
        <span>To</span>
        <input type="date" value={to} onChange={(e) => onTo(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700" />
      </label>
      <div className="flex gap-1">
        {presets.map(([label, fn]) => (
          <button key={label} type="button" onClick={fn} disabled={disabled} className="rounded-xl border border-slate-300 px-3 py-2 text-[12px] font-bold uppercase tracking-wide text-slate-600 hover:bg-slate-50 disabled:opacity-40">
            {label === "30d" ? "Last 30d" : label}
          </button>
        ))}
      </div>
      <button type="button" onClick={onReload} disabled={disabled} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
        <FaSyncAlt size={13} /> Load
      </button>
    </div>
  );
}

function ReportTable({ columns, rows, summary }) {
  return (
    <div className="space-y-3">
      {summary && Object.keys(summary).length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {Object.entries(summary).map(([k, v]) => (
            <div key={k} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{k.replace(/_/g, " ")}</div>
              <div className="text-sm font-bold text-slate-800">{typeof v === "number" ? formatINR(v) : String(v)}</div>
            </div>
          ))}
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        {rows.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm font-semibold text-slate-400">No rows in this window.</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr>{columns.map((c) => <th key={c} className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">{c}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-t border-slate-100">
                  {columns.map((c) => (
                    <td key={c} className="px-3 py-2 text-slate-700">{row[c] === null || row[c] === undefined || row[c] === "" ? <span className="text-slate-300">—</span> : row[c]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function ReportsSuite() {
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 29); return isoDate(d); });
  const [to, setTo] = useState(todayISO());
  const [reportKey, setReportKey] = useState("mis");
  const [columns, setColumns] = useState([]);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  const current = useMemo(() => REPORTS.find((r) => r.key === reportKey) || REPORTS[0], [reportKey]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (from) params.from = from;
      if (to) params.to = to;
      const res = await API.get(`/reports-suite/${reportKey}`, { params });
      const data = res.data || {};
      setColumns(data.columns || []);
      setRows(data.rows || []);
      setSummary(data.summary || null);
    } catch (err) {
      setError(err?.response?.data?.message || "Report could not be loaded.");
    }
    setLoading(false);
  }, [reportKey, from, to]);

  useEffect(() => { load(); }, [load]);

  const downloadNow = async () => {
    setDownloading(true);
    try {
      const params = { format: "csv" };
      if (from) params.from = from;
      if (to) params.to = to;
      const res = await API.get(`/reports-suite/${reportKey}`, { params, responseType: "blob" });
      const blob = res.data;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${reportKey}_${from || "all"}_${to || "all"}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError("CSV download failed.");
    }
    setDownloading(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.16em] text-emerald-600">
              <FaChartBar size={14} /> Reports Suite
            </div>
            <h1 className="mt-1 text-xl font-bold text-slate-900">{current.label}</h1>
            <p className="text-sm text-slate-500">{current.note}</p>
          </div>
          <button
            type="button"
            onClick={downloadNow}
            disabled={!csvText}
            className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            <FaDownload size={13} /> Download CSV
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap gap-1.5">
            {REPORTS.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => { setReportKey(r.key); setCsvText(""); }}
                className={`rounded-lg px-3 py-1.5 text-[12px] font-bold tracking-wide transition ${reportKey === r.key ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <DateControls from={from} to={to} onFrom={setFrom} onTo={setTo} onReload={load} disabled={loading} />
        </div>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm font-semibold text-slate-400">Loading {current.label}…</div>
        ) : error ? (
          <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            <FaFileAlt size={15} /> {error}
          </div>
        ) : (
          <ReportTable columns={columns} rows={rows} summary={summary} />
        )}
      </div>
    </div>
  );
}
