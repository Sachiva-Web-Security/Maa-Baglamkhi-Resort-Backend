// src/pages/InventoryHubPage.jsx
// Main inventory landing page at /inventory
// Shows overview stats and quick access cards to all sub-sections
//
// NOTE: This file only changes presentation (markup/classNames/inline styles).
// All hooks, state, API calls, filtering logic, sorting logic, and navigation
// routes are byte-for-byte the same as the original implementation.

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaBoxes, FaListAlt, FaTruck, FaBalanceScale,
  FaWarehouse, FaUtensils, FaClipboardList, FaShoppingCart,
  FaChartBar, FaPlus, FaSearch, FaExclamationTriangle,
  FaCheckCircle, FaArrowRight, FaBell, FaChevronRight,
} from "react-icons/fa";

import API from "../api";

// ---- Design tokens (visual only — does not touch any logic below) ----
const c = {
  paper: "#F4F8FF", line: "#E7EEFB", tealDeep: "#0B4F48", tealMid: "#0F6E64",
  muted: "#6B7280", text: "#1C231F",
  navy: "#0F2A5C", slate: "#475569", rose: "#B5442E", amber: "#C8791A",
};

const sectionCards = [
  { name: "Categories", path: "/inventory/categories", icon: FaListAlt, color: "#2563EB", tint: "#EAF1FF", desc: "Organize items into groups" },
  { name: "Item Categories & Sub", path: "/inventory/stock-categories", icon: FaListAlt, color: "#2563EB", tint: "#EAF1FF", desc: "Categories + subcategories for items" },
  { name: "Vendors", path: "/inventory/vendors", icon: FaTruck, color: "#16A34A", tint: "#E9F9EE", desc: "Manage supplier contacts" },
  { name: "Units", path: "/inventory/units", icon: FaBalanceScale, color: "#7C3AED", tint: "#F1EBFE", desc: "kg, ltr, pcs, metres" },
  { name: "Items / Stock", path: "/inventory/items", icon: FaWarehouse, color: "#2563EB", tint: "#EAF1FF", desc: "Track stock levels" },
  { name: "Menu Items", path: "/inventory/menu-items", icon: FaUtensils, color: "#F59E0B", tint: "#FFF4E2", desc: "Food & drink with photos" },
  { name: "Menu List", path: "/inventory/menu-list", icon: FaClipboardList, color: "#16A34A", tint: "#E9F9EE", desc: "Kitchen/wait staff view" },
  { name: "Purchase Invoices", path: "/inventory/purchases", icon: FaShoppingCart, color: "#2563EB", tint: "#EAF1FF", desc: "Orders from vendors" },
  { name: "Reports", path: "/inventory/reports", icon: FaChartBar, color: "#7C3AED", tint: "#F1EBFE", desc: "Stock & spend analytics" },
];

const InventoryHubPage = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ items: 0, vendors: 0, categories: 0, units: 0, purchases: 0, menuItems: 0 });
  const [lowStock, setLowStock] = useState([]);
  const [recentPurchases, setRecentPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [itemsRes, vendorsRes, catsRes, unitsRes, purchasesRes] = await Promise.allSettled([
          API.get("/inventory").catch(() => ({ data: [] })),
          API.get("/inventory-masters/vendors").catch(() => ({ data: [] })),
          API.get("/inventory-masters/menu-categories").catch(() => ({ data: [] })),
          API.get("/inventory-masters/units").catch(() => ({ data: [] })),
          API.get("/inventory/purchase-orders").catch(() => ({ data: [] })),
        ]);

        const items = itemsRes.status === "fulfilled" ? (itemsRes.value.data || []) : [];
        const vendors = vendorsRes.status === "fulfilled" ? (vendorsRes.value.data || []) : [];
        const cats = catsRes.status === "fulfilled" ? (catsRes.value.data || []) : [];
        const units = unitsRes.status === "fulfilled" ? (unitsRes.value.data || []) : [];
        const purchases = purchasesRes.status === "fulfilled" ? (purchasesRes.value.data || []) : [];

        setStats({
          items: items.length,
          vendors: vendors.length,
          categories: cats.length,
          units: units.length,
          purchases: purchases.length,
          menuItems: 0,
        });

        // Low stock = items where stock_qty < min_stock_level (if available) or stock_qty < 5
        const low = items
          .filter((i) => {
            const qty = Number(i.stock_qty ?? i.stockQty ?? i.quantity ?? 0);
            const min = Number(i.min_stock_level ?? i.minStockLevel ?? 5);
            return qty < min;
          })
          .slice(0, 5);
        setLowStock(low);

        // Recent purchases sorted by date desc
        const sorted = [...purchases].sort((a, b) => {
          const da = new Date(a.created_at || a.purchase_date || 0);
          const db = new Date(b.created_at || b.purchase_date || 0);
          return db - da;
        });
        setRecentPurchases(sorted.slice(0, 5));
      } catch {
        // silently fail — individual sections show empty states
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filteredCards = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sectionCards;
    return sectionCards.filter((s) => s.name.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q));
  }, [search]);

  const statCards = [
    { label: "Items / Stock", value: stats.items, color: "#2563EB", tint: "#EAF1FF", icon: FaWarehouse, path: "/inventory/items" },
    { label: "Vendors", value: stats.vendors, color: "#16A34A", tint: "#E9F9EE", icon: FaTruck, path: "/inventory/vendors" },
    { label: "Categories", value: stats.categories, color: "#7C3AED", tint: "#F1EBFE", icon: FaListAlt, path: "/inventory/categories" },
    { label: "Units", value: stats.units, color: "#F59E0B", tint: "#FFF4E2", icon: FaBalanceScale, path: "/inventory/units" },
    { label: "Purchases", value: stats.purchases, color: "#0EA5B7", tint: "#E4FBFD", icon: FaShoppingCart, path: "/inventory/purchases" },
  ];

  return (
    <div
      className="min-h-screen w-full max-w-full overflow-x-hidden px-4 pt-5 pb-14 sm:px-7 sm:pt-7 sm:pb-16"
      style={{
        background: "linear-gradient(180deg, #F5F9FF 0%, #F0F5FD 45%, #EEF3FC 100%)",
        color: c.text,
      }}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start items-stretch justify-between flex-wrap gap-4 mb-8">
        <div>
          <h1
            className="m-0 leading-tight font-bold text-[28px] sm:text-[44px]"
            style={{ color: c.navy, letterSpacing: "-0.02em" }}
          >
            Inventory
          </h1>
          <p className="m-0 mt-1 text-[14.5px] sm:text-[19px]" style={{ color: c.slate }}>
            Manage stock, vendors, purchases, and menu
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none sm:w-[300px]">
            <FaSearch
              className="absolute left-4 top-1/2 -translate-y-1/2"
              style={{ color: "#94A3B8", fontSize: "15px" }}
            />
            <input
              className="w-full rounded-full border bg-white pl-11 pr-4 py-3 font-medium outline-none transition-all duration-250"
              style={{
                fontSize: "17px",
                borderColor: c.line,
                boxShadow: "0 1px 2px rgba(15,42,92,0.04)",
              }}
              placeholder="Quick search sections…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={(e) => {
                e.target.style.borderColor = "#2563EB";
                e.target.style.boxShadow = "0 0 0 4px rgba(37,99,235,0.12)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = c.line;
                e.target.style.boxShadow = "0 1px 2px rgba(15,42,92,0.04)";
              }}
            />
          </div>

          <button
            type="button"
            aria-label="Notifications"
            className="relative shrink-0 flex items-center justify-center rounded-full bg-white transition-all duration-250 hover:shadow-md"
            style={{ width: "50px", height: "50px", border: `1px solid ${c.line}` }}
          >
            <FaBell style={{ color: c.slate, fontSize: "18px" }} />
            <span
              className="absolute rounded-full"
              style={{
                top: "12px",
                right: "12px",
                width: "9px",
                height: "9px",
                background: "#EF4444",
                border: "2px solid white",
              }}
            />
          </button>
        </div>
      </div>

      {/* Quick stat row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.label}
              onClick={() => navigate(s.path)}
              className="group text-left bg-white transition-all duration-300 p-4 sm:p-[22px]"
              style={{
                borderRadius: "20px",
                boxShadow: "0 1px 3px rgba(15,42,92,0.06)",
                border: `1px solid ${c.line}`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-4px)";
                e.currentTarget.style.boxShadow = "0 12px 24px rgba(15,42,92,0.10)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 1px 3px rgba(15,42,92,0.06)";
              }}
            >
              <div
                className="flex items-center justify-center mb-3"
                style={{ width: "48px", height: "48px", borderRadius: "14px", background: s.tint }}
              >
                <Icon style={{ color: s.color, fontSize: "20px" }} />
              </div>
              <div
                className="font-semibold uppercase mb-2"
                style={{ fontSize: "11px", letterSpacing: "0.06em", color: c.muted }}
              >
                {s.label}
              </div>
              <div
                className="font-bold leading-none mb-3 text-[28px] sm:text-[38px]"
                style={{ color: c.navy }}
              >
                {loading ? "…" : s.value}
              </div>
              <div
                className="inline-flex items-center gap-1.5 font-medium transition-colors whitespace-nowrap"
                style={{ fontSize: "13px", color: s.color }}
              >
                View Details <FaArrowRight style={{ fontSize: "11px" }} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Section cards */}
      <h2
        className="font-bold mb-4"
        style={{ fontSize: "13px", letterSpacing: "0.06em", color: c.slate, textTransform: "uppercase" }}
      >
        All Sections
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {filteredCards.map((sec) => {
          const Icon = sec.icon;
          return (
            <button
              key={sec.path}
              onClick={() => navigate(sec.path)}
              className="group text-left bg-white transition-all duration-300 flex items-center gap-3.5"
              style={{
                borderRadius: "18px",
                padding: "18px",
                border: `1px solid ${c.line}`,
                boxShadow: "0 1px 3px rgba(15,42,92,0.05)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-3px)";
                e.currentTarget.style.boxShadow = "0 10px 20px rgba(15,42,92,0.09)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 1px 3px rgba(15,42,92,0.05)";
              }}
            >
              <div
                className="flex items-center justify-center shrink-0"
                style={{ width: "44px", height: "44px", borderRadius: "12px", background: sec.tint }}
              >
                <Icon style={{ color: sec.color, fontSize: "18px" }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold leading-tight truncate" style={{ fontSize: "15px", color: c.navy }}>
                  {sec.name}
                </div>
                <div className="mt-0.5 truncate" style={{ fontSize: "12.5px", color: c.muted }}>
                  {sec.desc}
                </div>
              </div>
              <FaChevronRight
                className="shrink-0 transition-transform group-hover:translate-x-0.5"
                style={{ fontSize: "12px", color: "#94A3B8" }}
              />
            </button>
          );
        })}
      </div>

      {/* Alerts row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Low stock */}
        <div
          className="bg-white"
          style={{ borderRadius: "20px", padding: "22px", border: `1px solid ${c.line}`, boxShadow: "0 1px 3px rgba(15,42,92,0.05)" }}
        >
          <div className="flex items-center gap-2.5 mb-4">
            <div
              className="flex items-center justify-center"
              style={{ width: "34px", height: "34px", borderRadius: "10px", background: "#FFF4E2" }}
            >
              <FaExclamationTriangle style={{ color: "#F59E0B", fontSize: "14px" }} />
            </div>
            <h3 className="font-bold m-0" style={{ fontSize: "17px", color: c.navy }}>
              Low Stock Alerts
            </h3>
          </div>

          {lowStock.length === 0 ? (
            <div className="flex items-center gap-2 py-3" style={{ fontSize: "14px", color: c.muted }}>
              <FaCheckCircle style={{ color: "#16A34A" }} /> All items in stock.
            </div>
          ) : (
            <>
              <div>
                {lowStock.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between"
                    style={{ padding: "12px 2px", borderBottom: `1px solid ${c.line}` }}
                  >
                    <div className="min-w-0 pr-3">
                      <div className="font-semibold break-words" style={{ fontSize: "14.5px", color: c.text }}>
                        {item.name || item.item_name || "-"}
                      </div>
                      <div style={{ fontSize: "12.5px", color: c.muted }}>{item.category || ""}</div>
                    </div>
                    <span
                      className="font-semibold shrink-0"
                      style={{
                        fontSize: "12.5px",
                        color: "#DC2626",
                        background: "#FEF2F2",
                        padding: "4px 10px",
                        borderRadius: "999px",
                      }}
                    >
                      {Number(item.stock_qty ?? item.stockQty ?? item.quantity ?? 0)} left
                    </span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => navigate("/inventory/items")}
                className="w-full text-center font-semibold transition-colors py-2 sm:py-0 whitespace-nowrap"
                style={{ fontSize: "13.5px", color: "#2563EB", marginTop: "14px" }}
              >
                View All Low Stock <FaArrowRight style={{ display: "inline", fontSize: "11px", marginLeft: "4px" }} />
              </button>
            </>
          )}
        </div>

        {/* Recent purchases */}
        <div
          className="bg-white"
          style={{ borderRadius: "20px", padding: "22px", border: `1px solid ${c.line}`, boxShadow: "0 1px 3px rgba(15,42,92,0.05)" }}
        >
          <div className="flex items-center gap-2.5 mb-4">
            <div
              className="flex items-center justify-center"
              style={{ width: "34px", height: "34px", borderRadius: "10px", background: "#EAF1FF" }}
            >
              <FaShoppingCart style={{ color: "#2563EB", fontSize: "14px" }} />
            </div>
            <h3 className="font-bold m-0" style={{ fontSize: "17px", color: c.navy }}>
              Recent Purchases
            </h3>
          </div>

          {recentPurchases.length === 0 ? (
            <div className="py-3" style={{ fontSize: "14px", color: c.muted }}>No purchases yet.</div>
          ) : (
            <>
              <div>
                {recentPurchases.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between"
                    style={{ padding: "12px 2px", borderBottom: `1px solid ${c.line}` }}
                  >
                    <div className="min-w-0 pr-3">
                      <div className="font-semibold break-words" style={{ fontSize: "14.5px", color: c.text }}>
                        {p.invoice_no || p.invoiceNumber || `#${p.id}`}
                      </div>
                      <div style={{ fontSize: "12.5px", color: c.muted }}>{p.vendor_name || p.vendor || "-"}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-semibold" style={{ fontSize: "14.5px", color: c.text }}>
                        ₹{Number(p.total_amount ?? p.total ?? 0).toFixed(2)}
                      </div>
                      <div style={{ fontSize: "12.5px", color: c.muted }}>
                        {p.purchase_date || p.created_at ? new Date(p.purchase_date || p.created_at).toLocaleDateString() : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => navigate("/inventory/purchases")}
                className="w-full text-center font-semibold transition-colors py-2 sm:py-0 whitespace-nowrap"
                style={{ fontSize: "13.5px", color: "#2563EB", marginTop: "14px" }}
              >
                View All Purchases <FaArrowRight style={{ display: "inline", fontSize: "11px", marginLeft: "4px" }} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default InventoryHubPage;