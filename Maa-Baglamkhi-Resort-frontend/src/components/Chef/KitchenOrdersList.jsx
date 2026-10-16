import { useState, useMemo } from "react";

import KitchenOrderCard from "./KitchenOrderCard";

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "preparing", label: "Preparing" },
  { key: "ready", label: "Ready" },
  { key: "cancelled", label: "Cancelled" },
  { key: "served", label: "Served" },
  { key: "completed", label: "Completed" },
];

const KitchenOrdersList = ({ orders, loading, onStatusUpdate }) => {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let result = Array.isArray(orders) ? orders : [];

    if (filter !== "all") {
      result = result.filter((o) => String(o.status || "").toLowerCase() === filter.toLowerCase());
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((o) => {
        const ref = `${o.entityType || ""} ${o.table || ""} ${o.waiter_name || ""}`.toLowerCase();
        const itemNames = (o.items || [])
          .map((i) => `${i.name || i.item_name || ""}`.toLowerCase())
          .join(" ");
        return ref.includes(q) || itemNames.includes(q) || String(o.id).includes(q);
      });
    }

    return result;
  }, [orders, filter, search]);

  const counts = useMemo(() => {
    const base = Array.isArray(orders) ? orders : [];
    const c = {};
    STATUS_FILTERS.forEach((f) => {
      if (f.key === "all") {
        c[f.key] = base.length;
      } else {
        c[f.key] = base.filter((o) => String(o.status || "").toLowerCase() === f.key.toLowerCase()).length;
      }
    });
    return c;
  }, [orders]);

  if (loading) {
    return (
      <div className="rounded-[30px] border border-white/70 bg-white/90 p-8 shadow-[0_20px_55px_rgba(30,64,175,0.08)] backdrop-blur-xl">
        <div className="flex items-center justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-700" />
          <span className="ml-3 text-[17px] font-semibold text-slate-500">Loading kitchen orders...</span>
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="rounded-[30px] border border-white/70 bg-white/90 p-4 shadow-[0_20px_55px_rgba(30,64,175,0.08)] backdrop-blur-xl sm:p-7 lg:p-8">
        {/* Header + filters */}
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[15px] font-bold uppercase tracking-[0.24em] text-sky-500">
              Kitchen Orders
            </p>
            <h2 className="mt-1 text-[24px] font-black text-slate-900 sm:text-[30px] lg:text-[34px]">
              Live Kitchen Queue
            </h2>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            {/* Search */}
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search table, waiter, items..."
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[15px] font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100 sm:w-64"
            />

            {/* Status filter chips */}
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={`rounded-full px-3.5 py-2 text-[13px] font-bold transition-all duration-200 sm:text-[15px] ${
                    filter === f.key
                      ? "bg-gradient-to-r from-blue-700 to-sky-500 text-white shadow-md shadow-blue-200"
                      : "border border-slate-200 bg-white text-slate-500 hover:border-blue-200 hover:text-blue-700"
                  }`}
                >
                  {f.label}
                  <span className="ml-1 text-[11px] opacity-80">({counts[f.key] || 0})</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Order list */}
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((order) => (
              <KitchenOrderCard
                key={order.id}
                order={order}
                onStatusUpdate={onStatusUpdate}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-[26px] border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center sm:p-12">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
              <span className="text-3xl text-blue-400">🍳</span>
            </div>
            <div className="text-[20px] font-black text-slate-900 sm:text-[22px]">
              {filter === "all" ? "No kitchen orders yet" : `No ${filter} orders`}
            </div>
            <div className="mx-auto mt-2 max-w-md text-[17px] leading-7 text-slate-500 sm:text-[20px] sm:leading-8">
              {filter === "all"
                ? "New orders from the restaurant will automatically appear here as they come in."
                : `Switch to a different filter or wait for new orders.`}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default KitchenOrdersList;
