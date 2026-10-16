import React, { useState } from "react";
import { FaArrowLeft, FaSearch, FaExclamationTriangle, FaTrash, FaEdit } from "react-icons/fa";

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(Number(amount || 0));
}

function getExpiryStatus(expiryDate) {
  if (!expiryDate) return null;
  const diffDays = Math.ceil((new Date(expiryDate) - new Date()) / 86400000);
  if (diffDays < 0)  return { label: "Expired",           color: "bg-red-100 text-red-700 border-red-300" };
  if (diffDays <= 7) return { label: `Exp in ${diffDays}d`, color: "bg-orange-100 text-orange-700 border-orange-300" };
  if (diffDays <= 30) return { label: `Exp in ${diffDays}d`, color: "bg-amber-100 text-amber-700 border-amber-300" };
  return null;
}

export default function CategoryInventory({ categoryName, items = [], onBack, onDeleteItem, onEditItem }) {
  const [search, setSearch] = useState("");

  const filtered = items
    .filter((i) => i.category === categoryName)
    .filter((i) => String(i.name || "").toLowerCase().includes(search.toLowerCase()) ||
                   String(i.branch || "").toLowerCase().includes(search.toLowerCase()));

  const totalValue = filtered.reduce(
    (sum, i) => sum + Number(i.stock || 0) * Number(i.price || 0), 0
  );
  const lowStock = filtered.filter((i) => Number(i.stock || 0) <= Number(i.reorderPoint || 10)).length;

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#f6fbff_0%,#eef6f8_30%,#fff8ef_65%,#f8fafc_100%)] p-4 md:p-6">
      {/* Header */}
      <div className="relative mb-6 overflow-hidden rounded-[28px] border border-slate-900/10 bg-[linear-gradient(120deg,#071b34_0%,#0f766e_52%,#1d4ed8_100%)] p-5 shadow-[0_28px_70px_rgba(15,23,42,0.14)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[-8%] top-[-14%] h-36 w-36 rounded-full bg-cyan-300/20 blur-3xl" />
          <div className="absolute right-[-6%] top-[8%] h-40 w-40 rounded-full bg-amber-300/20 blur-3xl" />
        </div>
        <div className="relative z-[1]">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20"
          >
            <FaArrowLeft size={13} /> Back
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">{categoryName}</h1>
            <p className="text-xs text-white/70">{filtered.length} items in this category</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-[22px] border border-white/15 bg-white/10 px-4 py-3 text-white backdrop-blur-xl">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/65">Total Items</p>
            <p className="mt-1 text-2xl font-bold">{filtered.length}</p>
          </div>
          <div className="rounded-[22px] border border-white/15 bg-white/10 px-4 py-3 text-white backdrop-blur-xl">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-cyan-200">Category Value</p>
            <p className="mt-1 text-2xl font-bold">{formatCurrency(totalValue)}</p>
          </div>
          {lowStock > 0 && (
            <div className="rounded-[22px] border border-amber-300/25 bg-amber-400/15 px-4 py-3 text-amber-100 backdrop-blur-xl">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-100/70">Low Stock</p>
              <p className="mt-1 text-2xl font-bold">{lowStock} items</p>
            </div>
          )}
        </div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <label className="flex items-center gap-2 rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-[0_20px_45px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <FaSearch className="shrink-0 text-cyan-500" size={14} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search in ${categoryName}...`}
            className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
        </label>
      </div>

      {/* Items table */}
      <div className="overflow-hidden rounded-[28px] border border-white/70 bg-white/92 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] text-[11px] font-semibold uppercase tracking-widest text-slate-500 text-left">
              <tr>
                <th className="px-5 py-4">Item Name</th>
                <th className="px-5 py-4">Stock</th>
                <th className="px-5 py-4">Reorder</th>
                <th className="px-5 py-4">Price / Unit</th>
                <th className="px-5 py-4">Total Value</th>
                <th className="px-5 py-4">Expiry</th>
                <th className="px-5 py-4">Store</th>
                <th className="px-5 py-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length ? filtered.map((item) => {
                const isLow = Number(item.stock || 0) <= Number(item.reorderPoint || 10);
                const expStatus = getExpiryStatus(item.expiry);
                return (
                  <tr
                    key={item.id}
                    className={`border-t border-slate-100 hover:bg-cyan-50/40 transition ${isLow ? "bg-amber-50/30" : ""}`}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{item.name}</span>
                        {isLow && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                            <FaExclamationTriangle size={9} /> Low
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`font-semibold ${isLow ? "text-amber-600" : "text-slate-800"}`}>
                        {item.stock}
                      </span>
                      <span className="ml-1 text-xs text-slate-400">{item.unit}</span>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500">
                      {item.reorderPoint || 10} {item.unit}
                    </td>
                    <td className="px-5 py-4 text-slate-700">{formatCurrency(item.price)}</td>
                    <td className="px-5 py-4 font-medium text-slate-800">
                      {formatCurrency(Number(item.stock || 0) * Number(item.price || 0))}
                    </td>
                    <td className="px-5 py-4">
                      {expStatus ? (
                        <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${expStatus.color}`}>
                          {expStatus.label}
                        </span>
                      ) : item.expiry ? (
                        <span className="text-xs text-slate-400">{String(item.expiry).split("T")[0]}</span>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-500">{item.branch || "—"}</td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        {onEditItem && (
                          <button
                            type="button"
                            onClick={() => onEditItem(item)}
                            className="inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700 hover:bg-cyan-100 transition"
                          >
                            <FaEdit size={10} /> Edit
                          </button>
                        )}
                        {onDeleteItem && (
                          <button
                            type="button"
                            onClick={() => onDeleteItem(item.id)}
                            className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition"
                          >
                            <FaTrash size={10} /> Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center text-sm text-slate-400">
                    {search ? `No items match "${search}" in ${categoryName}.` : `No items in ${categoryName} yet.`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
