import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import API from "../../api";

const formatCurrency = (value) => `Rs. ${Number(value || 0).toLocaleString("en-IN")}`;

const TokenItemsPage = () => {
  const { table } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const entityType = location.state?.entityType || "Table";
  const roomData = location.state?.roomData || null;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadItems = async () => {
      try {
        setLoading(true);
        const tokenRes = await API.get(`/token/table/${table}`);
        const tokenId = tokenRes.data?.id;

        if (!tokenId) {
          setItems([]);
          return;
        }

        const itemsRes = await API.get(`/token/items/${tokenId}`);
        setItems(itemsRes.data || []);
      } catch (error) {
        console.log("Error loading token items:", error);
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    loadItems();
  }, [table]);

  const normalizedItems = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        name: item.item_name || item.name || "Menu Item",
        qty: Number(item.qty || item.quantity || 0),
        rate: Number(item.rate || item.price || 0),
        amount: Number(item.qty || item.quantity || 0) * Number(item.rate || item.price || 0),
      })),
    [items],
  );

  const subtotal = normalizedItems.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="min-h-full w-full bg-[linear-gradient(135deg,#eef4ff_0%,#f7fafd_38%,#ffffff_100%)] p-2.5 xs:p-3 sm:p-4 lg:p-6 xl:p-8">
      <div className="w-full space-y-4 animate-[fadeIn_0.4s_ease-out] sm:space-y-5 lg:space-y-6">
        {/* HERO */}
        <section className="overflow-hidden rounded-2xl border border-blue-900/20 bg-gradient-to-br from-blue-950 via-blue-700 to-sky-500 px-4 py-5 text-white shadow-[0_16px_40px_rgba(15,40,120,0.24)] sm:rounded-[24px] sm:px-6 sm:py-6 md:px-7 lg:px-8 lg:py-7">
          <div className="grid gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-sky-200 sm:text-[11px] sm:tracking-[0.32em] md:text-xs">
                Token Snapshot
              </p>
              <h1 className="mt-1.5 truncate text-lg lg:text-3xl font-black sm:mt-2 sm:text-xl md:text-2xl">
                {entityType} {table}
              </h1>
              <p className="mt-2 text-sm leading-snug text-white/85 sm:mt-2.5 sm:text-base md:text-[18px] lg:text-[19px]">
                {roomData
                  ? `Room ${roomData.roomNo || table} | ${roomData.categoryName || "Room"} | ID ${roomData.roomId || "--"}`
                  : "Live token items ready for billing or editing"}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2.5 xs:gap-3 sm:gap-4">
              <div className="min-w-0 rounded-2xl border border-white/25 bg-white/10 px-3 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.12)] backdrop-blur-md sm:px-5 sm:py-4 md:px-6 md:py-5">
                <div className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-100/90 sm:text-[13px] sm:tracking-[0.2em] md:text-[15px]">
                  Subtotal
                </div>
                <div className="mt-1.5 truncate text-lg font-black tracking-tight sm:mt-2 sm:text-xl md:text-2xl">
                  {formatCurrency(subtotal)}
                </div>
              </div>
              <div className="min-w-0 rounded-2xl border border-white/25 bg-white/10 px-3 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.12)] backdrop-blur-md sm:px-5 sm:py-4 md:px-6 md:py-5">
                <div className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-100/90 sm:text-[13px] sm:tracking-[0.2em] md:text-[15px]">
                  Items
                </div>
                <div className="mt-1.5 truncate text-lg font-black tracking-tight sm:mt-2 sm:text-xl md:text-2xl">
                  {normalizedItems.length}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* MAIN CARD */}
        <section className="space-y-4 rounded-2xl border border-blue-100 bg-white p-3.5 shadow-[0_12px_32px_rgba(15,40,120,0.07)] sm:space-y-5 sm:rounded-[24px] sm:p-5 md:p-6 lg:space-y-6 lg:p-8">
          <div className="flex flex-col gap-3 border-b border-blue-100 pb-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4 sm:pb-5">
            <div className="min-w-0">
              <h4 className="text-xl font-black leading-tight text-slate-900 sm:text-2xl md:text-[28px] lg:text-[32px]">
                All Token Items
              </h4>
              <p className="mt-1 text-sm text-slate-500 sm:mt-1.5 sm:text-base md:text-[17px]">
                Non-invoiced items with live quantity and pricing.
              </p>
            </div>
            <div className="inline-flex w-fit items-center rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-blue-700 sm:px-5 sm:py-2.5 sm:text-[15px] sm:tracking-[0.16em]">
              {normalizedItems.length} items
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-blue-100 bg-white shadow-sm sm:rounded-[22px]">
            <div className="hidden border-b border-blue-100 bg-gradient-to-r from-blue-50 to-sky-50 px-4 py-3.5 text-sm font-bold uppercase tracking-[0.12em] text-blue-800 md:grid md:grid-cols-[minmax(0,1.7fr)_100px_130px_140px] md:px-5 md:py-4 md:text-base md:tracking-[0.14em] lg:grid-cols-[minmax(0,1.7fr)_110px_140px_150px]">
              <div>Item Name</div>
              <div className="text-center">Quantity</div>
              <div className="text-right">Unit Price</div>
              <div className="text-right">Amount</div>
            </div>

            {loading ? (
              <div className="px-4 py-10 text-center text-base font-medium text-slate-400 sm:py-12 sm:text-lg md:text-[20px]">
                Loading items...
              </div>
            ) : !normalizedItems.length ? (
              <div className="px-4 py-10 text-center text-base font-medium text-slate-400 sm:py-12 sm:text-lg md:text-[20px]">
                No items added yet.
              </div>
            ) : (
              <div className="divide-y divide-blue-50">
                {normalizedItems.map((item) => (
                  <div key={item.id}>
                    {/* Mobile / tablet card */}
                    <div className="grid gap-3 px-4 py-4 transition-colors hover:bg-blue-50/40 sm:gap-3.5 sm:px-5 sm:py-5 md:hidden">
                      <div className="min-w-0">
                        <div className="truncate text-base font-bold text-slate-900 sm:text-lg">{item.name}</div>
                        <div className="mt-1 text-xs text-slate-500 sm:text-sm">Token item #{item.id}</div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs sm:gap-2.5 sm:text-sm md:text-base">
                        <div className="min-w-0 rounded-xl border border-blue-100 bg-blue-50/60 px-2 py-2 text-center sm:px-3 sm:py-2.5">
                          <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-blue-400 sm:text-[13px] sm:tracking-[0.12em]">
                            Qty
                          </div>
                          <div className="mt-1 truncate font-bold text-slate-700">{item.qty}</div>
                        </div>
                        <div className="min-w-0 rounded-xl border border-blue-100 bg-blue-50/60 px-2 py-2 text-center sm:px-3 sm:py-2.5">
                          <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-blue-400 sm:text-[13px] sm:tracking-[0.12em]">
                            Rate
                          </div>
                          <div className="mt-1 truncate font-bold text-slate-700">{formatCurrency(item.rate)}</div>
                        </div>
                        <div className="min-w-0 rounded-xl bg-blue-700 px-2 py-2 text-center text-white shadow-md sm:px-3 sm:py-2.5">
                          <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/70 sm:text-[13px] sm:tracking-[0.12em]">
                            Amount
                          </div>
                          <div className="mt-1 truncate font-black">{formatCurrency(item.amount)}</div>
                        </div>
                      </div>
                    </div>

                    {/* Desktop / tablet-landscape row */}
                    <div className="hidden items-center px-4 py-4 text-sm transition-colors hover:bg-blue-50/40 md:grid md:grid-cols-[minmax(0,1.7fr)_100px_130px_140px] md:px-5 md:py-5 md:text-base lg:grid-cols-[minmax(0,1.7fr)_110px_140px_150px] lg:text-[17px]">
                      <div className="min-w-0">
                        <div className="truncate font-bold text-slate-900">{item.name}</div>
                        <div className="mt-1 text-xs text-slate-500 sm:text-sm">Token item #{item.id}</div>
                      </div>
                      <div className="text-center font-semibold text-slate-700">{item.qty}</div>
                      <div className="truncate text-right font-semibold text-slate-700">{formatCurrency(item.rate)}</div>
                      <div className="text-right">
                        <span className="inline-block rounded-lg bg-blue-700 px-2.5 py-1.5 text-sm font-black text-white shadow-sm md:px-3 md:text-base">
                          {formatCurrency(item.amount)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Current Total */}
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-4 shadow-[0_10px_26px_rgba(15,120,60,0.1)] sm:rounded-[22px] sm:px-6 sm:py-5 lg:px-7 lg:py-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
              <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-green-300/60 bg-white/60 text-green-700 shadow-md backdrop-blur-md sm:h-12 sm:w-12 sm:rounded-2xl">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 sm:h-6 sm:w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-2M12 12h9m0 0l-3-3m3 3l-3 3"
                    />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold uppercase tracking-[0.14em] text-green-700 sm:text-[15px] sm:tracking-[0.18em]">
                    Current Total
                  </div>
                  <div className="mt-1 truncate text-xl font-black text-slate-900 sm:text-2xl md:text-[28px]">
                    {formatCurrency(subtotal)}
                  </div>
                </div>
              </div>
              <div className="text-sm text-green-800/80 sm:text-base md:text-[17px]">
                Add more menu items or edit current token before invoice.
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end sm:gap-3.5">
            <button
              className="h-12 w-full rounded-xl border border-blue-200 bg-white px-5 text-sm font-bold text-blue-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-50 hover:shadow-md sm:h-[54px] sm:w-auto sm:rounded-2xl sm:px-6 sm:text-[17px]"
              onClick={() => navigate("/restaurant")}
            >
              Back to Dashboard
            </button>

            <button
              className="h-12 w-full rounded-xl bg-green-500 px-5 text-sm font-bold text-white shadow-[0_8px_22px_rgba(21,128,61,0.24)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-green-600 hover:shadow-[0_14px_34px_rgba(21,128,61,0.34)] sm:h-[54px] sm:w-auto sm:rounded-2xl sm:px-6 sm:text-[17px]"
              onClick={() =>
                navigate(`/restaurant/menu/${table}`, {
                  state: {
                    entityType,
                    roomData,
                    existingItems: normalizedItems.map((item) => ({
                      id: item.id,
                      name: item.name,
                      qty: item.qty,
                      rate: item.rate,
                      amount: item.amount,
                    })),
                  },
                })
              }
            >
              Add More Item
            </button>

            <button
              className="h-12 w-full rounded-xl bg-blue-700 px-5 text-sm font-bold text-white shadow-[0_8px_22px_rgba(15,40,120,0.24)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-800 hover:shadow-[0_14px_34px_rgba(15,40,120,0.34)] sm:h-[54px] sm:w-auto sm:rounded-2xl sm:px-6 sm:text-[17px]"
              onClick={() =>
                navigate(`/restaurant/edit-token/${table}`, {
                  state: { entityType, roomData },
                })
              }
            >
              Edit Token
            </button>
          </div>
        </section>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default TokenItemsPage;