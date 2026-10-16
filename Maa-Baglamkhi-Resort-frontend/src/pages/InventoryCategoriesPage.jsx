// src/pages/InventoryCategoriesPage.jsx
// Menu Categories list — fetches from /api/inventory-masters/menu-categories
//
// NOTE: This file only changes presentation (markup/classNames/inline styles).
// All hooks, state, API calls, validation, and CRUD logic are unchanged from
// the original implementation.

import React, { useEffect, useMemo, useState } from "react";
import {
  FaPlus, FaSearch, FaEdit, FaTrash, FaTimes,
  FaCheckCircle, FaExclamationTriangle, FaListAlt,
} from "react-icons/fa";

import {
  createInventoryMasterRecord,
  deleteInventoryMasterRecord,
  fetchInventoryMasterRecords,
  updateInventoryMasterRecord,
} from "../services/inventoryMastersService";

import BackButton from "../components/Inventory/BackButton";

// ---- Design tokens (visual only — does not touch any logic below) ----
const c = {
  line: "#E7EEFB", muted: "#6B7280", text: "#1C231F",
  navy: "#0F2A5C", slate: "#475569", blue: "#2563EB", blueDeep: "#1D4ED8",
};

const fieldCls =
  "w-full rounded-[14px] border bg-white px-4 py-3.5 text-[14px] sm:text-[15px] font-medium text-[#1C231F] outline-none transition-all duration-250 focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)]";
const labelCls = "mb-1.5 block text-[12px] sm:text-[13px] font-semibold uppercase tracking-[0.04em]" ;
const primaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-[12px] px-5 py-3 text-[14px] sm:text-[15px] font-semibold text-white transition-all duration-250 hover:brightness-110 hover:shadow-lg active:scale-[0.98]";
const ghostBtn =
  "inline-flex items-center justify-center gap-1.5 rounded-[12px] px-5 py-3 text-[14px] sm:text-[15px] font-semibold border bg-white transition-all duration-250 hover:bg-[#F5F8FF]";
const dangerBtn =
  "inline-flex items-center justify-center gap-1 rounded-[10px] w-12 h-12 sm:w-10 sm:h-10 text-[14px] font-semibold transition-all duration-250 hover:shadow-md active:scale-95 shrink-0";
const editBtn =
  "inline-flex items-center justify-center gap-1 rounded-[10px] w-12 h-12 sm:w-10 sm:h-10 text-[14px] font-semibold transition-all duration-250 hover:shadow-md active:scale-95 shrink-0";

const Modal = ({ open, onClose, title, subtitle, children, actions }) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[#0F2A5C]/45 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[540px] max-h-[88vh] overflow-y-auto bg-white p-6 sm:p-8 shadow-[0_30px_90px_rgba(15,42,92,0.28)] animate-[fadeIn_0.25s_ease]"
        style={{ borderRadius: "24px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <h3 className="text-[19px] sm:text-[24px] font-bold m-0" style={{ color: c.navy }}>{title}</h3>
            {subtitle && <p className="text-[13px] sm:text-[14.5px] mt-1 m-0" style={{ color: c.muted }}>{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-full p-2 transition-colors hover:bg-[#F1F5FB]"
            style={{ color: c.muted }}
            type="button"
          >
            <FaTimes className="text-lg" />
          </button>
        </div>
        <div className="text-[14px] sm:text-[15px]">{children}</div>
        {actions && <div className="mt-7 flex flex-wrap justify-end gap-3">{actions}</div>}
      </div>
    </div>
  );
};

const Toast = ({ open, type, title, message, onClose }) => {
  if (!open) return null;
  const isSuccess = type === "success";
  const tone = isSuccess ? { bg: "#ECFDF3", fg: "#16A34A", ring: "#BBF7D0" } : { bg: "#FEF2F2", fg: "#DC2626", ring: "#FECACA" };
  const Icon = isSuccess ? FaCheckCircle : FaExclamationTriangle;
  return (
    <div
      className="fixed bottom-5 right-5 left-5 sm:left-auto z-[90] flex items-center gap-3 bg-white px-5 py-4 shadow-[0_20px_50px_rgba(15,42,92,0.18)] sm:max-w-sm animate-[fadeIn_0.25s_ease]"
      style={{ borderRadius: "16px", border: `1px solid ${tone.ring}` }}
    >
      <div className="flex items-center justify-center shrink-0" style={{ width: "38px", height: "38px", borderRadius: "10px", background: tone.bg }}>
        <Icon style={{ color: tone.fg, fontSize: "16px" }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] sm:text-[14.5px] font-bold" style={{ color: c.navy }}>{title}</div>
        <div className="text-[12.5px] sm:text-[13px] break-words sm:truncate" style={{ color: c.muted }}>{message}</div>
      </div>
      <button onClick={onClose} className="shrink-0 rounded-full p-1.5 hover:bg-black/5" style={{ color: c.muted }}>
        <FaTimes className="text-sm" />
      </button>
    </div>
  );
};

const ConfirmDelete = ({ open, onClose, onConfirm, name }) => (
  <Modal
    open={open}
    onClose={onClose}
    title="Delete category?"
    subtitle={`"${name || "this category"}" will be removed.`}
    actions={
      <>
        <button onClick={onClose} className={ghostBtn} style={{ borderColor: c.line, color: c.navy }}>Cancel</button>
        <button
          onClick={() => { onConfirm(); onClose(); }}
          className={primaryBtn}
          style={{ background: "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)" }}
        >
          Delete
        </button>
      </>
    }
  >
    <div className="flex items-start gap-4 mb-1">
      <div className="flex items-center justify-center shrink-0" style={{ width: "48px", height: "48px", borderRadius: "14px", background: "#FEF2F2" }}>
        <FaExclamationTriangle style={{ color: "#DC2626", fontSize: "20px" }} />
      </div>
      <p className="text-[14px] sm:text-[15px] m-0 pt-1.5" style={{ color: c.slate }}>
        Are you sure? Menu items in this category will be kept but may appear uncategorized.
      </p>
    </div>
  </Modal>
);

const CategoryFormModal = ({ open, onClose, onSave, initial }) => {
  const [form, setForm] = useState({ name: "", status: "Active" });
  useEffect(() => {
    if (open) {
      if (initial) setForm({ name: initial.name || "", status: initial.status || "Active" });
      else setForm({ name: "", status: "Active" });
    }
  }, [open, initial]);
  const setField = (name, value) => setForm((p) => ({ ...p, [name]: value }));
  const handleSubmit = () => { if (!form.name.trim()) return; onSave(form); };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Edit category" : "Add category"}
      subtitle={initial ? "Update category details" : "Create a new menu category"}
      actions={
        <>
          <button onClick={onClose} className={ghostBtn} style={{ borderColor: c.line, color: c.navy }}>Cancel</button>
          <button
            onClick={handleSubmit}
            className={primaryBtn}
            style={{ background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)" }}
          >
            {initial ? "Save" : "Add category"}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4">
        <div className="field">
          <label className={labelCls} style={{ color: c.muted }}>Category name *</label>
          <input
            className={fieldCls}
            style={{ borderColor: c.line }}
            placeholder="e.g. Starters"
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
            onFocus={(e) => (e.target.style.borderColor = "#2563EB")}
            onBlur={(e) => (e.target.style.borderColor = c.line)}
          />
        </div>
      </div>
    </Modal>
  );
};

// Icons cycle for visual variety in the list, purely decorative — does not affect data
const rowIcons = [FaListAlt, FaListAlt, FaListAlt];

const InventoryCategoriesPage = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [toast, setToast] = useState({ open: false, type: "success", title: "", message: "" });

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await fetchInventoryMasterRecords("menu-categories");
      setCategories(Array.isArray(res) ? res : []);
    } catch { setCategories([]); } finally { setLoading(false); }
  };
  useEffect(() => { fetchCategories(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => String(c.name || "").toLowerCase().includes(q));
  }, [categories, search]);

  const handleSave = async (formData) => {
    try {
      const payload = { name: formData.name, status: formData.status };
      if (editingCat) {
        await updateInventoryMasterRecord("menu-categories", editingCat.id, payload);
        setToast({ open: true, type: "success", title: "Updated", message: `${formData.name} updated.` });
      } else {
        await createInventoryMasterRecord("menu-categories", payload);
        setToast({ open: true, type: "success", title: "Added", message: `${formData.name} added.` });
      }
      setShowForm(false); setEditingCat(null); await fetchCategories();
    } catch (err) {
      setToast({ open: true, type: "error", title: "Save failed", message: err.response?.data?.message || "Could not save." });
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteInventoryMasterRecord("menu-categories", deletingId);
      setToast({ open: true, type: "success", title: "Deleted", message: "Category removed." });
      setDeletingId(null); await fetchCategories();
    } catch (err) {
      setToast({ open: true, type: "error", title: "Delete failed", message: err.response?.data?.message || "Could not delete." });
      setDeletingId(null);
    }
  };

  return (
    <div
      className="min-h-screen w-full max-w-full overflow-x-hidden relative px-4 pt-5 pb-14 sm:px-7 sm:pt-7 sm:pb-16"
      style={{
        background: "linear-gradient(180deg, #F5F9FF 0%, #F0F5FD 45%, #EEF3FC 100%)",
        color: c.text,
      }}
    >
      {/* subtle abstract shape, decorative only */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -z-0"
        style={{
          left: "-8%", bottom: "-14%", width: "560px", height: "360px",
          background: "radial-gradient(closest-side, rgba(37,99,235,0.10), rgba(37,99,235,0))",
          borderRadius: "50%",
        }}
      />

      {/* Header */}
      <BackButton className="shrink-0" />
      <div className="relative flex flex-col sm:flex-row sm:items-center items-stretch justify-between flex-wrap gap-3 sm:gap-4 mb-5 sm:mb-7">
                  

        <div className="flex items-center gap-3 sm:gap-4">
         
          <div
            className="flex items-center justify-center shrink-0 text-white w-[42px] h-[42px] sm:w-[46px] sm:h-[46px] md:w-[58px] md:h-[58px] text-[17px] sm:text-[19px] md:text-[24px] rounded-[14px] sm:rounded-[16px] md:rounded-[18px]"
            style={{
              background: "linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)",
              boxShadow: "0 10px 24px rgba(37,99,235,0.28)",
            }}
          >
            <FaListAlt />
          </div>
          <div className="min-w-0">
            <h1 className="m-0 leading-tight font-bold text-[20px] sm:text-[22px] md:text-[38px]" style={{ color: c.navy, letterSpacing: "-0.02em" }}>
              Menu Categories
            </h1>
            <p className="m-0 mt-0.5 sm:mt-1 text-[13px] sm:text-[14.5px] md:text-[19px]" style={{ color: c.slate }}>
              Organize your menu items into categories
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => { setEditingCat(null); setShowForm(true); }}
          className={`${primaryBtn} w-full sm:w-auto h-[40px] sm:h-[42px] md:h-[48px] text-[13px] sm:text-[14px] md:text-[15px]`}
          style={{
            background: "linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)",
            padding: "0 20px sm:px-5 md:px-6",
            boxShadow: "0 10px 24px rgba(37,99,235,0.28)",
          }}
        >
          <FaPlus className="text-xs sm:text-sm" /> Add Category
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4 sm:mb-5 md:mb-6">
        <div className="relative w-full">
          <FaSearch className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-[13px] sm:text-[14px] md:text-[16px]" style={{ color: "#94A3B8" }} />
          <input
            className="w-full rounded-[14px] sm:rounded-[16px] border bg-white pl-10 sm:pl-12 pr-4 font-medium outline-none transition-all duration-250 h-[48px] sm:h-[52px] md:h-[58px] text-[13px] sm:text-[14px] md:text-[15px]"
            style={{ borderColor: c.line, boxShadow: "0 1px 3px rgba(15,42,92,0.05)" }}
            placeholder="Search categories…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={(e) => {
              e.target.style.borderColor = "#2563EB";
              e.target.style.boxShadow = "0 0 0 4px rgba(37,99,235,0.12)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = c.line;
              e.target.style.boxShadow = "0 1px 3px rgba(15,42,92,0.05)";
            }}
          />
        </div>
      </div>

      {/* Categories - Desktop table / Mobile cards */}
      <div
        className="relative bg-white overflow-hidden"
        style={{ borderRadius: "18px sm:rounded-[22px] md:rounded-[22px]", border: `1px solid ${c.line}`, boxShadow: "0 1px 3px rgba(15,42,92,0.06)" }}
      >
        {/* Desktop / Tablet table (md and up) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[560px] text-left">
            <thead>
              <tr>
                <th
                  className="text-left font-bold uppercase tracking-[0.05em] py-3 md:py-4 px-4 md:px-6 border-b"
                  style={{ fontSize: "12px md:text-[13px]", color: "#2563EB", borderColor: c.line }}
                >
                  Name
                </th>
                <th
                  className="text-left font-bold uppercase tracking-[0.05em] py-3 md:py-4 px-4 md:px-6 border-b w-[120px] md:w-[140px]"
                  style={{ fontSize: "12px md:text-[13px]", color: "#2563EB", borderColor: c.line }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={2} className="py-10 md:py-14 text-center" style={{ color: c.muted, fontSize: "14px md:text-[15px]" }}>
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={2}>
                    <div className="flex flex-col items-center text-center py-12 md:py-16 px-4 md:px-6">
                      <div
                        className="flex items-center justify-center mb-3 md:mb-4 w-[48px] h-[48px] sm:w-[56px] sm:h-[56px] md:w-[72px] md:h-[72px] rounded-[14px] sm:rounded-[16px] md:rounded-[20px]"
                        style={{ background: "#EAF1FF" }}
                      >
                        <FaListAlt className="text-[20px] sm:text-[22px] md:text-[28px]" style={{ color: "#2563EB" }} />
                      </div>
                      <b className="block mb-1 text-[16px] sm:text-[18px] md:text-[21px]" style={{ color: c.navy }}>No categories</b>
                      <span className="text-[13px] sm:text-[14.5px] md:text-[17px]" style={{ color: c.muted }}>Add your first category.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((cat, idx) => (
                  <tr
                    key={cat.id}
                    className="group transition-colors"
                    style={{ borderBottom: idx === filtered.length - 1 ? "none" : `1px solid ${c.line}` }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#F7FAFF")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td className="py-3 md:py-4 px-4 md:px-6">
                      <div className="flex items-center gap-2.5 sm:gap-3.5">
                        <div
                          className="flex items-center justify-center shrink-0"
                          style={{ width: "38px sm:w-[44px] md:w-[44px]", height: "38px sm:h-[44px] md:h-[44px]", borderRadius: "11px sm:rounded-[13px] md:rounded-[13px]", background: "#EAF1FF" }}
                        >
                          <FaListAlt style={{ color: "#2563EB", fontSize: "16px sm:text-[18px] md:text-[18px]" }} />
                        </div>
                        <span className="font-bold break-words min-w-0" style={{ fontSize: "15px sm:text-[17px] md:text-[17px]", color: c.navy }}>
                          {cat.name || "-"}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 md:py-4 px-4 md:px-6">
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setEditingCat(cat); setShowForm(true); }}
                          className={editBtn}
                          style={{ background: "#EAF1FF", color: "#2563EB" }}
                        >
                          <FaEdit />
                        </button>
                        <button
                          onClick={() => setDeletingId(cat.id)}
                          className={dangerBtn}
                          style={{ background: "#FEF2F2", color: "#DC2626" }}
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile card list (below md) */}
        <div className="md:hidden p-3 sm:p-4">
          {loading ? (
            <div className="py-10 text-center text-[14px]" style={{ color: c.muted }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center text-center py-12 px-4">
              <div className="flex items-center justify-center mb-3 w-[48px] h-[48px] rounded-[14px]" style={{ background: "#EAF1FF" }}>
                <FaListAlt className="text-[20px]" style={{ color: "#2563EB" }} />
              </div>
              <b className="block mb-1 text-[16px]" style={{ color: c.navy }}>No categories</b>
              <span className="text-[13px]" style={{ color: c.muted }}>Add your first category.</span>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 sm:gap-3">
              {filtered.map((cat) => (
                <div key={cat.id} className="bg-white border border-[#E7EEFB] rounded-[18px] sm:rounded-[20px] p-3.5 sm:p-4 shadow-[0_4px_16px_rgba(11,30,77,0.06)]">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center justify-center shrink-0 w-[38px] h-[38px] rounded-[12px]" style={{ background: "#EAF1FF" }}>
                      <FaListAlt className="text-[16px]" style={{ color: "#2563EB" }} />
                    </div>
                    <span className="font-bold text-[15px] sm:text-[16px] break-words" style={{ color: c.navy }}>
                      {cat.name || "-"}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setEditingCat(cat); setShowForm(true); }}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-[14px] border border-[#BFD6FB] bg-[#EAF2FE] px-3 py-2 text-[13px] sm:text-[14px] font-bold text-[#1D4ED8] transition-all duration-200 hover:bg-[#DCEAFE] active:scale-[0.97]"
                    >
                      <FaEdit className="text-xs" /> Edit
                    </button>
                    <button
                      onClick={() => setDeletingId(cat.id)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-[14px] border border-rose-100 bg-rose-50 px-3 py-2 text-[13px] sm:text-[14px] font-bold text-rose-700 transition-all duration-200 hover:bg-rose-100 active:scale-[0.97]"
                    >
                      <FaTrash className="text-xs" /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <CategoryFormModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditingCat(null); }}
        onSave={handleSave}
        initial={editingCat}
      />
      <ConfirmDelete
        open={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        name={categories.find((c) => c.id === deletingId)?.name}
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

export default InventoryCategoriesPage;