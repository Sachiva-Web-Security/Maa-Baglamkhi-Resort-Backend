// src/pages/InventoryItemsPage.jsx
// Items & Stock list — fetches from /api/inventory
// Add / Edit via modal; page is the default landing for /inventory.
//
// ⚠️ RESPONSIVE PASS ONLY — Desktop (≥1280px / "xl") layout is untouched.
// Laptop (1024–1279px) uses the tablet/mobile stacked layout.
// Tablet (768–1023px) stacks the header, full-width search/filter, and
// keeps the table with a sticky header + horizontal scroll.
// Mobile (<768px) converts each row into a card.
// No functionality, API calls, state, validation, business logic,
// content or typography sizes were changed — only responsive layout classes.

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaPlus,
  FaSearch,
  FaEdit,
  FaEye,
  FaTimes,
  FaCheckCircle,
  FaExclamationTriangle,
  FaWarehouse,
  FaArrowLeft,
  FaChevronLeft,
  FaChevronRight,
  FaBoxOpen,
  FaLayerGroup,
} from "react-icons/fa";

import API, { getBackendBaseURL } from "../api";
import BackButton from "../components/Inventory/BackButton";

/* ── style tokens (Blue & White premium theme) ── */
const c = {
  ink: "#0B1E3D",
  paper: "#F4F8FF",
  panel: "#FFFFFF",
  line: "#E1EAFB",
  blue: "#1D4ED8",
  blueDeep: "#0B1E4D",
  sky: "#38BDF8",
  amber: "#B45309",
  rose: "#DC2626",
  muted: "#5B6B8C",
  text: "#0F1E3D",
};

const fieldCls =
  "w-full rounded-[14px] border border-[#DCE6FB] bg-white px-4 py-3 text-[17px] font-medium text-[#0F1E3D] shadow-sm transition-all duration-200 placeholder:text-[#8B98B8] placeholder:font-normal focus:border-[#1D4ED8] focus:outline-none focus:ring-4 focus:ring-[#1D4ED8]/12";

const labelCls = "mb-1.5 block text-[17px] font-semibold text-[#33456B]";

const primaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-[14px] px-5 py-3 min-h-[44px] text-[17px] font-semibold transition-all duration-200 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-white shadow-[0_10px_24px_-8px_rgba(29,78,216,0.55)] hover:shadow-[0_14px_30px_-8px_rgba(29,78,216,0.65)] hover:-translate-y-[1px]";
const primaryBtnStyle = { backgroundImage: "linear-gradient(135deg,#1D4ED8 0%,#2563EB 55%,#38BDF8 100%)" };

const ghostBtn =
  "inline-flex items-center justify-center gap-2 rounded-[14px] px-5 py-3 min-h-[44px] text-[17px] font-semibold transition-all duration-200 active:scale-[0.97] bg-white border border-[#DCE6FB] text-[#0F1E3D] hover:bg-[#F0F5FF] hover:border-[#B9CDF7]";

const rowActionBtn = (tone = "neutral") => {
  const tones = {
    neutral: "border-[#DCE6FB] bg-white text-[#33456B] hover:bg-[#F0F5FF] hover:border-[#B9CDF7]",
    primary: "border-[#BFD6FB] bg-[#EAF2FE] text-[#1D4ED8] hover:bg-[#DCEAFE] hover:border-[#8FB6F5]",
  };
  return `inline-flex items-center justify-center gap-1.5 rounded-[12px] px-3.5 py-2 min-h-[44px] text-[16px] font-semibold border transition-all duration-200 hover:-translate-y-[1px] ${tones[tone] || tones.neutral}`;
};

/* ── badge color system (deterministic, cycles through a premium palette) ── */
const BADGE_PALETTE = [
  { bg: "#EAF2FE", text: "#1D4ED8", ring: "#CFE0FC" }, // blue
  { bg: "#ECFEFF", text: "#0E7490", ring: "#BAF3F9" }, // cyan
  { bg: "#F0FDF4", text: "#15803D", ring: "#C6F0D3" }, // green
  { bg: "#FEF3E9", text: "#B45309", ring: "#FBDFC0" }, // amber
  { bg: "#F5F0FE", text: "#7C3AED", ring: "#E1D4FB" }, // violet
  { bg: "#FEF1F5", text: "#BE185D", ring: "#FAD2E2" }, // pink
  { bg: "#EEF2FF", text: "#4338CA", ring: "#D6DDFB" }, // indigo
];

const hashStr = (str = "") => {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
};

const Badge = ({ value, fallback = "—" }) => {
  if (!value) return <span className="text-[17px]" style={{ color: c.muted }}>{fallback}</span>;
  const tone = BADGE_PALETTE[hashStr(String(value)) % BADGE_PALETTE.length];
  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1 text-[15px] font-semibold ring-1"
      style={{ background: tone.bg, color: tone.text, boxShadow: `inset 0 0 0 1px ${tone.ring}` }}
    >
      {value}
    </span>
  );
};

/* ── Modal ── */
const Modal = ({ open, onClose, title, subtitle, children, actions }) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[#0B1E3D]/55 px-3 sm:px-4 py-4 sm:py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[600px] max-h-[92vh] sm:max-h-[88vh] overflow-y-auto rounded-[22px] sm:rounded-[26px] bg-white p-4 sm:p-6 md:p-8 shadow-[0_40px_100px_rgba(11,30,77,0.35)] border border-[#EAF1FE]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4 sm:mb-5">
          <div>
            <h3 className="text-[24px] font-bold m-0" style={{ color: c.blueDeep }}>{title}</h3>
            {subtitle && <p className="text-[17px] mt-1" style={{ color: c.muted }}>{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-full p-2 text-[#5B6B8C] transition hover:bg-[#F0F5FF] hover:text-[#0F1E3D]"
            aria-label="Close"
            type="button"
          >
            <FaTimes className="text-lg" />
          </button>
        </div>
        <div className="text-[17px] leading-relaxed text-[#0F1E3D]">{children}</div>
        {actions && (
          <div className="mt-6 flex flex-col-reverse sm:flex-row sm:flex-wrap sm:justify-end gap-2.5 sm:gap-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};

/* ── Toast ── */
const Toast = ({ open, type, title, message, onClose }) => {
  if (!open) return null;
  const tone = type === "success" ? "bg-[#EAF7EF] text-[#15803D] border-[#CDEFDA]" : "bg-[#FDEEEC] text-[#DC2626] border-[#F8CFC9]";
  const Icon = type === "success" ? FaCheckCircle : FaExclamationTriangle;
  return (
    <div className={`fixed bottom-4 right-4 left-4 sm:left-auto sm:bottom-5 sm:right-5 z-[90] flex items-center gap-3 rounded-[16px] border ${tone} px-4 sm:px-5 py-4 shadow-[0_20px_50px_rgba(11,30,77,0.2)] sm:max-w-sm backdrop-blur-sm`}>
      <Icon className="text-xl shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[17px] font-bold">{title}</div>
        <div className="text-[15px] opacity-80 truncate">{message}</div>
      </div>
      <button type="button" onClick={onClose} className="shrink-0 rounded-full p-1 hover:bg-black/5">
        <FaTimes className="text-sm" />
      </button>
    </div>
  );
};

/* ── Mobile item card (shown < md, i.e. below 768px) ── */
const ItemCard = ({ item, stockLow, onEdit }) => (
  <div className="bg-white border border-[#E7EEFC] rounded-[20px] p-4 shadow-[0_10px_28px_-14px_rgba(11,30,77,0.25)]">
    <div className="flex items-start justify-between gap-3 mb-3">
      <h4 className="text-[18px] font-semibold m-0" style={{ color: c.blueDeep }}>{item.name || "-"}</h4>
      {stockLow(item) ? (
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[17px] font-bold shrink-0"
          style={{ background: "#FDECEC", color: c.rose }}
        >
          <FaExclamationTriangle className="text-[13px]" />
          {Number(item.stock || 0)}
        </span>
      ) : (
        <span className="text-[17px] font-semibold shrink-0" style={{ color: c.text }}>{Number(item.stock || 0)}</span>
      )}
    </div>

    <div className="flex flex-wrap gap-2 mb-4">
      <Badge value={item.category} />
      <Badge value={item.unit} />
      <Badge value={item.branch} />
    </div>

    <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 mb-4">
      <div>
        <div className="text-[15px] font-semibold" style={{ color: c.muted }}>Subcategory</div>
        <div className="text-[17px]" style={{ color: c.text }}>{item.subcategory || "—"}</div>
      </div>
      <div>
        <div className="text-[15px] font-semibold" style={{ color: c.muted }}>Reorder Level</div>
        <div className="text-[17px]" style={{ color: c.text }}>{item.reorder_point ?? 5}</div>
      </div>
      <div>
        <div className="text-[15px] font-semibold" style={{ color: c.muted }}>Price (₹)</div>
        <div className="text-[17px] font-medium" style={{ color: c.text }}>{item.price ? Number(item.price).toFixed(2) : "-"}</div>
      </div>
      <div>
        <div className="text-[15px] font-semibold" style={{ color: c.muted }}>Expiry</div>
        <div className="text-[17px]" style={{ color: c.text }}>{item.expiry ? String(item.expiry).slice(0, 10) : "-"}</div>
      </div>
    </div>

    <button type="button" onClick={() => onEdit(item)} className={`${rowActionBtn("primary")} w-full`}>
      <FaEdit /> Edit
    </button>
  </div>
);

/* ─────────────────────────────── Main Component ─────────────────────────────── */

const InventoryItemsPage = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Master data for form dropdowns
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [stores, setStores] = useState([]);

  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ open: false, type: "success", title: "", message: "" });

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await API.get("/inventory");
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMasters = async () => {
    try {
      const [catRes, unitRes, storeRes] = await Promise.all([
        API.get("/inventory-masters/stock-categories").catch(() => ({ data: [] })),
        API.get("/inventory-masters/units").catch(() => ({ data: [] })),
        API.get("/inventory-masters/locations").catch(() => ({ data: [] })),
      ]);
      setCategories(Array.isArray(catRes.data) ? catRes.data : []);
      setUnits(Array.isArray(unitRes.data) ? unitRes.data : []);
      setStores(Array.isArray(storeRes.data) ? storeRes.data : []);
    } catch {
      // silent fallback
    }
  };

  useEffect(() => {
    fetchItems();
    fetchMasters();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((s) => {
      const matchesSearch = !q || [s.name, s.category, s.unit]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
      const matchesCategory = categoryFilter === "all" || String(s.category || "").toLowerCase() === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [items, search, categoryFilter]);

  const uniqueCategories = useMemo(() => {
    const cats = new Set(items.map((i) => i.category).filter(Boolean));
    return Array.from(cats);
  }, [items]);

  const handleSave = async (formData) => {
    setSaving(true);
    try {
      if (editingItem) {
        await API.put(`/inventory/${editingItem.id}`, formData);
        setToast({ open: true, type: "success", title: "Item updated", message: `${formData.name} has been updated.` });
      } else {
        await API.post("/inventory", formData);
        setToast({ open: true, type: "success", title: "Item added", message: `${formData.name} has been added to stock.` });
      }
      setShowForm(false);
      setEditingItem(null);
      await fetchItems();
    } catch (err) {
      setToast({ open: true, type: "error", title: "Save failed", message: err.response?.data?.message || "Could not save item." });
    } finally {
      setSaving(false);
    }
  };

  const openAdd = () => {
    setEditingItem(null);
    setShowForm(true);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setShowForm(true);
  };

  const closeToast = () => setToast((t) => ({ ...t, open: false }));

  const stockLow = (item) => {
    const reorder = Number(item.reorder_point || 5);
    return Number(item.stock || 0) <= reorder;
  };

  return (
    <div
      className="min-h-screen w-full max-w-full overflow-x-hidden"
      style={{ background: "linear-gradient(180deg,#F4F8FF 0%,#F7FAFF 40%,#F4F8FF 100%)", color: c.text }}
    >
      {/* ── hero ── */}
      <div
        className="relative overflow-hidden px-4 sm:px-6 md:px-8 pt-5 sm:pt-6 pb-8 sm:pb-10 xl:pb-12"
        style={{ backgroundImage: "linear-gradient(120deg,#0B1E4D 0%,#123273 45%,#38BDF8 130%)" }}
      >
        {/* decorative glow */}
        <div className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-30 blur-3xl" style={{ background: "#38BDF8" }} />
        <div className="pointer-events-none absolute -bottom-28 -left-16 w-64 h-64 rounded-full opacity-20 blur-3xl" style={{ background: "#1D4ED8" }} />
          <BackButton className="shrink-0" />
        <div className="relative flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          
          <div className="flex items-center gap-3.5">
           
            <div
              className="w-[52px] h-[52px] rounded-[16px] flex items-center justify-center text-white text-[22px] shadow-[0_10px_28px_rgba(0,0,0,0.25)] ring-1 ring-white/25 shrink-0"
              style={{ backgroundImage: "linear-gradient(135deg,#1D4ED8,#38BDF8)" }}
            >
              <FaWarehouse />
            </div>
            <div className="min-w-0">
              <h1 className="text-[21px] font-semibold m-0 leading-tight text-white" style={{ letterSpacing: "0.2px" }}>
                Items &amp; Stock
              </h1>
              <p className="m-0 text-[18px] text-white/75 mt-0.5">
                All inventory items across stores and kitchens
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={openAdd}
            className={`${primaryBtn} w-full xl:w-auto`}
            style={primaryBtnStyle}
          >
            <FaPlus className="text-sm" /> Add Item
          </button>
        </div>
      </div>

      <div className="px-4 sm:px-6 md:px-8 -mt-5 sm:-mt-6 xl:-mt-7 pb-16">
        {/* ── search + filter card ── */}
        <div className="bg-white border border-[#E7EEFC] rounded-[20px] xl:rounded-[24px] shadow-[0_18px_40px_-16px_rgba(11,30,77,0.18)] p-3 sm:p-3.5 xl:p-4 mb-4 xl:mb-5 flex flex-col xl:flex-row gap-2.5">
          <div className="relative w-full xl:flex-1 xl:min-w-[220px]">
            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8B98B8] text-sm" />
            <input
              className={`${fieldCls} pl-11`}
              placeholder="Search items by name, category, unit…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="relative w-full xl:w-[220px]">
            <FaLayerGroup className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8B98B8] text-sm pointer-events-none" />
            <select
              className={`${fieldCls} pl-11 appearance-none cursor-pointer`}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All categories</option>
              {uniqueCategories.map((cat) => (
                <option key={cat} value={cat.toLowerCase()}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── table card (md and up: real table; below md: card list) ── */}
        <div className="bg-white border border-[#E7EEFC] rounded-[20px] xl:rounded-[26px] overflow-hidden shadow-[0_20px_50px_-18px_rgba(11,30,77,0.2)]">
          {/* Table view — visible from md (768px) upward */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[820px] text-left">
              <thead>
                <tr style={{ background: "linear-gradient(180deg,#F5F9FF,#EEF4FE)" }} className="sticky top-0 z-10">
                  <th className="text-left text-[16px] font-bold tracking-[0.02em] py-4 pl-6 pr-4 border-b border-[#E7EEFC]" style={{ color: c.blueDeep }}>Item Name</th>
                  <th className="text-left text-[16px] font-bold tracking-[0.02em] py-4 pr-4 border-b border-[#E7EEFC]" style={{ color: c.blueDeep }}>Category</th>
                  <th className="text-left text-[16px] font-bold tracking-[0.02em] py-4 pr-4 border-b border-[#E7EEFC]" style={{ color: c.blueDeep }}>Subcategory</th>
                  <th className="text-left text-[16px] font-bold tracking-[0.02em] py-4 pr-4 border-b border-[#E7EEFC]" style={{ color: c.blueDeep }}>Stock</th>
                  <th className="text-left text-[16px] font-bold tracking-[0.02em] py-4 pr-4 border-b border-[#E7EEFC]" style={{ color: c.blueDeep }}>Reorder Level</th>
                  <th className="text-left text-[16px] font-bold tracking-[0.02em] py-4 pr-4 border-b border-[#E7EEFC]" style={{ color: c.blueDeep }}>Unit</th>
                  <th className="text-left text-[16px] font-bold tracking-[0.02em] py-4 pr-4 border-b border-[#E7EEFC]" style={{ color: c.blueDeep }}>Price (₹)</th>
                  <th className="text-left text-[16px] font-bold tracking-[0.02em] py-4 pr-4 border-b border-[#E7EEFC]" style={{ color: c.blueDeep }}>Expiry</th>
                  <th className="text-left text-[16px] font-bold tracking-[0.02em] py-4 pr-4 border-b border-[#E7EEFC]" style={{ color: c.blueDeep }}>Store</th>
                  <th className="text-left text-[16px] font-bold tracking-[0.02em] py-4 pr-6 border-b border-[#E7EEFC] w-[110px]" style={{ color: c.blueDeep }}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF3FD]">
                {loading ? (
                  <tr><td colSpan={10} className="py-14 text-center text-[18px]" style={{ color: c.muted }}>Loading items…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10}>
                      <div className="text-center py-14">
                        <div className="mx-auto mb-3 w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "#EAF2FE", color: c.blue }}>
                          <FaBoxOpen className="text-2xl" />
                        </div>
                        <b className="block text-[22px] mb-1" style={{ color: c.blueDeep }}>No items in stock</b>
                        <span className="text-[18px]" style={{ color: c.muted }}>Add your first item to start tracking inventory.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => (
                    <tr key={item.id} className="transition-colors hover:bg-[#F6F9FF]">
                      <td className="py-3.5 pl-6 pr-4 text-[18px] font-semibold" style={{ color: c.blueDeep }}>{item.name || "-"}</td>
                      <td className="py-3.5 pr-4"><Badge value={item.category} /></td>
                      <td className="py-3.5 pr-4 text-[17px]" style={{ color: c.text }}>{item.subcategory || <span style={{ color: c.muted }}>—</span>}</td>
                      <td className="py-3.5 pr-4">
                        {stockLow(item) ? (
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[17px] font-bold"
                            style={{ background: "#FDECEC", color: c.rose }}
                          >
                            <FaExclamationTriangle className="text-[13px]" />
                            {Number(item.stock || 0)}
                          </span>
                        ) : (
                          <span className="text-[17px] font-semibold" style={{ color: c.text }}>{Number(item.stock || 0)}</span>
                        )}
                      </td>
                      <td className="py-3.5 pr-4 text-[17px]" style={{ color: c.text }}>{item.reorder_point ?? 5}</td>
                      <td className="py-3.5 pr-4"><Badge value={item.unit} /></td>
                      <td className="py-3.5 pr-4 text-[17px] font-medium" style={{ color: c.text }}>{item.price ? Number(item.price).toFixed(2) : "-"}</td>
                      <td className="py-3.5 pr-4 text-[17px]" style={{ color: c.text }}>{item.expiry ? String(item.expiry).slice(0, 10) : "-"}</td>
                      <td className="py-3.5 pr-4"><Badge value={item.branch} /></td>
                      <td className="py-3.5 pr-6">
                        <div className="flex gap-1.5">
                          <button type="button" onClick={() => openEdit(item)} className={rowActionBtn("primary")}>
                            <FaEdit /> Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Card view — visible below md (768px) only */}
          <div className="md:hidden p-3 sm:p-4">
            {loading ? (
              <div className="py-14 text-center text-[18px]" style={{ color: c.muted }}>Loading items…</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-14">
                <div className="mx-auto mb-3 w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "#EAF2FE", color: c.blue }}>
                  <FaBoxOpen className="text-2xl" />
                </div>
                <b className="block text-[22px] mb-1" style={{ color: c.blueDeep }}>No items in stock</b>
                <span className="text-[18px]" style={{ color: c.muted }}>Add your first item to start tracking inventory.</span>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filtered.map((item) => (
                  <ItemCard key={item.id} item={item} stockLow={stockLow} onEdit={openEdit} />
                ))}
              </div>
            )}
          </div>

          {/* ── pagination (visual only — matches reference; no paging logic in original) ── */}
          <div className="flex items-center justify-between flex-wrap gap-3 px-4 sm:px-6 py-4 border-t border-[#EEF3FD]" style={{ background: "#FAFCFF" }}>
            <span className="text-[16px]" style={{ color: c.muted }}>
              Showing 1 to {filtered.length} of {filtered.length} items
            </span>
            <div className="flex items-center gap-2">
              <button type="button" disabled className="w-9 h-9 rounded-[10px] border border-[#E1EAFB] flex items-center justify-center text-[#B8C4E0] disabled:opacity-60">
                <FaChevronLeft className="text-xs" />
              </button>
              <span
                className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[15px] font-bold text-white"
                style={{ backgroundImage: "linear-gradient(135deg,#1D4ED8,#38BDF8)" }}
              >
                1
              </span>
              <button type="button" disabled className="w-9 h-9 rounded-[10px] border border-[#E1EAFB] flex items-center justify-center text-[#B8C4E0] disabled:opacity-60">
                <FaChevronRight className="text-xs" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Item form modal ── */}
      <ItemFormModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditingItem(null); }}
        onSave={handleSave}
        initial={editingItem}
        categories={categories}
        units={units}
        stores={stores}
        saving={saving}
      />
      <Toast open={toast.open} type={toast.type} title={toast.title} message={toast.message} onClose={closeToast} />
    </div>
  );
};

/* ── Item Form Modal ── */
const ItemFormModal = ({ open, onClose, onSave, initial, categories, units, stores, saving }) => {
  const [form, setForm] = useState({
    name: "",
    category: "",
    subcategory: "",
    stock: "",
    unit: "",
    price: "",
    reorder_point: "5",
    expiry: "",
    branch: "",
  });

  useEffect(() => {
    if (open) {
      if (initial) {
        setForm({
          name: initial.name || "",
          category: initial.category || "",
          subcategory: initial.subcategory || "",
          stock: String(initial.stock ?? 0),
          unit: initial.unit || "",
          price: String(initial.price ?? 0),
          reorder_point: String(initial.reorder_point ?? 5),
          expiry: initial.expiry ? String(initial.expiry).slice(0, 10) : "",
          branch: initial.branch || "",
        });
      } else {
        setForm({ name: "", category: "", subcategory: "", stock: "", unit: "", price: "", reorder_point: "5", expiry: "", branch: "" });
      }
    }
  }, [open, initial]);

  const setField = (name, value) => setForm((p) => ({ ...p, [name]: value }));

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    onSave({
      ...form,
      stock: Number(form.stock) || 0,
      price: Number(form.price) || 0,
      reorder_point: Number(form.reorder_point) || 5,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Edit item" : "Add item"}
      subtitle={initial ? "Update item details" : "Add a new item to your inventory"}
      actions={
        <>
          <button type="button" onClick={onClose} className={`${ghostBtn} w-full sm:w-auto`} disabled={saving}>Cancel</button>
          <button type="button" onClick={handleSubmit} className={`${primaryBtn} w-full sm:w-auto`} style={primaryBtnStyle} disabled={saving}>
            {saving ? "Saving…" : initial ? "Save changes" : "Add item"}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="field sm:col-span-2">
          <label className={labelCls}>Item name *</label>
          <input className={fieldCls} placeholder="e.g. Onion" value={form.name} onChange={(e) => setField("name", e.target.value)} />
        </div>
        <div className="field">
          <label className={labelCls}>Category *</label>
          <select className={fieldCls} value={form.category} onChange={(e) => { setField("category", e.target.value); setField("subcategory", ""); }}>
            <option value="">Select category</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.name}>{cat.name}</option>
            ))}
          </select>
        </div>
        {form.category && (() => {
          const subCats = categories
            .filter((c) => c.name === form.category && c.subcategory)
            .map((c) => c.subcategory);
          const uniqueSubs = [...new Set(subCats)];
          if (uniqueSubs.length === 0) return null;
          return (
            <div className="field">
              <label className={labelCls}>Subcategory</label>
              <select className={fieldCls} value={form.subcategory} onChange={(e) => setField("subcategory", e.target.value)}>
                <option value="">Select subcategory</option>
                {uniqueSubs.map((sc) => (
                  <option key={sc} value={sc}>{sc}</option>
                ))}
              </select>
            </div>
          );
        })()}
        <div className="field">
          <label className={labelCls}>Unit</label>
          <select className={fieldCls} value={form.unit} onChange={(e) => setField("unit", e.target.value)}>
            <option value="">Select unit</option>
            {units.map((u) => (
              <option key={u.id} value={u.name}>{u.name} ({u.short_name || u.shortName || ""})</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className={labelCls}>Initial stock</label>
          <input type="number" className={fieldCls} placeholder="0" value={form.stock} onChange={(e) => setField("stock", e.target.value)} />
        </div>
        <div className="field">
          <label className={labelCls}>Reorder level</label>
          <input type="number" className={fieldCls} placeholder="5" value={form.reorder_point} onChange={(e) => setField("reorder_point", e.target.value)} />
        </div>
        <div className="field">
          <label className={labelCls}>Price per unit (₹)</label>
          <input type="number" className={fieldCls} placeholder="0.00" value={form.price} onChange={(e) => setField("price", e.target.value)} />
        </div>
        <div className="field">
          <label className={labelCls}>Expiry date</label>
          <input type="date" className={fieldCls} value={form.expiry} onChange={(e) => setField("expiry", e.target.value)} />
        </div>
        <div className="field">
          <label className={labelCls}>Store / Kitchen</label>
          <select className={fieldCls} value={form.branch} onChange={(e) => setField("branch", e.target.value)}>
            <option value="">Select store</option>
            {stores.map((s) => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>
    </Modal>
  );
};

export default InventoryItemsPage;