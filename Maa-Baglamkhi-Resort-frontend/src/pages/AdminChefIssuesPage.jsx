import React, { useEffect, useMemo, useState } from "react";
import { FaSearch, FaFilter, FaRedo, FaClipboardList } from "react-icons/fa";
import API from "../../api";

function StatusBadge({ status }) {
  const map = {
    issued: { label: "Issued", cls: "bg-amber-100 text-amber-700 border-amber-200" },
    partially_returned: { label: "Partially Returned", cls: "bg-cyan-100 text-cyan-700 border-cyan-200" },
    fully_returned: { label: "Fully Returned", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  };
  const cfg = map[status] || { label: status, cls: "bg-slate-100 text-slate-600" };
  return (
    <span className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

export default function AdminChefIssuesPage() {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterChef, setFilterChef] = useState("");

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await API.get("/inventory/chef-issues");
      setIssues(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load chef issues.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => {
    let data = issues;
    if (filterStatus) data = data.filter((r) => r.status === filterStatus);
    if (filterChef) {
      const q = filterChef.toLowerCase();
      data = data.filter((r) => String(r.chefName || "").toLowerCase().includes(q));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(
        (r) =>
          String(r.itemName || "").toLowerCase().includes(q) ||
          String(r.purpose || "").toLowerCase().includes(q),
      );
    }
    return [...data].sort(
      (a, b) => new Date(b.issuedAt || 0).getTime() - new Date(a.issuedAt || 0).getTime(),
    );
  }, [issues, search, filterStatus, filterChef]);

  const summary = useMemo(() => {
    const chefNames = Array.from(new Set(issues.map((r) => r.chefName).filter(Boolean)));
    return {
      total: issues.length,
      open: issues.filter((r) => r.status !== "fully_returned").length,
      totalIssued: issues.reduce((s, r) => s + Number(r.quantityIssued || 0), 0),
      totalReturned: issues.reduce((s, r) => s + Number(r.quantityReturned || 0), 0),
      chefCount: chefNames.length,
    };
  }, [issues]);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef2ff_100%)] p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="overflow-hidden rounded-[28px] border border-white/70 bg-[linear-gradient(135deg,#0f172a_0%,#1e3a8a_60%,#0e7490_100%)] px-6 py-6 text-white shadow-[0_24px_60px_rgba(15,23,42,0.25)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                <FaClipboardList size={22} />
              </div>
              <div>
                <h1 className="text-2xl font-bold md:text-3xl">Chef Issues Overview</h1>
                <p className="mt-1 text-sm text-white/80">
                  Track every raw-material issue and return across all kitchen staff.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center md:flex md:gap-4">
              <div className="rounded-2xl bg-white/10 px-4 py-2">
                <p className="text-[10px] uppercase tracking-widest text-white/70">Total Issues</p>
                <p className="text-xl font-bold">{summary.total}</p>
              </div>
              <div className="rounded-2xl bg-white/10 px-4 py-2">
                <p className="text-[10px] uppercase tracking-widest text-white/70">Open</p>
                <p className="text-xl font-bold">{summary.open}</p>
              </div>
              <div className="rounded-2xl bg-white/10 px-4 py-2">
                <p className="text-[10px] uppercase tracking-widest text-white/70">Chefs Active</p>
                <p className="text-xl font-bold">{summary.chefCount}</p>
              </div>
              <div className="rounded-2xl bg-white/10 px-4 py-2">
                <p className="text-[10px] uppercase tracking-widest text-white/70">Total Issued</p>
                <p className="text-xl font-bold">{summary.totalIssued.toFixed(2)}</p>
              </div>
              <div className="rounded-2xl bg-white/10 px-4 py-2">
                <p className="text-[10px] uppercase tracking-widest text-white/70">Total Returned</p>
                <p className="text-xl font-bold">{summary.totalReturned.toFixed(2)}</p>
              </div>
              <div className="rounded-2xl bg-white/10 px-4 py-2">
                <p className="text-[10px] uppercase tracking-widest text-white/70">Still Out</p>
                <p className="text-xl font-bold">
                  {(summary.totalIssued - summary.totalReturned).toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <FaSearch className="text-slate-400" size={12} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by item, purpose or chef…"
              className="w-56 bg-transparent text-sm outline-none"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">All Status</option>
            <option value="issued">Issued</option>
            <option value="partially_returned">Partially Returned</option>
            <option value="fully_returned">Fully Returned</option>
          </select>
          <input
            value={filterChef}
            onChange={(e) => setFilterChef(e.target.value)}
            placeholder="Filter by chef name…"
            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
          />
          <button
            type="button"
            onClick={refresh}
            className="rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-xs font-semibold text-cyan-700 hover:bg-cyan-100"
          >
            <FaRedo size={10} className="mr-1 inline" /> Refresh
          </button>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-[0_22px_50px_rgba(15,23,42,0.08)]">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">ID</th>
                  <th className="px-4 py-3 text-left">Chef</th>
                  <th className="px-4 py-3 text-left">Item</th>
                  <th className="px-4 py-3 text-left">Issued</th>
                  <th className="px-4 py-3 text-left">Returned</th>
                  <th className="px-4 py-3 text-left">With Chef</th>
                  <th className="px-4 py-3 text-left">Purpose</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Issued At</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                      Loading…
                    </td>
                  </tr>
                ) : rows.length ? (
                  rows.map((row) => {
                    const remaining =
                      Number(row.quantityIssued || 0) - Number(row.quantityReturned || 0);
                    return (
                      <tr key={row.id} className="border-t border-slate-100 hover:bg-cyan-50/40">
                        <td className="px-4 py-3 text-xs text-slate-500">#{row.id}</td>
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {row.chefName || "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {row.itemName}
                          <div className="text-xs text-slate-500">{row.unit || ""}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {Number(row.quantityIssued || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {Number(row.quantityReturned || 0).toFixed(2)}
                        </td>
                        <td className={`px-4 py-3 font-semibold ${remaining > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                          {remaining.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">{row.purpose || "—"}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {row.issuedAt ? new Date(row.issuedAt).toLocaleString() : "—"}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                      No chef issues recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
