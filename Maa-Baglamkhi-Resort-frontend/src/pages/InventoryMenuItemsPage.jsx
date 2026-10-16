// src/pages/InventoryMenuItemsPage.jsx
// Menu Items — create/edit/delete with image upload
// Uses /api/restaurant/restaurant/menu (POST/PUT with multipart for image, GET for list)
//
// RESPONSIVE UPDATE NOTES:
// - Desktop (>=1280px / xl) layout, spacing, typography, and the table are byte-for-byte
//   the same as before — every place that changed uses an `xl:` breakpoint override so the
//   xl+ styling matches the original classes exactly.
// - Tablet/iPad (768px-1279px) now stacks the header, search bar, and category filter, with
//   slightly reduced padding, and shows the same card list used on mobile (no horizontal
//   scroll table).
// - Mobile (<=767px) renders the menu items as compact stacked cards instead of a table.
// - No functionality, API calls, validation, business logic, state, routing, filtering,
//   search, pagination, modals, or CRUD operations were changed — only JSX/layout/classes.

import React, { useEffect, useMemo, useState } from "react";
import {
  FaPlus, FaSearch, FaEdit, FaTrash, FaTimes,
  FaCheckCircle, FaExclamationTriangle, FaUtensils,
  FaThLarge, FaChevronDown, FaChevronLeft, FaChevronRight,
} from "react-icons/fa";

import API, { getBackendBaseURL } from "../api";

import BackButton from "../components/Inventory/BackButton";

const c = {
  pageBgFrom: "#EEF4FF",
  pageBgTo: "#F8FAFF",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E2E8F0",
  blue950: "#0B1F52",
  blue900: "#152A6B",
  blue800: "#1E40AF",
  sky500: "#0EA5E9",
};

const fieldCls =
  "w-full rounded-[18px] border border-[#E2E8F0] bg-white/90 px-4 py-3 text-[17px] font-medium text-[#0F172A] shadow-sm outline-none transition-all duration-200 focus:border-[#1E40AF] focus:ring-4 focus:ring-[#DBEAFE] placeholder:text-[#94A3B8]";

const labelCls =
  "mb-2 block text-[17.5px] font-semibold text-[#475569]";

const primaryBtn =
  "w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-[16px] px-6 py-3.5 text-[17.5px] font-semibold text-white bg-gradient-to-r from-[#0B1F52] via-[#1E40AF] to-[#0EA5E9] shadow-[0_12px_28px_rgba(30,64,175,0.35)] transition-all duration-200 hover:shadow-[0_16px_34px_rgba(30,64,175,0.45)] hover:brightness-105 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed";

const ghostBtn =
  "w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-[16px] px-6 py-3.5 text-[17.5px] font-semibold border border-[#E2E8F0] bg-white text-[#334155] transition-all duration-200 hover:bg-[#F1F5F9] hover:border-[#CBD5E1] disabled:opacity-60 disabled:cursor-not-allowed";

const dangerBtn =
  "inline-flex items-center justify-center gap-1.5 rounded-[12px] p-2.5 border border-[#FFD7D0] bg-[#FFF1EE] text-[#E1442E] transition-all duration-200 hover:bg-[#FFE1DA] hover:shadow-sm";

const editBtn =
  "inline-flex items-center justify-center gap-1.5 rounded-[12px] p-2.5 border border-[#DBEAFE] bg-[#EFF6FF] text-[#1E40AF] transition-all duration-200 hover:bg-[#DBEAFE] hover:shadow-sm";

// Convert DB-stored "/uploads/foo.jpg" into a full URL pointing at the backend.
// DB may return null, a relative path ("/uploads/foo.jpg"), or an absolute URL.
const resolveImageUrl = (raw) => {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;          // already absolute
  const base = getBackendBaseURL();
  const path = s.startsWith("/") ? s : `/${s}`;
  return `${base}${path}`;
};

const Modal = ({ open, onClose, title, subtitle, children, actions }) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[#0B1F52]/45 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[600px] max-h-[88vh] overflow-y-auto rounded-[28px] border border-white/60 bg-white p-6 sm:p-7 shadow-[0_30px_90px_rgba(11,31,82,0.28)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <h3 className="text-[23px] font-bold text-[#0B1F52] m-0">{title}</h3>
            {subtitle && <p className="text-[17px] text-[#64748B] mt-1">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-full p-2 text-[#64748B] hover:bg-[#F1F5F9] transition-colors"
            type="button"
          >
            <FaTimes className="text-lg" />
          </button>
        </div>
        <div className="text-[17px]">{children}</div>
        {actions && <div className="mt-6 flex flex-col-reverse sm:flex-row flex-wrap justify-end gap-3">{actions}</div>}
      </div>
    </div>
  );
};

const Toast = ({ open, type, title, message, onClose }) => {
  if (!open) return null;
  const tone =
    type === "success"
      ? "border-[#BBF3DA] text-[#047857]"
      : "border-[#FFD7D0] text-[#E1442E]";
  const iconBg = type === "success" ? "bg-[#D1FAE5]" : "bg-[#FFE1DA]";
  const Icon = type === "success" ? FaCheckCircle : FaExclamationTriangle;
  return (
    <div
      className={`fixed bottom-5 right-5 z-[90] flex items-center gap-3 rounded-[18px] border ${tone} bg-white/95 backdrop-blur-xl px-5 py-4 shadow-[0_20px_50px_rgba(15,23,42,0.15)] max-w-sm`}
    >
      <div className={`shrink-0 rounded-full p-2 ${iconBg}`}>
        <Icon className="text-lg" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[16.5px] font-bold">{title}</div>
        <div className="text-[15px] opacity-80 truncate">{message}</div>
      </div>
      <button onClick={onClose} className="shrink-0 rounded-full p-1 hover:bg-black/5">
        <FaTimes className="text-sm" />
      </button>
    </div>
  );
};

const ConfirmDelete = ({ open, onClose, onConfirm, name }) => (
  <Modal
    open={open}
    onClose={onClose}
    title="Delete menu item?"
    subtitle={`"${name || "this item"}" will be permanently removed.`}
    actions={
      <>
        <button onClick={onClose} className={ghostBtn}>Cancel</button>
        <button
          onClick={() => { onConfirm(); onClose(); }}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-[16px] px-6 py-3.5 text-[17.5px] font-semibold text-white bg-gradient-to-r from-[#E1442E] to-[#F0654F] shadow-[0_12px_28px_rgba(225,68,46,0.3)] hover:brightness-105 transition-all"
        >
          Delete
        </button>
      </>
    }
  >
    <p className="text-[17px] text-[#334155]">This cannot be undone. Any recipes linked to this item will be removed too.</p>
  </Modal>
);

const MenuItemFormModal = ({ open, onClose, onSave, initial, categories, saving }) => {
  const blank = { name: "", price: "", category: "Others", description: "", foodType: "Veg", status: "Available", tax: "5", imageFile: null, imagePreview: null };
  const [form, setForm] = useState(blank);

  useEffect(() => {
    if (open) {
      if (initial) {
        setForm({
          name: initial.name || "",
          price: String(initial.price ?? 0),
          category: initial.category || "Others",
          description: initial.description || "",
          foodType: initial.food_type || initial.foodType || "Veg",
          status: initial.status || "Available",
          tax: String(initial.tax ?? 5),
          imageFile: null,
          imagePreview: initial.image_url || null,
        });
      } else {
        setForm(blank);
      }
    }
  }, [open, initial]);

  const setField = (name, value) => setForm((p) => ({ ...p, [name]: value }));

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setForm((p) => ({ ...p, imageFile: file, imagePreview: URL.createObjectURL(file) }));
    }
  };

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    onSave(form);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Edit menu item" : "Add menu item"}
      subtitle={initial ? "Update item details and image" : "Add a new item to your menu with photo"}
      actions={
        <>
          <button onClick={onClose} className={ghostBtn} disabled={saving}>Cancel</button>
          <button onClick={handleSubmit} className={primaryBtn} disabled={saving}>
            {saving ? "Saving…" : (initial ? "Save changes" : "Add item")}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-5">
        <div className="field">
          <label className={labelCls}>Item name *</label>
          <input className={fieldCls} placeholder="e.g. Butter Chicken" value={form.name} onChange={(e) => setField("name", e.target.value)} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="field">
            <label className={labelCls}>Price (₹) *</label>
            <input type="number" className={fieldCls} placeholder="0" value={form.price} onChange={(e) => setField("price", e.target.value)} />
          </div>
          <div className="field">
            <label className={labelCls}>Category</label>
            <div className="relative">
              <select className={`${fieldCls} appearance-none pr-10`} value={form.category} onChange={(e) => setField("category", e.target.value)}>
                <option value="Others">Others</option>
                {categories.map((cat) => (<option key={cat.id} value={cat.name}>{cat.name}</option>))}
              </select>
              <FaChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#94A3B8] text-xs" />
            </div>
          </div>
        </div>
        <div className="field">
          <label className={labelCls}>Description</label>
          <textarea className={fieldCls} rows={2} placeholder="Short description…" value={form.description} onChange={(e) => setField("description", e.target.value)} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="field">
            <label className={labelCls}>Food type</label>
            <div className="relative">
              <select className={`${fieldCls} appearance-none pr-10`} value={form.foodType} onChange={(e) => setField("foodType", e.target.value)}>
                <option value="Veg">Veg</option><option value="Non-Veg">Non-Veg</option><option value="Egg">Egg</option>
              </select>
              <FaChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#94A3B8] text-xs" />
            </div>
          </div>
          <div className="field">
            <label className={labelCls}>Status</label>
            <div className="relative">
              <select className={`${fieldCls} appearance-none pr-10`} value={form.status} onChange={(e) => setField("status", e.target.value)}>
                <option value="Available">Available</option><option value="Unavailable">Unavailable</option>
              </select>
              <FaChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#94A3B8] text-xs" />
            </div>
          </div>
        </div>
        <div className="field">
          <label className={labelCls}>Image</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="block w-full text-[15px] text-[#64748B] file:mr-4 file:rounded-[12px] file:border-0 file:bg-[#EFF6FF] file:px-4 file:py-2.5 file:text-[15px] file:font-semibold file:text-[#1E40AF] hover:file:bg-[#DBEAFE] file:transition-colors"
          />
          {(() => {
            const src = resolveImageUrl(form.imagePreview || initial?.image_url);
            return src ? (
              <img src={src} alt="Preview" className="mt-3 h-[130px] w-auto rounded-[16px] border border-[#E2E8F0] object-cover shadow-sm" />
            ) : null;
          })()}
        </div>
      </div>
    </Modal>
  );
};

// `size="sm"` gives a smaller, compact badge for mobile/tablet cards.
// Default (no size prop) is completely unchanged, so the desktop table is untouched.
const StatusBadge = ({ children, tone, size }) => {
  const tones = {
    emerald: "bg-[#D1FAE5] text-[#047857]",
    rose: "bg-[#FFE1DA] text-[#E1442E]",
    amber: "bg-[#FEF0D5] text-[#C8791A]",
    blue: "bg-[#DBEAFE] text-[#1E40AF]",
  };
  const sizeCls =
    size === "sm"
      ? "px-2.5 py-0.5 text-[12.5px]"
      : "px-3.5 py-1 text-[15.5px]";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-bold ${sizeCls} ${tones[tone]}`}>
      {children}
    </span>
  );
};

const InventoryMenuItemsPage = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [categories, setCategories] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ open: false, type: "success", title: "", message: "" });

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await API.get("/restaurant/menu");
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch { setItems([]); } finally { setLoading(false); }
  };

  const fetchCategories = async () => {
    try {
      const res = await API.get("/inventory-masters/menu-categories");
      setCategories(Array.isArray(res.data) ? res.data : []);
    } catch { setCategories([]); }
  };

  useEffect(() => { fetchItems(); fetchCategories(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((m) => {
      const matchesSearch = !q || [m.name, m.category].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
      const matchesCat = categoryFilter === "all" || String(m.category || "").toLowerCase() === categoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [items, search, categoryFilter]);

  const uniqueCategories = useMemo(() => {
    const cats = new Set(items.map((i) => i.category).filter(Boolean));
    return Array.from(cats);
  }, [items]);

  const handleSave = async (formData) => {
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("name", formData.name);
      fd.append("price", formData.price || "0");
      fd.append("category", formData.category || "Others");
      fd.append("description", formData.description || "");
      fd.append("foodType", formData.foodType || "Veg");
      fd.append("status", formData.status || "Available");
      fd.append("tax", formData.tax || "5");
      if (formData.imageFile) {
        fd.append("image", formData.imageFile);
      } else if (!editingItem && formData.imagePreview) {
        // For new items, imagePreview is a blob: URL — send the original raw value (none yet)
        fd.append("imageUrl", "");
      } else if (editingItem?.image_url) {
        // Backend's updateMenuItem reads BOTH `imageUrl` (body) and `existingImageUrl`.
        // Sending `existingImageUrl` is the safe choice — it keeps the previous image
        // when the user edits without picking a new file.
        fd.append("existingImageUrl", editingItem.image_url);
      }

      if (editingItem) {
        await API.put(`/restaurant/menu/${editingItem.id}`, fd);
        setToast({ open: true, type: "success", title: "Updated", message: `${formData.name} updated.` });
      } else {
        await API.post("/restaurant/menu", fd);
        setToast({ open: true, type: "success", title: "Added", message: `${formData.name} added to menu.` });
      }
      setShowForm(false); setEditingItem(null); await fetchItems();
    } catch (err) {
      setToast({ open: true, type: "error", title: "Save failed", message: err.response?.data?.message || err.message || "Could not save." });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingItem) return;
    try {
      await API.delete(`/restaurant/menu/${deletingItem.id}`);
      setToast({ open: true, type: "success", title: "Deleted", message: "Item removed." });
      setDeletingItem(null); await fetchItems();
    } catch (err) {
      setToast({ open: true, type: "error", title: "Delete failed", message: err.response?.data?.message || "Could not delete." });
    }
  };

  const openAdd = () => { setEditingItem(null); setShowForm(true); };

  const foodTypeTone = (ft) => (ft === "Veg" ? "emerald" : ft === "Non-Veg" ? "rose" : "amber");

  return (
    <div
      className="min-h-screen w-full max-w-full overflow-x-hidden px-4 py-4 md:px-6 md:py-6 xl:px-[22px] xl:pt-[28px] xl:pb-[60px]"
      style={{
        background: `linear-gradient(180deg, ${c.pageBgFrom} 0%, ${c.pageBgTo} 55%, #FFFFFF 100%)`,
        color: c.text,
      }}
    >
      <div className="w-full min-w-0 rounded-[24px] sm:rounded-[28px] xl:rounded-[32px] border border-white/60 bg-white/70 backdrop-blur-xl shadow-[0_30px_80px_rgba(30,64,175,0.10)] p-4 sm:p-5 md:p-6 xl:p-7">
        {/* Hero */}
         <BackButton className="shrink-0" />
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 mb-5 xl:mb-6">
        
          <div className="flex items-center gap-3.5 min-w-0">
           
            <div
              className="w-[52px] h-[52px] rounded-2xl flex items-center justify-center text-white text-[22px] shrink-0 shadow-[0_10px_24px_rgba(11,31,82,0.35)]"
              style={{ background: `linear-gradient(135deg, ${c.blue950}, ${c.sky500})` }}
            >
              <FaUtensils />
            </div>
            <div className="min-w-0">
              <h1 className="text-[21px] font-semibold m-0 leading-tight text-[#0B1F52]">Menu Items</h1>
              <p className="m-0 text-[15px] sm:text-[16px] xl:text-[19px] mt-0.5" style={{ color: c.muted }}>
                Create menu items with photos — used in table bookings
              </p>
            </div>
          </div>
          <button type="button" onClick={openAdd} className={`${primaryBtn} w-full xl:w-auto`}>
            <FaPlus className="text-sm" /> Add Menu Item
          </button>
        </div>

        {/* Search + filter */}
        <div className="flex flex-col xl:flex-row gap-3 mb-5 xl:mb-6">
          <div className="relative flex-1 min-w-0 xl:min-w-[240px]">
            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8] text-sm" />
            <input
              className={`${fieldCls} pl-11`}
              placeholder="Search menu items…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="relative w-full xl:w-[220px]">
            <FaThLarge className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1E40AF] text-sm" />
            <select
              className={`${fieldCls} appearance-none pl-11 pr-10`}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All categories</option>
              {uniqueCategories.map((cat) => (<option key={cat} value={cat.toLowerCase()}>{cat}</option>))}
            </select>
            <FaChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#94A3B8] text-xs" />
          </div>
        </div>

        {/* Data area: desktop table (xl+) / mobile & tablet cards (below xl) */}
        <div className="bg-white/90 backdrop-blur-xl border border-[#DBEAFE]/70 rounded-[20px] xl:rounded-[26px] overflow-hidden shadow-[0_20px_50px_rgba(30,64,175,0.08)]">

          {/* ===== Desktop table (unchanged) ===== */}
          <div className="hidden xl:block overflow-x-auto">
            <table className="w-full min-w-[640px] xl:min-w-[700px] text-left">
              <thead>
                <tr className="bg-gradient-to-r from-[#EFF6FF] to-[#F0F9FF]">
                  <th className="text-left text-[16.5px] font-bold text-[#1E3A8A]/70 py-3 pl-3 pr-2 xl:py-4 xl:pl-5 xl:pr-4 border-b border-[#DBEAFE] w-[70px] xl:w-[90px]">Img</th>
                  <th className="text-left text-[16.5px] font-bold text-[#1E3A8A]/70 py-3 pr-2 xl:py-4 xl:pr-4 border-b border-[#DBEAFE]">Name</th>
                  <th className="text-left text-[16.5px] font-bold text-[#1E3A8A]/70 py-3 pr-2 xl:py-4 xl:pr-4 border-b border-[#DBEAFE]">Category</th>
                  <th className="text-left text-[16.5px] font-bold text-[#1E3A8A]/70 py-3 pr-2 xl:py-4 xl:pr-4 border-b border-[#DBEAFE]">Price (₹)</th>
                  <th className="text-left text-[16.5px] font-bold text-[#1E3A8A]/70 py-3 pr-2 xl:py-4 xl:pr-4 border-b border-[#DBEAFE]">Type</th>
                  <th className="text-left text-[16.5px] font-bold text-[#1E3A8A]/70 py-3 pr-2 xl:py-4 xl:pr-4 border-b border-[#DBEAFE]">Status</th>
                  <th className="text-left text-[16.5px] font-bold text-[#1E3A8A]/70 py-3 pr-3 xl:py-4 xl:pr-5 border-b border-[#DBEAFE] w-[100px] xl:w-[130px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF2F9]">
                {loading ? (
                  <tr><td colSpan={7} className="py-14 text-center text-[18px] text-[#64748B]">Loading…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="text-center py-14 text-[#64748B]">
                        <b className="block text-[21px] text-[#0F172A] mb-1.5">No menu items</b>
                        <span className="text-[17.5px]">Add your first item with a photo.</span>
                      </div>
                    </td>
                  </tr>
                ) : filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-[#F5F9FF] transition-colors duration-150">
                    <td className="py-2.5 pl-3 pr-2 xl:py-3 xl:pl-5 xl:pr-3">
                      {resolveImageUrl(item.image_url) ? (
                        <img src={resolveImageUrl(item.image_url)} alt={item.name} className="h-[44px] w-[44px] xl:h-[64px] xl:w-[64px] rounded-xl xl:rounded-2xl object-cover border border-[#E2E8F0] shadow-sm" />
                      ) : (
                        <div className="h-[44px] w-[44px] xl:h-[64px] xl:w-[64px] rounded-xl xl:rounded-2xl bg-[#F1F5F9] border border-[#E2E8F0] flex items-center justify-center text-[#94A3B8] text-[11px] xl:text-[13px] font-medium">No img</div>
                      )}
                    </td>
                    <td className="py-2.5 pr-2 xl:py-3 xl:pr-3 text-[18px] font-semibold text-[#0F172A]">{item.name || "-"}</td>
                    <td className="py-2.5 pr-2 xl:py-3 xl:pr-3 text-[17.5px] text-[#334155]">{item.category || "-"}</td>
                    <td className="py-2.5 pr-2 xl:py-3 xl:pr-3 text-[17.5px] font-medium text-[#0F172A]">{item.price ? Number(item.price).toFixed(2) : "-"}</td>
                    <td className="py-2.5 pr-2 xl:py-3 xl:pr-3">
                      <StatusBadge tone={foodTypeTone(item.food_type)}>{item.food_type || "Veg"}</StatusBadge>
                    </td>
                    <td className="py-2.5 pr-2 xl:py-3 xl:pr-3">
                      <StatusBadge tone={item.availability_status === "Available" || item.status === "Available" ? "blue" : "amber"}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
                        {item.availability_status || item.status || "Available"}
                      </StatusBadge>
                    </td>
                    <td className="py-2.5 pr-3 xl:py-3 xl:pr-5">
                      <div className="flex gap-2">
                        <button onClick={() => { setEditingItem(item); setShowForm(true); }} className={`${editBtn} min-w-[38px] min-h-[38px] xl:min-w-0 xl:min-h-0`}><FaEdit /></button>
                        <button onClick={() => { setDeletingItem(item); }} className={`${dangerBtn} min-w-[38px] min-h-[38px] xl:min-w-0 xl:min-h-0`}><FaTrash /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ===== Mobile & Tablet card list (below xl) ===== */}
          <div className="xl:hidden p-3 sm:p-4">
            {loading ? (
              <div className="py-14 text-center text-[16px] text-[#64748B]">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-14 text-[#64748B]">
                <b className="block text-[19px] sm:text-[21px] text-[#0F172A] mb-1.5">No menu items</b>
                <span className="text-[15px] sm:text-[16px]">Add your first item with a photo.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filtered.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[20px] border border-[#E2E8F0] bg-white p-3.5 sm:p-4 shadow-sm hover:shadow-md transition-shadow duration-150"
                  >
                    <div className="flex gap-3">
                      {resolveImageUrl(item.image_url) ? (
                        <img
                          src={resolveImageUrl(item.image_url)}
                          alt={item.name}
                          className="h-[56px] w-[56px] sm:h-[64px] sm:w-[64px] rounded-[16px] object-cover border border-[#E2E8F0] shadow-sm shrink-0"
                        />
                      ) : (
                        <div className="h-[56px] w-[56px] sm:h-[64px] sm:w-[64px] rounded-[16px] bg-[#F1F5F9] border border-[#E2E8F0] flex items-center justify-center text-[#94A3B8] text-[11px] font-medium shrink-0">
                          No img
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-[15px] font-semibold text-[#0F172A] truncate">{item.name || "-"}</div>
                        <div className="text-[14px] text-[#334155] truncate mt-0.5">{item.category || "-"}</div>
                        <div className="text-[15px] font-bold text-[#0B1F52] mt-1">
                          ₹{item.price ? Number(item.price).toFixed(2) : "-"}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <div className="rounded-[12px] bg-[#F8FAFF] border border-[#EEF2F9] px-3 py-2">
                        <div className="text-[13px] font-semibold text-[#94A3B8]">Type</div>
                        <div className="mt-1">
                          <StatusBadge tone={foodTypeTone(item.food_type)} size="sm">{item.food_type || "Veg"}</StatusBadge>
                        </div>
                      </div>
                      <div className="rounded-[12px] bg-[#F8FAFF] border border-[#EEF2F9] px-3 py-2">
                        <div className="text-[13px] font-semibold text-[#94A3B8]">Status</div>
                        <div className="mt-1">
                          <StatusBadge
                            tone={item.availability_status === "Available" || item.status === "Available" ? "blue" : "amber"}
                            size="sm"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
                            {item.availability_status || item.status || "Available"}
                          </StatusBadge>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => { setEditingItem(item); setShowForm(true); }}
                        className={`${editBtn} flex-1 !py-2.5`}
                      >
                        <FaEdit className="text-[13px]" />
                        <span className="text-[14px] font-semibold">Edit</span>
                      </button>
                      <button
                        onClick={() => { setDeletingItem(item); }}
                        className={`${dangerBtn} flex-1 !py-2.5`}
                      >
                        <FaTrash className="text-[13px]" />
                        <span className="text-[14px] font-semibold">Delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pagination footer (display only) — shared by table & card views */}
          <div className="flex flex-col xl:flex-row items-center justify-center xl:justify-between gap-3 px-4 xl:px-5 py-4 border-t border-[#EEF2F9] bg-[#FAFCFF] text-center xl:text-left">
            <span className="text-[15px] xl:text-[16px] text-[#64748B]">
              Showing {filtered.length === 0 ? 0 : 1} to {filtered.length} of {filtered.length} items
            </span>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                disabled
                className="w-9 h-9 flex items-center justify-center rounded-[10px] border border-[#E2E8F0] bg-white text-[#94A3B8] disabled:opacity-60"
              >
                <FaChevronLeft className="text-xs" />
              </button>
              <span
                className="w-9 h-9 flex items-center justify-center rounded-[10px] text-white text-[15px] font-bold shadow-[0_6px_16px_rgba(30,64,175,0.35)]"
                style={{ background: `linear-gradient(135deg, ${c.blue950}, ${c.sky500})` }}
              >
                1
              </span>
              <button
                type="button"
                disabled
                className="w-9 h-9 flex items-center justify-center rounded-[10px] border border-[#E2E8F0] bg-white text-[#94A3B8] disabled:opacity-60"
              >
                <FaChevronRight className="text-xs" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <MenuItemFormModal open={showForm} onClose={() => { setShowForm(false); setEditingItem(null); }} onSave={handleSave} initial={editingItem} categories={categories} saving={saving} />
      <ConfirmDelete open={!!deletingItem} onClose={() => setDeletingItem(null)} onConfirm={handleDelete} name={deletingItem?.name} />
      <Toast open={toast.open} type={toast.type} title={toast.title} message={toast.message} onClose={() => setToast((t) => ({ ...t, open: false }))} />
    </div>
  );
};

export default InventoryMenuItemsPage;