import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { FiArrowRight, FiClipboard, FiCoffee, FiMapPin, FiUser, FiSend, FiArrowLeft, FiBookOpen, FiShield, FiBox, FiInbox } from "react-icons/fi";
import API from "../../api";
import { getCurrentActor } from "../../utils/currentActor";

const TokenPage = () => {
  const navigate = useNavigate();
  const { table } = useParams();
  const location = useLocation();
  const entityType = location.state?.entityType || "Table";
  const roomData = location.state?.roomData || null;
  const actor = getCurrentActor();

  const [items, setItems] = useState([]);
  const [tokenId, setTokenId] = useState(null);
  const [loading, setLoading] = useState(true);
  const waiterName = actor?.name || (entityType === "Room" ? "Room Service" : "Waiter");

  useEffect(() => {
    const loadToken = async () => {
      try {
        setLoading(true);

        const tokenRes = await API.get(`/token/table/${table}`);
        const activeToken = tokenRes.data?.id ? tokenRes.data : null;

        if (!activeToken) {
          setTokenId(null);
          setItems([]);
          return;
        }

        setTokenId(activeToken.id);

        const itemsRes = await API.get(`/token/items/${activeToken.id}`);
        setItems(itemsRes.data || []);
      } catch (error) {
        console.log("Error loading token:", error);
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    loadToken();
  }, [table]);

  const ensureTokenAndOpenMenu = async () => {
    try {
      let resolvedTokenId = tokenId;

      if (!resolvedTokenId) {
        const res = await API.post("/token/create", {
          tableNumber: String(table),
          waiter: waiterName,
        });
        resolvedTokenId = res.data?.tokenId;
        setTokenId(resolvedTokenId);
      }

      navigate(`/restaurant/menu/${table}`, {
        state: { entityType, roomData },
      });
    } catch (error) {
      alert(error.response?.data?.message || "Token could not be created.");
    }
  };

  const totalAmount = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.rate || 0), 0),
    [items],
  );

  return (
    <div className="w-full min-h-screen bg-[#f5f8fc]">
      <div className="w-full p-3 sm:p-4 lg:p-5 space-y-3 animate-[fadeIn_0.4s_ease-in-out]">

        {/* HERO HEADER */}
        <section className="relative w-full overflow-hidden rounded-[20px] bg-gradient-to-br from-blue-950 via-blue-700 to-sky-500
px-4 sm:px-6 md:px-8 lg:px-12
py-6 sm:py-8 md:py-10 lg:py-12
text-white shadow-[0_12px_28px_rgba(15,23,42,0.18)]">
          <div className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 left-1/3 h-40 w-40 rounded-full bg-sky-300/10 blur-3xl" />

          <div className="relative grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="flex items-center gap-2 sm:gap-3 max-w-2xl">
              <div className="hidden sm:flex h-10 w-10 md:h-12 md:w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 border border-white/20 backdrop-blur">
                <FiCoffee className="text-lg md:text-xl" />
              </div>
              <div>
                <p className="text-[10px] sm:text-[12px] md:text-[13px] lg:text-[15px] font-bold uppercase tracking-[0.15em] sm:tracking-[0.2em] lg:tracking-[0.25em] text-sky-200">Restaurant Token</p>
                <h1 className="mt-0.5 text-xl sm:text-2xl md:text-3xl lg:text-[2.3rem] font-black leading-tight">Create and Manage Room Token</h1>
                {/* <p className="mt-1 max-w-2xl text-[14px] sm:text-[14px] leading-6 text-slate-100/85">
                  Room token, menu flow aur live item summary ko ek hi cleaner premium workspace me manage kariye.
                </p> */}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5 lg:gap-3 lg:w-[480px]">
              <div className="rounded-[12px] sm:rounded-[16px] border border-white/20 bg-white/10 px-2 py-2 sm:px-3 sm:py-2.5 backdrop-blur-xl shadow-[0_6px_16px_rgba(0,0,0,0.12)] transition-transform lg:hover:-translate-y-0.5">
                <div className="flex items-center gap-1 sm:gap-1.5 text-[9px] sm:text-[11px] md:text-[13px] lg:text-[15px] font-semibold uppercase tracking-[0.05em] sm:tracking-[0.1em] text-sky-100/85">
                  <FiBookOpen className="text-[9px] sm:text-[11px] md:text-[13px] lg:text-[15px]" /> Reference
                </div>
                <div className="mt-1 text-sm sm:text-base md:text-lg font-black leading-none truncate">{table}</div>
              </div>
              <div className="rounded-[12px] sm:rounded-[16px] border border-white/20 bg-white/10 px-2 py-2 sm:px-3 sm:py-2.5 backdrop-blur-xl shadow-[0_6px_16px_rgba(0,0,0,0.12)] transition-transform lg:hover:-translate-y-0.5">
                <div className="flex items-center gap-1 sm:gap-1.5 text-[9px] sm:text-[11px] md:text-[13px] lg:text-[15px] font-semibold uppercase tracking-[0.05em] sm:tracking-[0.1em] text-sky-100/85">
                  <FiShield className="text-[9px] sm:text-[11px] md:text-[13px] lg:text-[15px]" /> Token ID
                </div>
                <div className="mt-1 text-sm sm:text-base md:text-lg font-black leading-none truncate">{tokenId || "Pending"}</div>
              </div>
              <div className="rounded-[12px] sm:rounded-[16px] border border-white/20 bg-white/10 px-2 py-2 sm:px-3 sm:py-2.5 backdrop-blur-xl shadow-[0_6px_16px_rgba(0,0,0,0.12)] transition-transform lg:hover:-translate-y-0.5">
                <div className="flex items-center gap-1 sm:gap-1.5 text-[9px] sm:text-[11px] md:text-[13px] lg:text-[15px] font-semibold uppercase tracking-[0.05em] sm:tracking-[0.1em] text-sky-100/85">
                  <FiBox className="text-[9px] sm:text-[11px] md:text-[13px] lg:text-[15px]" /> Items
                </div>
                <div className="mt-1 text-sm sm:text-base md:text-lg font-black leading-none">{items.length}</div>
              </div>
            </div>
          </div>
        </section>

        {/* MAIN CONTENT */}
        <section className="grid w-full gap-3 xl:grid-cols-2 items-start">

          {/* TOKEN DETAILS */}
          <div className="w-full rounded-[16px] sm:rounded-[22px] border border-blue-100 bg-white p-3 sm:p-4 lg:p-5 shadow-[0_8px_22px_rgba(15,23,42,0.06)] transition-shadow lg:hover:shadow-[0_12px_28px_rgba(15,23,42,0.09)]">
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-2 sm:gap-3 border-b border-slate-100 pb-2.5 sm:pb-3">
              <div>
                <p className="text-[11px] sm:text-[14px] lg:text-[17px] font-bold uppercase tracking-[0.1em] sm:tracking-[0.15em] lg:tracking-[0.18em] text-sky-600">Token Details</p>
                <h2 className="mt-1 text-lg sm:text-2xl md:text-[28px] lg:text-[32px] font-black text-slate-900 leading-tight">Ready to open room order</h2>
              </div>
              <div className="self-start sm:self-auto rounded-full bg-blue-50 border border-blue-100 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm lg:text-[16px] font-bold text-blue-700 flex items-center gap-1.5 whitespace-nowrap">
                <FiMapPin className="text-xs sm:text-sm lg:text-[16px]" /> {entityType}
              </div>
            </div>

            <div className="mt-3 sm:mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
              <div className="rounded-[12px] sm:rounded-[16px] border border-blue-100 bg-[#f8fbff] p-3 sm:p-3.5 transition-all lg:hover:-translate-y-0.5 lg:hover:shadow-[0_8px_18px_rgba(37,99,235,0.10)]">
                <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[13px] lg:text-[17px] font-semibold uppercase tracking-[0.05em] sm:tracking-[0.08em] text-slate-500">
                  <span className="flex h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-[11px] sm:text-[13px] lg:text-[15px]">
                    <FiClipboard />
                  </span>
                  Token Type
                </div>
                <div className="mt-1.5 sm:mt-2 text-base sm:text-lg lg:text-[22px] font-black text-slate-900 truncate">{entityType}</div>
              </div>

              <div className="rounded-[12px] sm:rounded-[16px] border border-blue-100 bg-[#f8fbff] p-3 sm:p-3.5 transition-all lg:hover:-translate-y-0.5 lg:hover:shadow-[0_8px_18px_rgba(37,99,235,0.10)]">
                <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[13px] lg:text-[17px] font-semibold uppercase tracking-[0.05em] sm:tracking-[0.08em] text-slate-500">
                  <span className="flex h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-[11px] sm:text-[13px] lg:text-[15px]">
                    <FiUser />
                  </span>
                  Waiter
                </div>
                <div className="mt-1.5 sm:mt-2 text-base sm:text-lg lg:text-[22px] font-black text-slate-900 truncate">{waiterName}</div>
              </div>

              <div className="rounded-[12px] sm:rounded-[16px] border border-blue-100 bg-[#f8fbff] p-3 sm:p-3.5 transition-all lg:hover:-translate-y-0.5 lg:hover:shadow-[0_8px_18px_rgba(37,99,235,0.10)]">
                <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[13px] lg:text-[17px] font-semibold uppercase tracking-[0.05em] sm:tracking-[0.08em] text-slate-500">
                  <span className="flex h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-[11px] sm:text-[13px] lg:text-[15px]">
                    <FiMapPin />
                  </span>
                  Reference
                </div>
                <div className="mt-1.5 sm:mt-2 text-base sm:text-lg lg:text-[22px] font-black text-slate-900 truncate">{table}</div>
                <div className="mt-1 text-[11px] sm:text-sm lg:text-[17px] text-slate-500">Table No / Room No / Phone No.</div>
              </div>

              <div className="rounded-[12px] sm:rounded-[16px] border border-blue-100 bg-[#f8fbff] p-3 sm:p-3.5 transition-all lg:hover:-translate-y-0.5 lg:hover:shadow-[0_8px_18px_rgba(37,99,235,0.10)]">
                <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[13px] lg:text-[17px] font-semibold uppercase tracking-[0.05em] sm:tracking-[0.08em] text-slate-500">
                  <span className="flex h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-[11px] sm:text-[13px] lg:text-[15px]">
                    <FiCoffee />
                  </span>
                  POS
                </div>
                <div className="mt-1.5 sm:mt-2 text-base sm:text-lg lg:text-[22px] font-black text-slate-900 truncate">Foods of Heaven</div>
              </div>
            </div>

            {roomData ? (
              <div className="mt-3 sm:mt-3.5 rounded-[14px] sm:rounded-[18px] border border-blue-100 bg-gradient-to-br from-[#eef6ff] to-[#f8fbff] p-3 sm:p-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
                  <div>
                    <div className="text-[11px] sm:text-[14px] lg:text-[17px] font-bold uppercase tracking-[0.05em] sm:tracking-[0.08em] text-sky-700">Room No</div>
                    <div className="mt-1 sm:mt-1.5 text-base sm:text-lg lg:text-[22px] font-black text-slate-900">{roomData.roomNo || table}</div>
                  </div>
                  <div>
                    <div className="text-[11px] sm:text-[14px] lg:text-[17px] font-bold uppercase tracking-[0.05em] sm:tracking-[0.08em] text-sky-700">Room Type</div>
                    <div className="mt-1 sm:mt-1.5 text-base sm:text-lg lg:text-[22px] font-black text-slate-900">{roomData.categoryName || "Room"}</div>
                  </div>
                  <div>
                    <div className="text-[11px] sm:text-[14px] lg:text-[17px] font-bold uppercase tracking-[0.05em] sm:tracking-[0.08em] text-sky-700">Room ID</div>
                    <div className="mt-1 sm:mt-1.5 text-base sm:text-lg lg:text-[22px] font-black text-slate-900">{roomData.roomId || "--"}</div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-3.5 sm:mt-4 flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-2.5">
              <button
                className="w-full sm:w-auto inline-flex h-11 sm:h-12 lg:h-[52px] items-center justify-center gap-2 rounded-[12px] sm:rounded-[14px] bg-gradient-to-r from-blue-600 to-sky-500 px-4 sm:px-5 lg:px-6 text-sm sm:text-base lg:text-[17px] font-bold text-white shadow-[0_8px_18px_rgba(37,99,235,0.25)] transition-all lg:hover:-translate-y-0.5 lg:hover:shadow-[0_10px_22px_rgba(37,99,235,0.32)] active:translate-y-0"
                onClick={ensureTokenAndOpenMenu}
              >
                Add Item
                <FiArrowRight />
              </button>

              <button
                className="w-full sm:w-auto inline-flex h-11 sm:h-12 lg:h-[52px] items-center justify-center gap-2 rounded-[12px] sm:rounded-[14px] bg-gradient-to-r from-rose-500 to-orange-500 px-4 sm:px-5 lg:px-6 text-sm sm:text-base lg:text-[17px] font-bold text-white shadow-[0_8px_18px_rgba(244,63,94,0.22)] transition-all lg:hover:-translate-y-0.5 lg:hover:shadow-[0_10px_22px_rgba(244,63,94,0.28)] active:translate-y-0"
                onClick={ensureTokenAndOpenMenu}
              >
                Menu Card
                <FiArrowRight />
              </button>
            </div>
          </div>

          {/* LIVE SUMMARY */}
          <div className="w-full rounded-[16px] sm:rounded-[22px] border border-blue-100 bg-white p-3 sm:p-4 lg:p-5 shadow-[0_8px_22px_rgba(15,23,42,0.06)] transition-shadow lg:hover:shadow-[0_12px_28px_rgba(15,23,42,0.09)]">
            <p className="text-[11px] sm:text-[14px] lg:text-[17px] font-bold uppercase tracking-[0.1em] sm:tracking-[0.15em] lg:tracking-[0.18em] text-violet-600">Live Summary</p>
            <h3 className="mt-1 text-lg sm:text-2xl md:text-[28px] lg:text-[32px] font-black text-slate-900 leading-tight">Token item snapshot</h3>

            <div className="mt-3 sm:mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
              <div className="rounded-[12px] sm:rounded-[16px] bg-gradient-to-br from-blue-950 via-blue-800 to-blue-700 p-3 sm:p-3.5 text-white shadow-[0_8px_18px_rgba(15,23,42,0.20)]">
                <div className="text-[11px] sm:text-[14px] lg:text-[17px] font-semibold uppercase tracking-[0.05em] sm:tracking-[0.08em] text-white/70">Active Token</div>
                <div className="mt-1.5 sm:mt-2 text-lg sm:text-xl lg:text-[24px] font-black truncate">{tokenId || "Not created"}</div>
              </div>
              <div className="rounded-[12px] sm:rounded-[16px] border border-blue-100 bg-[#eff6ff] p-3 sm:p-3.5">
                <div className="text-[11px] sm:text-[14px] lg:text-[17px] font-semibold uppercase tracking-[0.05em] sm:tracking-[0.08em] text-sky-700">Total Amount</div>
                <div className="mt-1.5 sm:mt-2 text-lg sm:text-xl lg:text-[24px] font-black text-blue-900 truncate">Rs. {totalAmount.toLocaleString("en-IN")}</div>
              </div>
            </div>

            <div className="mt-3 sm:mt-3.5 rounded-[14px] sm:rounded-[18px] border border-blue-100 bg-[#f8fbff] p-3 sm:p-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm sm:text-base lg:text-[17px] font-bold text-slate-900">Current items</div>
                <div className="rounded-full bg-white border border-blue-100 px-2.5 py-1 sm:px-3.5 sm:py-1.5 text-[11px] sm:text-[13px] lg:text-[15px] font-bold text-slate-500 whitespace-nowrap">
                  {items.length} rows
                </div>
              </div>

              <div className="mt-2 sm:mt-2.5 space-y-2">
                {loading ? (
                  <div className="space-y-2">
                    {[1, 2].map((n) => (
                      <div key={n} className="rounded-[12px] sm:rounded-[14px] border border-slate-200 bg-white px-3 py-2.5 sm:px-4 sm:py-3 shadow-sm">
                        <div className="h-3.5 w-1/3 animate-pulse rounded bg-slate-200" />
                        <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-slate-100" />
                      </div>
                    ))}
                  </div>
                ) : !items.length ? (
                  <div className="flex flex-col items-center justify-center gap-2 rounded-[12px] sm:rounded-[14px] border border-dashed border-slate-300 bg-white px-3 py-6 sm:px-4 sm:py-7 text-center">
                    <span className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-blue-50 text-blue-400 text-base sm:text-lg">
                      <FiInbox />
                    </span>
                    <div className="text-base sm:text-lg lg:text-[21px] font-bold text-slate-600">No items added yet</div>
                  </div>
                ) : (
                  items.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-[12px] sm:rounded-[14px] border border-slate-200 bg-white px-3 py-2.5 sm:px-4 sm:py-3 shadow-[0_4px_12px_rgba(15,23,42,0.05)] transition-all lg:hover:-translate-y-0.5 lg:hover:shadow-[0_8px_18px_rgba(15,23,42,0.08)]"
                    >
                      <div className="flex items-center justify-between gap-2 sm:gap-3">
                        <div className="min-w-0">
                          <div className="text-sm sm:text-base lg:text-[18px] font-black text-slate-900 truncate">{item.item_name}</div>
                          <div className="mt-1 text-xs sm:text-sm lg:text-[17px] text-slate-500 truncate">
                            Qty {item.qty} | Rate Rs. {item.rate}
                          </div>
                        </div>
                        <div className="shrink-0 rounded-full bg-sky-50 border border-sky-100 px-2.5 py-1 sm:px-3.5 sm:py-1.5 text-[11px] sm:text-[13px] lg:text-[15px] font-bold text-sky-700 whitespace-nowrap">
                          Rs. {(Number(item.qty) * Number(item.rate)).toLocaleString("en-IN")}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-3.5 sm:mt-4 flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-2.5">
              <button
                className="w-full sm:w-auto inline-flex h-11 sm:h-12 lg:h-[52px] items-center justify-center gap-2 rounded-[12px] sm:rounded-[14px] bg-gradient-to-r from-blue-600 to-sky-500 px-4 sm:px-5 lg:px-6 text-sm sm:text-base lg:text-[17px] font-bold text-white shadow-[0_8px_18px_rgba(37,99,235,0.25)] transition-all lg:hover:-translate-y-0.5 lg:hover:shadow-[0_10px_22px_rgba(37,99,235,0.32)] active:translate-y-0"
                onClick={ensureTokenAndOpenMenu}
              >
                <FiSend className="text-sm sm:text-base lg:text-[17px]" />
                Submit
              </button>

              <button
                className="w-full sm:w-auto inline-flex h-11 sm:h-12 lg:h-[52px] items-center justify-center gap-2 rounded-[12px] sm:rounded-[14px] border border-slate-300 bg-white px-4 sm:px-5 lg:px-6 text-sm sm:text-base lg:text-[17px] font-bold text-slate-700 transition-all lg:hover:-translate-y-0.5 lg:hover:border-blue-300 lg:hover:bg-blue-50 active:translate-y-0"
                onClick={() => navigate("/restaurant")}
              >
                <FiArrowLeft className="text-sm sm:text-base lg:text-[17px]" />
                Back to Dashboard
              </button>
            </div>
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

export default TokenPage;