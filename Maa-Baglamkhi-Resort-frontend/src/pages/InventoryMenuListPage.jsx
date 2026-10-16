// src/pages/InventoryMenuListPage.jsx
// Read-only menu list view, grouped by category with toggle for availability
// Used by kitchen, waiters, and at table bookings
// Responsive: Desktop (xl:1280px+) unchanged. Tablet/iPad (768-1279px) stacked & compact.
// Mobile (<768px) table becomes stacked cards.

import React, { useEffect, useMemo, useState } from "react";
import {
  FaSearch, FaTimes, FaCheckCircle, FaExclamationTriangle,
  FaClipboardList, FaPrint, FaUtensils, FaLeaf, FaDrumstickBite, FaEgg,
  FaChevronDown, FaChevronUp, FaChevronLeft, FaChevronRight, FaThLarge, FaBan,
} from "react-icons/fa";

import API from "../api";

import BackButton from "../components/Inventory/BackButton";

// Classic Indian veg/non-veg mark: square outline with a solid dot inside
const VegMark = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="1" width="18" height="18" rx="3" stroke="#16A34A" strokeWidth="2" />
    <circle cx="10" cy="10" r="5" fill="#16A34A" />
  </svg>
);

const NonVegMark = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="1" width="18" height="18" rx="3" stroke="#DC2626" strokeWidth="2" />
    <path d="M10 4L16.5 15H3.5L10 4Z" fill="#DC2626" />
  </svg>
);

const Toast = ({ open, type, title, message, onClose }) => {
  if (!open) return null;
  const tone =
    type === "success"
      ? "bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 border-emerald-100"
      : "bg-gradient-to-r from-rose-50 to-red-50 text-rose-700 border-rose-100";
  const Icon = type === "success" ? FaCheckCircle : FaExclamationTriangle;
  return (
    <div className={`fixed bottom-5 right-5 left-5 sm:left-auto z-[90] flex items-center gap-3 rounded-2xl border ${tone} px-4 sm:px-5 py-3 sm:py-3.5 shadow-xl shadow-blue-900/10 sm:max-w-sm backdrop-blur-sm`}>
      <Icon className="text-lg shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] sm:text-[14px] font-bold">{title}</div>
        <div className="text-[12px] sm:text-[13px] opacity-80 truncate">{message}</div>
      </div>
      <button onClick={onClose} className="shrink-0 rounded-full p-1 hover:bg-black/5 transition-colors">
        <FaTimes className="text-sm" />
      </button>
    </div>
  );
};

const FoodTypeIcon = ({ type, size = 12 }) => {
  if (type === "Non-Veg") return <FaDrumstickBite style={{ color: "#DC2626", fontSize: size }} title="Non-Veg" />;
  if (type === "Egg") return <FaEgg style={{ color: "#D97706", fontSize: size }} title="Egg" />;
  return <FaLeaf style={{ color: "#2563EB", fontSize: size }} title="Veg" />;
};

const FoodTypeBadge = ({ type }) => {
  const t = type || "Veg";
  const map = {
    Veg: "bg-gradient-to-r from-blue-50 to-sky-50 text-blue-700 border-blue-100",
    "Non-Veg": "bg-gradient-to-r from-rose-50 to-red-50 text-rose-700 border-rose-100",
    Egg: "bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 border-amber-100",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 xl:px-3 py-0.5 xl:py-1 text-[12px] xl:text-[15px] font-semibold border ${map[t] || map.Veg}`}>
      <FoodTypeIcon type={t} size={11} />
      {t}
    </span>
  );
};

const StatusBadge = ({ status }) => {
  const isAvailable = status === "Available";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 xl:px-3 py-0.5 xl:py-1 text-[12px] xl:text-[15px] font-bold border ${
        isAvailable
          ? "bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 border-emerald-100"
          : "bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 border-amber-100"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${isAvailable ? "bg-emerald-500" : "bg-amber-500"}`} />
      {status}
    </span>
  );
};

const PAGE_SIZE = 8;

const InventoryMenuListPage = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [foodTypeFilter, setFoodTypeFilter] = useState("all");
  const [availabilityFilter, setAvailabilityFilter] = useState("all");
  const [toast, setToast] = useState({ open: false, type: "success", title: "", message: "" });
  const [collapsed, setCollapsed] = useState({});
  const [page, setPage] = useState(1);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await API.get("/restaurant/menu");
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setToast({ open: true, type: "error", title: "Failed to load", message: "Could not fetch menu." });
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((m) => {
      const matchesSearch =
        !q || [m.name, m.category, m.description].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
      const matchesCat = categoryFilter === "all" || String(m.category || "").toLowerCase() === categoryFilter;
      const food = m.food_type || m.foodType || "Veg";
      const matchesFoodType = foodTypeFilter === "all" || food === foodTypeFilter;
      const status = m.availability_status || m.status || "Available";
      const matchesAvail = availabilityFilter === "all" || status === availabilityFilter;
      return matchesSearch && matchesCat && matchesFoodType && matchesAvail;
    });
  }, [items, search, categoryFilter, foodTypeFilter, availabilityFilter]);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter, foodTypeFilter, availabilityFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const grouped = useMemo(() => {
    const map = new Map();
    paginated.forEach((item) => {
      const key = item.category || "Uncategorized";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [paginated]);

  const uniqueCategories = useMemo(
    () => Array.from(new Set(items.map((i) => i.category).filter(Boolean))).sort(),
    [items]
  );

  const stats = useMemo(() => {
    const total = items.length;
    const available = items.filter((i) => (i.availability_status || i.status || "Available") === "Available").length;
    const veg = items.filter((i) => (i.food_type || "Veg") === "Veg").length;
    const nonVeg = items.filter((i) => (i.food_type || "") === "Non-Veg").length;
    return { total, available, unavailable: total - available, veg, nonVeg };
  }, [items]);

  const handlePrint = () => window.print();

  const toggleCollapse = (cat) => setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));

  const statCards = [
    { label: "Total Items", value: stats.total, sub: "All menu items", icon: FaThLarge, color: "#2563EB", bg: "from-blue-50 to-sky-50" },
    { label: "Available", value: stats.available, sub: "Currently available", icon: FaCheckCircle, color: "#0D9488", bg: "from-emerald-50 to-teal-50" },
    { label: "Veg", value: stats.veg, sub: "Vegetarian items", icon: VegMark, color: "#16A34A", bg: "from-emerald-50 to-green-50" },
    { label: "Non-Veg", value: stats.nonVeg, sub: "Non-vegetarian items", icon: NonVegMark, color: "#DC2626", bg: "from-rose-50 to-red-50" },
  ];

  return (
    <div
      className="min-h-screen w-full max-w-full overflow-x-hidden relative px-4 py-6 sm:px-5 sm:py-7 md:px-6 md:py-8 xl:px-[28px] xl:pt-[28px] xl:pb-[60px]"
      style={{
        background: "linear-gradient(180deg, #F5F8FF 0%, #FFFFFF 35%, #F7FAFF 100%)",
      }}
    >
      {/* Ambient glow accents */}
      <div className="pointer-events-none fixed -top-32 -left-20 h-[420px] w-[420px] rounded-full bg-blue-300/20 blur-[110px]" />
      <div className="pointer-events-none fixed top-40 -right-24 h-[380px] w-[380px] rounded-full bg-sky-300/20 blur-[110px]" />

      <div className="relative">
        {/* Header */}
       <BackButton className="shrink-0" />
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 mb-6 xl:mb-7">
          
          <div className="flex items-center gap-3 xl:gap-4">
            
            <div
              className="w-[44px] h-[44px] xl:w-[52px] xl:h-[52px] rounded-2xl flex items-center justify-center text-white text-[18px] xl:text-[22px] shadow-lg shadow-blue-500/30 shrink-0"
              style={{ background: "linear-gradient(135deg,#2563EB,#0EA5E9)" }}
            >
              <FaClipboardList />
            </div>
            <div>
              <h1 className="text-[22px] xl:text-[26px] font-extrabold m-0 leading-tight text-slate-900 tracking-tight">Menu List</h1>
              <p className="m-0 text-[15px] xl:text-[19px] text-slate-500 font-medium">Always-available view of every menu item</p>
            </div>
          </div>
          <button
            onClick={handlePrint}
            className="w-full xl:w-auto inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-[15px] xl:text-[17px] font-semibold text-white shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
            style={{ background: "linear-gradient(135deg,#2563EB,#0EA5E9)" }}
          >
            <FaPrint className="text-base" /> Print
          </button>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4 mb-6 xl:mb-7">
          {statCards.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.label}
                className="group bg-white/80 backdrop-blur-sm border border-blue-100/70 rounded-[20px] xl:rounded-[28px] p-4 xl:p-5 shadow-[0_4px_20px_rgba(30,64,175,0.06)] hover:shadow-[0_10px_30px_rgba(30,64,175,0.12)] hover:-translate-y-1 transition-all duration-300"
              >
                <div className="flex items-center justify-between mb-2.5 xl:mb-3">
                  <div
                    className={`w-9 h-9 xl:w-11 xl:h-11 rounded-2xl flex items-center justify-center bg-gradient-to-br ${s.bg} border border-white shadow-sm`}
                  >
                    <Icon size={16} style={{ color: s.color, fontSize: 16 }} />
                  </div>
                </div>
                <div className="text-[13px] xl:text-[17px] font-semibold uppercase tracking-wide text-slate-400 mb-1">{s.label}</div>
                <div className="text-[22px] xl:text-[30px] font-extrabold text-slate-900 leading-none mb-1">{s.value}</div>
                <div className="text-[12px] xl:text-[15px] text-slate-400 font-medium">{s.sub}</div>
              </div>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex flex-col xl:flex-row gap-3 mb-6 xl:mb-7 xl:flex-wrap">
          <div className="relative w-full xl:flex-1 xl:min-w-[240px]">
            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
            <input
              className="w-full h-[48px] xl:h-[52px] rounded-2xl border border-blue-100 bg-white/90 backdrop-blur-sm pl-11 pr-4 text-[15px] xl:text-[17px] font-medium text-slate-700 placeholder:text-slate-400 shadow-sm focus:border-blue-400 focus:ring-4 focus:ring-blue-100 focus:outline-none transition-all"
              placeholder="Search items…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="relative w-full xl:w-auto">
            <FaThLarge className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none" />
            <select
              className="w-full h-[48px] xl:h-[52px] xl:w-[190px] rounded-2xl border border-blue-100 bg-white/90 backdrop-blur-sm pl-11 pr-8 text-[15px] xl:text-[17px] font-medium text-slate-700 shadow-sm focus:border-blue-400 focus:ring-4 focus:ring-blue-100 focus:outline-none appearance-none transition-all"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All categories</option>
              {uniqueCategories.map((cat) => (
                <option key={cat} value={cat.toLowerCase()}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 w-full xl:w-auto">
            <div className="relative w-1/2 xl:w-auto">
              <FaLeaf className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none" />
              <select
                className="w-full h-[48px] xl:h-[52px] xl:w-[170px] rounded-2xl border border-blue-100 bg-white/90 backdrop-blur-sm pl-11 pr-8 text-[15px] xl:text-[17px] font-medium text-slate-700 shadow-sm focus:border-blue-400 focus:ring-4 focus:ring-blue-100 focus:outline-none appearance-none transition-all"
                value={foodTypeFilter}
                onChange={(e) => setFoodTypeFilter(e.target.value)}
              >
                <option value="all">All types</option>
                <option value="Veg">Veg</option>
                <option value="Non-Veg">Non-Veg</option>
                <option value="Egg">Egg</option>
              </select>
            </div>
            <div className="relative w-1/2 xl:w-auto">
              <FaBan className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none" />
              <select
                className="w-full h-[48px] xl:h-[52px] xl:w-[190px] rounded-2xl border border-blue-100 bg-white/90 backdrop-blur-sm pl-11 pr-8 text-[15px] xl:text-[17px] font-medium text-slate-700 shadow-sm focus:border-blue-400 focus:ring-4 focus:ring-blue-100 focus:outline-none appearance-none transition-all"
                value={availabilityFilter}
                onChange={(e) => setAvailabilityFilter(e.target.value)}
              >
                <option value="all">All status</option>
                <option value="Available">Available</option>
                <option value="Unavailable">Unavailable</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-14 xl:py-16">
            <div className="inline-block h-8 w-8 rounded-full border-4 border-blue-200 border-t-blue-500 animate-spin mb-3" />
            <div className="text-[17px] xl:text-[20px] text-slate-500 font-medium">Loading…</div>
          </div>
        ) : grouped.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm border border-blue-100 rounded-[20px] xl:rounded-[28px] p-8 xl:p-14 text-center shadow-[0_4px_20px_rgba(30,64,175,0.06)]">
            <div className="w-14 h-14 xl:w-16 xl:h-16 rounded-2xl bg-gradient-to-br from-blue-50 to-sky-50 flex items-center justify-center mx-auto mb-4 border border-blue-100">
              <FaUtensils className="text-[22px] xl:text-[26px] text-blue-400" />
            </div>
            <b className="block text-[18px] xl:text-[22px] text-slate-800 mb-1.5">No items match</b>
            <span className="text-[15px] xl:text-[20px] text-slate-400 font-medium">Try changing the filters or add new menu items.</span>
          </div>
        ) : (
          <div className="space-y-5 xl:space-y-6">
            {grouped.map(([category, list]) => {
              const isCollapsed = !!collapsed[category];
              return (
                <div
                  key={category}
                  className="bg-white/90 backdrop-blur-sm border border-blue-100/70 rounded-[20px] xl:rounded-[28px] overflow-hidden shadow-[0_4px_20px_rgba(30,64,175,0.06)] hover:shadow-[0_8px_28px_rgba(30,64,175,0.1)] transition-shadow duration-300"
                >
                  <button
                    onClick={() => toggleCollapse(category)}
                    className="w-full px-4 xl:px-6 py-3.5 xl:py-4 border-b border-blue-100/70 flex items-center justify-between bg-gradient-to-r from-blue-50/60 to-sky-50/40 hover:from-blue-50 hover:to-sky-50 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 xl:gap-3">
                      <div className="w-8 h-8 xl:w-9 xl:h-9 rounded-xl bg-gradient-to-br from-blue-500 to-sky-500 flex items-center justify-center text-white text-[13px] xl:text-[14px] shadow-md shadow-blue-500/30 shrink-0">
                        <FaUtensils />
                      </div>
                      <div className="text-left">
                        <h2 className="text-[18px] xl:text-[23px] font-bold m-0 text-slate-800">{category}</h2>
                        <p className="m-0 text-[13px] xl:text-[15px] text-blue-500 font-semibold">
                          {list.length} item{list.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <span className="w-8 h-8 xl:w-9 xl:h-9 rounded-xl bg-white border border-blue-100 flex items-center justify-center text-blue-500 shadow-sm shrink-0">
                      {isCollapsed ? <FaChevronDown className="text-sm" /> : <FaChevronUp className="text-sm" />}
                    </span>
                  </button>

                  {!isCollapsed && (
                    <>
                      {/* Desktop / Tablet table (md and up) */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full min-w-[640px] text-left">
                          <thead>
                            <tr className="bg-blue-50/30">
                              <th className="text-left text-[13px] xl:text-[16px] font-bold uppercase tracking-wide text-slate-400 py-3 xl:py-3.5 pl-4 xl:pl-6 pr-3 xl:pr-4 border-b border-blue-100/70 w-[64px] xl:w-[76px]">
                                Img
                              </th>
                              <th className="text-left text-[13px] xl:text-[16px] font-bold uppercase tracking-wide text-slate-400 py-3 xl:py-3.5 pr-3 xl:pr-4 border-b border-blue-100/70">
                                Item
                              </th>
                              <th className="text-left text-[13px] xl:text-[16px] font-bold uppercase tracking-wide text-slate-400 py-3 xl:py-3.5 pr-3 xl:pr-4 border-b border-blue-100/70">
                                Type
                              </th>
                              <th className="text-left text-[13px] xl:text-[16px] font-bold uppercase tracking-wide text-slate-400 py-3 xl:py-3.5 pr-3 xl:pr-4 border-b border-blue-100/70">
                                Price
                              </th>
                              <th className="text-left text-[13px] xl:text-[16px] font-bold uppercase tracking-wide text-slate-400 py-3 xl:py-3.5 pr-3 xl:pr-4 border-b border-blue-100/70">
                                Tax
                              </th>
                              <th className="text-left text-[13px] xl:text-[16px] font-bold uppercase tracking-wide text-slate-400 py-3 xl:py-3.5 pr-4 xl:pr-6 border-b border-blue-100/70">
                                Status
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-blue-50">
                            {list.map((item) => {
                              const status = item.availability_status || item.status || "Available";
                              return (
                                <tr key={item.id} className="hover:bg-blue-50/40 transition-colors">
                                  <td className="py-3 pl-4 xl:pl-6 pr-3">
                                    {item.image_url ? (
                                      <img
                                        src={item.image_url}
                                        alt={item.name}
                                        className="h-[44px] w-[44px] xl:h-[48px] xl:w-[48px] rounded-2xl object-cover border border-blue-100 shadow-sm"
                                      />
                                    ) : (
                                      <div className="h-[44px] w-[44px] xl:h-[48px] xl:w-[48px] rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-slate-300 text-xs">
                                        —
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-3 pr-3">
                                    <div className="font-bold text-[15px] xl:text-[18px] text-slate-800">{item.name}</div>
                                    {item.description && (
                                      <div className="text-[13px] xl:text-[15px] text-slate-400 mt-0.5 line-clamp-1 font-medium">
                                        {item.description}
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-3 pr-3">
                                    <FoodTypeBadge type={item.food_type} />
                                  </td>
                                  <td className="py-3 pr-3 font-bold text-[15px] xl:text-[18px] text-slate-800">
                                    ₹{Number(item.price || 0).toFixed(2)}
                                  </td>
                                  <td className="py-3 pr-3 text-[14px] xl:text-[17px] text-slate-500 font-medium">
                                    {Number(item.tax || 0)}%
                                  </td>
                                  <td className="py-3 pr-4 xl:pr-6">
                                    <StatusBadge status={status} />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile stacked cards (below md) */}
                      <div className="md:hidden divide-y divide-blue-50">
                        {list.map((item) => {
                          const status = item.availability_status || item.status || "Available";
                          return (
                            <div key={item.id} className="p-[14px] hover:bg-blue-50/30 transition-colors">
                              <div className="flex gap-3">
                                {item.image_url ? (
                                  <img
                                    src={item.image_url}
                                    alt={item.name}
                                    className="h-[60px] w-[60px] rounded-[18px] object-cover border border-blue-100 shadow-sm shrink-0"
                                  />
                                ) : (
                                  <div className="h-[60px] w-[60px] rounded-[18px] bg-blue-50 border border-blue-100 flex items-center justify-center text-slate-300 text-xs shrink-0">
                                    —
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="font-bold text-[15px] text-slate-800 leading-snug">{item.name}</div>
                                    <StatusBadge status={status} />
                                  </div>
                                  <div className="text-[13px] text-slate-400 font-medium mt-0.5">{category}</div>
                                  <div className="flex items-center gap-2 mt-2">
                                    <FoodTypeBadge type={item.food_type} />
                                    <span className="font-extrabold text-[15px] text-slate-800">
                                      ₹{Number(item.price || 0).toFixed(2)}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-3 pt-3 border-t border-blue-50">
                                <div className="flex items-center justify-between">
                                  <span className="text-[13px] text-slate-400 font-semibold uppercase tracking-wide">Category</span>
                                  <span className="text-[14px] text-slate-700 font-semibold truncate ml-2">{category}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-[13px] text-slate-400 font-semibold uppercase tracking-wide">Tax</span>
                                  <span className="text-[14px] text-slate-700 font-semibold">{Number(item.tax || 0)}%</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {!loading && filtered.length > 0 && (
          <div className="mt-6 xl:mt-7 bg-white/80 backdrop-blur-sm border border-blue-100/70 rounded-[18px] xl:rounded-[24px] px-4 xl:px-5 py-4 flex flex-col md:flex-row items-center justify-center md:justify-between gap-3 shadow-[0_4px_20px_rgba(30,64,175,0.06)]">
            <span className="text-[14px] xl:text-[16px] text-slate-500 font-medium text-center md:text-left">
              Showing {filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1} to{" "}
              {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} items
            </span>
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-10 h-10 rounded-xl border border-blue-100 bg-white flex items-center justify-center text-slate-500 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-500 transition-colors"
              >
                <FaChevronLeft className="text-xs" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-10 h-10 rounded-xl text-[16px] font-bold transition-all ${
                    p === page
                      ? "text-white shadow-md shadow-blue-500/30"
                      : "border border-blue-100 bg-white text-slate-500 hover:bg-blue-50 hover:text-blue-600"
                  }`}
                  style={p === page ? { background: "linear-gradient(135deg,#2563EB,#0EA5E9)" } : undefined}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="w-10 h-10 rounded-xl border border-blue-100 bg-white flex items-center justify-center text-slate-500 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-500 transition-colors"
              >
                <FaChevronRight className="text-xs" />
              </button>
            </div>
          </div>
        )}
      </div>

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

export default InventoryMenuListPage;