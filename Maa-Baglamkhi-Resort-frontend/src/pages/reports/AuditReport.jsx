import React, { useEffect, useMemo, useState } from "react";
import {
  FaCalendarAlt,
  FaCheckCircle,
  FaChevronDown,
  FaExclamationTriangle,
  FaFilter,
  FaHistory,
  FaSearch,
  FaShieldAlt,
  FaSyncAlt,
  FaUserShield,
} from "react-icons/fa";
import API from "../../api";

const ACTION_OPTIONS = ["", "login", "login_failed", "create", "update", "delete", "update_profile", "update_profile_avatar", "change_password", "update_user", "delete_user"];
const STATUS_OPTIONS = ["", "200", "201", "204", "304", "400", "401", "403", "404", "500"];

function getStatusTone(statusCode) {
  const numericStatus = Number(statusCode);

  if (numericStatus >= 200 && numericStatus < 400) {
    return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  }

  if (numericStatus >= 400 && numericStatus < 500) {
    return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
  }

  return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
}

function formatDateTime(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatJsonInline(value) {
  if (!value || (typeof value === "object" && !Object.keys(value).length)) {
    return "--";
  }

  const text = JSON.stringify(value);
  if (!text) return "--";
  return text.length > 140 ? `${text.slice(0, 140)}...` : text;
}

function formatJsonPreview(value) {
  if (!value || typeof value !== "object" || !Object.keys(value).length) {
    return "--";
  }

  const keys = Object.keys(value).slice(0, 2);
  if (!keys.length) return "--";

  return `${keys.join(", ")} ...`;
}

function ExpandableJsonCell({ value }) {
  if (!value || (typeof value === "object" && !Object.keys(value).length)) {
    return <span className="text-[16px] text-slate-400">--</span>;
  }

  return (
    <details className="group max-w-[240px] rounded-xl sm:rounded-2xl border border-slate-200 bg-slate-50/80 transition-colors duration-300 open:border-sky-300 open:bg-sky-50/60">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-[15px] font-bold text-slate-700 [&::-webkit-details-marker]:hidden">
        <span className="truncate">{formatJsonPreview(value)}</span>
        <FaChevronDown className="shrink-0 text-xs text-slate-400 transition-transform duration-300 group-open:rotate-180" />
      </summary>
      <div className="border-t border-slate-200/80 px-3 py-2">
        <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs font-medium leading-6 text-slate-600">
          {JSON.stringify(value, null, 2)}
        </pre>
      </div>
    </details>
  );
}

function ExpandableJsonBlock({ label, value }) {
  const hasValue = value && (typeof value !== "object" || Object.keys(value).length);

  return (
    <details className="group rounded-xl border border-slate-200 bg-slate-50/80 transition-colors duration-300 open:border-sky-300 open:bg-sky-50/60">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-[13px] font-bold uppercase tracking-wide text-slate-500 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          {label}
          {!hasValue ? <span className="text-[13px] font-medium normal-case text-slate-400">--</span> : null}
        </span>
        {hasValue ? (
          <FaChevronDown className="shrink-0 text-xs text-slate-400 transition-transform duration-300 group-open:rotate-180" />
        ) : null}
      </summary>
      {hasValue ? (
        <div className="border-t border-slate-200/80 px-3 py-2">
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs font-medium leading-6 text-slate-600">
            {JSON.stringify(value, null, 2)}
          </pre>
        </div>
      ) : null}
    </details>
  );
}

function AuditLogCard({ log }) {
  const statusTone = getStatusTone(log.response_status);

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.25)] transition-all duration-300 active:scale-[0.99]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-bold uppercase tracking-[0.14em] text-slate-400">Log #{log.id}</div>
          <div className="mt-1 truncate text-[16px] font-bold text-slate-900">
            {log.user_name || `User #${log.user_id || "--"}`}
          </div>
          <div className="mt-0.5 truncate text-[14px] font-medium text-slate-500">{log.user_email || "--"}</div>
        </div>
        <span className={`inline-flex shrink-0 rounded-full px-3 py-1 text-[14px] font-bold ${statusTone}`}>
          {log.response_status}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex rounded-full bg-sky-50 px-3 py-1 text-[14px] font-bold text-sky-700 ring-1 ring-sky-200">
          {log.action}
        </span>
        <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-[14px] font-bold uppercase text-slate-600 ring-1 ring-slate-200">
          {log.http_method}
        </span>
      </div>

      <div className="mt-3 space-y-1.5 rounded-xl bg-slate-50/80 p-3">
        <div className="flex items-start justify-between gap-3 text-[14px]">
          <span className="shrink-0 font-bold text-slate-400">Endpoint</span>
          <span className="break-all text-right font-medium text-slate-700">{log.endpoint || "--"}</span>
        </div>
        <div className="flex items-center justify-between gap-3 text-[14px]">
          <span className="shrink-0 font-bold text-slate-400">IP</span>
          <span className="font-medium text-slate-700">{log.ip_address || "--"}</span>
        </div>
        <div className="flex items-center justify-between gap-3 text-[14px]">
          <span className="shrink-0 font-bold text-slate-400">Timestamp</span>
          <span className="font-medium text-slate-700">{formatDateTime(log.created_at)}</span>
        </div>
      </div>

      <div className="mt-3 grid gap-2">
        <ExpandableJsonBlock label="Request Data" value={log.request_data} />
        <ExpandableJsonBlock label="Old Value" value={log.old_value} />
        <ExpandableJsonBlock label="New Value" value={log.new_value} />
      </div>
    </div>
  );
}

export default function AuditReport() {
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    successCount: 0,
    errorCount: 0,
    uniqueUsers: 0,
  });
  const [liveSummary, setLiveSummary] = useState({
    total: 0,
    successCount: 0,
    errorCount: 0,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 1,
  });
  const [filters, setFilters] = useState({
    search: "",
    action: "",
    status: "",
    dateFrom: "",
    dateTo: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadLogs = async (page = pagination.page) => {
    try {
      setLoading(true);
      setError("");

      const res = await API.get("/audit-logs", {
        params: {
          ...filters,
          page,
          limit: pagination.limit,
        },
      });

      setLogs(Array.isArray(res.data?.rows) ? res.data.rows : []);
      setSummary(res.data?.summary || { total: 0, successCount: 0, errorCount: 0, uniqueUsers: 0 });
      setLiveSummary(res.data?.liveSummary || { total: 0, successCount: 0, errorCount: 0 });
      setPagination((current) => ({
        ...current,
        ...(res.data?.pagination || {}),
      }));
    } catch (err) {
      setError(err.response?.data?.message || "Audit logs could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs(1);
  }, []);

  const successRate = useMemo(() => {
    if (!liveSummary.total) return "100%";
    return `${Math.round((liveSummary.successCount / liveSummary.total) * 100)}%`;
  }, [liveSummary]);

  const handleFilterChange = (key, value) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const applyFilters = () => {
    loadLogs(1);
  };

  const clearFilters = () => {
    const next = {
      search: "",
      action: "",
      status: "",
      dateFrom: "",
      dateTo: "",
    };
    setFilters(next);
    setPagination((current) => ({ ...current, page: 1 }));
    setTimeout(() => {
      loadLogs(1);
    }, 0);
  };

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-slate-50 font-['Inter',sans-serif] px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8 2xl:px-12">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-blue-400/10 blur-3xl" />
        <div className="absolute -right-24 top-1/4 h-96 w-96 rounded-full bg-sky-400/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />
      </div>

      <div className="w-full max-w-none space-y-6 lg:space-y-8">
        {/* HERO */}
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(120deg,#0c1e3d_0%,#1d4ed8_55%,#38bdf8_120%)] p-4 sm:p-6 lg:p-8 shadow-[0_20px_60px_-15px_rgba(29,78,216,0.45)]">
          {/* decorative blobs */}
          <div className="pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -right-10 bottom-0 h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 opacity-[0.07] bg-[linear-gradient(rgba(255,255,255,0.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.4)_1px,transparent_1px)] bg-[size:56px_56px]" />

          <div className="relative grid gap-6 lg:gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(340px,1fr)] lg:items-end">
            <div className="space-y-3 sm:space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs sm:text-sm md:text-[14px] font-bold uppercase tracking-[0.28em] text-cyan-100 ring-1 ring-white/15 backdrop-blur-sm">
                <FaShieldAlt className="text-cyan-200" />
                Security And Compliance
              </div>
              <div className="space-y-2 sm:space-y-2.5">
                <h1 className="text-[26px] sm:text-[32px] md:text-[36px] lg:text-[40px] font-black leading-tight text-white">
                  Audit log dashboard
                </h1>
                
              </div>
              <button
                type="button"
                onClick={() => loadLogs(pagination.page)}
                className="group inline-flex items-center gap-2 rounded-xl sm:rounded-2xl bg-white px-5 py-3 sm:py-3.5 text-sm sm:text-[16px] font-bold text-blue-900 shadow-[0_10px_30px_-8px_rgba(255,255,255,0.5)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_36px_-8px_rgba(255,255,255,0.65)] active:translate-y-0"
              >
                <FaSyncAlt className={`text-sky-600 transition-transform duration-500 ${loading ? "animate-spin" : "group-hover:rotate-180"}`} />
                Refresh Logs
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Total Events", value: summary.total, icon: FaHistory, tone: "text-white", ring: "ring-white/15", bg: "bg-white/10" },
                { label: "Success", value: summary.successCount, icon: FaCheckCircle, tone: "text-emerald-100", ring: "ring-emerald-300/25", bg: "bg-emerald-400/15" },
                { label: "Errors", value: summary.errorCount, icon: FaExclamationTriangle, tone: "text-rose-100", ring: "ring-rose-300/25", bg: "bg-rose-400/15" },
                { label: "Unique Users", value: summary.uniqueUsers, icon: FaUserShield, tone: "text-cyan-100", ring: "ring-cyan-300/25", bg: "bg-cyan-400/15" },
              ].map((item) => (
                <div
                  key={item.label}
                  className={`flex h-full flex-col justify-between rounded-xl sm:rounded-2xl px-4 py-4 backdrop-blur-md ring-1 transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.14] ${item.bg} ${item.ring}`}
                >
                  <div className={`flex items-center gap-2 text-xs sm:text-sm md:text-[16px] font-medium opacity-80 ${item.tone}`}>
                    <item.icon className="text-sm sm:text-base md:text-lg" />
                    {item.label}
                  </div>
                  <div className={`mt-3 text-[26px] sm:text-[30px] md:text-[34px] lg:text-[42px] font-bold ${item.tone}`}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FILTERS + SNAPSHOT */}
        <section className="grid gap-4 lg:gap-6 xl:grid-cols-2">
          <div className="flex h-full flex-col rounded-3xl border border-slate-200/70 bg-white/80 p-4 sm:p-6 lg:p-8 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.15)] backdrop-blur-xl transition-shadow duration-300 hover:shadow-[0_24px_60px_-24px_rgba(15,23,42,0.2)]">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs sm:text-sm md:text-[16px] font-bold uppercase tracking-[0.24em] text-emerald-600">
                  Filters
                </p>
                <h2 className="mt-1 text-xl sm:text-2xl md:text-[28px] lg:text-[34px] font-black text-slate-900">Search audit events</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white px-5 py-3 sm:py-3.5 text-sm sm:text-[16px] font-bold text-slate-700 shadow-sm transition-all duration-300 hover:border-slate-300 hover:bg-slate-50 hover:-translate-y-0.5"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={applyFilters}
                  className="inline-flex items-center gap-2 rounded-xl sm:rounded-2xl bg-gradient-to-r from-blue-700 via-blue-600 to-sky-500 px-5 py-3 sm:py-3.5 text-sm sm:text-[16px] font-bold text-white shadow-[0_12px_28px_-10px_rgba(37,99,235,0.6)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_34px_-10px_rgba(37,99,235,0.75)]"
                >
                  <FaFilter className="text-xs" />
                  Apply Filters
                </button>
              </div>
            </div>

            <div className="grid flex-1 gap-3 sm:grid-cols-2 2xl:grid-cols-5">
              <label className="flex h-11 sm:h-13 md:h-14 items-center gap-2.5 rounded-xl sm:rounded-2xl border border-slate-200 bg-white px-4 text-sm sm:text-[16px] font-medium text-slate-700 shadow-sm transition-all duration-300 focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-100 sm:col-span-2 2xl:col-span-2">
                <FaSearch className="shrink-0 text-sky-500" />
                <input
                  value={filters.search}
                  onChange={(e) => handleFilterChange("search", e.target.value)}
                  placeholder="Search action, endpoint, user"
                  className="w-full bg-transparent text-sm sm:text-[16px] font-medium text-slate-800 outline-none placeholder:text-slate-400"
                />
              </label>

              <select
                value={filters.action}
                onChange={(e) => handleFilterChange("action", e.target.value)}
                className="h-11 sm:h-13 md:h-14 rounded-xl sm:rounded-2xl border border-slate-200 bg-white px-4 text-sm sm:text-[16px] font-medium text-slate-700 shadow-sm outline-none transition-all duration-300 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              >
                <option value="">All actions</option>
                {ACTION_OPTIONS.filter(Boolean).map((action) => (
                  <option key={action} value={action}>{action}</option>
                ))}
              </select>

              <select
                value={filters.status}
                onChange={(e) => handleFilterChange("status", e.target.value)}
                className="h-11 sm:h-13 md:h-14 rounded-xl sm:rounded-2xl border border-slate-200 bg-white px-4 text-sm sm:text-[16px] font-medium text-slate-700 shadow-sm outline-none transition-all duration-300 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              >
                <option value="">All status</option>
                {STATUS_OPTIONS.filter(Boolean).map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>

              <div className="grid gap-3 sm:grid-cols-2 sm:col-span-2 2xl:col-span-5">
                <label className="flex h-11 sm:h-13 md:h-14 items-center gap-2.5 rounded-xl sm:rounded-2xl border border-slate-200 bg-white px-4 text-sm sm:text-[16px] font-medium text-slate-700 shadow-sm transition-all duration-300 focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-100">
                  <FaCalendarAlt className="shrink-0 text-sky-500" />
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
                    className="w-full bg-transparent text-sm sm:text-[16px] font-medium text-slate-800 outline-none"
                  />
                </label>
                <label className="flex h-11 sm:h-13 md:h-14 items-center gap-2.5 rounded-xl sm:rounded-2xl border border-slate-200 bg-white px-4 text-sm sm:text-[16px] font-medium text-slate-700 shadow-sm transition-all duration-300 focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-100">
                  <FaCalendarAlt className="shrink-0 text-sky-500" />
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => handleFilterChange("dateTo", e.target.value)}
                    className="w-full bg-transparent text-sm sm:text-[16px] font-medium text-slate-800 outline-none"
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="h-full rounded-3xl border border-slate-200/70 bg-white/80 p-4 sm:p-6 lg:p-8 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.15)] backdrop-blur-xl transition-shadow duration-300 hover:shadow-[0_24px_60px_-24px_rgba(15,23,42,0.2)]">
            <div className="flex h-full flex-col gap-4">
              <div>
                <p className="text-xs sm:text-sm md:text-[16px] font-bold uppercase tracking-[0.24em] text-amber-500">
                  Snapshot
                </p>
                <h2 className="mt-1 text-xl sm:text-2xl md:text-[28px] lg:text-[34px] font-black text-slate-900">Live audit health</h2>
              </div>
              <div className="grid flex-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                <div className="flex h-full flex-col justify-between rounded-2xl border border-emerald-200/70 bg-emerald-50/80 p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <FaCheckCircle />
                    <span className="text-sm sm:text-[16px] font-medium">Success rate</span>
                  </div>
                  <div className="mt-3 text-[26px] sm:text-[30px] md:text-[34px] lg:text-[42px] font-bold leading-none text-emerald-700">{successRate}</div>
                </div>
                <div className="flex h-full flex-col justify-between rounded-2xl border border-rose-200/70 bg-rose-50/80 p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                  <div className="flex items-center gap-2 text-rose-700">
                    <FaExclamationTriangle />
                    <span className="text-sm sm:text-[16px] font-medium">Failed calls</span>
                  </div>
                  <div className="mt-3 text-[26px] sm:text-[30px] md:text-[34px] lg:text-[42px] font-bold leading-none text-rose-700">{liveSummary.errorCount}</div>
                  <div className="mt-2 text-sm sm:text-[16px] leading-7 text-rose-700/80">
                   Unresolved failures based on the latest endpoint state
                  </div>
                </div>
                <div className="flex h-full flex-col justify-between rounded-2xl border border-cyan-200/70 bg-cyan-50/80 p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                  <div className="flex items-center gap-2 text-cyan-700">
                    <FaUserShield />
                    <span className="text-sm sm:text-[16px] font-medium">Traced users</span>
                  </div>
                  <div className="mt-3 text-[26px] sm:text-[30px] md:text-[34px] lg:text-[42px] font-bold leading-none text-cyan-700">{summary.uniqueUsers}</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50/90 px-5 py-4 text-sm sm:text-[16px] font-medium text-rose-700 shadow-sm">
            {error}
          </div>
        ) : null}

        {/* TABLE / CARDS */}
        <section className="space-y-4 lg:space-y-6">
          {loading ? (
            <div className="flex items-center justify-center rounded-3xl border border-slate-200/70 bg-white/85 py-20 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.15)] backdrop-blur-xl">
              <div className="text-center">
                <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-sky-100 border-t-sky-600" />
                <p className="mt-4 text-sm sm:text-[16px] font-medium text-slate-500">Loading audit logs...</p>
              </div>
            </div>
          ) : logs.length ? (
            <>
              {/* Mobile: card list (phone only) */}
              <div className="grid grid-cols-1 gap-3 sm:hidden">
                {logs.map((log) => (
                  <AuditLogCard key={log.id} log={log} />
                ))}
              </div>

              {/* Tablet/Desktop: table */}
              <div className="hidden overflow-hidden rounded-3xl border border-slate-200/70 bg-white/90 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.15)] backdrop-blur-xl sm:block">
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="sticky top-0 z-10 bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)]">
                      <tr>
                        <th className="whitespace-nowrap px-4 py-3.5 text-left text-[15px] uppercase tracking-[0.16em] font-bold text-slate-500">Log ID</th>
                        <th className="whitespace-nowrap px-4 py-3.5 text-left text-[15px] uppercase tracking-[0.16em] font-bold text-slate-500">User</th>
                        <th className="whitespace-nowrap px-4 py-3.5 text-left text-[15px] uppercase tracking-[0.16em] font-bold text-slate-500">Action</th>
                        <th className="whitespace-nowrap px-4 py-3.5 text-left text-[15px] uppercase tracking-[0.16em] font-bold text-slate-500">Endpoint</th>
                        <th className="whitespace-nowrap px-4 py-3.5 text-left text-[15px] uppercase tracking-[0.16em] font-bold text-slate-500">Method</th>
                        <th className="whitespace-nowrap px-4 py-3.5 text-left text-[15px] uppercase tracking-[0.16em] font-bold text-slate-500">Status</th>
                        <th className="whitespace-nowrap px-4 py-3.5 text-left text-[15px] uppercase tracking-[0.16em] font-bold text-slate-500">IP</th>
                        <th className="whitespace-nowrap px-4 py-3.5 text-left text-[15px] uppercase tracking-[0.16em] font-bold text-slate-500">Request Data</th>
                        <th className="whitespace-nowrap px-4 py-3.5 text-left text-[15px] uppercase tracking-[0.16em] font-bold text-slate-500">Old Value</th>
                        <th className="whitespace-nowrap px-4 py-3.5 text-left text-[15px] uppercase tracking-[0.16em] font-bold text-slate-500">New Value</th>
                        <th className="whitespace-nowrap px-4 py-3.5 text-left text-[15px] uppercase tracking-[0.16em] font-bold text-slate-500">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {logs.map((log, idx) => {
                        const statusTone = getStatusTone(log.response_status);
                        return (
                          <tr
                            key={log.id}
                            className={`align-top transition-colors duration-200 hover:bg-sky-50/60 ${idx % 2 === 1 ? "bg-slate-50/50" : "bg-transparent"}`}
                          >
                            <td className="whitespace-nowrap px-4 py-4 text-[16px] font-bold text-slate-900">#{log.id}</td>
                            <td className="px-4 py-4">
                              <div className="min-w-[180px]">
                                <div className="text-[16px] font-medium text-slate-900">
                                  {log.user_name || `User #${log.user_id || "--"}`}
                                </div>
                                <div className="mt-1 text-sm text-slate-500">{log.user_email || "--"}</div>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <span className="inline-flex rounded-full bg-sky-50 px-3 py-1 text-[15px] font-bold text-sky-700 ring-1 ring-sky-200">
                                {log.action}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <div className="min-w-[220px] break-words text-[16px] font-medium text-slate-700">{log.endpoint}</div>
                            </td>
                            <td className="px-4 py-4">
                              <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-[15px] font-bold uppercase text-slate-600 ring-1 ring-slate-200">
                                {log.http_method}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <span className={`inline-flex rounded-full px-3 py-1 text-[15px] font-bold ${statusTone}`}>
                                {log.response_status}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-4 py-4 text-[16px] font-medium text-slate-600">{log.ip_address || "--"}</td>
                            <td className="px-4 py-4">
                              <ExpandableJsonCell value={log.request_data} />
                            </td>
                            <td className="px-4 py-4">
                              <ExpandableJsonCell value={log.old_value} />
                            </td>
                            <td className="px-4 py-4">
                              <ExpandableJsonCell value={log.new_value} />
                            </td>
                            <td className="px-4 py-4">
                              <div className="min-w-[150px] text-[16px] font-medium text-slate-600">
                                {formatDateTime(log.created_at)}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-3xl border border-slate-200/70 bg-white/80 px-5 py-4 shadow-[0_16px_40px_-24px_rgba(15,23,42,0.15)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm sm:text-[16px] font-medium text-slate-500">
                  Page <span className="font-bold text-slate-900">{pagination.page}</span> of{" "}
                  <span className="font-bold text-slate-900">{pagination.totalPages}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={pagination.page <= 1}
                    onClick={() => loadLogs(pagination.page - 1)}
                    className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:py-3.5 text-[15px] font-bold text-slate-700 shadow-sm transition-all duration-300 hover:border-slate-300 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => loadLogs(pagination.page + 1)}
                    className="rounded-xl sm:rounded-2xl bg-gradient-to-r from-blue-700 via-blue-600 to-sky-500 px-4 py-3 sm:py-3.5 text-[15px] font-bold text-white shadow-[0_10px_24px_-10px_rgba(37,99,235,0.6)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-10px_rgba(37,99,235,0.75)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 p-12 text-center shadow-sm">
              <FaHistory className="mx-auto mb-3 text-3xl text-slate-400" />
              <div className="text-xl sm:text-2xl md:text-[28px] font-black text-slate-900">No audit logs found</div>
              <div className="mt-2 text-sm sm:text-[16px] leading-7 text-slate-500">Modify the filters or perform any action, then refresh.</div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}