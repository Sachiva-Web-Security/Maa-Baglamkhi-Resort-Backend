// src/pages/InventoryUnitsPage.jsx
// Units list — fetches from /api/inventory-masters/units

import React, { useEffect, useMemo, useState } from "react";
import {
  FaPlus, FaSearch, FaEdit, FaTrash, FaTimes,
  FaCheckCircle, FaExclamationTriangle, FaBalanceScale,
  FaWeightHanging, FaTint, FaThLarge, FaBoxOpen, FaTag,
} from "react-icons/fa";

import {
  createInventoryMasterRecord,
  deleteInventoryMasterRecord,
  fetchInventoryMasterRecords,
  updateInventoryMasterRecord,
} from "../services/inventoryMastersService";

import BackButton from "../components/Inventory/BackButton";

/* ---------------------------------------------------------
   Design tokens — Modern Blue & White premium theme
--------------------------------------------------------- */
const c = {
  bg: "#F8FAFC",
  blue950: "#0B1E4A",
  blue900: "#122A5C",
  blue700: "#1D4ED8",
  blue600: "#2563EB",
  sky500: "#0EA5E9",
  border: "#E7ECF5",
  borderSoft: "#EEF2FA",
  muted: "#64748B",
  text: "#0F1B33",
  emerald: "#059669",
  emeraldBg: "#ECFDF5",
  amber: "#B45309",
  amberBg: "#FFFBEB",
  violet: "#6D28D9",
  violetBg: "#F5F3FF",
  rose: "#DC2626",
  roseBg: "#FEF2F2",
};

/* NOTE ON RESPONSIVE STRATEGY (read me):
   All classNames below are mobile-first. Any className fragment prefixed
   with `xl:` (or `lg:` that flows through to xl) reproduces the EXACT
   original (pre-responsive) desktop value, so Desktop (≥1280px) renders
   pixel-identical to the original file. `lg:` adds minor refinements for
   small laptops (1024px–1279px). Unprefixed / `sm:` / `md:` values serve
   phones and tablets (<1024px). Tables become card layouts below the md
   (768px) breakpoint. No JS logic, handlers, API calls, state, or props
   were changed anywhere in this file. */

const fieldCls =
  "w-full rounded-[14px] lg:rounded-[16px] border border-[#E7ECF5] bg-white px-3.5 lg:px-4 py-3 lg:py-3.5 text-[15px] lg:text-[17px] font-medium text-[#0F1B33] shadow-[0_1px_2px_rgba(15,27,51,0.04)] outline-none transition-all duration-250 focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10";
const labelCls =
  "mb-2 block text-[15px] lg:text-[17px] font-semibold text-[#122A5C]";
const primaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-[14px] lg:rounded-[16px] px-5 lg:px-6 py-3 lg:py-3.5 text-[15px] lg:text-[17px] font-semibold text-white shadow-[0_8px_20px_rgba(37,99,235,0.28)] transition-all duration-250 hover:shadow-[0_10px_26px_rgba(37,99,235,0.38)] hover:-translate-y-0.5 active:translate-y-0";
const primaryBtnStyle = {
  background: `linear-gradient(135deg, ${c.blue700} 0%, ${c.sky500} 100%)`,
};
const ghostBtn =
  "inline-flex items-center justify-center gap-2 rounded-[14px] lg:rounded-[16px] px-5 lg:px-6 py-3 lg:py-3.5 text-[15px] lg:text-[17px] font-semibold border border-[#E7ECF5] text-[#122A5C] bg-white hover:bg-[#F8FAFC] transition-all duration-250";
const dangerSolidBtn =
  "inline-flex items-center justify-center gap-2 rounded-[14px] lg:rounded-[16px] px-5 lg:px-6 py-3 lg:py-3.5 text-[15px] lg:text-[17px] font-semibold text-white bg-[#DC2626] hover:bg-[#B91C1C] transition-all duration-250 shadow-[0_8px_18px_rgba(220,38,38,0.25)]";

/* Type badge config — icon + soft accent color per type */
const typeMeta = {
  Weight: { icon: FaWeightHanging, color: c.blue700, bg: "#EFF4FF" },
  Volume: { icon: FaTint, color: c.sky500, bg: "#EFF9FF" },
  Count: { icon: FaThLarge, color: c.violet, bg: c.violetBg },
};
const getTypeMeta = (type) => typeMeta[type] || { icon: FaTag, color: c.muted, bg: "#F1F5F9" };

/* ---------------------------------------------------------
   Modal
--------------------------------------------------------- */
const Modal = ({ open, onClose, title, subtitle, children, actions }) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[#0B1E4A]/50 px-3 sm:px-4 py-4 sm:py-6 backdrop-blur-sm animate-[fadeIn_250ms_ease]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[92vw] sm:max-w-[480px] lg:max-w-[560px] max-h-[90vh] lg:max-h-[88vh] overflow-y-auto rounded-[18px] sm:rounded-[22px] lg:rounded-[24px] bg-white p-4 sm:p-6 lg:p-8 shadow-[0_30px_90px_rgba(11,30,74,0.25)] animate-[popIn_280ms_cubic-bezier(0.16,1,0.3,1)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-5 lg:mb-6">
          <div>
            <h3 className="text-[19px] sm:text-[22px] lg:text-[24px] font-bold text-[#0B1E4A] m-0">{title}</h3>
            {subtitle && <p className="text-[14px] sm:text-[16px] lg:text-[17px] text-[#64748B] mt-1">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-full p-2 text-[#64748B] hover:bg-[#F1F5F9] transition-colors"
            type="button"
          >
            <FaTimes className="text-lg" />
          </button>
        </div>
        <div className="text-[15px] lg:text-[17px]">{children}</div>
        {actions && <div className="mt-6 lg:mt-7 flex flex-wrap justify-end gap-3">{actions}</div>}
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes popIn { from { opacity: 0; transform: translateY(12px) scale(0.98) } to { opacity: 1; transform: translateY(0) scale(1) } }
      `}</style>
    </div>
  );
};

/* ---------------------------------------------------------
   Toast
--------------------------------------------------------- */
const Toast = ({ open, type, title, message, onClose }) => {
  if (!open) return null;
  const isSuccess = type === "success";
  const Icon = isSuccess ? FaCheckCircle : FaExclamationTriangle;
  return (
    <div
      className="fixed left-3 right-3 bottom-4 sm:left-auto sm:right-6 sm:bottom-6 z-[90] flex items-center gap-3 sm:gap-3.5 rounded-[16px] sm:rounded-[18px] bg-white px-4 sm:px-5 py-3.5 sm:py-4 shadow-[0_18px_45px_rgba(11,30,74,0.18)] border border-[#E7ECF5] w-auto sm:max-w-sm animate-[slideUp_280ms_cubic-bezier(0.16,1,0.3,1)]"
    >
      <div
        className="shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-[10px] sm:rounded-[12px] flex items-center justify-center text-[16px] sm:text-[18px]"
        style={{
          background: isSuccess ? c.emeraldBg : c.roseBg,
          color: isSuccess ? c.emerald : c.rose,
        }}
      >
        <Icon />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[15px] sm:text-[17px] font-bold text-[#0F1B33]">{title}</div>
        <div className="text-[13px] sm:text-[15px] text-[#64748B] break-words sm:truncate">{message}</div>
      </div>
      <button
        onClick={onClose}
        className="shrink-0 rounded-full p-1.5 text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#0F1B33] transition-colors"
      >
        <FaTimes className="text-sm" />
      </button>
      <style>{`
        @keyframes slideUp { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
    </div>
  );
};

/* ---------------------------------------------------------
   Delete confirmation
--------------------------------------------------------- */
const ConfirmDelete = ({ open, onClose, onConfirm, name }) => (
  <Modal
    open={open}
    onClose={onClose}
    title=""
    actions={
      <>
        <button onClick={onClose} className={`${ghostBtn} w-full sm:w-auto`}>Cancel</button>
        <button onClick={() => { onConfirm(); onClose(); }} className={`${dangerSolidBtn} w-full sm:w-auto`}>
          <FaTrash className="text-sm" /> Delete unit
        </button>
      </>
    }
  >
    <div className="flex flex-col items-center text-center -mt-4 mb-2">
      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-[18px] sm:rounded-[20px] flex items-center justify-center text-[24px] sm:text-[28px] mb-4" style={{ background: c.roseBg, color: c.rose }}>
        <FaExclamationTriangle />
      </div>
      <h3 className="text-[19px] sm:text-[22px] font-bold text-[#0B1E4A] mb-2">Delete unit?</h3>
      <p className="text-[15px] sm:text-[17px] text-[#64748B] max-w-[380px]">
        <span className="font-semibold text-[#0F1B33]">"{name || "This unit"}"</span> will be permanently removed. Items using this unit will keep their existing unit name for historical reference.
      </p>
    </div>
  </Modal>
);

/* ---------------------------------------------------------
   Add / Edit form modal
--------------------------------------------------------- */
const UnitFormModal = ({ open, onClose, onSave, initial }) => {
  const [form, setForm] = useState({ name: "", shortName: "", type: "Count", status: "Active" });
  useEffect(() => {
    if (open) {
      if (initial) {
        setForm({
          name: initial.name || "",
          shortName: initial.shortName || initial.short_name || "",
          type: initial.type || "Count",
          status: initial.status || "Active",
        });
      } else {
        setForm({ name: "", shortName: "", type: "Count", status: "Active" });
      }
    }
  }, [open, initial]);

  const setField = (name, value) => setForm((p) => ({ ...p, [name]: value }));
  const handleSubmit = () => {
    if (!form.name.trim()) return;
    onSave(form);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Edit unit" : "Add unit"}
      subtitle={initial ? "Update the details for this measurement unit" : "Add a new measurement unit to your inventory"}
      actions={
        <>
          <button onClick={onClose} className={`${ghostBtn} w-full sm:w-auto`}>Cancel</button>
          <button onClick={handleSubmit} className={`${primaryBtn} w-full sm:w-auto`} style={primaryBtnStyle}>
            {initial ? "Save changes" : "Add unit"}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-5">
        <div className="field">
          <label className={labelCls}>Unit name *</label>
          <input
            className={fieldCls}
            placeholder="e.g. Kilogram"
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
          />
        </div>
        <div className="field">
          <label className={labelCls}>Short name *</label>
          <input
            className={fieldCls}
            placeholder="e.g. kg"
            value={form.shortName}
            onChange={(e) => setField("shortName", e.target.value)}
          />
        </div>
        <div className="field sm:col-span-2">
          <label className={labelCls}>Type</label>
          <select
            className={fieldCls}
            value={form.type}
            onChange={(e) => setField("type", e.target.value)}
          >
            <option value="Weight">Weight</option>
            <option value="Volume">Volume</option>
            <option value="Count">Count</option>
          </select>
        </div>
      </div>
    </Modal>
  );
};

/* ---------------------------------------------------------
   Mobile card row (phones & tablets, <768px)
   Same data / same handlers as the desktop table row — just a
   different visual shell so nothing overflows a small screen.
--------------------------------------------------------- */
const UnitCard = ({ u, onEdit, onDelete }) => {
  const meta = getTypeMeta(u.type);
  const TypeIcon = meta.icon;
  return (
    <div className="bg-white border border-[#E7ECF5] rounded-[18px] p-4 shadow-[0_4px_16px_rgba(15,27,51,0.05)]">
      <div className="flex items-start gap-3 mb-3">
        <div
          className="w-11 h-11 rounded-[14px] flex items-center justify-center text-[17px] shrink-0"
          style={{ background: "#EFF6FF", color: c.blue700 }}
        >
          <FaBoxOpen />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[17px] font-semibold break-words" style={{ color: c.text }}>
            {u.name || "-"}
          </div>
          <span
            className="inline-flex items-center gap-1.5 mt-1.5 rounded-[10px] px-2.5 py-1 text-[13px] font-semibold"
            style={{ background: meta.bg, color: meta.color }}
          >
            <TypeIcon className="text-[11px]" />
            {u.type || "-"}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-[#EEF2FA] pt-3 mb-3">
        <span className="text-[13px] font-semibold uppercase tracking-[0.04em]" style={{ color: c.muted }}>
          Short Name
        </span>
        <span
          className="inline-flex items-center justify-center rounded-[10px] px-3 py-1.5 text-[14px] font-semibold"
          style={{ background: "#F1F5F9", color: c.text }}
        >
          {u.shortName || u.short_name || "-"}
        </span>
      </div>

      <div className="flex gap-2.5">
        <button
          onClick={onEdit}
          className="flex-1 min-h-[48px] inline-flex items-center justify-center gap-2 rounded-[12px] border-2 px-4 text-[15px] font-semibold transition-all duration-250"
          style={{ borderColor: c.blue700, color: c.blue700, background: "white" }}
        >
          <FaEdit className="text-[13px]" /> Edit
        </button>
        <button
          onClick={onDelete}
          className="flex-1 min-h-[48px] inline-flex items-center justify-center gap-2 rounded-[12px] px-4 text-[15px] font-semibold transition-all duration-250"
          style={{ background: c.roseBg, color: c.rose }}
        >
          <FaTrash className="text-[13px]" /> Delete
        </button>
      </div>
    </div>
  );
};

/* ---------------------------------------------------------
   Main page
--------------------------------------------------------- */
const InventoryUnitsPage = () => {
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [toast, setToast] = useState({ open: false, type: "success", title: "", message: "" });

  const fetchUnits = async () => {
    setLoading(true);
    try {
      const res = await fetchInventoryMasterRecords("units");
      setUnits(Array.isArray(res) ? res : []);
    } catch {
      setUnits([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { fetchUnits(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return units;
    return units.filter((u) =>
      [u.name, u.shortName, u.short_name, u.type].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))
    );
  }, [units, search]);

  const handleSave = async (formData) => {
    try {
      // Backend expects camelCase field names (name, shortName) and maps them to DB columns
      const payload = { name: formData.name, shortName: formData.shortName, type: formData.type, status: formData.status };
      if (editingUnit) {
        await updateInventoryMasterRecord("units", editingUnit.id, payload);
        setToast({ open: true, type: "success", title: "Unit updated", message: `${formData.name} updated.` });
      } else {
        await createInventoryMasterRecord("units", payload);
        setToast({ open: true, type: "success", title: "Unit added", message: `${formData.name} added.` });
      }
      setShowForm(false);
      setEditingUnit(null);
      await fetchUnits();
    } catch (err) {
      setToast({ open: true, type: "error", title: "Save failed", message: err.response?.data?.message || "Could not save." });
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteInventoryMasterRecord("units", deletingId);
      setToast({ open: true, type: "success", title: "Deleted", message: "Unit removed." });
      setDeletingId(null);
      await fetchUnits();
    } catch (err) {
      setToast({ open: true, type: "error", title: "Delete failed", message: err.response?.data?.message || "Could not delete." });
      setDeletingId(null);
    }
  };

  return (
    <div
      className="min-h-screen w-full max-w-full overflow-x-hidden relative"
      style={{
        background: `linear-gradient(160deg, #EFF6FF 0%, ${c.bg} 45%, #F5F9FF 100%)`,
      }}
    >
      {/* Abstract wave background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <svg className="absolute -top-10 right-0 w-[70%] max-w-[900px] opacity-60" viewBox="0 0 800 400" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M100 60C260 10 380 130 560 90C680 65 740 20 800 40V400H100C40 300 -20 120 100 60Z" fill="url(#waveGrad1)" />
          <defs>
            <linearGradient id="waveGrad1" x1="0" y1="0" x2="800" y2="400" gradientUnits="userSpaceOnUse">
              <stop stopColor="#DBEAFE" />
              <stop offset="1" stopColor="#EFF6FF" stopOpacity="0.3" />
            </linearGradient>
          </defs>
        </svg>
        <svg className="absolute top-0 right-0 w-[45%] max-w-[600px] opacity-70" viewBox="0 0 600 300" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M50 0C220 40 260 -20 420 30C500 55 560 20 600 0V300H50C10 220 -30 60 50 0Z" fill="url(#waveGrad2)" />
          <defs>
            <linearGradient id="waveGrad2" x1="0" y1="0" x2="600" y2="300" gradientUnits="userSpaceOnUse">
              <stop stopColor="#BFDBFE" stopOpacity="0.5" />
              <stop offset="1" stopColor="#93C5FD" stopOpacity="0.15" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div
        className="relative w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:pt-9 lg:pb-[72px]"
      >
        {/* Header */}
          <BackButton className="shrink-0" />
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 sm:gap-5 mb-6 lg:mb-7">
         
          <div className="flex items-center gap-3.5 sm:gap-4">
           
            <div
              className="w-12 h-12 sm:w-14 sm:h-14 lg:w-[68px] lg:h-[68px] rounded-[16px] lg:rounded-[20px] flex items-center justify-center text-white text-[22px] sm:text-[24px] lg:text-[28px] shrink-0 shadow-[0_10px_24px_rgba(37,99,235,0.30)]"
              style={{ background: `linear-gradient(135deg, ${c.blue700} 0%, ${c.sky500} 100%)` }}
            >
              <FaBalanceScale />
            </div>
            <div className="min-w-0">
              <h1 className="text-[26px] sm:text-[34px] lg:text-[44px] font-extrabold m-0 leading-tight tracking-tight" style={{ color: c.blue950 }}>
                Units
              </h1>
              <p className="m-0 text-[14px] sm:text-[17px] lg:text-[19px]" style={{ color: c.muted }}>
                Measurement units (kg, ltr, pcs, etc.)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { setEditingUnit(null); setShowForm(true); }}
            className={`${primaryBtn} w-full lg:w-auto`}
            style={{ ...primaryBtnStyle, height: 48, borderRadius: 18 }}
          >
            <FaPlus className="text-[15px]" /> Add Unit
          </button>
        </div>

        {/* Search */}
        <div className="mb-6 lg:mb-7">
          <div className="relative w-full lg:max-w-2xl">
            <FaSearch className="absolute left-4 lg:left-5 top-1/2 -translate-y-1/2 text-[#94A3B8] text-[15px] lg:text-[17px]" />
            <input
              className="w-full rounded-[16px] lg:rounded-[18px] border border-[#E7ECF5] bg-white pl-11 lg:pl-14 pr-4 lg:pr-5 text-[15px] lg:text-[17px] font-medium text-[#0F1B33] shadow-[0_6px_20px_rgba(15,27,51,0.05)] outline-none transition-all duration-250 focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10 h-[52px] lg:h-[60px]"
              placeholder="Search units…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Table card — visible on tablet landscape & desktop (≥768px), unchanged on xl+ */}
        <div className="hidden md:block bg-white/90 backdrop-blur-sm border border-[#E7ECF5] rounded-[20px] xl:rounded-[28px] overflow-hidden shadow-[0_20px_60px_rgba(15,27,51,0.06)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr style={{ background: "linear-gradient(90deg, #EFF6FF 0%, #F5F9FF 100%)" }}>
                  <th className="text-left text-[14px] lg:text-[16px] font-bold uppercase tracking-[0.04em] py-4 xl:py-5 pl-5 lg:pl-7 pr-4 border-b border-[#E7ECF5]" style={{ color: c.blue900 }}>
                    <span className="inline-flex items-center gap-2"><FaTag className="text-[13px] opacity-70" /> Name</span>
                  </th>
                  <th className="text-left text-[14px] lg:text-[16px] font-bold uppercase tracking-[0.04em] py-4 xl:py-5 pr-4 border-b border-[#E7ECF5]" style={{ color: c.blue900 }}>
                    <span className="inline-flex items-center gap-2"><FaTag className="text-[13px] opacity-70" /> Short Name</span>
                  </th>
                  <th className="text-left text-[14px] lg:text-[16px] font-bold uppercase tracking-[0.04em] py-4 xl:py-5 pr-4 border-b border-[#E7ECF5]" style={{ color: c.blue900 }}>
                    <span className="inline-flex items-center gap-2"><FaBoxOpen className="text-[13px] opacity-70" /> Type</span>
                  </th>
                  <th className="text-left text-[14px] lg:text-[16px] font-bold uppercase tracking-[0.04em] py-4 xl:py-5 pr-5 lg:pr-7 border-b border-[#E7ECF5] w-[200px] lg:w-[220px]" style={{ color: c.blue900 }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF2FA]">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-16 text-center text-[17px]" style={{ color: c.muted }}>
                      Loading…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <div className="flex flex-col items-center text-center py-16 px-6">
                        <div
                          className="w-20 h-20 rounded-[24px] flex items-center justify-center text-[32px] mb-5 shadow-[0_10px_24px_rgba(37,99,235,0.12)]"
                          style={{ background: "#EFF6FF", color: c.blue700 }}
                        >
                          <FaBoxOpen />
                        </div>
                        <b className="block text-[22px] font-bold mb-2" style={{ color: c.blue950 }}>
                          No units yet
                        </b>
                        <span className="text-[17px] max-w-[360px]" style={{ color: c.muted }}>
                          Add your first measurement unit to get started with inventory tracking.
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((u) => {
                    const meta = getTypeMeta(u.type);
                    const TypeIcon = meta.icon;
                    return (
                      <tr key={u.id} className="transition-colors duration-250 hover:bg-[#F8FAFC]">
                        <td className="py-4 xl:py-5 pl-5 lg:pl-7 pr-4">
                          <div className="flex items-center gap-3.5">
                            <div
                              className="w-11 h-11 rounded-[14px] flex items-center justify-center text-[17px] shrink-0"
                              style={{ background: "#EFF6FF", color: c.blue700 }}
                            >
                              <FaBoxOpen />
                            </div>
                            <span className="text-[17px] lg:text-[18px] font-semibold" style={{ color: c.text }}>
                              {u.name || "-"}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 xl:py-5 pr-4">
                          <span
                            className="inline-flex items-center justify-center rounded-[10px] px-3 py-1.5 text-[15px] font-semibold"
                            style={{ background: "#F1F5F9", color: c.text }}
                          >
                            {u.shortName || u.short_name || "-"}
                          </span>
                        </td>
                        <td className="py-4 xl:py-5 pr-4">
                          <span
                            className="inline-flex items-center gap-1.5 rounded-[10px] px-3.5 py-1.5 text-[15px] font-semibold"
                            style={{ background: meta.bg, color: meta.color }}
                          >
                            <TypeIcon className="text-[13px]" />
                            {u.type || "-"}
                          </span>
                        </td>
                        <td className="py-4 xl:py-5 pr-5 lg:pr-7">
                          <div className="flex gap-2.5">
                            <button
                              onClick={() => { setEditingUnit(u); setShowForm(true); }}
                              className="inline-flex items-center gap-1.5 rounded-[12px] border-2 px-4 py-2 text-[16px] font-semibold transition-all duration-250 hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(37,99,235,0.18)]"
                              style={{ borderColor: c.blue700, color: c.blue700, background: "white" }}
                            >
                              <FaEdit className="text-[13px]" /> Edit
                            </button>
                            <button
                              onClick={() => setDeletingId(u.id)}
                              className="inline-flex items-center gap-1.5 rounded-[12px] px-4 py-2 text-[16px] font-semibold transition-all duration-250 hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(220,38,38,0.15)]"
                              style={{ background: c.roseBg, color: c.rose }}
                            >
                              <FaTrash className="text-[13px]" />
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
        </div>

        {/* Card list — phones & tablets (<768px), same data & handlers as the table above */}
        <div className="md:hidden">
          {loading ? (
            <div className="py-16 text-center text-[15px]" style={{ color: c.muted }}>
              Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white/90 border border-[#E7ECF5] rounded-[20px] flex flex-col items-center text-center py-14 px-5">
              <div
                className="w-16 h-16 rounded-[20px] flex items-center justify-center text-[26px] mb-4 shadow-[0_10px_24px_rgba(37,99,235,0.12)]"
                style={{ background: "#EFF6FF", color: c.blue700 }}
              >
                <FaBoxOpen />
              </div>
              <b className="block text-[18px] font-bold mb-2" style={{ color: c.blue950 }}>
                No units yet
              </b>
              <span className="text-[14px] max-w-[300px]" style={{ color: c.muted }}>
                Add your first measurement unit to get started with inventory tracking.
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filtered.map((u) => (
                <UnitCard
                  key={u.id}
                  u={u}
                  onEdit={() => { setEditingUnit(u); setShowForm(true); }}
                  onDelete={() => setDeletingId(u.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <UnitFormModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditingUnit(null); }}
        onSave={handleSave}
        initial={editingUnit}
      />
      <ConfirmDelete
        open={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        name={units.find((u) => u.id === deletingId)?.name}
      />
      <Toast
        open={toast.open}
        type={toast.type}
        title={toast.title}
        message={toast.message}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
      />
    </div>
  );
};

export default InventoryUnitsPage;