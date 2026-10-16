import React, { useEffect, useMemo, useState } from "react";
import {
  FaBoxOpen, FaClipboardCheck, FaHandHolding, FaSearch,
  FaUndo, FaUtensils, FaCheckCircle, FaHourglassHalf, FaTimes,
} from "react-icons/fa";
import chefService from "../services/chefService";
import { getUserFromStorage } from "../utils/authStorage";

/*
  RESPONSIVE STRATEGY (layout/typography only — no logic changed):
  - Base (no prefix)  => Mobile   ( <768px )
  - md:                => Tablet / iPad ( 768px – 1279px )
  - xl:                => Desktop ( >=1280px ) — matches the previous
    desktop-only design pixel-for-pixel; nothing here changes at xl.
*/

function StatusBadge({ status }) {
  const map = {
    issued: { label: "Issued", classes: "bg-amber-100 text-amber-700 border-amber-200", Icon: FaHourglassHalf },
    partially_returned: { label: "Partially Returned", classes: "bg-cyan-100 text-cyan-700 border-cyan-200", Icon: FaUndo },
    fully_returned: { label: "Fully Returned", classes: "bg-emerald-100 text-emerald-700 border-emerald-200", Icon: FaCheckCircle },
  };
  const cfg = map[status] || { label: status, classes: "bg-slate-100 text-slate-600", Icon: FaHourglassHalf };
  const Icon = cfg.Icon;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold sm:px-3 sm:py-1.5 sm:text-[13px] xl:text-[15px] ${cfg.classes}`}
    >
      <Icon size={11} className="xl:hidden" />
      <Icon size={13} className="hidden xl:inline" />
      {cfg.label}
    </span>
  );
}

export default function ChefInventoryPage() {
  const user = getUserFromStorage() || {};
  const loggedInName = user?.username || user?.name || user?.fullName || "Chef";

  const [items, setItems] = useState([]);
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [requestDraft, setRequestDraft] = useState({
    itemId: "", itemName: "", quantityIssued: "", unit: "", purpose: "", remarks: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [returnModal, setReturnModal] = useState(null); // { id, itemName, max }
  const [returnForm, setReturnForm] = useState({ quantityReturned: "", remarks: "" });
  const [returning, setReturning] = useState(false);

  // ── Load items + issues ─────────────────────────────────────────────────────
  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const [itemsRes, issuesRes] = await Promise.all([
        chefService.getInventoryItems(),
        chefService.getChefIssues({ chefName: loggedInName }),
      ]);
      const itemsList = Array.isArray(itemsRes)
        ? itemsRes
        : Array.isArray(itemsRes?.items)
          ? itemsRes.items
          : Array.isArray(itemsRes?.data)
            ? itemsRes.data
            : [];
      setItems(itemsList);
      setIssues(Array.isArray(issuesRes) ? issuesRes : []);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to load inventory.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Request item ───────────────────────────────────────────────────────────
  const handleItemSelect = (e) => {
    const id = e.target.value;
    const found = items.find((it) => String(it.id) === String(id));
    setRequestDraft((c) => ({
      ...c,
      itemId: id,
      itemName: found?.name || "",
      unit: found?.unit || "",
    }));
  };

  const handleRequest = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!requestDraft.itemId) return setError("Select an inventory item.");
    const qty = Number(requestDraft.quantityIssued);
    if (!qty || qty <= 0) return setError("Quantity must be greater than zero.");
    const selectedItem = items.find((it) => String(it.id) === String(requestDraft.itemId));
    if (selectedItem && Number(selectedItem.stock || 0) < qty) {
      return setError(`Insufficient stock. Available: ${selectedItem.stock} ${selectedItem.unit || ""}`);
    }
    setSubmitting(true);
    try {
      await chefService.createChefIssue({
        itemId: Number(requestDraft.itemId),
        itemName: requestDraft.itemName,
        quantityIssued: qty,
        unit: requestDraft.unit,
        chefName: loggedInName,
        chefId: user?.id || user?.userId || null,
        purpose: requestDraft.purpose,
        remarks: requestDraft.remarks,
      });
      setSuccess("Item issued to you from inventory.");
      setRequestDraft({ itemId: "", itemName: "", quantityIssued: "", unit: "", purpose: "", remarks: "" });
      await refresh();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to issue item.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Return item ────────────────────────────────────────────────────────────
  const openReturn = (row) => {
    const remaining = Number(row.quantityIssued || 0) - Number(row.quantityReturned || 0);
    setReturnModal({ id: row.id, itemName: row.itemName, max: remaining });
    setReturnForm({ quantityReturned: "", remarks: "" });
  };

  const submitReturn = async (e) => {
    e.preventDefault();
    if (!returnModal) return;
    const qty = Number(returnForm.quantityReturned);
    if (!qty || qty <= 0) return setError("Return quantity must be greater than zero.");
    if (qty > returnModal.max) {
      return setError(`Cannot return more than remaining ${returnModal.max}.`);
    }
    setReturning(true);
    setError("");
    try {
      await chefService.returnChefIssue(returnModal.id, {
        quantityReturned: qty,
        remarks: returnForm.remarks,
      });
      setSuccess("Return recorded successfully.");
      setReturnModal(null);
      await refresh();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to record return.");
    } finally {
      setReturning(false);
    }
  };

  // ── Derived: filtered issues ───────────────────────────────────────────────
  const filteredIssues = useMemo(() => {
    let rows = issues;
    if (filterStatus) rows = rows.filter((r) => r.status === filterStatus);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          String(r.itemName || "").toLowerCase().includes(q) ||
          String(r.purpose || "").toLowerCase().includes(q),
      );
    }
    return [...rows].sort(
      (a, b) => new Date(b.issuedAt || 0).getTime() - new Date(a.issuedAt || 0).getTime(),
    );
  }, [issues, search, filterStatus]);

  const myStats = useMemo(() => {
    const open = issues.filter((r) => r.status !== "fully_returned");
    const issued = issues.reduce(
      (sum, r) => sum + Number(r.quantityIssued || 0),
      0,
    );
    const returned = issues.reduce(
      (sum, r) => sum + Number(r.quantityReturned || 0),
      0,
    );
    return { openCount: open.length, issued, returned, remaining: issued - returned };
  }, [issues]);

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#eef2ff_100%)] p-3 sm:p-4 md:p-6 xl:p-8">
      <div className="mx-auto w-full max-w-none space-y-4 px-0 sm:px-2 md:space-y-5 md:px-4 xl:space-y-6 xl:px-6">
        {/* Header */}
        <div className="overflow-hidden rounded-[20px] border border-white/70 bg-[linear-gradient(135deg,#0f172a_0%,#1e3a8a_60%,#0e7490_100%)] px-4 py-5 text-white shadow-[0_24px_60px_rgba(15,23,42,0.25)] sm:rounded-[24px] md:px-8 md:py-6 xl:rounded-[28px] xl:px-10">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 xl:h-12 xl:w-12">
                <FaUtensils size={20} />
              </div>
              <div>
                <h1 className="text-2xl font-bold md:text-3xl">Kitchen Inventory · {loggedInName}</h1>
                <p className="mt-1 text-[15px] leading-snug text-white/80 md:text-[17px] xl:text-[19px]">
                  Request raw material and record leftover returns against each issue.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3 xl:flex xl:flex-wrap xl:gap-3">
              <div className="rounded-xl bg-white/10 px-3 py-2.5 xl:rounded-2xl xl:px-4 xl:py-3">
                <p className="text-[11px] uppercase tracking-wider text-white/70 sm:text-[13px] xl:text-[16px]">Open</p>
                <p className="text-lg font-bold sm:text-xl xl:text-2xl">{myStats.openCount}</p>
              </div>
              <div className="rounded-xl bg-white/10 px-3 py-2.5 xl:rounded-2xl xl:px-4 xl:py-3">
                <p className="text-[11px] uppercase tracking-wider text-white/70 sm:text-[13px] xl:text-[16px]">Issued</p>
                <p className="text-lg font-bold sm:text-xl xl:text-2xl">{myStats.issued.toFixed(2)}</p>
              </div>
              <div className="rounded-xl bg-white/10 px-3 py-2.5 xl:rounded-2xl xl:px-4 xl:py-3">
                <p className="text-[11px] uppercase tracking-wider text-white/70 sm:text-[13px] xl:text-[16px]">Returned</p>
                <p className="text-lg font-bold sm:text-xl xl:text-2xl">{myStats.returned.toFixed(2)}</p>
              </div>
              <div className="rounded-xl bg-white/10 px-3 py-2.5 xl:rounded-2xl xl:px-4 xl:py-3">
                <p className="text-[11px] uppercase tracking-wider text-white/70 sm:text-[13px] xl:text-[16px]">With Chef</p>
                <p className="text-lg font-bold sm:text-xl xl:text-2xl">{myStats.remaining.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[14px] font-medium text-red-700 xl:rounded-2xl xl:px-4 xl:py-3 xl:text-[17px]">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[14px] font-medium text-emerald-700 xl:rounded-2xl xl:px-4 xl:py-3 xl:text-[17px]">
            {success}
          </div>
        )}

        {/* Request form */}
        <div className="rounded-[20px] border border-white/80 bg-white p-4 shadow-[0_22px_50px_rgba(15,23,42,0.08)] sm:rounded-[22px] md:p-6 xl:rounded-[26px] xl:p-8">
          <div className="mb-4 flex items-center gap-3 md:mb-5 xl:mb-6">
            <FaHandHolding className="text-cyan-500" size={18} />
            <h2 className="text-[20px] font-bold leading-tight text-slate-900 sm:text-[24px] md:text-[28px] xl:text-[32px]">
              Request Item from Inventory
            </h2>
          </div>
          <form onSubmit={handleRequest} className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
            <Field label="Inventory Item" required>
              <select
                value={requestDraft.itemId}
                onChange={handleItemSelect}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[14px] outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 md:text-[15px] xl:px-4 xl:py-3 xl:text-[17px]"
              >
                <option value="">Select an item…</option>
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name} · {it.stock ?? 0} {it.unit || ""}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Quantity" required>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={requestDraft.quantityIssued}
                onChange={(e) =>
                  setRequestDraft((c) => ({ ...c, quantityIssued: e.target.value }))
                }
                placeholder="e.g. 2"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[14px] outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 md:text-[15px] xl:px-4 xl:py-3 xl:text-[17px]"
              />
            </Field>

            <Field label="Unit">
              <input
                value={requestDraft.unit}
                onChange={(e) => setRequestDraft((c) => ({ ...c, unit: e.target.value }))}
                placeholder="kg / ltr / pcs"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[14px] outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 md:text-[15px] xl:px-4 xl:py-3 xl:text-[17px]"
              />
            </Field>

            <Field label="Purpose (optional)">
              <input
                value={requestDraft.purpose}
                onChange={(e) => setRequestDraft((c) => ({ ...c, purpose: e.target.value }))}
                placeholder="e.g. Lunch prep / Banquet / Daily cooking"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[14px] outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 md:text-[15px] xl:px-4 xl:py-3 xl:text-[17px]"
              />
            </Field>

            <Field label="Remarks (optional)" full>
              <textarea
                rows={2}
                value={requestDraft.remarks}
                onChange={(e) => setRequestDraft((c) => ({ ...c, remarks: e.target.value }))}
                placeholder="Any additional note"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[14px] outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 md:text-[15px] xl:px-4 xl:py-3 xl:text-[17px]"
              />
            </Field>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 px-5 py-2.5 text-[14px] font-semibold text-white shadow-[0_18px_30px_rgba(37,99,235,0.25)] transition hover:-translate-y-0.5 disabled:opacity-60 sm:w-auto md:text-[16px] xl:px-6 xl:py-3 xl:text-[17px]"
              >
                <FaBoxOpen size={13} />
                {submitting ? "Issuing…" : "Issue to Me"}
              </button>
            </div>
          </form>
        </div>

        {/* Issues list */}
        <div className="rounded-[20px] border border-white/80 bg-white p-4 shadow-[0_22px_50px_rgba(15,23,42,0.08)] sm:rounded-[22px] md:p-6 xl:rounded-[26px] xl:p-8">
          <div className="mb-4 flex flex-col gap-3 md:mb-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-3">
              <FaClipboardCheck className="text-emerald-500" size={18} />
              <h2 className="text-[20px] font-bold leading-tight text-slate-900 sm:text-[24px] md:text-[28px] xl:text-[32px]">
                My Issued Items
              </h2>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center xl:w-auto">
              <div className="flex w-full items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 sm:w-auto">
                <FaSearch className="shrink-0 text-slate-400" size={14} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by item or purpose…"
                  className="w-full bg-transparent text-[14px] outline-none sm:w-48 xl:text-[17px]"
                />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full rounded-full border border-slate-200 bg-white px-3 py-2 text-[14px] sm:w-auto xl:text-[17px]"
              >
                <option value="">All Status</option>
                <option value="issued">Issued</option>
                <option value="partially_returned">Partially Returned</option>
                <option value="fully_returned">Fully Returned</option>
              </select>
              <button
                type="button"
                onClick={refresh}
                className="w-full rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-[14px] font-semibold text-cyan-700 hover:bg-cyan-100 sm:w-auto xl:text-[16px]"
              >
                Refresh
              </button>
            </div>
          </div>

          {/* ── Desktop / Tablet table (>=768px) ─────────────────────────── */}
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full text-[13px] md:text-[15px] xl:text-[17px]">
              <thead className="bg-slate-50 text-[12px] uppercase tracking-wide text-slate-500 md:text-[14px] xl:text-[16px]">
                <tr>
                  <th className="px-2 py-2.5 text-left md:px-3 xl:px-4 xl:py-3">Item</th>
                  <th className="px-2 py-2.5 text-left md:px-3 xl:px-4 xl:py-3">Issued</th>
                  <th className="px-2 py-2.5 text-left md:px-3 xl:px-4 xl:py-3">Returned</th>
                  <th className="px-2 py-2.5 text-left md:px-3 xl:px-4 xl:py-3">With Chef</th>
                  <th className="hidden px-2 py-2.5 text-left xl:table-cell xl:px-4 xl:py-3">Purpose</th>
                  <th className="px-2 py-2.5 text-left md:px-3 xl:px-4 xl:py-3">Status</th>
                  <th className="hidden px-2 py-2.5 text-left xl:table-cell xl:px-4 xl:py-3">Issued At</th>
                  <th className="hidden px-2 py-2.5 text-left xl:table-cell xl:px-4 xl:py-3">Issued By</th>
                  <th className="px-2 py-2.5 text-left md:px-3 xl:px-4 xl:py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-14 text-center text-[18px] text-slate-400 xl:text-[21px]">
                      Loading…
                    </td>
                  </tr>
                ) : filteredIssues.length ? (
                  filteredIssues.map((row) => {
                    const remaining =
                      Number(row.quantityIssued || 0) - Number(row.quantityReturned || 0);
                    return (
                      <tr key={row.id} className="border-t border-slate-100 hover:bg-cyan-50/40">
                        <td className="px-2 py-2.5 font-medium text-slate-800 md:px-3 xl:px-4 xl:py-3">
                          {row.itemName}
                          <div className="text-[12px] text-slate-500 xl:text-[15px]">{row.unit || ""}</div>
                        </td>
                        <td className="px-2 py-2.5 text-slate-700 md:px-3 xl:px-4 xl:py-3">
                          {Number(row.quantityIssued || 0).toFixed(2)}
                        </td>
                        <td className="px-2 py-2.5 text-slate-700 md:px-3 xl:px-4 xl:py-3">
                          {Number(row.quantityReturned || 0).toFixed(2)}
                        </td>
                        <td className="px-2 py-2.5 font-semibold text-slate-900 md:px-3 xl:px-4 xl:py-3">
                          {remaining.toFixed(2)}
                        </td>
                        <td className="hidden px-2 py-2.5 text-slate-600 xl:table-cell xl:px-4 xl:py-3">
                          {row.purpose || "—"}
                        </td>
                        <td className="px-2 py-2.5 md:px-3 xl:px-4 xl:py-3">
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="hidden px-2 py-2.5 text-[13px] text-slate-500 xl:table-cell xl:px-4 xl:py-3 xl:text-[15px]">
                          {row.issuedAt ? new Date(row.issuedAt).toLocaleString() : "—"}
                        </td>
                        <td className="hidden px-2 py-2.5 text-[13px] text-slate-600 xl:table-cell xl:px-4 xl:py-3 xl:text-[15px]">
                          {row.createdBy || "—"}
                        </td>
                        <td className="px-2 py-2.5 md:px-3 xl:px-4 xl:py-3">
                          {row.status === "fully_returned" ? (
                            <span className="text-[13px] text-slate-400 xl:text-[15px]">Closed</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openReturn(row)}
                              className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[13px] font-semibold text-emerald-700 transition hover:bg-emerald-100 md:px-3 xl:text-[16px]"
                            >
                              <FaUndo size={10} /> Return
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="px-4 py-14 text-center text-[18px] text-slate-400 xl:text-[21px]">
                      No items issued yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ── Mobile stacked cards (<768px) ─────────────────────────────── */}
          <div className="space-y-3 md:hidden">
            {loading ? (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 py-12 text-center text-[20px] text-slate-400">
                Loading…
              </div>
            ) : filteredIssues.length ? (
              filteredIssues.map((row) => {
                const remaining =
                  Number(row.quantityIssued || 0) - Number(row.quantityReturned || 0);
                return (
                  <div
                    key={row.id}
                    className="rounded-[20px] border border-slate-100 bg-white p-3.5 shadow-[0_10px_28px_rgba(15,23,42,0.06)]"
                  >
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
                          <FaBoxOpen size={22} />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-bold text-slate-900">{row.itemName}</p>
                          <p className="truncate text-[13px] text-slate-500">
                            {row.purpose || "No purpose noted"}
                          </p>
                        </div>
                      </div>
                      <StatusBadge status={row.status} />
                    </div>

                    <div className="mb-3 grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl bg-slate-50 p-3">
                      <div>
                        <p className="text-[13px] uppercase tracking-wide text-slate-400">Issued</p>
                        <p className="text-[14px] font-semibold text-slate-800">
                          {Number(row.quantityIssued || 0).toFixed(2)} {row.unit || ""}
                        </p>
                      </div>
                      <div>
                        <p className="text-[13px] uppercase tracking-wide text-slate-400">Returned</p>
                        <p className="text-[14px] font-semibold text-slate-800">
                          {Number(row.quantityReturned || 0).toFixed(2)} {row.unit || ""}
                        </p>
                      </div>
                      <div>
                        <p className="text-[13px] uppercase tracking-wide text-slate-400">With Chef</p>
                        <p className="text-[14px] font-semibold text-slate-900">
                          {remaining.toFixed(2)} {row.unit || ""}
                        </p>
                      </div>
                      <div>
                        <p className="text-[13px] uppercase tracking-wide text-slate-400">Issued At</p>
                        <p className="text-[14px] font-semibold text-slate-800">
                          {row.issuedAt ? new Date(row.issuedAt).toLocaleDateString() : "—"}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-[13px] uppercase tracking-wide text-slate-400">Issued By</p>
                        <p className="text-[14px] font-semibold text-slate-800">{row.createdBy || "—"}</p>
                      </div>
                    </div>

                    {row.status === "fully_returned" ? (
                      <span className="block w-full rounded-full bg-slate-100 py-2 text-center text-[14px] font-semibold text-slate-400">
                        Closed
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openReturn(row)}
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 py-2.5 text-[14px] font-semibold text-emerald-700 transition hover:bg-emerald-100"
                      >
                        <FaUndo size={12} /> Return
                      </button>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 py-12 text-center text-[20px] text-slate-400">
                No items issued yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Return modal */}
      {returnModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-2xl sm:rounded-3xl sm:p-6">
            <div className="mb-4 flex items-center justify-between sm:mb-5">
              <h3 className="text-[18px] font-bold leading-tight text-slate-900 sm:text-[22px] xl:text-[24px]">
                Return Leftover — {returnModal.itemName}
              </h3>
              <button
                type="button"
                onClick={() => setReturnModal(null)}
                className="shrink-0 rounded-full p-2 text-slate-400 hover:bg-slate-100"
              >
                <FaTimes size={18} />
              </button>
            </div>
            <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-[14px] font-medium text-amber-700 sm:px-4 sm:py-2.5 xl:text-[16px]">
              Maximum returnable quantity: {returnModal.max}
            </p>
            <form onSubmit={submitReturn} className="space-y-4">
              <Field label="Quantity to Return" required>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={returnModal.max}
                  value={returnForm.quantityReturned}
                  onChange={(e) =>
                    setReturnForm((c) => ({ ...c, quantityReturned: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[14px] outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 sm:px-4 sm:py-3 xl:text-[17px]"
                  placeholder="e.g. 2"
                />
              </Field>
              <Field label="Remarks (optional)">
                <textarea
                  rows={2}
                  value={returnForm.remarks}
                  onChange={(e) =>
                    setReturnForm((c) => ({ ...c, remarks: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[14px] outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 sm:px-4 sm:py-3 xl:text-[17px]"
                />
              </Field>
              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setReturnModal(null)}
                  className="w-full rounded-full border border-slate-200 bg-white px-5 py-2.5 text-[14px] font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto xl:text-[17px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={returning}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-2.5 text-[14px] font-semibold text-white shadow-lg disabled:opacity-60 sm:w-auto xl:text-[17px]"
                >
                  <FaUndo size={13} />
                  {returning ? "Saving…" : "Confirm Return"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, required, children, full = false }) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <label className="mb-1.5 block text-[13px] font-semibold uppercase tracking-wider text-slate-600 md:mb-2 md:text-[15px] xl:text-[17px]">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}