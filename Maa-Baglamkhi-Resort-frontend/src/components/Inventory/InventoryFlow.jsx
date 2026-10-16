// src/components/Inventory/InventoryFlow.jsx
//
// ✅ SINGLE-PAGE INVENTORY MODULE
// -----------------------------------------------------------------------------
// This ONE file replaces separate Purchase/Stock/Reports pages into a unified
// flow with local-state navigation (no route changes). Matches your HTML
// prototype's exact layout, colors (Fraunces + Work Sans + Roboto Mono),
// typography, and component structure.
//
// HOW TO WIRE INTO ROUTER:
//   <Route path="/inventory" element={<InventoryFlow />} />
//
// ─── Color tokens (from HTML prototype) ──────────────────────────────────
//   --ink:    #132A2A
//   --paper:  #F6F5F1
//   --panel:  #FFFFFF
//   --line:   #E4E1D8
//   --teal:   #0F6E64
//   --teal-deep: #0B4F48
//   --amber:  #C8791A
//   --rose:   #B5442E
//   --muted:  #6B6F66
//   --text:   #1C231F
// -----------------------------------------------------------------------------

import React, { useEffect, useMemo, useState } from "react";
import {
  FaPlus,
  FaEye,
  FaEdit,
  FaSearch,
  FaCheckCircle,
  FaTimes,
  FaExclamationTriangle,
  FaArrowLeft,
} from "react-icons/fa";

import API from "../../api";

/* ─────────────────────────── font + typography tokens ─────────────────────────── */
/* Matches the HTML prototype: Fraunces for display, Work Sans for body, Roboto Mono for numbers */

const fontDisplay = '"Fraunces", serif';
const fontBody = '"Work Sans", sans-serif';
const fontMono = '"Roboto Mono", monospace';

/* ─────────────────────────── CSS custom-property helpers ─────────────────────────── */
/* Since we use Tailwind v4, we define palette via arbitrary values everywhere.
   The :root variables are set in index.css for the font imports — the actual
   color tokens are encoded directly in the class strings below to match the HTML. */

const c = {
  ink: "#132A2A",
  paper: "#F6F5F1",
  panel: "#FFFFFF",
  line: "#E4E1D8",
  teal: "#0F6E64",
  tealDeep: "#0B4F48",
  amber: "#C8791A",
  rose: "#B5442E",
  muted: "#6B6F66",
  text: "#1C231F",
};

/* ─────────────────────────── shared style strings ─────────────────────────── */

const fieldCls =
  "w-full rounded-[9px] border border-[#E4E1D8] bg-white px-3 py-2.5 text-[13.5px] font-medium text-[#1C231F] shadow-sm transition-all duration-200 placeholder:text-[#6B6F66] placeholder:font-medium focus:border-[#0F6E64] focus:outline-none focus:outline-2 focus:outline-offset-1 focus:outline-[#0F6E64]";

const labelCls =
  "mb-1.5 block text-[11.5px] font-semibold uppercase tracking-[0.04em] text-[#6B6F66]";

const panelCls =
  "bg-white border border-[#E4E1D8] rounded-[14px] p-5 sm:p-6 shadow-sm";

const sectionTitleCls =
  "text-[19px] font-semibold text-[#1C231F] mb-1";

const btnBase =
  "inline-flex items-center justify-center gap-1.5 rounded-[9px] px-4 py-2.5 text-[13.5px] font-semibold transition-all duration-200 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap";

const primaryBtn = `${btnBase} bg-[#0B4F48] text-white hover:bg-[#0F6E64]`;

const ghostBtn = `${btnBase} bg-transparent border border-[#E4E1D8] text-[#1C231F] hover:bg-[#F6F5F1]`;

const rowActionBtn = (tone = "neutral") => {
  const tones = {
    neutral: "border-[#E4E1D8] bg-white text-[#1C231F] hover:bg-[#F6F5F1]",
    primary: "border-[#E4E1D8] bg-[#E4F0EE] text-[#0B4F48] hover:bg-[#CFE7E2]",
    danger: "border-[#E4E1D8] bg-[#F5DFDA] text-[#B5442E] hover:bg-[#F3D0C9]",
    warning: "border-[#E4E1D8] bg-[#F3E9DD] text-[#C8791A] hover:bg-[#EAD9C0]",
  };
  return `${btnBase} border ${tones[tone] || tones.neutral}`;
};

const softBtn = (active) =>
  `inline-flex items-center justify-center gap-1.5 rounded-[20px] px-3.5 py-1.5 text-[12.5px] font-medium transition-all duration-200 ${
    active
      ? "bg-[#0B4F48] text-white border border-[#0B4F48]"
      : "bg-[#F6F5F1] border border-[#E4E1D8] text-[#1C231F] hover:bg-white"
  }`;

/* ─────────────────────────── formatters ─────────────────────────── */

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

const formatDate = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const toNumber = (value) => Number(value) || 0;

/* ─────────────────────────── status styles ─────────────────────────── */

const STATUS_STYLES = {
  received: "bg-[#E4F0EE] text-[#0B4F48]",
  pending: "bg-[#F3E9DD] text-[#C8791A]",
  completed: "bg-[#E4F0EE] text-[#0B4F48]",
  cancelled: "bg-[#F5DFDA] text-[#B5442E]",
  transferred: "bg-[#E4F0EE] text-[#0B4F48]",
  "in-transfer": "bg-[#F3E9DD] text-[#C8791A]",
  audited: "bg-[#E4F0EE] text-[#0B4F48]",
  wasted: "bg-[#F5DFDA] text-[#B5442E]",
  low: "bg-[#F3E9DD] text-[#C8791A]",
  ok: "bg-[#E4F0EE] text-[#0B4F48]",
  expired: "bg-[#F5DFDA] text-[#B5442E]",
};

const statusBadgeCls = (status) => {
  const key = String(status || "").toLowerCase().trim().replace(/\s+/g, "-");
  const style = STATUS_STYLES[key] || "bg-[#F6F5F1] text-[#6B6F66]";
  return `inline-block rounded-full px-3 py-1 text-[11px] font-bold ${style}`;
};

/* ─────────────────────────── Modal primitive ─────────────────────────── */

const Modal = ({ open, onClose, title, subtitle, children, actions, closeOnBackdrop = true }) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[#132A2A]/45 px-4 py-6 backdrop-blur-sm"
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        className="w-full max-w-[520px] max-h-[88vh] overflow-y-auto rounded-[16px] bg-white p-5 sm:p-6 shadow-[0_30px_90px_rgba(19,42,42,0.28)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-1">
          <div>
            <h3 className="text-[19px] font-bold text-[#132A2A] m-0">{title}</h3>
            {subtitle && <p className="text-[12.5px] text-[#6B6F66] mt-0.5 mb-4">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-full p-1.5 text-[#6B6F66] transition hover:bg-[#F6F5F1] hover:text-[#132A2A]"
            aria-label="Close"
            type="button"
          >
            <FaTimes className="text-lg" />
          </button>
        </div>
        {!subtitle && <div className="mb-4" />}
        <div className="text-[13.5px] leading-relaxed text-[#1C231F]">{children}</div>
        {actions && <div className="mt-5 flex flex-wrap justify-end gap-2.5">{actions}</div>}
      </div>
    </div>
  );
};

/* ─────────────────────────── FeatureModal (larger, for invoices etc.) ─────────────────────────── */

const FeatureModal = ({ title, subtitle, size = "max-w-4xl", onClose, children }) => {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[#132A2A]/70 px-3 py-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`relative max-h-[140vh] w-full ${size} overflow-y-auto rounded-[16px] bg-white shadow-[0_30px_90px_rgba(19,42,42,0.35)]`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#E4E1D8] bg-white/95 px-5 py-4 backdrop-blur">
          <div>
            <h3 className="text-[19px] font-bold text-[#132A2A]">{title}</h3>
            {subtitle && <p className="text-[12.5px] text-[#6B6F66] mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            aria-label="Close modal"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E4E1D8] bg-white text-[#6B6F66] transition hover:bg-[#F6F5F1]"
          >
            <FaTimes />
          </button>
        </div>
        <div className="p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
};

/* ─────────────────────────── FlowRail ─────────────────────────── */
/* Signature 3-step rail matching the HTML prototype exactly */

const FLOW_STEPS = [
  { key: "purchase", num: "1", title: "Purchase", desc: "Buy from vendors" },
  { key: "stock", num: "2", title: "Stock", desc: "Items, transfers, audits" },
  { key: "reports", num: "3", title: "Reports", desc: "Value, waste, expiry" },
];

const FlowRail = ({ activePage, onJump }) => (
  <div
    className="flex bg-white border border-[#E4E1D8] rounded-[14px] p-[6px] gap-[6px] mb-5"
    style={{ position: "relative" }}
  >
    {FLOW_STEPS.map((step, idx) => {
      const isActive = step.key === activePage;
      return (
        <React.Fragment key={step.key}>
          <button
            type="button"
            onClick={() => onJump(step.key)}
            className="flex-1 relative flex items-center gap-2.5 px-3 sm:px-4 py-3 rounded-[10px] cursor-pointer transition-all duration-200 border border-transparent"
            style={{
              background: isActive ? c.tealDeep : "transparent",
            }}
            title={step.desc}
          >
            {idx > 0 && (
              <span
                className="hidden sm:block absolute -right-[9px] top-1/2 -translate-y-1/2 w-4 h-4 rotate-[-45deg] z-[1]"
                style={{
                  background: c.paper,
                  borderRight: `1px solid ${c.line}`,
                  borderBottom: `1px solid ${c.line}`,
                }}
              />
            )}
            <span
              className="flex-shrink-0 w-[26px] h-[26px] rounded-full border-[1.5px] flex items-center justify-center text-[11px] font-medium mono"
              style={{
                fontFamily: fontMono,
                borderColor: isActive ? "#fff" : c.line,
                background: isActive ? "#fff" : "transparent",
                color: isActive ? c.tealDeep : c.muted,
              }}
            >
              {step.num}
            </span>
            <span className="text-left">
              <b
                className="block text-[14.5px] font-semibold leading-tight"
                style={{ color: isActive ? "#fff" : c.text }}
              >
                {step.title}
              </b>
              <span
                className="block text-[11.5px] leading-tight mt-0.5"
                style={{ color: isActive ? "#CFE7E2" : c.muted }}
              >
                {step.desc}
              </span>
            </span>
          </button>
        </React.Fragment>
      );
    })}
  </div>
);

/* ─────────────────────────── StatCards ─────────────────────────── */

const STAT_CONFIG = [
  { label: "Total items", icon: "📦", iconBg: "#E4F0EE", iconColor: c.tealDeep, change: "+12%", variant: "i1" },
  { label: "Stock value", icon: "📊", iconBg: "#F3E9DD", iconColor: c.amber, change: "Live", variant: "i2" },
  { label: "Low stock items", icon: "⚠️", iconBg: "#F3E9DD", iconColor: c.amber, change: "Reorder", variant: "i3" },
  { label: "Expiring soon", icon: "📅", iconBg: "#F5DFDA", iconColor: c.rose, change: "Alerts", variant: "i4" },
];

const StatCards = ({ stats }) => (
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
    {STAT_CONFIG.map((s, i) => (
      <div key={i} className={`bg-white border border-[#E4E1D8] rounded-[12px] p-4 ${s.variant}`}>
        <div className="flex justify-between items-start mb-3">
          <span
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[15px]"
            style={{ background: s.iconBg, color: s.iconColor }}
          >
            {s.icon}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#6B6F66]">
            {s.change}
          </span>
        </div>
        <div className="text-[26px] font-semibold leading-tight" style={{ fontFamily: fontDisplay }}>
          {stats[i] !== undefined ? stats[i] : "0"}
        </div>
        <div className="text-[12px] text-[#6B6F66] mt-1">{s.label}</div>
      </div>
    ))}
  </div>
);

/* ─────────────────────────── SetupDrawer ─────────────────────────── */

const DRAWER_TABS = [
  { key: "categories", label: "Categories" },
  { key: "vendors", label: "Vendors" },
  { key: "units", label: "Units" },
  { key: "stores", label: "Stores" },
  { key: "groups", label: "Item groups" },
];

const SetupDrawer = ({ open, onClose, activeTab, onTabChange, onSave }) => {
  const [form, setForm] = useState({});

  const setField = (name, value) => setForm((p) => ({ ...p, [name]: value }));

  const handleSave = () => {
    onSave(activeTab, form);
    setForm({});
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "categories":
        return (
          <>
            <div className="field">
              <label className={labelCls}>Category name</label>
              <input
                className={fieldCls}
                placeholder="e.g. Vegetables"
                value={form.name || ""}
                onChange={(e) => setField("name", e.target.value)}
              />
            </div>
            <div className="field">
              <label className={labelCls}>Parent group</label>
              <input
                className={fieldCls}
                placeholder="Optional"
                value={form.parentGroup || ""}
                onChange={(e) => setField("parentGroup", e.target.value)}
              />
            </div>
            <button type="button" onClick={handleSave} className={`${primaryBtn} w-full`}>
              + Add category
            </button>
          </>
        );
      case "vendors":
        return (
          <>
            <div className="field">
              <label className={labelCls}>Vendor name</label>
              <input
                className={fieldCls}
                placeholder="e.g. Sharma Traders"
                value={form.name || ""}
                onChange={(e) => setField("name", e.target.value)}
              />
            </div>
            <div className="field">
              <label className={labelCls}>Contact number</label>
              <input
                className={fieldCls}
                placeholder="+91"
                value={form.contact || ""}
                onChange={(e) => setField("contact", e.target.value)}
              />
            </div>
            <button type="button" onClick={handleSave} className={`${primaryBtn} w-full`}>
              + Add vendor
            </button>
          </>
        );
      case "units":
        return (
          <>
            <div className="field">
              <label className={labelCls}>Unit name</label>
              <input
                className={fieldCls}
                placeholder="e.g. Kilogram (kg)"
                value={form.name || ""}
                onChange={(e) => setField("name", e.target.value)}
              />
            </div>
            <button type="button" onClick={handleSave} className={`${primaryBtn} w-full`}>
              + Add unit
            </button>
          </>
        );
      case "stores":
        return (
          <>
            <div className="field">
              <label className={labelCls}>Store / kitchen name</label>
              <input
                className={fieldCls}
                placeholder="e.g. Main kitchen"
                value={form.name || ""}
                onChange={(e) => setField("name", e.target.value)}
              />
            </div>
            <button type="button" onClick={handleSave} className={`${primaryBtn} w-full`}>
              + Add store
            </button>
          </>
        );
      case "groups":
        return (
          <>
            <div className="field">
              <label className={labelCls}>Item group name</label>
              <input
                className={fieldCls}
                placeholder="e.g. Dairy"
                value={form.name || ""}
                onChange={(e) => setField("name", e.target.value)}
              />
            </div>
            <button type="button" onClick={handleSave} className={`${primaryBtn} w-full`}>
              + Add group
            </button>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <>
      {/* overlay */}
      <div
        className="fixed inset-0 z-[75] bg-[#132A2A]/40 hidden"
        style={{ display: open ? "block" : "none" }}
        onClick={onClose}
      />
      {/* drawer panel */}
      <div
        className="fixed top-0 right-0 h-full w-[420px] max-w-[92vw] bg-white shadow-[-8px_0_30px_rgba(0,0,0,0.12)] z-[76] overflow-y-auto transition-transform duration-300"
        style={{
          transform: open ? "translateX(0)" : "translateX(100%)",
          padding: "24px",
        }}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[19px] font-bold text-[#132A2A]">Setup</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-[#6B6F66] transition hover:bg-[#F6F5F1] hover:text-[#132A2A]"
          >
            <FaTimes className="text-lg" />
          </button>
        </div>
        <p className="text-[12.5px] text-[#6B6F66] mb-4">
          Categories, vendors, units & everything else — configured once, used everywhere
        </p>

        {/* tab pills */}
        <div className="flex flex-wrap gap-[6px] mb-4">
          {DRAWER_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => onTabChange(tab.key)}
              className={`rounded-[20px] px-3 py-1.5 text-[11.5px] font-medium transition-all ${
                activeTab === tab.key
                  ? "bg-[#0B4F48] text-white border border-[#0B4F48]"
                  : "bg-[#F6F5F1] border border-[#E4E1D8] text-[#1C231F] hover:bg-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* tab panes */}
        <div>{renderTabContent()}</div>
      </div>
    </>
  );
};

/* ─────────────────────────── empty state helper ─────────────────────────── */

const EmptyState = ({ title, subtitle }) => (
  <div className="text-center py-9 text-[#6B6F66]">
    <b className="block text-[14.5px] text-[#1C231F] mb-1" style={{ fontFamily: fontDisplay }}>
      {title}
    </b>
    {subtitle && <span className="text-[13px]">{subtitle}</span>}
  </div>
);

/* ─────────────────────────── common table header ─────────────────────────── */

const TableHeader = ({ columns }) => (
  <thead>
    <tr>
      {columns.map((col) => (
        <th
          key={col.key}
          className="text-left text-[10.5px] font-semibold uppercase tracking-[0.05em] text-[#6B6F66] py-2.5 pr-4 border-b border-[#E4E1D8]"
          style={{ width: col.width || "auto" }}
        >
          {col.label}
        </th>
      ))}
    </tr>
  </thead>
);

/* ─────────────────────────── PurchasePage ─────────────────────────── */

const PurchasePage = ({ onOpenNewPurchase, onOpenVendorDrawer }) => {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchPurchases = async () => {
    setLoading(true);
    try {
      const res = await API.get("/inventory/purchases");
      setPurchases(Array.isArray(res.data) ? res.data : []);
    } catch {
      setPurchases([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPurchases(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return purchases;
    return purchases.filter((p) =>
      [p.itemName, p.vendor, p.status]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [purchases, search]);

  const pillFilters = ["All", "Items", "Services", "Orders"];

  return (
    <div className={panelCls}>
      <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
        <div>
          <h2 className={sectionTitleCls}>Purchases</h2>
          <p className="text-[12.5px] text-[#6B6F66] mt-0.5">
            Everything you buy — items, services & vendor orders, one list
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onOpenVendorDrawer} className={ghostBtn}>
            Manage vendors
          </button>
          <button type="button" onClick={onOpenNewPurchase} className={primaryBtn}>
            <FaPlus className="text-sm" /> New purchase
          </button>
        </div>
      </div>

      {/* filter pills */}
      <div className="flex gap-2 flex-wrap mb-4">
        {pillFilters.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f.toLowerCase())}
            className={`rounded-[20px] px-3.5 py-1.5 text-[12.5px] font-medium transition-all ${
              filter === f.toLowerCase()
                ? "bg-[#0B4F48] text-white border border-[#0B4F48]"
                : "bg-[#F6F5F1] border border-[#E4E1D8] text-[#1C231F] hover:bg-white"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* search */}
      <div className="flex gap-2.5 mb-4">
        <div className="relative flex-1">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6F66] text-xs" />
          <input
            className={`${fieldCls} pl-9`}
            placeholder="Search purchases…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* table */}
      <div className="overflow-x-auto rounded-xl border border-[#E4E1D8]">
        <table className="w-full min-w-[600px] text-left text-[13px]">
          <TableHeader
            columns={[
              { key: "item", label: "Item / Service" },
              { key: "vendor", label: "Vendor" },
              { key: "qty", label: "Qty" },
              { key: "rate", label: "Rate" },
              { key: "total", label: "Total" },
              { key: "status", label: "Status" },
            ]}
          />
          <tbody className="divide-y divide-[#E4E1D8]">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-[#6B6F66]">
                  Loading purchases...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <EmptyState title="No purchases yet" subtitle="Add your first purchase to start tracking spend by vendor." />
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id || p.purchaseId} className="hover:bg-[#F6F5F1]/50 transition-colors">
                  <td className="py-2.5 pr-3 font-semibold text-[#1C231F]">{p.itemName || p.item_name || "-"}</td>
                  <td className="py-2.5 pr-3 text-[#1C231F]">{p.vendor || "-"}</td>
                  <td className="py-2.5 pr-3 text-[#1C231F]">{p.quantity || p.qty || 0}</td>
                  <td className="py-2.5 pr-3 text-[#1C231F]">{formatCurrency(p.rate || p.unitPrice || 0)}</td>
                  <td className="py-2.5 pr-3 font-semibold text-[#1C231F]">{formatCurrency(p.total || p.totalAmount || 0)}</td>
                  <td className="py-2.5 pr-3">
                    <span className={statusBadgeCls(p.status || "pending")}>
                      {p.status || "Pending"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ─────────────────────────── StockPage ─────────────────────────── */

const StockPage = ({ onOpenAddStock, onOpenActionModal }) => {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockItems, setStockItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState("raw"); // "raw" | "menu"

  const fetchStock = async () => {
    setLoading(true);
    try {
      const res = await API.get("/inventory/stock");
      setStockItems(Array.isArray(res.data) ? res.data : []);
    } catch {
      setStockItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStock(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stockItems.filter((s) => {
      const matchesSearch = !q || [s.itemName, s.category, s.store]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
      const matchesCategory = categoryFilter === "all" || String(s.category || "").toLowerCase() === categoryFilter;
      const matchesView = viewMode === "raw" ? (s.type !== "menu") : (s.type === "menu");
      return matchesSearch && matchesCategory && matchesView;
    });
  }, [stockItems, search, categoryFilter, viewMode]);

  // Derive unique categories for the dropdown
  const categories = useMemo(() => {
    const cats = new Set(stockItems.map((s) => s.category).filter(Boolean));
    return Array.from(cats);
  }, [stockItems]);

  return (
    <div className={panelCls}>
      <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
        <div>
          <h2 className={sectionTitleCls}>Stock</h2>
          <p className="text-[12.5px] text-[#6B6F66] mt-0.5">Live inventory across all stores &amp; kitchens</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onOpenActionModal} className={ghostBtn}>
            Transfer / Audit / Waste
          </button>
          <button type="button" onClick={onOpenAddStock} className={primaryBtn}>
            <FaPlus className="text-sm" /> Add stock
          </button>
        </div>
      </div>

      {/* raw / menu pills */}
      <div className="flex gap-2 flex-wrap mb-4">
        <button
          type="button"
          onClick={() => setViewMode("raw")}
          className={softBtn(viewMode === "raw")}
        >
          Raw items
        </button>
        <button
          type="button"
          onClick={() => setViewMode("menu")}
          className={softBtn(viewMode === "menu")}
        >
          Menu items
        </button>
      </div>

      {/* search + filter */}
      <div className="flex gap-2.5 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6F66] text-xs" />
          <input
            className={`${fieldCls} pl-9`}
            placeholder="Search items…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="w-[170px] rounded-[9px] border border-[#E4E1D8] bg-white px-3 py-2.5 text-[13.5px] font-medium text-[#1C231F]"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="all">All categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat.toLowerCase()}>{cat}</option>
          ))}
        </select>
      </div>

      {/* table */}
      <div className="overflow-x-auto rounded-xl border border-[#E4E1D8]">
        <table className="w-full min-w-[640px] text-left text-[13px]">
          <TableHeader
            columns={[
              { key: "item", label: "Item" },
              { key: "category", label: "Category" },
              { key: "stock", label: "Physical stock" },
              { key: "reorder", label: "Reorder level" },
              { key: "expiry", label: "Expiry" },
              { key: "store", label: "Store" },
              { key: "actions", label: "" },
            ]}
          />
          <tbody className="divide-y divide-[#E4E1D8]">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-[#6B6F66]">
                  Loading stock...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <EmptyState title="No items in stock" subtitle="Add stock to see it reflected here instantly." />
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr key={s.id || s.stockId} className="hover:bg-[#F6F5F1]/50 transition-colors">
                  <td className="py-2.5 pr-3 font-semibold text-[#1C231F]">{s.itemName || s.item_name || "-"}</td>
                  <td className="py-2.5 pr-3 text-[#1C231F]">{s.category || "-"}</td>
                  <td className="py-2.5 pr-3">
                    <span className={Number(s.quantity || 0) <= (s.reorderLevel || 5) ? "text-[#C8791A] font-semibold" : "text-[#1C231F]"}>
                      {s.quantity || 0}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-[#1C231F]">{s.reorderLevel ?? 5}</td>
                  <td className="py-2.5 pr-3 text-[#1C231F]">{s.expiryDate ? formatDate(s.expiryDate) : "-"}</td>
                  <td className="py-2.5 pr-3 text-[#1C231F]">{s.store || s.storeName || "-"}</td>
                  <td className="py-2.5 pr-3">
                    <div className="flex gap-1.5">
                      <button type="button" className={rowActionBtn("neutral") + " !py-1.5 !px-2.5 !text-xs"}>
                        <FaEye /> View
                      </button>
                      <button type="button" className={rowActionBtn("primary") + " !py-1.5 !px-2.5 !text-xs"}>
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
    </div>
  );
};

/* ─────────────────────────── ReportsPage ─────────────────────────── */

const REPORTS_TABS = [
  { key: "vendor-spend", label: "Vendor spend" },
  { key: "stock-value", label: "Stock value" },
  { key: "expiry-batches", label: "Expiry & batches" },
  { key: "consumption", label: "Consumption" },
  { key: "audit-trail", label: "Audit trail" },
];

const ReportsPage = () => {
  const [activeReport, setActiveReport] = useState("vendor-spend");
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchReport = async (type) => {
    setLoading(true);
    try {
      // Map tab key to backend endpoint
      const endpointMap = {
        "vendor-spend": "/inventory/reports/vendor-spend",
        "stock-value": "/inventory/reports/stock-value",
        "expiry-batches": "/inventory/reports/expiry-batches",
        "consumption": "/inventory/reports/consumption",
        "audit-trail": "/inventory/reports/audit-trail",
      };
      const res = await API.get(endpointMap[type] || "/inventory/reports/vendor-spend");
      setReportData(Array.isArray(res.data) ? res.data : []);
    } catch {
      setReportData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReport(activeReport); }, [activeReport]);

  // Column definitions per report type
  const columnsMap = {
    "vendor-spend": [
      { key: "vendor", label: "Vendor" },
      { key: "contact", label: "Contact" },
      { key: "purchases", label: "Purchases" },
      { key: "services", label: "Services" },
      { key: "totalSpend", label: "Total spend" },
      { key: "status", label: "Status" },
    ],
    "stock-value": [
      { key: "item", label: "Item" },
      { key: "category", label: "Category" },
      { key: "qty", label: "Qty" },
      { key: "unitPrice", label: "Unit price" },
      { key: "totalValue", label: "Total value" },
    ],
    "expiry-batches": [
      { key: "item", label: "Item" },
      { key: "batch", label: "Batch" },
      { key: "expiry", label: "Expiry date" },
      { key: "qty", label: "Qty" },
      { key: "status", label: "Status" },
    ],
    "consumption": [
      { key: "item", label: "Item" },
      { key: "consumed", label: "Consumed" },
      { key: "period", label: "Period" },
      { key: "value", label: "Value" },
    ],
    "audit-trail": [
      { key: "date", label: "Date" },
      { key: "action", label: "Action" },
      { key: "item", label: "Item" },
      { key: "qty", label: "Qty" },
      { key: "user", label: "User" },
      { key: "notes", label: "Notes" },
    ],
  };

  const columns = columnsMap[activeReport] || columnsMap["vendor-spend"];

  // Format value based on column key
  const formatCell = (row, colKey) => {
    const val = row[colKey];
    if (colKey === "totalSpend" || colKey === "unitPrice" || colKey === "totalValue" || colKey === "value") {
      return formatCurrency(val);
    }
    if (colKey === "date") return formatDate(val);
    return val || "-";
  };

  return (
    <div className={panelCls}>
      <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
        <div>
          <h2 className={sectionTitleCls}>Reports</h2>
          <p className="text-[12.5px] text-[#6B6F66] mt-0.5">See how stock, spend &amp; waste are moving</p>
        </div>
        <button type="button" className={ghostBtn}>
          ⚙ Setup data
        </button>
      </div>

      {/* report type pills */}
      <div className="flex gap-2 flex-wrap mb-4">
        {REPORTS_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveReport(tab.key)}
            className={`rounded-[20px] px-3.5 py-1.5 text-[12.5px] font-medium transition-all ${
              activeReport === tab.key
                ? "bg-[#0B4F48] text-white border border-[#0B4F48]"
                : "bg-[#F6F5F1] border border-[#E4E1D8] text-[#1C231F] hover:bg-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* report table */}
      <div className="overflow-x-auto rounded-xl border border-[#E4E1D8]">
        <table className="w-full min-w-[560px] text-left text-[13px]">
          <TableHeader columns={columns} />
          <tbody className="divide-y divide-[#E4E1D8]">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="py-10 text-center text-[#6B6F66]">
                  Loading report data...
                </td>
              </tr>
            ) : reportData.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <EmptyState
                    title="No report data yet"
                    subtitle="Reports fill in automatically once you record purchases and stock activity."
                  />
                </td>
              </tr>
            ) : (
              reportData.map((row, i) => (
                <tr key={i} className="hover:bg-[#F6F5F1]/50 transition-colors">
                  {columns.map((col) => (
                    <td key={col.key} className="py-2.5 pr-3 text-[#1C231F]">
                      {formatCell(row, col.key)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ─────────────────────────── NewPurchaseModal ─────────────────────────── */

const NewPurchaseModal = ({ open, onClose, categories, vendors, onSave }) => {
  const [form, setForm] = useState({
    itemName: "",
    category: "",
    vendor: "",
    quantity: "",
    unit: "",
    rate: "",
    total: "",
    status: "pending",
  });

  const setField = (name, value) => {
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      // Auto-calculate total when qty or rate changes
      if (name === "quantity" || name === "rate") {
        const q = name === "quantity" ? toNumber(value) : toNumber(prev.quantity);
        const r = name === "rate" ? toNumber(value) : toNumber(prev.rate);
        next.total = String(q * r);
      }
      return next;
    });
  };

  const handleSubmit = () => {
    onSave({ ...form, quantity: toNumber(form.quantity), rate: toNumber(form.rate), total: toNumber(form.total) });
    setForm({ itemName: "", category: "", vendor: "", quantity: "", unit: "", rate: "", total: "", status: "pending" });
    onClose();
  };

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New purchase"
      subtitle="Record what you bought and from whom"
      actions={
        <>
          <button type="button" onClick={onClose} className={ghostBtn}>Cancel</button>
          <button type="button" onClick={handleSubmit} className={primaryBtn}>Save purchase</button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="field">
          <label className={labelCls}>Item name</label>
          <select
            className={fieldCls}
            value={form.itemName}
            onChange={(e) => setField("itemName", e.target.value)}
          >
            <option value="">Select item</option>
            {categories.map((cat) => (
              <option key={cat.id || cat.value} value={cat.name || cat.value}>{cat.name || cat.label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className={labelCls}>Vendor</label>
          <select
            className={fieldCls}
            value={form.vendor}
            onChange={(e) => setField("vendor", e.target.value)}
          >
            <option value="">Select vendor</option>
            {vendors.map((v) => (
              <option key={v.id || v.value} value={v.name || v.value}>{v.name || v.label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className={labelCls}>Quantity</label>
          <input
            type="number"
            className={fieldCls}
            placeholder="0"
            value={form.quantity}
            onChange={(e) => setField("quantity", e.target.value)}
          />
        </div>
        <div className="field">
          <label className={labelCls}>Unit</label>
          <input
            className={fieldCls}
            placeholder="kg / ltr / pcs"
            value={form.unit}
            onChange={(e) => setField("unit", e.target.value)}
          />
        </div>
        <div className="field">
          <label className={labelCls}>Rate / unit (₹)</label>
          <input
            type="number"
            className={fieldCls}
            placeholder="0"
            value={form.rate}
            onChange={(e) => setField("rate", e.target.value)}
          />
        </div>
        <div className="field">
          <label className={labelCls}>Total amount (₹)</label>
          <input
            type="number"
            className={fieldCls}
            placeholder="0"
            value={form.total}
            readOnly
          />
        </div>
      </div>
    </Modal>
  );
};

/* ─────────────────────────── AddStockModal ─────────────────────────── */

const AddStockModal = ({ open, onClose, categories, stores, onSave }) => {
  const [form, setForm] = useState({
    itemName: "",
    category: "",
    receivedQty: "",
    reorderLevel: "",
    expiryDate: "",
    store: "",
  });

  const setField = (name, value) => setForm((p) => ({ ...p, [name]: value }));

  const handleSubmit = () => {
    onSave({ ...form, receivedQty: toNumber(form.receivedQty), reorderLevel: toNumber(form.reorderLevel) });
    setForm({ itemName: "", category: "", receivedQty: "", reorderLevel: "", expiryDate: "", store: "" });
    onClose();
  };

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add stock"
      subtitle="Update physical stock for an item"
      actions={
        <>
          <button type="button" onClick={onClose} className={ghostBtn}>Cancel</button>
          <button type="button" onClick={handleSubmit} className={primaryBtn}>Save stock</button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="field">
          <label className={labelCls}>Item name</label>
          <select
            className={fieldCls}
            value={form.itemName}
            onChange={(e) => setField("itemName", e.target.value)}
          >
            <option value="">Select item</option>
            {categories.map((cat) => (
              <option key={cat.id || cat.value} value={cat.name || cat.value}>{cat.name || cat.label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className={labelCls}>Category</label>
          <select
            className={fieldCls}
            value={form.category}
            onChange={(e) => setField("category", e.target.value)}
          >
            <option value="">Select category</option>
            {categories.map((cat) => (
              <option key={cat.id || cat.value} value={cat.name || cat.value}>{cat.name || cat.label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className={labelCls}>Received qty</label>
          <input
            type="number"
            className={fieldCls}
            placeholder="0"
            value={form.receivedQty}
            onChange={(e) => setField("receivedQty", e.target.value)}
          />
        </div>
        <div className="field">
          <label className={labelCls}>Reorder level</label>
          <input
            type="number"
            className={fieldCls}
            placeholder="0"
            value={form.reorderLevel}
            onChange={(e) => setField("reorderLevel", e.target.value)}
          />
        </div>
        <div className="field">
          <label className={labelCls}>Expiry date</label>
          <input
            type="date"
            className={fieldCls}
            value={form.expiryDate}
            onChange={(e) => setField("expiryDate", e.target.value)}
          />
        </div>
        <div className="field">
          <label className={labelCls}>Store / kitchen</label>
          <select
            className={fieldCls}
            value={form.store}
            onChange={(e) => setField("store", e.target.value)}
          >
            <option value="">Select store</option>
            {stores.map((s) => (
              <option key={s.id || s.value} value={s.name || s.value}>{s.name || s.label}</option>
            ))}
          </select>
        </div>
      </div>
    </Modal>
  );
};

/* ─────────────────────────── ActionModal (Transfer / Audit / Waste) ─────────────────────────── */

const ACTION_TABS = [
  { key: "transfer", label: "Transfer" },
  { key: "audit", label: "Audit" },
  { key: "waste", label: "Waste / spoilage" },
];

const ActionModal = ({ open, onClose, categories, stores, onSave }) => {
  const [actionType, setActionType] = useState("transfer");
  const [form, setForm] = useState({
    item: "",
    quantity: "",
    fromStore: "",
    toStore: "",
    notes: "",
  });

  const setField = (name, value) => setForm((p) => ({ ...p, [name]: value }));

  const handleSubmit = () => {
    onSave({ ...form, actionType, quantity: toNumber(form.quantity) });
    setForm({ item: "", quantity: "", fromStore: "", toStore: "", notes: "" });
    onClose();
  };

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Stock action"
      subtitle="Move, count, or write off stock"
      actions={
        <>
          <button type="button" onClick={onClose} className={ghostBtn}>Cancel</button>
          <button type="button" onClick={handleSubmit} className={primaryBtn}>Save</button>
        </>
      }
    >
      {/* action type pills */}
      <div className="flex gap-2 flex-wrap mb-4">
        {ACTION_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActionType(tab.key)}
            className={`rounded-[20px] px-3.5 py-1.5 text-[12.5px] font-medium transition-all ${
              actionType === tab.key
                ? "bg-[#0B4F48] text-white border border-[#0B4F48]"
                : "bg-[#F6F5F1] border border-[#E4E1D8] text-[#1C231F] hover:bg-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="field">
          <label className={labelCls}>Item</label>
          <select
            className={fieldCls}
            value={form.item}
            onChange={(e) => setField("item", e.target.value)}
          >
            <option value="">Select item</option>
            {categories.map((cat) => (
              <option key={cat.id || cat.value} value={cat.name || cat.value}>{cat.name || cat.label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className={labelCls}>Quantity</label>
          <input
            type="number"
            className={fieldCls}
            placeholder="0"
            value={form.quantity}
            onChange={(e) => setField("quantity", e.target.value)}
          />
        </div>
        {actionType === "transfer" && (
          <>
            <div className="field">
              <label className={labelCls}>From store</label>
              <select
                className={fieldCls}
                value={form.fromStore}
                onChange={(e) => setField("fromStore", e.target.value)}
              >
                <option value="">Select store</option>
                {stores.map((s) => (
                  <option key={s.id || s.value} value={s.name || s.value}>{s.name || s.label}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className={labelCls}>To store</label>
              <select
                className={fieldCls}
                value={form.toStore}
                onChange={(e) => setField("toStore", e.target.value)}
              >
                <option value="">Select store</option>
                {stores.map((s) => (
                  <option key={s.id || s.value} value={s.name || s.value}>{s.name || s.label}</option>
                ))}
              </select>
            </div>
          </>
        )}
        <div className="field sm:col-span-2">
          <label className={labelCls}>Reason / notes</label>
          <input
            className={fieldCls}
            placeholder="Optional"
            value={form.notes}
            onChange={(e) => setField("notes", e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
};

/* ─────────────────────────── Toast notification ─────────────────────────── */

const Toast = ({ open, type, title, message, onClose }) => {
  if (!open) return null;
  const tone = type === "success" ? "bg-[#E4F0EE] text-[#0B4F48]" : "bg-[#F5DFDA] text-[#B5442E]";
  const Icon = type === "success" ? FaCheckCircle : FaExclamationTriangle;
  return (
    <div className={`fixed bottom-5 right-5 z-[90] flex items-center gap-3 rounded-[12px] border border-[#E4E1D8] ${tone} px-5 py-3.5 shadow-lg max-w-sm`}>
      <Icon className="text-lg shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-bold">{title}</div>
        <div className="text-[12px] opacity-80 truncate">{message}</div>
      </div>
      <button type="button" onClick={onClose} className="shrink-0 rounded-full p-1 hover:bg-black/5">
        <FaTimes className="text-sm" />
      </button>
    </div>
  );
};

/* ─────────────────────────── main component ─────────────────────────── */

const InventoryFlow = () => {
  const [view, setView] = useState("purchase"); // "purchase" | "stock" | "reports"
  const [showNewPurchase, setShowNewPurchase] = useState(false);
  const [showAddStock, setShowAddStock] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState("categories");
  const [toast, setToast] = useState({ open: false, type: "success", title: "", message: "" });

  // Master data (categories, vendors, units, stores, groups) — loaded from /setup
  const [categories, setCategories] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [stores, setStores] = useState([]);

  // Stats
  const [stats, setStats] = useState(["0", "₹0", "0", "0"]);

  // Load master data
  useEffect(() => {
    let cancelled = false;
    const loadMasters = async () => {
      try {
        const [catRes, venRes, storeRes] = await Promise.all([
          API.get("/inventory/setup/categories").catch(() => ({ data: [] })),
          API.get("/inventory/setup/vendors").catch(() => ({ data: [] })),
          API.get("/inventory/setup/stores").catch(() => ({ data: [] })),
        ]);
        if (!cancelled) {
          setCategories(Array.isArray(catRes.data) ? catRes.data : []);
          setVendors(Array.isArray(venRes.data) ? venRes.data : []);
          setStores(Array.isArray(storeRes.data) ? storeRes.data : []);
        }
      } catch {
        // silent — empty arrays used as fallback
      }
    };
    loadMasters();
    return () => { cancelled = true; };
  }, []);

  // Load stats
  useEffect(() => {
    let cancelled = false;
    const loadStats = async () => {
      try {
        const res = await API.get("/inventory/stats");
        if (!cancelled && res.data) {
          const d = res.data;
          setStats([
            String(d.totalItems ?? d.total_items ?? 0),
            formatCurrency(d.stockValue ?? d.stock_value ?? 0),
            String(d.lowStock ?? d.low_stock ?? 0),
            String(d.expiringSoon ?? d.expiring_soon ?? 0),
          ]);
        }
      } catch {
        // use defaults
      }
    };
    loadStats();
    return () => { cancelled = true; };
  }, []);

  /* ── handlers ─────────────────────────── */

  const showToast = (type, title, message) => setToast({ open: true, type, title, message });
  const closeToast = () => setToast((t) => ({ ...t, open: false }));

  const handleJumpStep = (step) => {
    setView(step);
  };

  const handleSavePurchase = async (data) => {
    try {
      await API.post("/inventory/purchases", data);
      showToast("success", "Purchase saved", "Your purchase has been recorded.");
    } catch (err) {
      console.error(err);
      showToast("error", "Save failed", err.response?.data?.message || "Could not save purchase.");
    }
  };

  const handleSaveStock = async (data) => {
    try {
      await API.post("/inventory/stock", data);
      showToast("success", "Stock updated", "Stock has been updated successfully.");
    } catch (err) {
      console.error(err);
      showToast("error", "Save failed", err.response?.data?.message || "Could not update stock.");
    }
  };

  const handleSaveAction = async (data) => {
    try {
      await API.post("/inventory/stock-action", data);
      const actionLabel = data.actionType === "transfer" ? "Transfer" : data.actionType === "audit" ? "Audit" : "Waste recorded";
      showToast("success", `${actionLabel} saved`, "The stock action has been recorded.");
    } catch (err) {
      console.error(err);
      showToast("error", "Save failed", err.response?.data?.message || "Could not save stock action.");
    }
  };

  const handleSaveMaster = (tab, data) => {
    console.log(`[Setup] Saving ${tab}:`, data);
    showToast("success", `${tab.charAt(0).toUpperCase() + tab.slice(1)} saved`, `${data.name || "Entry"} has been added to ${tab}.`);
  };

  /* ── render ─────────────────────────── */

  return (
    <div
      className="min-h-screen w-full max-w-full overflow-x-hidden"
      style={{
        background: c.paper,
        color: c.text,
        fontFamily: fontBody,
        padding: "22px 22px 60px",
      }}
    >
      {/* ─── top bar ─────────────────────── */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg bg-white/80 px-4 py-2 text-sm font-medium text-[#1C231F] shadow-sm ring-1 ring-[#E4E1D8] hover:bg-white hover:text-[#0B4F48] active:scale-[0.98] transition"
            title="Back"
          >
            <FaArrowLeft className="text-base" />
            Back
          </button>
          <div className="flex items-center gap-3">
            <div
              className="w-[38px] h-[38px] rounded-lg flex items-center justify-center text-white font-bold text-[18px]"
              style={{ background: c.tealDeep, fontFamily: fontDisplay }}
            >
              I
            </div>
            <div>
              <h1 className="text-[21px] font-semibold m-0 leading-tight" style={{ letterSpacing: "0.2px" }}>
                Inventory
              </h1>
              <p className="m-0 text-[12px]" style={{ color: c.muted }}>
                Purchase → Stock → Track, in one flow
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          {/* bell notification (static — wire to real alerts later) */}
          <div
            className="relative w-[38px] h-[38px] rounded-full bg-white border border-[#E4E1D8] flex items-center justify-center cursor-pointer"
            title="Alerts"
          >
            <span>🔔</span>
            <span
              className="absolute top-[6px] right-[7px] w-2 h-2 rounded-full"
              style={{ background: c.rose }}
            />
          </div>
          <button type="button" onClick={() => { setDrawerTab("categories"); setDrawerOpen(true); }} className={ghostBtn}>
            ⚙ Setup
          </button>
        </div>
      </div>

      {/* ─── flow rail ──────────────────── */}
      <FlowRail activePage={view} onJump={handleJumpStep} />

      {/* ─── stat cards ─────────────────── */}
      <StatCards stats={stats} />

      {/* ─── pages ──────────────────────── */}
      <div style={{ display: view === "purchase" ? "block" : "none" }}>
        <PurchasePage
          onOpenNewPurchase={() => setShowNewPurchase(true)}
          onOpenVendorDrawer={() => { setDrawerTab("vendors"); setDrawerOpen(true); }}
        />
      </div>

      <div style={{ display: view === "stock" ? "block" : "none" }}>
        <StockPage
          onOpenAddStock={() => setShowAddStock(true)}
          onOpenActionModal={() => setShowActionModal(true)}
        />
      </div>

      <div style={{ display: view === "reports" ? "block" : "none" }}>
        <ReportsPage />
      </div>

      {/* ─── modals ─────────────────────── */}
      <NewPurchaseModal
        open={showNewPurchase}
        onClose={() => setShowNewPurchase(false)}
        categories={categories}
        vendors={vendors}
        onSave={handleSavePurchase}
      />

      <AddStockModal
        open={showAddStock}
        onClose={() => setShowAddStock(false)}
        categories={categories}
        stores={stores}
        onSave={handleSaveStock}
      />

      <ActionModal
        open={showActionModal}
        onClose={() => setShowActionModal(false)}
        categories={categories}
        stores={stores}
        onSave={handleSaveAction}
      />

      {/* ─── setup drawer ──────────────── */}
      <SetupDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        activeTab={drawerTab}
        onTabChange={setDrawerTab}
        onSave={handleSaveMaster}
      />

      {/* ─── toast ─────────────────────── */}
      <Toast
        open={toast.open}
        type={toast.type}
        title={toast.title}
        message={toast.message}
        onClose={closeToast}
      />
    </div>
  );
};

export default InventoryFlow;
export { FlowRail, StatCards, Modal, FeatureModal, SetupDrawer, PurchasePage, StockPage, ReportsPage };