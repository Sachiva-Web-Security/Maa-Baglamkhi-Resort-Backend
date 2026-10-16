import React, { useEffect, useMemo, useState } from "react";
import API from "../api";

const PAGE_SIZE = 20;

const ACTION_COLORS = {
  create: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60",
  update: "bg-sky-50 text-sky-700 ring-1 ring-sky-200/60",
  delete: "bg-rose-50 text-rose-700 ring-1 ring-rose-200/60",
  login: "bg-violet-50 text-violet-700 ring-1 ring-violet-200/60",
  read: "bg-slate-50 text-slate-600 ring-1 ring-slate-200/60",
};

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = { page, limit: PAGE_SIZE };
      if (search.trim()) params.search = search.trim();
      if (actionFilter !== "all") params.action = actionFilter;

      const res = await API.get("/audit-logs", { params });
      setLogs(res.data.logs || res.data || []);
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, actionFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchLogs();
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const getActionBadge = (action) => {
    const key = String(action || "").toLowerCase();
    const base = ACTION_COLORS[key] || ACTION_COLORS.read;
    return (
      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${base}`}>
        {action}
      </span>
    );
  };

  const formatJson = (value) => {
    if (!value) return "--";
    if (typeof value === "string") {
      try {
        value = JSON.parse(value);
      } catch {
        return value;
      }
    }
    if (typeof value !== "object") return String(value);
    return JSON.stringify(value, null, 2);
  };

  const formatTimestamp = (ts) => {
    if (!ts) return "--";
    const d = new Date(ts);
    if (isNaN(d)) return ts;
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-xs">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Security & Compliance</div>
          <h3 className="text-lg sm:text-xl font-black text-slate-900 mt-0.5">Audit Logs</h3>
          <p className="text-xs sm:text-sm font-medium text-slate-500">
            Track every change, payment, and access across the system
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-72">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
              </svg>
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by action, endpoint, user..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-8 py-2 text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500"
          >
            <option value="all">All Actions</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
            <option value="login">Login</option>
            <option value="read">Read</option>
          </select>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden overflow-x-auto rounded-xl border border-slate-200/80 md:block">
        <table className="min-w-full text-left text-xs sm:text-sm">
          <thead className="bg-slate-900 text-slate-200 uppercase tracking-wider text-[11px] font-bold">
            <tr>
              <th className="px-4 py-3">Date & Time</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Endpoint</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm font-medium text-slate-400">
                  Loading audit logs...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm font-medium text-slate-400">
                  No audit logs found.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="transition-colors duration-150 hover:bg-slate-50/80">
                  <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-slate-600">
                    {formatTimestamp(log.created_at)}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700">
                    {log.requestData?.clientUserEmail ||
                     log.userEmail ||
                     `User #${log.user_id || "system"}`}
                  </td>
                  <td className="px-4 py-3">{getActionBadge(log.action)}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-600">
                    {log.endpoint}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold ${
                      log.httpMethod === "GET" ? "bg-slate-100 text-slate-600" :
                      log.httpMethod === "POST" ? "bg-emerald-50 text-emerald-700" :
                      log.httpMethod === "PUT" ? "bg-amber-50 text-amber-700" :
                      log.httpMethod === "DELETE" ? "bg-rose-50 text-rose-700" :
                      "bg-slate-50 text-slate-600"
                    }`}>
                      {log.httpMethod}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-center">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      log.responseStatus >= 200 && log.responseStatus < 300
                        ? "bg-emerald-50 text-emerald-700"
                        : log.responseStatus >= 400 && log.responseStatus < 500
                        ? "bg-amber-50 text-amber-700"
                        : "bg-rose-50 text-rose-700"
                    }`}>
                      {log.responseStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <details className="group">
                      <summary className="cursor-pointer text-[11px] font-semibold text-blue-600 hover:text-blue-800">
                        View Details
                      </summary>
                      <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600 space-y-2">
                        {log.oldValue && (
                          <div>
                            <div className="font-bold text-slate-500 mb-1">OLD VALUE:</div>
                            <pre className="whitespace-pre-wrap break-all font-mono text-[10px]">{formatJson(log.oldValue)}</pre>
                          </div>
                        )}
                        {log.newValue && (
                          <div>
                            <div className="font-bold text-slate-500 mb-1">NEW VALUE:</div>
                            <pre className="whitespace-pre-wrap break-all font-mono text-[10px]">{formatJson(log.newValue)}</pre>
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-slate-500 mb-1">REQUEST:</div>
                          <pre className="whitespace-pre-wrap break-all font-mono text-[10px] max-h-40 overflow-auto">
                            {formatJson(log.requestData)}
                          </pre>
                        </div>
                      </div>
                    </details>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="space-y-3 md:hidden">
        {loading ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center text-sm text-slate-400">
            Loading audit logs...
          </div>
        ) : logs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center text-sm text-slate-400">
            No audit logs found.
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-bold text-slate-900">
                  {log.requestData?.clientUserEmail || `User #${log.user_id || "system"}`}
                </div>
                {getActionBadge(log.action)}
              </div>
              <div className="mt-2 space-y-1 text-[11px] text-slate-600">
                <div><span className="font-semibold text-slate-500">Endpoint:</span> {log.endpoint}</div>
                <div><span className="font-semibold text-slate-500">Method:</span> {log.httpMethod}</div>
                <div><span className="font-semibold text-slate-500">Status:</span> {log.responseStatus}</div>
                <div><span className="font-semibold text-slate-500">Time:</span> {formatTimestamp(log.created_at)}</div>
              </div>
              <details className="mt-2 group">
                <summary className="cursor-pointer text-[11px] font-semibold text-blue-600">View Details</summary>
                <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-[10px] text-slate-600 space-y-2">
                  {log.oldValue && <div><div className="font-bold">OLD:</div><pre className="whitespace-pre-wrap">{formatJson(log.oldValue)}</pre></div>}
                  {log.newValue && <div><div className="font-bold">NEW:</div><pre className="whitespace-pre-wrap">{formatJson(log.newValue)}</pre></div>}
                </div>
              </details>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {logs.length > 0 && (
        <div className="mt-5 flex flex-col items-center gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-between">
          <div className="text-xs font-medium text-slate-500">
            Showing {logs.length} record{logs.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogs;
