// src/pages/InventoryStockCategoriesPage.jsx
// Stock categories + subcategories management — fetches from /api/inventory-masters/stock-categories

import React, { useEffect, useMemo, useState } from "react";
import {
  FaPlus,
  FaSearch,
  FaEdit,
  FaTrash,
  FaTimes,
  FaCheckCircle,
  FaExclamationTriangle,
  FaListAlt,
  FaTag,
  FaLayerGroup,
  FaBoxOpen,
} from "react-icons/fa";

import {
  createInventoryMasterRecord,
  deleteInventoryMasterRecord,
  fetchInventoryMasterRecords,
  updateInventoryMasterRecord,
} from "../services/inventoryMastersService";

import BackButton from "../components/Inventory/BackButton";

/* ------------------------------------------------------------------ */
/* Design tokens — premium blue & white theme                         */
/* ------------------------------------------------------------------ */
const c = {
  bgTop: "#EEF2FC",
  bgBottom: "#E4EBFB",
  card: "#FFFFFF",
  line: "#E7ECF8",
  navy: "#0F1B3D",
  muted: "#8790A6",
  blue: "#2148E0",
  blueDeep: "#1A38B8",
  blueSoft: "#EAF0FE",
  blueSofter: "#F4F7FE",
  red: "#E14B4B",
  redSoft: "#FDECEC",
};

const fieldCls =
  "w-full rounded-[16px] border border-[#E7ECF8] bg-white px-4 py-3.5 text-[15px] font-medium text-[#0F1B3D] shadow-[0_2px_10px_rgba(33,72,224,0.04)] transition-all duration-250 placeholder:text-[#A6ADC2] focus:border-[#2148E0] focus:outline-none focus:ring-4 focus:ring-[#2148E0]/10";
const labelCls =
  "mb-2 block text-[13px] font-semibold uppercase tracking-[0.06em] text-[#8790A6]";
const primaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-[16px] px-5 py-3 text-[15px] font-semibold text-white transition-all duration-250 shadow-[0_10px_24px_rgba(33,72,224,0.28)] hover:shadow-[0_14px_30px_rgba(33,72,224,0.36)] hover:-translate-y-[1px] active:translate-y-0";
const primaryBtnBg = { background: `linear-gradient(135deg, ${c.blue}, ${c.blueDeep})` };
const ghostBtn =
  "inline-flex items-center justify-center gap-2 rounded-[16px] px-5 py-3 text-[15px] font-semibold border border-[#E7ECF8] text-[#0F1B3D] bg-white hover:bg-[#F4F7FE] transition-all duration-250";
const dangerBtn =
  "inline-flex items-center justify-center rounded-[12px] p-3 text-[15px] font-semibold border border-transparent bg-[#FDECEC] text-[#E14B4B] hover:bg-[#FBDADA] hover:-translate-y-[1px] transition-all duration-250 shadow-sm";
const editBtn =
  "inline-flex items-center justify-center rounded-[12px] p-3 text-[15px] font-semibold border border-transparent bg-[#EAF0FE] text-[#2148E0] hover:bg-[#DCE7FD] hover:-translate-y-[1px] transition-all duration-250 shadow-sm";

/* ------------------------------------------------------------------ */
/* Modal                                                               */
/* ------------------------------------------------------------------ */
const Modal = ({ open, onClose, title, subtitle, children, actions }) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[#0B1638]/50 px-4 py-6 backdrop-blur-sm animate-[fadeIn_0.2s_ease]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[540px] max-h-[88vh] overflow-y-auto rounded-[24px] bg-white p-6 sm:p-7 shadow-[0_30px_90px_rgba(15,27,61,0.28)] animate-[popIn_0.25s_cubic-bezier(0.16,1,0.3,1)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <h3 className="text-[22px] font-bold text-[#0F1B3D] m-0">{title}</h3>
            {subtitle && (
              <p className="text-[14px] text-[#8790A6] mt-1">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-full p-2 text-[#8790A6] hover:bg-[#F4F7FE] hover:text-[#0F1B3D] transition-colors"
            type="button"
          >
            <FaTimes className="text-lg" />
          </button>
        </div>
        <div className="text-[15px]">{children}</div>
        {actions && (
          <div className="mt-6 flex flex-wrap justify-end gap-3">{actions}</div>
        )}
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes popIn { from { opacity: 0; transform: translateY(8px) scale(0.98) } to { opacity: 1; transform: translateY(0) scale(1) } }
      `}</style>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Toast                                                                */
/* ------------------------------------------------------------------ */
const Toast = ({ open, type, title, message, onClose }) => {
  if (!open) return null;
  const isSuccess = type === "success";
  const tone = isSuccess ? "text-[#1B7A4C]" : "text-[#E14B4B]";
  const iconBg = isSuccess ? "bg-[#E4F7ED]" : "bg-[#FDECEC]";
  const Icon = isSuccess ? FaCheckCircle : FaExclamationTriangle;
  return (
    <div className="fixed left-4 right-4 bottom-4 sm:left-auto sm:right-6 sm:bottom-6 z-[90] flex items-center gap-3.5 rounded-[18px] bg-white border border-[#E7ECF8] px-5 py-4 shadow-[0_20px_50px_rgba(15,27,61,0.18)] w-auto sm:max-w-sm animate-[slideUp_0.25s_cubic-bezier(0.16,1,0.3,1)]">
      <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${iconBg} ${tone}`}>
        <Icon className="text-lg" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[14.5px] font-bold text-[#0F1B3D]">{title}</div>
        <div className="text-[13px] text-[#8790A6] break-words sm:truncate">{message}</div>
      </div>
      <button
        onClick={onClose}
        className="shrink-0 rounded-full p-1.5 text-[#8790A6] hover:bg-[#F4F7FE] hover:text-[#0F1B3D] transition-colors"
      >
        <FaTimes className="text-sm" />
      </button>
      <style>{`
        @keyframes slideUp { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Delete confirmation                                                 */
/* ------------------------------------------------------------------ */
const ConfirmDelete = ({ open, onClose, onConfirm, name }) => (
  <Modal
    open={open}
    onClose={onClose}
    title="Delete category?"
    subtitle={`"${name || "this category"}" will be removed.`}
    actions={
      <>
        <button onClick={onClose} className={ghostBtn}>
          Cancel
        </button>
        <button
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className="inline-flex items-center justify-center gap-2 rounded-[16px] px-5 py-3 text-[15px] font-semibold text-white bg-[#E14B4B] hover:bg-[#CC3F3F] hover:-translate-y-[1px] transition-all duration-250 shadow-[0_10px_24px_rgba(225,75,75,0.28)]"
        >
          Delete
        </button>
      </>
    }
  >
    <div className="flex items-start gap-4 rounded-[16px] bg-[#FDECEC] border border-[#FBDADA] p-4">
      <div className="shrink-0 w-11 h-11 rounded-full bg-white flex items-center justify-center text-[#E14B4B] shadow-sm">
        <FaExclamationTriangle className="text-lg" />
      </div>
      <p className="text-[14.5px] text-[#7A2E2E] m-0 leading-relaxed">
        Are you sure? Items using this category may become uncategorized.
      </p>
    </div>
  </Modal>
);

/* ------------------------------------------------------------------ */
/* Add / Edit form modal                                               */
/* ------------------------------------------------------------------ */
const CategoryFormModal = ({ open, onClose, onSave, initial }) => {
  const [form, setForm] = useState({ name: "", subcategory: "", status: "Active" });

  useEffect(() => {
    if (open) {
      if (initial) {
        setForm({
          name: initial.name || "",
          subcategory: initial.subcategory || "",
          status: initial.status || "Active",
        });
      } else {
        setForm({ name: "", subcategory: "", status: "Active" });
      }
    }
  }, [open, initial]);

  const setField = (name, value) => setForm((p) => ({ ...p, [name]: value }));
  const handleSubmit = () => {
    if (!form.name.trim()) return;
    onSave({
      name: form.name.trim(),
      subcategory: form.subcategory.trim() || null,
      status: form.status,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Edit category" : "Add category"}
      subtitle={initial ? "Update category and subcategory" : "Create a new item category"}
      actions={
        <>
          <button onClick={onClose} className={ghostBtn}>
            Cancel
          </button>
          <button onClick={handleSubmit} className={primaryBtn} style={primaryBtnBg}>
            {initial ? "Save" : "Add category"}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-5">
        <div className="field">
          <label className={labelCls}>Main category *</label>
          <input
            className={fieldCls}
            placeholder="e.g. Vegetables, Dairy, Spices"
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
          />
        </div>
        <div className="field">
          <label className={labelCls}>Subcategory</label>
          <input
            className={fieldCls}
            placeholder="e.g. Root, Leafy, Organic (optional)"
            value={form.subcategory}
            onChange={(e) => setField("subcategory", e.target.value)}
          />
        </div>
        <div className="field">
          <label className={labelCls}>Status</label>
          <select
            className={fieldCls}
            value={form.status}
            onChange={(e) => setField("status", e.target.value)}
          >
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>
    </Modal>
  );
};

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */
const InventoryStockCategoriesPage = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [toast, setToast] = useState({ open: false, type: "success", title: "", message: "" });

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await fetchInventoryMasterRecords("stock-categories");
      setRecords(Array.isArray(res) ? res : []);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) =>
      [r.name, r.subcategory].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))
    );
  }, [records, search]);

  const handleSave = async (formData) => {
    try {
      if (editingRecord) {
        await updateInventoryMasterRecord("stock-categories", editingRecord.id, formData);
        setToast({ open: true, type: "success", title: "Updated", message: `${formData.name} updated.` });
      } else {
        await createInventoryMasterRecord("stock-categories", formData);
        setToast({ open: true, type: "success", title: "Added", message: `${formData.name} added.` });
      }
      setShowForm(false);
      setEditingRecord(null);
      await fetchRecords();
    } catch (err) {
      setToast({
        open: true,
        type: "error",
        title: "Save failed",
        message: err.response?.data?.message || "Could not save.",
      });
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteInventoryMasterRecord("stock-categories", deletingId);
      setToast({ open: true, type: "success", title: "Deleted", message: "Category removed." });
      setDeletingId(null);
      await fetchRecords();
    } catch (err) {
      setToast({
        open: true,
        type: "error",
        title: "Delete failed",
        message: err.response?.data?.message || "Could not delete.",
      });
      setDeletingId(null);
    }
  };

  return (
    <div
      className="relative min-h-screen w-full max-w-full overflow-x-hidden"
      style={{
        background: `linear-gradient(160deg, ${c.bgTop} 0%, ${c.bgBottom} 100%)`,
        color: c.navy,
      }}
    >
      {/* Abstract background shapes */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <svg
          className="absolute bottom-0 left-0 w-full h-[380px] opacity-70"
          viewBox="0 0 1600 400"
          preserveAspectRatio="none"
        >
          <path
            d="M0,260 C280,180 480,340 760,300 C1040,260 1220,120 1600,220 L1600,400 L0,400 Z"
            fill="#DCE6FB"
          />
          <path
            d="M0,320 C260,260 520,380 820,340 C1120,300 1300,220 1600,300 L1600,400 L0,400 Z"
            fill="#E9EFFC"
          />
        </svg>
        <div className="absolute -top-24 -right-24 w-[420px] h-[420px] rounded-full bg-[#DCE6FB] opacity-50 blur-3xl" />
      </div>

      <div className="relative z-10 px-5 sm:px-8 lg:px-12 py-8 sm:py-10 pb-16 w-full">
        {/* Header */}
       <BackButton className="shrink-0" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 mb-7">
          
          <div className="flex items-center gap-4">
           
            <div
              className="w-[64px] h-[64px] rounded-[20px] flex items-center justify-center text-white text-[26px] shadow-[0_14px_30px_rgba(33,72,224,0.32)] shrink-0"
              style={{ background: `linear-gradient(135deg, ${c.blue}, ${c.blueDeep})` }}
            >
              <FaListAlt />
            </div>
            <div>
              <h1 className="text-[22px] sm:text-[34px] font-extrabold m-0 leading-tight tracking-[-0.01em] text-[#0F1B3D]">
                Item Categories &amp; Subcategories
              </h1>
              <p className="m-0 mt-1 text-[12px] sm:text-[17px]" style={{ color: c.muted }}>
                Manage categories and subcategories for items &amp; stock
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingRecord(null);
              setShowForm(true);
            }}
            className={`${primaryBtn} w-full sm:w-auto h-[48px] px-6 text-[16px]`}
            style={primaryBtnBg}
          >
            <FaPlus className="text-[15px]" /> Add Category
          </button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-2xl w-full">
            <FaSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-[#8790A6] text-[12px]" />
            <input
              className={`${fieldCls} pl-12 h-[48px]`}
              placeholder="Search categories or subcategories…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Mobile / tablet card list (below md) — desktop table is untouched and hidden here */}
        <div className="md:hidden">
          {loading ? (
            <div className="bg-white border border-[#E7ECF8] rounded-[20px] py-14 text-center text-[#8790A6] text-[15px] shadow-[0_18px_50px_rgba(15,27,61,0.08)]">
              Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white border border-[#E7ECF8] rounded-[20px] py-12 px-5 text-center shadow-[0_18px_50px_rgba(15,27,61,0.08)]">
              <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-[#F4F7FE] flex items-center justify-center text-[#2148E0] text-[26px]">
                <FaBoxOpen />
              </div>
              <b className="block text-[19px] text-[#0F1B3D] mb-1.5">No categories</b>
              <span className="text-[15px] text-[#8790A6]">Add your first category.</span>
            </div>
          ) : (
            <div className="flex flex-col gap-3.5">
              {filtered.map((rec) => (
                <div
                  key={rec.id}
                  className="bg-white border border-[#E7ECF8] rounded-[20px] p-4 shadow-[0_10px_30px_rgba(15,27,61,0.06)]"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-[#EAF0FE] flex items-center justify-center text-[#2148E0] text-[15px] shrink-0">
                      <FaTag />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11.5px] font-bold uppercase tracking-[0.05em] text-[#2148E0] mb-0.5">
                        Category
                      </div>
                      <div className="font-semibold text-[16px] text-[#0F1B3D] break-words">
                        {rec.name || "-"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-[#EAF0FE] flex items-center justify-center text-[#2148E0] text-[15px] shrink-0">
                      <FaLayerGroup />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11.5px] font-bold uppercase tracking-[0.05em] text-[#2148E0] mb-0.5">
                        Subcategory
                      </div>
                      <div className="text-[16px] text-[#0F1B3D] break-words">
                        {rec.subcategory || <span style={{ color: c.muted }}>—</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2.5 pt-3 border-t border-[#E7ECF8]">
                    <button
                      onClick={() => {
                        setEditingRecord(rec);
                        setShowForm(true);
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-2 min-h-[48px] rounded-[12px] text-[14.5px] font-semibold border border-transparent bg-[#EAF0FE] text-[#2148E0] active:bg-[#DCE7FD] transition-all duration-250"
                      aria-label="Edit category"
                    >
                      <FaEdit /> Edit
                    </button>
                    <button
                      onClick={() => setDeletingId(rec.id)}
                      className="flex-1 inline-flex items-center justify-center gap-2 min-h-[48px] rounded-[12px] text-[14.5px] font-semibold border border-transparent bg-[#FDECEC] text-[#E14B4B] active:bg-[#FBDADA] transition-all duration-250"
                      aria-label="Delete category"
                    >
                      <FaTrash /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Table card — md and up only; desktop layout unchanged */}
        <div className="hidden md:block bg-white border border-[#E7ECF8] rounded-[24px] overflow-hidden shadow-[0_18px_50px_rgba(15,27,61,0.08)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left">
              <thead>
                <tr className="bg-[#F7F9FE]">
                  <th className="text-left text-[13px] font-bold uppercase tracking-[0.05em] text-[#2148E0] py-4 px-6 border-b border-[#E7ECF8]">
                    <span className="inline-flex items-center gap-2">
                      <FaTag className="text-[12px]" /> Category
                    </span>
                  </th>
                  <th className="text-left text-[13px] font-bold uppercase tracking-[0.05em] text-[#2148E0] py-4 px-6 border-b border-[#E7ECF8]">
                    <span className="inline-flex items-center gap-2">
                      <FaLayerGroup className="text-[12px]" /> Subcategory
                    </span>
                  </th>
                  <th className="text-left text-[13px] font-bold uppercase tracking-[0.05em] text-[#2148E0] py-4 px-6 border-b border-[#E7ECF8] w-[140px]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7ECF8]">
                {loading ? (
                  <tr>
                    <td colSpan={3} className="py-16 text-center text-[#8790A6] text-[15px]">
                      Loading…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={3}>
                      <div className="text-center py-16 px-6">
                        <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-[#F4F7FE] flex items-center justify-center text-[#2148E0] text-[26px]">
                          <FaBoxOpen />
                        </div>
                        <b className="block text-[21px] text-[#0F1B3D] mb-1.5">No categories</b>
                        <span className="text-[16px] text-[#8790A6]">Add your first category.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((rec) => (
                    <tr key={rec.id} className="hover:bg-[#F7F9FE] transition-colors duration-200">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3.5">
                          <div className="w-10 h-10 rounded-full bg-[#EAF0FE] flex items-center justify-center text-[#2148E0] text-[15px] shrink-0">
                            <FaTag />
                          </div>
                          <span className="font-semibold text-[17px] text-[#0F1B3D]">
                            {rec.name || "-"}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        {rec.subcategory ? (
                          <div className="flex items-center gap-3.5">
                            <div className="w-10 h-10 rounded-full bg-[#EAF0FE] flex items-center justify-center text-[#2148E0] text-[15px] shrink-0">
                              <FaLayerGroup />
                            </div>
                            <span className="text-[17px] text-[#0F1B3D]">{rec.subcategory}</span>
                          </div>
                        ) : (
                          <span className="text-[16px]" style={{ color: c.muted }}>
                            —
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex gap-2.5">
                          <button
                            onClick={() => {
                              setEditingRecord(rec);
                              setShowForm(true);
                            }}
                            className={editBtn}
                            aria-label="Edit category"
                          >
                            <FaEdit />
                          </button>
                          <button
                            onClick={() => setDeletingId(rec.id)}
                            className={dangerBtn}
                            aria-label="Delete category"
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
        </div>
      </div>

      <CategoryFormModal
        open={showForm}
        onClose={() => {
          setShowForm(false);
          setEditingRecord(null);
        }}
        onSave={handleSave}
        initial={editingRecord}
      />
      <ConfirmDelete
        open={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        name={records.find((r) => r.id === deletingId)?.name}
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

export default InventoryStockCategoriesPage;