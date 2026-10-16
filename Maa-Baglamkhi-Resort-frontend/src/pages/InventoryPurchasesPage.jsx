// src/pages/InventoryPurchasesPage.jsx
// Purchase Orders / Invoices — fetches from /api/inventory/purchase-orders
// Add / Edit via modal; search + status filter.
// Premium Blue & White design system — functionality unchanged.

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaPlus,
  FaSearch,
  FaEdit,
  FaTimes,
  FaCheckCircle,
  FaExclamationTriangle,
  FaShoppingCart,
  FaChevronLeft,
  FaChevronRight,
  FaBoxOpen,
} from "react-icons/fa";

import API from "../api";
import { fetchInventoryMasterRecords } from "../services/inventoryMastersService";

import BackButton from "../components/Inventory/BackButton";

/* ── style tokens ── */
const fieldCls =
  "w-full rounded-2xl border border-blue-100 bg-white px-4 py-3 text-[17px] font-medium text-slate-800 shadow-sm transition-all duration-200 placeholder:text-slate-400 placeholder:font-normal focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100";

const labelCls = "mb-2 block text-[17px] font-semibold text-slate-700";

const primaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-[17px] font-semibold text-white shadow-[0_8px_24px_-8px_rgba(30,64,175,0.55)] transition-all duration-300 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap bg-gradient-to-r from-blue-950 via-blue-800 to-sky-500 hover:shadow-[0_10px_30px_-6px_rgba(14,165,233,0.55)] hover:brightness-110";

const ghostBtn =
  "inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-[17px] font-semibold text-slate-600 transition-all duration-300 active:scale-[0.97] bg-white border border-blue-100 hover:bg-blue-50 hover:text-blue-900";

const rowEditBtn =
  "inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-[15px] font-semibold border border-blue-100 bg-gradient-to-b from-white to-blue-50 text-blue-800 shadow-sm transition-all duration-200 hover:border-blue-300 hover:from-blue-50 hover:to-blue-100 hover:shadow-md active:scale-[0.96]";

const STATUS_STYLES = {
  draft: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
  pending: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  "grn received": "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
  completed: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  cancelled: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
};

const STATUS_ICON = {
  completed: <FaCheckCircle className="text-[13px]" />,
};

const statusBadge = (s) => {
  const key = String(s || "").toLowerCase().trim().replace(/\s+/g, "-");
  const style = STATUS_STYLES[key] || "bg-slate-100 text-slate-600 ring-1 ring-slate-200";
  return `inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[15px] font-bold ${style}`;
};

/* ── Modal ── */
const Modal = ({ open, onClose, title, subtitle, children, actions }) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-blue-950/40 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[600px] max-h-[88vh] overflow-y-auto rounded-[20px] sm:rounded-[28px] bg-white p-5 sm:p-8 shadow-[0_40px_100px_-20px_rgba(15,23,80,0.35)] ring-1 ring-blue-50 animate-[fadeIn_.2s_ease]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-5 sm:mb-6">
          <div>
            <h3 className="text-[21px] sm:text-[26px] font-bold text-blue-950 m-0 tracking-tight">{title}</h3>
            {subtitle && <p className="text-[15px] sm:text-[17px] text-slate-500 mt-1">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-full p-2.5 text-slate-400 bg-slate-50 transition-all duration-200 hover:bg-rose-50 hover:text-rose-500"
            aria-label="Close"
            type="button"
          >
            <FaTimes className="text-lg" />
          </button>
        </div>
        <div className="text-[15px] sm:text-[17px] leading-relaxed text-slate-700">{children}</div>
        {actions && <div className="mt-6 sm:mt-7 flex flex-col-reverse sm:flex-row flex-wrap justify-end gap-2.5 sm:gap-3">{actions}</div>}
      </div>
    </div>
  );
};

/* ── Toast ── */
const Toast = ({ open, type, title, message, onClose }) => {
  if (!open) return null;
  const isSuccess = type === "success";
  const Icon = isSuccess ? FaCheckCircle : FaExclamationTriangle;
  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 z-[90] sm:max-w-sm animate-[fadeIn_.25s_ease]">
      <div className="flex items-center gap-3 sm:gap-3.5 rounded-2xl border border-white/60 bg-white/90 backdrop-blur-xl px-4 py-3.5 sm:px-5 sm:py-4 shadow-[0_20px_50px_-12px_rgba(15,23,80,0.35)]">
        <div
          className={`flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full ${
            isSuccess ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
          }`}
        >
          <Icon className="text-[15px] sm:text-[17px]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] sm:text-[17px] font-bold text-slate-800">{title}</div>
          <div className="text-[13px] sm:text-[15px] text-slate-500 truncate">{message}</div>
        </div>
        <button type="button" onClick={onClose} className="shrink-0 rounded-full p-1.5 text-slate-400 hover:bg-slate-100">
          <FaTimes className="text-sm" />
        </button>
      </div>
    </div>
  );
};

/* ─────────────────────────────── Main Component ─────────────────────────────── */

const InventoryPurchasesPage = () => {
  const navigate = useNavigate();
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [vendors, setVendors] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ open: false, type: "success", title: "", message: "" });

  const fetchPurchases = async () => {
    setLoading(true);
    try {
      const res = await API.get("/inventory/purchase-orders");
      setPurchases(Array.isArray(res.data) ? res.data : []);
    } catch {
      setPurchases([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchVendors = async () => {
    try {
      const data = await fetchInventoryMasterRecords("vendors");
      setVendors(Array.isArray(data) ? data : []);
    } catch {
      setVendors([]);
    }
  };

  useEffect(() => {
    fetchPurchases();
    fetchVendors();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return purchases.filter((p) => {
      const matchesSearch = !q || [p.po_number, p.vendor, p.item_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
      const matchesStatus = statusFilter === "all" || String(p.status || "").toLowerCase() === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [purchases, search, statusFilter]);

  const handleSave = async (formData) => {
    setSaving(true);
    try {
      if (editingId) {
        await API.put(`/inventory/purchase-orders/${editingId}`, formData);
        setToast({ open: true, type: "success", title: "Purchase updated", message: `Order ${formData.poNumber} has been updated.` });
      } else {
        await API.post("/inventory/purchase-orders", formData);
        setToast({ open: true, type: "success", title: "Purchase created", message: `Order ${formData.poNumber} has been created.` });
      }
      setShowForm(false);
      setEditingId(null);
      await fetchPurchases();
    } catch (err) {
      setToast({ open: true, type: "error", title: "Save failed", message: err.response?.data?.message || "Could not save purchase." });
    } finally {
      setSaving(false);
    }
  };

  const openAdd = () => {
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (purchase) => {
    setEditingId(purchase.id);
    setShowForm(true);
  };

  const closeToast = () => setToast((t) => ({ ...t, open: false }));

  const statusPills = ["all", "draft", "pending", "grn received", "completed", "cancelled"];

  return (
    <div
      className="min-h-screen w-full max-w-full overflow-x-hidden px-4 pt-5 pb-10 sm:px-5 sm:pt-6 sm:pb-12 lg:px-6 lg:pt-7 lg:pb-14 xl:px-7 xl:pt-7 xl:pb-16"
      style={{
        background:
          "radial-gradient(1200px 500px at 10% -10%, rgba(56,189,248,0.10), transparent), radial-gradient(1000px 500px at 100% 0%, rgba(30,64,175,0.08), transparent), #F7F9FC",
      }}
    >
      {/* ── top bar ── */}
     <BackButton className="shrink-0" />
      <div className="bg-white/70 backdrop-blur-xl border border-blue-50 rounded-[22px] xl:rounded-[28px] shadow-[0_20px_60px_-30px_rgba(15,23,80,0.25)] px-4 py-4 sm:px-5 sm:py-5 xl:px-6 xl:py-6 mb-4 sm:mb-5 xl:mb-6 flex flex-col items-stretch gap-4 xl:flex-row xl:items-center xl:justify-between xl:flex-wrap">
       
        <div className="flex items-center gap-3 sm:gap-4">
          
          <div
            className="w-[44px] h-[44px] sm:w-[52px] sm:h-[52px] rounded-2xl flex items-center justify-center text-white text-[18px] sm:text-[22px] shrink-0 shadow-[0_10px_28px_-8px_rgba(30,64,175,0.65)]"
            style={{ background: "linear-gradient(135deg, #0B1D4D 0%, #1E3A8A 55%, #38BDF8 100%)" }}
          >
            <FaShoppingCart />
          </div>
          <div>
            <h1 className="text-[24px] sm:text-[28px] xl:text-[34px] font-bold m-0 leading-tight tracking-tight text-blue-950">
              Purchase Invoices
            </h1>
            <p className="m-0 text-[15px] sm:text-[16px] xl:text-[18px] text-slate-500 mt-0.5">
              Track purchase orders and vendor invoices
            </p>
          </div>
        </div>
        <button type="button" onClick={openAdd} className={`${primaryBtn} w-full xl:w-auto`}>
          <FaPlus className="text-sm" /> New Purchase
        </button>
      </div>

      {/* ── search + filter ── */}
      <div className="bg-white/80 backdrop-blur-xl border border-blue-50 rounded-[22px] xl:rounded-[28px] shadow-[0_16px_50px_-30px_rgba(15,23,80,0.2)] px-4 py-4 sm:px-5 sm:py-5 mb-4 sm:mb-5 xl:mb-6 flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-center">
        <div className="relative w-full xl:flex-1 xl:min-w-[240px]">
          <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-300 text-[15px]" />
          <input
            className={`${fieldCls} pl-11`}
            placeholder="Search by PO #, vendor, item…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap w-full xl:w-auto">
          {statusPills.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3.5 py-2 sm:px-4 sm:py-2.5 text-[14px] sm:text-[16px] font-semibold transition-all duration-200 border ${
                statusFilter === s
                  ? "bg-gradient-to-r from-blue-950 via-blue-800 to-sky-500 text-white border-transparent shadow-[0_8px_20px_-8px_rgba(30,64,175,0.6)]"
                  : "bg-white border-blue-100 text-slate-600 hover:bg-blue-50 hover:text-blue-900"
              }`}
            >
              {s === "all" ? "All" : s === "grn received" ? "GRN Received" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── table (tablet & desktop, ≥768px) ── */}
      <div className="hidden md:block bg-white border border-blue-50 rounded-[22px] xl:rounded-[28px] overflow-hidden shadow-[0_20px_60px_-30px_rgba(15,23,80,0.25)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[750px] text-left">
            <thead>
              <tr style={{ background: "linear-gradient(90deg, #0B1D4D 0%, #1E3A8A 55%, #38BDF8 130%)" }}>
                <th className="text-left text-[16px] font-semibold uppercase tracking-[0.04em] text-white py-4 pl-6 pr-4">PO #</th>
                <th className="text-left text-[16px] font-semibold uppercase tracking-[0.04em] text-white py-4 pr-4">Vendor</th>
                <th className="text-left text-[16px] font-semibold uppercase tracking-[0.04em] text-white py-4 pr-4">Item</th>
                <th className="text-left text-[16px] font-semibold uppercase tracking-[0.04em] text-white py-4 pr-4">Qty</th>
                <th className="text-left text-[16px] font-semibold uppercase tracking-[0.04em] text-white py-4 pr-4">Rate (₹)</th>
                <th className="text-left text-[16px] font-semibold uppercase tracking-[0.04em] text-white py-4 pr-4">Total (₹)</th>
                <th className="text-left text-[16px] font-semibold uppercase tracking-[0.04em] text-white py-4 pr-4">Status</th>
                <th className="text-left text-[16px] font-semibold uppercase tracking-[0.04em] text-white py-4 pr-6 w-[110px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-50">
              {loading ? (
                <tr><td colSpan={8} className="py-14 text-center text-[18px] text-slate-500">Loading purchases…</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
                      <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-400 flex items-center justify-center mb-4 text-[26px]">
                        <FaBoxOpen />
                      </div>
                      <b className="block text-[22px] text-blue-950 mb-1.5">No purchases found</b>
                      <span className="text-[18px] text-slate-500 max-w-sm">Create your first purchase order to get started.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const total = Number(p.quantity || 0) * Number(p.rate || 0);
                  return (
                    <tr key={p.id} className="transition-colors duration-200 hover:bg-blue-50/50">
                      <td className="py-4 pl-6 pr-4 text-[18px] font-bold text-blue-950">{p.po_number || "-"}</td>
                      <td className="py-4 pr-4 text-[18px] text-slate-700">{p.vendor || "-"}</td>
                      <td className="py-4 pr-4 text-[18px] text-slate-700">{p.item_name || "-"}</td>
                      <td className="py-4 pr-4 text-[18px] text-slate-700">{p.quantity || 0}</td>
                      <td className="py-4 pr-4 text-[18px] text-slate-700">{Number(p.rate || 0).toFixed(2)}</td>
                      <td className="py-4 pr-4 text-[18px] font-bold text-blue-700">{total.toFixed(2)}</td>
                      <td className="py-4 pr-4">
                        <span className={statusBadge(p.status)}>
                          {STATUS_ICON[String(p.status || "").toLowerCase().trim().replace(/\s+/g, "-")]}
                          {p.status || "Draft"}
                        </span>
                      </td>
                      <td className="py-4 pr-6">
                        <div className="flex gap-2">
                          <button type="button" onClick={() => openEdit(p)} className={rowEditBtn}>
                            <FaEdit /> Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── footer / pagination (visual only, static — no logic added) ── */}
        {!loading && filtered.length > 0 && (
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-between px-4 py-4 sm:px-6 sm:py-5 border-t border-blue-50 text-center sm:text-left">
            <span className="text-[15px] sm:text-[16px] text-slate-500">
              Showing 1 to {filtered.length} of {filtered.length} invoices
            </span>
            <div className="flex items-center gap-2">
              <button type="button" disabled className="w-9 h-9 rounded-xl border border-blue-100 text-slate-300 flex items-center justify-center disabled:cursor-not-allowed">
                <FaChevronLeft className="text-[13px]" />
              </button>
              <span className="w-9 h-9 rounded-xl bg-gradient-to-r from-blue-950 via-blue-800 to-sky-500 text-white font-semibold flex items-center justify-center text-[15px] shadow-[0_6px_16px_-6px_rgba(30,64,175,0.6)]">
                1
              </span>
              <button type="button" disabled className="w-9 h-9 rounded-xl border border-blue-100 text-slate-300 flex items-center justify-center disabled:cursor-not-allowed">
                <FaChevronRight className="text-[13px]" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── card list (mobile only, <768px) ── */}
      <div className="md:hidden flex flex-col gap-3">
        {loading ? (
          <div className="bg-white border border-blue-50 rounded-[20px] py-10 text-center text-[14px] text-slate-500 shadow-sm">
            Loading purchases…
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-blue-50 rounded-[20px] flex flex-col items-center justify-center text-center py-12 px-5 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-400 flex items-center justify-center mb-3 text-[22px]">
              <FaBoxOpen />
            </div>
            <b className="block text-[20px] text-blue-950 mb-1">No purchases found</b>
            <span className="text-[14px] text-slate-500 max-w-xs">Create your first purchase order to get started.</span>
          </div>
        ) : (
          filtered.map((p) => {
            const total = Number(p.quantity || 0) * Number(p.rate || 0);
            return (
              <div
                key={p.id}
                className="bg-white border border-blue-50 rounded-[20px] p-4 shadow-[0_10px_30px_-18px_rgba(15,23,80,0.3)]"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <div className="text-[15px] font-bold text-blue-950 truncate">{p.po_number || "-"}</div>
                    <div className="text-[14px] text-slate-500 truncate">{p.vendor || "-"}</div>
                  </div>
                  <span className={statusBadge(p.status) + " !text-[12px] !px-3 !py-1 shrink-0"}>
                    {STATUS_ICON[String(p.status || "").toLowerCase().trim().replace(/\s+/g, "-")]}
                    {p.status || "Draft"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 rounded-2xl bg-blue-50/40 px-3.5 py-3 mb-3.5">
                  <div>
                    <div className="text-[13px] font-semibold text-slate-500">Item</div>
                    <div className="text-[14px] font-medium text-slate-800 truncate">{p.item_name || "-"}</div>
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-slate-500">Qty</div>
                    <div className="text-[14px] font-medium text-slate-800">{p.quantity || 0}</div>
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-slate-500">Rate (₹)</div>
                    <div className="text-[14px] font-medium text-slate-800">{Number(p.rate || 0).toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-slate-500">Total (₹)</div>
                    <div className="text-[15px] font-bold text-blue-700">{total.toFixed(2)}</div>
                  </div>
                </div>

                <button type="button" onClick={() => openEdit(p)} className={`${rowEditBtn} w-full !text-[14px]`}>
                  <FaEdit /> Edit
                </button>
              </div>
            );
          })
        )}

        {!loading && filtered.length > 0 && (
          <div className="flex flex-col items-center gap-3 pt-1">
            <span className="text-[13px] text-slate-500">
              Showing 1 to {filtered.length} of {filtered.length} invoices
            </span>
            <div className="flex items-center gap-2">
              <button type="button" disabled className="w-9 h-9 rounded-xl border border-blue-100 text-slate-300 flex items-center justify-center disabled:cursor-not-allowed">
                <FaChevronLeft className="text-[13px]" />
              </button>
              <span className="w-9 h-9 rounded-xl bg-gradient-to-r from-blue-950 via-blue-800 to-sky-500 text-white font-semibold flex items-center justify-center text-[15px] shadow-[0_6px_16px_-6px_rgba(30,64,175,0.6)]">
                1
              </span>
              <button type="button" disabled className="w-9 h-9 rounded-xl border border-blue-100 text-slate-300 flex items-center justify-center disabled:cursor-not-allowed">
                <FaChevronRight className="text-[13px]" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Form modal ── */}
      <PurchaseFormModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditingId(null); }}
        onSave={handleSave}
        initialId={editingId}
        vendors={vendors}
        saving={saving}
      />
      <Toast open={toast.open} type={toast.type} title={toast.title} message={toast.message} onClose={closeToast} />
    </div>
  );
};

/* ── Purchase Form Modal ── */
const PurchaseFormModal = ({ open, onClose, onSave, initialId, vendors, saving }) => {
  const blank = { poNumber: "", vendor: "", itemName: "", quantity: "", unit: "", rate: "", expectedDate: "", status: "Draft" };
  const [form, setForm] = useState(blank);

  useEffect(() => {
    if (open) {
      if (initialId) {
        // Fetch single PO for editing
        API.get(`/inventory/purchase-orders/${initialId}`)
          .then((res) => {
            const d = res.data;
            setForm({
              poNumber: d.po_number || "",
              vendor: d.vendor || "",
              itemName: d.item_name || "",
              quantity: String(d.quantity || 0),
              unit: d.unit || "",
              rate: String(d.rate || 0),
              expectedDate: d.expected_date ? String(d.expected_date).slice(0, 10) : "",
              status: d.status || "Draft",
            });
          })
          .catch(() => setForm(blank));
      } else {
        setForm(blank);
      }
    }
  }, [open, initialId]);

  const setField = (name, value) => setForm((p) => ({ ...p, [name]: value }));

  const total = useMemo(() => (Number(form.quantity) || 0) * (Number(form.rate) || 0), [form.quantity, form.rate]);

  const handleSubmit = () => {
    if (!form.poNumber.trim() || !form.vendor.trim()) return;
    onSave({
      poNumber: form.poNumber,
      vendor: form.vendor,
      itemName: form.itemName,
      quantity: Number(form.quantity) || 0,
      unit: form.unit,
      rate: Number(form.rate) || 0,
      expectedDate: form.expectedDate || null,
      status: form.status,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialId ? "Edit purchase order" : "New purchase order"}
      subtitle={initialId ? "Update purchase order details" : "Create a new purchase order or invoice"}
      actions={
        <>
          <button type="button" onClick={onClose} className={`${ghostBtn} w-full sm:w-auto`} disabled={saving}>Cancel</button>
          <button type="button" onClick={handleSubmit} className={`${primaryBtn} w-full sm:w-auto`} disabled={saving}>
            {saving ? "Saving…" : initialId ? "Save changes" : "Create order"}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
        <div className="field">
          <label className={labelCls}>PO Number *</label>
          <input className={fieldCls} placeholder="e.g. PO-001" value={form.poNumber} onChange={(e) => setField("poNumber", e.target.value)} />
        </div>
        <div className="field">
          <label className={labelCls}>Vendor *</label>
          <select className={fieldCls} value={form.vendor} onChange={(e) => setField("vendor", e.target.value)}>
            <option value="">Select vendor</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.name}>{v.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className={labelCls}>Item name</label>
          <input className={fieldCls} placeholder="e.g. Rice" value={form.itemName} onChange={(e) => setField("itemName", e.target.value)} />
        </div>
        <div className="field">
          <label className={labelCls}>Quantity</label>
          <input type="number" className={fieldCls} placeholder="0" value={form.quantity} onChange={(e) => setField("quantity", e.target.value)} />
        </div>
        <div className="field">
          <label className={labelCls}>Unit</label>
          <input className={fieldCls} placeholder="kg / pcs / ltr" value={form.unit} onChange={(e) => setField("unit", e.target.value)} />
        </div>
        <div className="field">
          <label className={labelCls}>Rate per unit (₹)</label>
          <input type="number" className={fieldCls} placeholder="0.00" value={form.rate} onChange={(e) => setField("rate", e.target.value)} />
        </div>
        <div className="field">
          <label className={labelCls}>Expected date</label>
          <input type="date" className={fieldCls} value={form.expectedDate} onChange={(e) => setField("expectedDate", e.target.value)} />
        </div>
        <div className="field">
          <label className={labelCls}>Status</label>
          <select className={fieldCls} value={form.status} onChange={(e) => setField("status", e.target.value)}>
            <option value="Draft">Draft</option>
            <option value="Pending">Pending</option>
            <option value="GRN Received">GRN Received</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>
        <div className="field sm:col-span-2">
          <label className={labelCls}>Total amount (₹)</label>
          <input className={`${fieldCls} bg-blue-50/60 font-bold text-blue-900`} value={total.toFixed(2)} readOnly />
        </div>
      </div>
    </Modal>
  );
};

export default InventoryPurchasesPage;