// src/pages/InventoryReportsPage.jsx
// Inventory Reports — read-only tabs: Low Stock, Expiring Items, Vendor Insights, Stock Ledger

import React, { useEffect, useMemo, useState } from "react";
import {
  FaChartBar,
  FaExclamationTriangle,
  FaCalendarAlt,
  FaTruck,
  FaBook,
  FaSearch,
  FaCheckCircle,
  FaExclamationTriangle as FaWarn,
  FaBoxOpen,
  FaLayerGroup,
} from "react-icons/fa";

import API from "../api";

import BackButton from "../components/Inventory/BackButton";

/* ── style tokens ──
   Premium Blue & White theme.
   Blues: #2563EB (primary), #1D4ED8 (deep), #EFF4FF (wash), #DCE7FB (border-tint)
   Neutrals: #0B1220 (ink), #FFFFFF (panel), #F7F9FE (page), #64748B (muted), #E6EBF5 (line)
*/
const c = {
  ink: "#0B1220",
  paper: "#F5F8FF",
  panel: "#FFFFFF",
  line: "#E6ECF7",
  blue: "#2563EB",
  blueDeep: "#1D4ED8",
  blueSoft: "#EFF4FF",
  amber: "#B7791F",
  rose: "#C0392B",
  emerald: "#1E8E5A",
  muted: "#64748B",
  text: "#0F172A",
};

const STATUS_STYLES = {
  low: "bg-[#FCEFDD] text-[#B7791F] ring-1 ring-inset ring-[#F0DBB8]",
  ok: "bg-[#E7F6EE] text-[#1E8E5A] ring-1 ring-inset ring-[#CFEEDC]",
  expired: "bg-[#FBE7E4] text-[#C0392B] ring-1 ring-inset ring-[#F4CFC8]",
  warning: "bg-[#FCEFDD] text-[#B7791F] ring-1 ring-inset ring-[#F0DBB8]",
  in: "bg-[#E7F6EE] text-[#1E8E5A] ring-1 ring-inset ring-[#CFEEDC]",
  out: "bg-[#FBE7E4] text-[#C0392B] ring-1 ring-inset ring-[#F4CFC8]",
};
const statusBadge = (s) => {
  const key = String(s || "").toLowerCase().trim().replace(/\s+/g, "-");
  const style = STATUS_STYLES[key] || "bg-[#EFF4FF] text-[#2563EB] ring-1 ring-inset ring-[#DCE7FB]";
  return `inline-flex items-center rounded-full px-3 py-1 sm:px-3.5 sm:py-1.5 text-[12px] sm:text-[13px] xl:text-[15px] font-bold tracking-wide ${style}`;
};

/* ── Report tabs ── */
const REPORT_TABS = [
  { key: "low-stock", label: "Low Stock", icon: FaExclamationTriangle, endpoint: "/inventory/alerts/low-stock" },
  { key: "expiring", label: "Expiring Items", icon: FaCalendarAlt, endpoint: "/inventory/alerts/expiring?days=30" },
  { key: "vendor-insights", label: "Vendor Insights", icon: FaTruck, endpoint: "/inventory/vendor-insights" },
  { key: "stock-ledger", label: "Stock Ledger", icon: FaBook, endpoint: "/inventory/stock-ledger" },
];

/* ── Column definitions per report ── */
const COLUMNS_MAP = {
  "low-stock": [
    { key: "name", label: "Item" },
    { key: "category", label: "Category" },
    { key: "stock", label: "Current Stock" },
    { key: "reorder_point", label: "Reorder Level" },
    { key: "unit", label: "Unit" },
    { key: "branch", label: "Store" },
  ],
  expiring: [
    { key: "name", label: "Item" },
    { key: "category", label: "Category" },
    { key: "expiry", label: "Expiry Date" },
    { key: "stock", label: "Stock" },
    { key: "unit", label: "Unit" },
    { key: "branch", label: "Store" },
  ],
  "vendor-insights": [
    { key: "vendor", label: "Vendor" },
    { key: "totalOrders", label: "Orders" },
    { key: "totalSpend", label: "Total Spend" },
    { key: "pendingPayments", label: "Pending" },
  ],
  "stock-ledger": [
    { key: "entry_date", label: "Date" },
    { key: "item_name", label: "Item" },
    { key: "direction", label: "Type" },
    { key: "quantity", label: "Qty" },
    { key: "vendor_name", label: "Vendor" },
    { key: "amount", label: "Amount" },
    { key: "balance_after", label: "Balance" },
    { key: "remarks", label: "Remarks" },
  ],
};

/* ─────────────────────────────── Main Component ─────────────────────────────── */

const InventoryReportsPage = () => {
  const [activeTab, setActiveTab] = useState("low-stock");
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const activeConfig = REPORT_TABS.find((t) => t.key === activeTab);

  const fetchReport = async (tabKey) => {
    setLoading(true);
    try {
      const tab = REPORT_TABS.find((t) => t.key === tabKey);
      if (!tab) return;
      const res = await API.get(tab.endpoint);
      setReportData(Array.isArray(res.data) ? res.data : []);
    } catch {
      setReportData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport(activeTab);
  }, [activeTab]);

  const columns = COLUMNS_MAP[activeTab] || [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return reportData;
    return reportData.filter((row) =>
      columns.some((col) => {
        const val = row[col.key];
        return val && String(val).toLowerCase().includes(q);
      }),
    );
  }, [reportData, search, columns]);

  const formatCell = (row, colKey) => {
    const val = row[colKey];
    if (colKey === "amount" || colKey === "totalSpend" || colKey === "rate") {
      return val ? `₹${Number(val).toFixed(2)}` : "-";
    }
    if (colKey === "stock" || colKey === "quantity" || colKey === "balance_after") {
      return val ?? "-";
    }
    if (colKey === "entry_date" || colKey === "expiry" || colKey === "expected_date") {
      if (!val) return "-";
      return String(val).slice(0, 10);
    }
    return val || "-";
  };

  const renderValue = (row, colKey) => {
    const val = row[colKey];
    if (colKey === "status" || colKey === "direction") {
      return <span className={statusBadge(val)}>{val || "-"}</span>;
    }
    return <span>{formatCell(row, colKey)}</span>;
  };

  return (
    <div
      className="min-h-screen w-full max-w-full overflow-x-hidden relative px-4 py-5 sm:px-5 sm:py-6 md:px-6 md:py-7 xl:px-[28px] xl:py-8 pb-10 sm:pb-12 md:pb-14 xl:pb-[72px]"
      style={{ background: c.paper, color: c.text }}
    >
      {/* ── ambient blue glows ── */}
      <div
        className="pointer-events-none absolute -z-0"
        style={{
          top: "-140px",
          right: "-120px",
          width: "460px",
          height: "460px",
          borderRadius: "9999px",
          background: "radial-gradient(circle, rgba(47,107,255,0.16) 0%, rgba(47,107,255,0) 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute -z-0"
        style={{
          top: "260px",
          left: "-160px",
          width: "420px",
          height: "420px",
          borderRadius: "9999px",
          background: "radial-gradient(circle, rgba(37,99,235,0.10) 0%, rgba(37,99,235,0) 70%)",
        }}
      />

      <div className="relative z-10 w-full">
        {/* ── premium page header ── */}
        <BackButton className="shrink-0" />
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between mb-5 sm:mb-6 xl:mb-7">
         
          <div className="flex items-center gap-3 sm:gap-4">
            
            <div
              className="shrink-0 w-[46px] h-[46px] sm:w-[52px] sm:h-[52px] xl:w-[56px] xl:h-[56px] rounded-[16px] xl:rounded-[18px] flex items-center justify-center text-white text-[19px] sm:text-[22px] xl:text-[24px] shadow-[0_10px_24px_-8px_rgba(29,78,216,0.55)]"
              style={{ background: "linear-gradient(135deg, #3B7BFF 0%, #1D4ED8 100%)" }}
            >
              <FaChartBar />
            </div>
            <div className="min-w-0">
              <h1 className="lg:text-[36px] text-[26px] font-semibold m-0 leading-tight truncate" style={{ letterSpacing: "0.2px", color: c.ink }}>
                Inventory Reports
              </h1>
              <p className="m-0 mt-1 text-[15px] sm:text-[16px] xl:text-[19px]" style={{ color: c.muted }}>
                Stock value, alerts, vendor spend and audit trail
              </p>
            </div>
          </div>
        </div>

        {/* ── tab pills ── */}
        <div className="flex gap-2 sm:gap-2.5 flex-wrap mb-4 sm:mb-5">
          {REPORT_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => { setActiveTab(tab.key); setSearch(""); }}
                className={`inline-flex items-center gap-1.5 sm:gap-2 rounded-full px-3.5 py-2 sm:px-4 sm:py-2.5 xl:px-[18px] xl:py-2.5 text-[14px] sm:text-[15px] xl:text-[16px] font-semibold transition-all duration-250 border ${
                  isActive
                    ? "text-white border-transparent shadow-[0_10px_22px_-8px_rgba(29,78,216,0.55)]"
                    : "bg-white border-[#E6ECF7] text-[#334155] hover:bg-[#EFF4FF] hover:border-[#DCE7FB]"
                }`}
                style={isActive ? { background: "linear-gradient(135deg, #3B7BFF 0%, #1D4ED8 100%)" } : undefined}
              >
                <Icon className="text-[12px] sm:text-[14px]" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ── search ── */}
        <div className="mb-5 sm:mb-6">
          <div className="relative w-full xl:max-w-md">
            <FaSearch className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-[#2563EB] text-[13px] sm:text-[14px]" />
            <input
              className="w-full rounded-full border-2 border-[#DCE7FB] bg-white px-4 py-2.5 sm:py-3 text-[15px] xl:text-[17px] font-medium text-[#0F172A] pl-10 sm:pl-11 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.08)] transition-all duration-250 placeholder:text-[#94A3B8] placeholder:font-normal focus:border-[#2563EB] focus:outline-none focus:shadow-[0_0_0_4px_rgba(37,99,235,0.14)]"
              placeholder={`Search ${activeConfig?.label.toLowerCase()}…`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* ── stat cards for low-stock and expiring ── */}
        {(activeTab === "low-stock" || activeTab === "expiring") && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-3.5 xl:gap-4 mb-5 sm:mb-6 xl:mb-7">
            <div className="bg-white border border-[#E6ECF7] rounded-[20px] md:rounded-[24px] xl:rounded-[28px] p-4 md:p-5 xl:p-6 shadow-[0_12px_28px_-16px_rgba(15,23,42,0.18)] transition-all duration-250 hover:shadow-[0_16px_34px_-14px_rgba(37,99,235,0.28)] hover:-translate-y-0.5">
              <div className="flex items-center justify-between mb-2.5 md:mb-3">
                <div
                  className="w-[38px] h-[38px] md:w-[42px] md:h-[42px] xl:w-[46px] xl:h-[46px] rounded-[12px] xl:rounded-[14px] flex items-center justify-center text-[16px] md:text-[18px] xl:text-[19px] text-[#2563EB]"
                  style={{ background: "linear-gradient(135deg, #EAF1FF 0%, #DCE7FB 100%)" }}
                >
                  <FaBoxOpen />
                </div>
              </div>
              <div className="text-[24px] md:text-[28px] xl:text-[32px] font-bold leading-tight" style={{ color: c.ink }}>{filtered.length}</div>
              <div className="text-[14px] md:text-[15px] xl:text-[17px] mt-1" style={{ color: c.muted }}>
                {activeTab === "low-stock" ? "Low stock items" : "Expiring items"}
              </div>
            </div>
            <div className="bg-white border border-[#E6ECF7] rounded-[20px] md:rounded-[24px] xl:rounded-[28px] p-4 md:p-5 xl:p-6 shadow-[0_12px_28px_-16px_rgba(15,23,42,0.18)] transition-all duration-250 hover:shadow-[0_16px_34px_-14px_rgba(37,99,235,0.28)] hover:-translate-y-0.5">
              <div className="flex items-center justify-between mb-2.5 md:mb-3">
                <div
                  className="w-[38px] h-[38px] md:w-[42px] md:h-[42px] xl:w-[46px] xl:h-[46px] rounded-[12px] xl:rounded-[14px] flex items-center justify-center text-[16px] md:text-[18px] xl:text-[19px] text-[#2563EB]"
                  style={{ background: "linear-gradient(135deg, #EAF1FF 0%, #DCE7FB 100%)" }}
                >
                  <FaLayerGroup />
                </div>
              </div>
              <div className="text-[24px] md:text-[28px] xl:text-[32px] font-bold leading-tight" style={{ color: c.ink }}>
                {filtered.reduce((sum, r) => sum + (Number(r.stock || 0)), 0)}
              </div>
              <div className="text-[14px] md:text-[15px] xl:text-[17px] mt-1" style={{ color: c.muted }}>Total units affected</div>
            </div>
          </div>
        )}

        {/* ══ DESKTOP & TABLET TABLE (≥768px) ══ */}
        <div className="hidden md:block bg-white border border-[#E6ECF7] rounded-[24px] xl:rounded-[28px] overflow-hidden shadow-[0_18px_40px_-20px_rgba(15,23,42,0.22)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-[15px] xl:text-[17px]">
              <thead>
                <tr style={{ background: "linear-gradient(135deg, #F0F5FF 0%, #E6EEFC 100%)" }}>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className="text-left text-[13.5px] xl:text-[16px] font-bold uppercase tracking-[0.06em] py-3 px-4 xl:py-4 xl:px-5 border-b border-[#E6ECF7] whitespace-nowrap"
                      style={{ color: "#1D4ED8" }}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF2FA]">
                {loading ? (
                  <tr>
                    <td colSpan={columns.length} className="py-12 xl:py-14 text-center text-[16px] xl:text-[18px]" style={{ color: c.muted }}>
                      Loading report data…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length}>
                      <div className="flex flex-col items-center justify-center text-center py-12 xl:py-16 px-6">
                        <div
                          className="w-[60px] h-[60px] xl:w-[72px] xl:h-[72px] rounded-full flex items-center justify-center text-[24px] xl:text-[28px] text-[#2563EB] mb-4"
                          style={{ background: "linear-gradient(135deg, #EAF1FF 0%, #DCE7FB 100%)" }}
                        >
                          <FaBoxOpen />
                        </div>
                        <b className="block text-[19px] xl:text-[21px] font-bold mb-1.5" style={{ color: c.ink }}>No data available</b>
                        <span className="text-[15px] xl:text-[17px] max-w-[360px]" style={{ color: c.muted }}>
                          Data will appear here once there is activity in the system.
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((row, i) => (
                    <tr key={i} className="transition-colors duration-200 hover:bg-[#F5F9FF]">
                      {columns.map((col) => (
                        <td key={col.key} className="py-3.5 px-4 xl:py-4 xl:px-5 text-[15px] xl:text-[17px]" style={{ color: c.text }}>
                          {renderValue(row, col.key)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ══ MOBILE STACKED CARDS (<768px) ══ */}
        <div className="block md:hidden">
          {loading ? (
            <div className="bg-white border border-[#E6ECF7] rounded-[20px] py-12 text-center text-[14px] shadow-[0_12px_28px_-16px_rgba(15,23,42,0.18)]" style={{ color: c.muted }}>
              Loading report data…
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white border border-[#E6ECF7] rounded-[20px] shadow-[0_12px_28px_-16px_rgba(15,23,42,0.18)]">
              <div className="flex flex-col items-center justify-center text-center py-12 px-6">
                <div
                  className="w-[56px] h-[56px] rounded-full flex items-center justify-center text-[22px] text-[#2563EB] mb-4"
                  style={{ background: "linear-gradient(135deg, #EAF1FF 0%, #DCE7FB 100%)" }}
                >
                  <FaBoxOpen />
                </div>
                <b className="block text-[20px] font-bold mb-1.5" style={{ color: c.ink }}>No data available</b>
                <span className="text-[14px] max-w-[300px]" style={{ color: c.muted }}>
                  Data will appear here once there is activity in the system.
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filtered.map((row, i) => {
                const primaryCol = columns[0];
                const secondaryCol = columns[1];
                const restCols = columns.slice(2);
                const Icon = activeConfig?.icon || FaBoxOpen;
                return (
                  <div
                    key={i}
                    className="bg-white border border-[#E6ECF7] rounded-[18px] p-4 shadow-[0_10px_24px_-16px_rgba(15,23,42,0.18)] transition-all duration-250 active:scale-[0.99]"
                  >
                    {/* card header: icon avatar + primary/secondary fields */}
                    <div className="flex items-start gap-3 mb-3 pb-3 border-b border-[#EEF2FA]">
                      <div
                        className="shrink-0 w-[56px] h-[56px] rounded-[16px] flex items-center justify-center text-[20px] text-[#2563EB]"
                        style={{ background: "linear-gradient(135deg, #EAF1FF 0%, #DCE7FB 100%)" }}
                      >
                        <Icon />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[15px] font-bold leading-snug truncate" style={{ color: c.ink }}>
                          {primaryCol ? formatCell(row, primaryCol.key) : "-"}
                        </div>
                        {secondaryCol && (
                          <div className="text-[13px] mt-0.5 truncate" style={{ color: c.muted }}>
                            {secondaryCol.key === "status" || secondaryCol.key === "direction" ? (
                              <span className={statusBadge(row[secondaryCol.key])}>{row[secondaryCol.key] || "-"}</span>
                            ) : (
                              formatCell(row, secondaryCol.key)
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* remaining fields as two-column label/value grid */}
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                      {restCols.map((col) => (
                        <div key={col.key} className="min-w-0">
                          <div className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: c.muted }}>
                            {col.label}
                          </div>
                          <div className="text-[14px] font-medium mt-0.5 break-words" style={{ color: c.text }}>
                            {renderValue(row, col.key)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InventoryReportsPage;