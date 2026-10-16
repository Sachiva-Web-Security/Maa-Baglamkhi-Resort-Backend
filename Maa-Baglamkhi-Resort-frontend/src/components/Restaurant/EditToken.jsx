import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import API from "../../api";
import { restaurantService } from "../../services/restaurantService";
import { getCurrentActor, namesMatch } from "../../utils/currentActor";

const ACTIVE_INVOICE_KEY = "restaurant-active-invoice";
const SAVED_INVOICE_KEY = "restaurant-saved-invoice";

const MODAL_VARIANTS = {
  success: {
    title: "Success",
    ring: "bg-emerald-100 text-emerald-600",
    button: "bg-emerald-600 hover:bg-emerald-700",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
        <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  error: {
    title: "Something went wrong",
    ring: "bg-rose-100 text-rose-600",
    button: "bg-rose-600 hover:bg-rose-700",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  warning: {
    title: "Heads up",
    ring: "bg-amber-100 text-amber-600",
    button: "bg-amber-600 hover:bg-amber-700",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
        <path d="M12 9v4m0 4h.01M10.29 3.86l-8.18 14.18A1 1 0 003 19.6h18a1 1 0 00.86-1.56L13.7 3.86a1 1 0 00-1.72 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  info: {
    title: "Notice",
    ring: "bg-sky-100 text-sky-600",
    button: "bg-gradient-to-br from-blue-950 via-blue-800 to-sky-500 hover:opacity-90",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
        <path d="M12 8h.01M11 12h1v5h1" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
  },
};

const AppModal = ({ config, onClose }) => {
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    setInputValue(config?.defaultValue || "");
  }, [config]);

  if (!config) return null;

  const {
    kind = "alert",
    variant = "info",
    title,
    message,
    submitLabel = "Submit",
    requireInput = true,
    onSubmit,
  } = config;

  const style = MODAL_VARIANTS[variant] || MODAL_VARIANTS.info;

  const handlePrimary = () => {
    if (kind === "prompt") {
      if (requireInput && !inputValue.trim()) return;
      onSubmit?.(inputValue.trim());
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-[24px] bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.28)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${style.ring}`}>
          {style.icon}
        </div>
        <h3 className="mt-4 text-center text-2xl font-black text-slate-900">
          {title || style.title}
        </h3>
        {message ? (
          <p className="mt-2 text-center text-lg text-slate-600">{message}</p>
        ) : null}

        {kind === "prompt" ? (
          <textarea
            autoFocus
            rows={3}
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder="Type here..."
            className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2 text-lg text-slate-700 focus:border-blue-500 focus:outline-none"
          />
        ) : null}

        <div className="mt-6 flex gap-3">
          {kind === "prompt" ? (
            <button
              onClick={onClose}
              className="flex-1 rounded-[16px] border border-slate-200 bg-slate-100 px-4 py-2.5 text-lg font-bold text-slate-700"
            >
              Cancel
            </button>
          ) : null}
          <button
            onClick={handlePrimary}
            className={`flex-1 rounded-[16px] px-4 py-2.5 text-lg font-bold text-white transition ${style.button}`}
          >
            {kind === "prompt" ? submitLabel : "OK"}
          </button>
        </div>
      </div>
    </div>
  );
};

const EditToken = () => {
  const { table } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const entityType = location.state?.entityType || localStorage.getItem(`entityType:${table}`) || "Table";
  const roomData = location.state?.roomData || null;
  const actor = getCurrentActor();
  const currentRole = actor.role;
  const isWaiter = actor.isWaiter;

  const [tokenId, setTokenId] = useState(null);
  const [items, setItems] = useState([]);
  const [kitchenOrder, setKitchenOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [waiterName, setWaiterName] = useState(actor.name || "Waiter");
  const [actionRequests, setActionRequests] = useState([]);
  const [modalConfig, setModalConfig] = useState(null);
  const readySound = useRef(null);
  const lastReadyKey = useRef("");

  const showAlert = (message, variant = "info", title) => {
    setModalConfig({ kind: "alert", variant, title, message });
  };

  const showPrompt = ({ variant = "info", title, message, submitLabel, requireInput = true, defaultValue = "", onSubmit }) => {
    setModalConfig({ kind: "prompt", variant, title, message, submitLabel, requireInput, defaultValue, onSubmit });
  };

  useEffect(() => {
    readySound.current = new Audio("/order.mp3");
  }, []);

  useEffect(() => {
    const loadTokenItems = async () => {
      try {
        setLoading(true);
        const tokenRes = await API.get(`/token/table/${table}`);
        const activeTokenId = tokenRes.data?.id || null;
        setTokenId(activeTokenId);
        setWaiterName(tokenRes.data?.waiter || "Waiter");

        if (!activeTokenId) {
          setItems([]);
          return;
        }

        const itemsRes = await API.get(`/token/items/${activeTokenId}`);
        setItems(itemsRes.data || []);
      } catch (error) {
        console.log("Error loading edit token:", error);
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    loadTokenItems();
  }, [table]);

  useEffect(() => {
    const loadActionRequests = async () => {
      try {
        const rows = await restaurantService.getItemActionRequests();
        setActionRequests(
          (rows || []).filter((row) => String(row.table_number || "") === String(table)),
        );
      } catch (error) {
        console.log("Action request load failed:", error);
        setActionRequests([]);
      }
    };

    loadActionRequests();
    window.addEventListener("tokenUpdated", loadActionRequests);
    return () => window.removeEventListener("tokenUpdated", loadActionRequests);
  }, [table]);

  useEffect(() => {
    let active = true;
    let timerId = null;

    const scheduleNext = (delay) => {
      if (!active) return;
      timerId = setTimeout(tick, delay);
    };

    const tick = async () => {
      if (!active) return;
      const ok = await loadKitchenOrder();
      // 4s after success, 8s after failure (back off)
      scheduleNext(ok ? 4000 : 8000);
    };

    const loadKitchenOrder = async () => {
      try {
        // Fetch both token and kitchen order to get full status
        const [tokenRes, kitchenRes] = await Promise.all([
          API.get(`/token/table/${table}`, { timeout: 8000, skipRetry: true }),
          API.get("/kitchen/orders", { timeout: 8000, skipRetry: true }),
        ]);

        if (!active) return false;

        const tokenData = tokenRes.data;
        const rows = Array.isArray(kitchenRes.data) ? kitchenRes.data : [];
        const match = rows.find((order) => {
          const orderRef = String(order.table || order.table_number || order.table_no || "");
          const orderEntityType = String(order.entityType || "").trim() || "Table";
          return (
            orderRef === String(table) &&
            orderEntityType.toLowerCase() === String(entityType).toLowerCase() &&
            String(order.status || "").toLowerCase() !== "cancelled"
          );
        });

        // Create merged object with both kitchen and token status
        const mergedOrder = match ? {
          ...match,
          tokenOrderStatus: tokenData?.order_status || null,
        } : null;

        if (!active) return false;

        setKitchenOrder(mergedOrder);

        if (mergedOrder && String(mergedOrder.status || "").toLowerCase() === "ready") {
          const readyKey = `${mergedOrder.id}:${mergedOrder.readyAt || mergedOrder.expectedReadyAt || "ready"}`;
          if (lastReadyKey.current !== readyKey) {
            lastReadyKey.current = readyKey;
            readySound.current?.play().catch(() => {});
          }
        }

        return true;
      } catch (error) {
        if (active) {
          console.log("Kitchen status load failed:", error);
          setKitchenOrder(null);
        }
        return false;
      }
    };

    tick();

    return () => {
      active = false;
      if (timerId) clearTimeout(timerId);
    };
  }, [entityType, table]);

  const handleChange = (id, field, value) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  };

  const deleteItem = async (id) => {
    try {
      await API.delete(`/token/item/${id}`);
      setItems((current) => current.filter((item) => item.id !== id));
    } catch (error) {
      showAlert(error.response?.data?.message || "Item could not be deleted.", "error");
    }
  };

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.rate || 0), 0),
    [items],
  );

  const tax = subtotal * 0.05;
  const total = subtotal + tax;

  const handleUpdate = async () => {
    if (!items.length) {
      showAlert("No items to update", "warning");
      return;
    }

    try {
      // Update each item one by one to handle errors properly
      for (const item of items) {
        await API.put("/token/item", {
          id: item.id,
          qty: Number(item.qty),
          rate: Number(item.rate),
        });
      }

      showAlert("Token updated successfully!", "success");
      window.dispatchEvent(new Event("tokenUpdated"));
    } catch (error) {
      const errorMsg = error?.response?.data?.message || error.message || "Token could not be updated.";
      showAlert(errorMsg, "error");
    }
  };

  // Pick Up Order - mark order as picked up from kitchen
  const handlePickup = async () => {
    if (!tokenId) {
      showAlert("Token not found", "warning");
      return;
    }
    try {
      await API.patch(`/waiter/orders/${tokenId}/pickup`);
      showAlert("Order picked up successfully!", "success");
      window.dispatchEvent(new Event("tokenUpdated"));
      window.dispatchEvent(new Event("live-board-updated"));
    } catch (error) {
      showAlert(error?.response?.data?.message || "Pick up failed. Order ready nahi hai ya already picked up hai.", "error");
    }
  };

  // Mark Order Served - complete the serving process
  const handleServed = async () => {
    if (!tokenId) {
      showAlert("Token not found", "warning");
      return;
    }
    try {
      await API.patch(`/waiter/orders/${tokenId}/served`);
      showAlert("Order marked as served!", "success");
      window.dispatchEvent(new Event("tokenUpdated"));
      window.dispatchEvent(new Event("live-board-updated"));
    } catch (error) {
      showAlert(error?.response?.data?.message || "Serve marking failed.", "error");
    }
  };

  // Get token order status for button visibility
  const tokenOrderStatus = kitchenOrder?.tokenOrderStatus || null;

  const handleInvoice = () => {
    const invoicePayload = {
      table,
      tokenId,
      waiterName,
      items: items.map((item) => ({
        id: item.id,
        name: item.item_name,
        qty: Number(item.qty),
        rate: Number(item.rate),
      })),
      subtotal,
      gst: tax,
      total,
      date: new Date().toISOString(),
      entityType,
      roomData,
    };

    localStorage.setItem(ACTIVE_INVOICE_KEY, JSON.stringify(invoicePayload));
    localStorage.setItem(SAVED_INVOICE_KEY, JSON.stringify(invoicePayload));
    navigate("/restaurant/payment", { state: invoicePayload });
  };

  const requestItemAction = (item, actionType) => {
    showPrompt({
      variant: "info",
      title: `${actionType} reason`,
      message: `Why should "${item.item_name}" be marked ${actionType.toLowerCase()}?`,
      submitLabel: "Send Request",
      requireInput: true,
      onSubmit: async (reason) => {
        try {
          await restaurantService.createItemActionRequest({
            tokenItemId: item.id,
            tableNumber: table,
            actionType,
            reason,
            requestedBy: localStorage.getItem("name") || waiterName || "Staff",
          });
          const rows = await restaurantService.getItemActionRequests();
          setActionRequests((rows || []).filter((row) => String(row.table_number || "") === String(table)));
          showAlert(`${actionType} request sent for manager approval.`, "success");
        } catch (error) {
          showAlert(error.response?.data?.message || "Request could not be sent.", "error");
        }
      },
    });
  };

  const reviewItemAction = (request, status) => {
    showPrompt({
      variant: status === "Approved" ? "success" : "warning",
      title: `${status} note`,
      message: `Add an optional note for request #${request.id}.`,
      submitLabel: status,
      requireInput: false,
      onSubmit: async (managerNote) => {
        try {
          await restaurantService.reviewItemActionRequest(request.id, {
            status,
            managerNote,
            approvedBy: localStorage.getItem("name") || "Manager",
          });

          if (status === "Approved") {
            const targetItem = items.find((item) => Number(item.id) === Number(request.token_item_id));
            if (targetItem && request.action_type === "Complimentary") {
              await API.put("/token/item", {
                id: targetItem.id,
                qty: Number(targetItem.qty),
                rate: 0,
              });
              setItems((current) =>
                current.map((item) => (item.id === targetItem.id ? { ...item, rate: 0 } : item)),
              );
            }

            if (targetItem && request.action_type === "Void") {
              await API.delete(`/token/item/${targetItem.id}`);
              setItems((current) => current.filter((item) => item.id !== targetItem.id));
            }
          }

          const rows = await restaurantService.getItemActionRequests();
          setActionRequests((rows || []).filter((row) => String(row.table_number || "") === String(table)));
        } catch (error) {
          showAlert(error.response?.data?.message || "Review could not be saved.", "error");
        }
      },
    });
  };

  if (loading) {
    return <div className="min-h-screen bg-white p-6 text-lg text-slate-600">Loading token...</div>;
  }

  const isOwnedByCurrentWaiter = !isWaiter || !waiterName || namesMatch(waiterName, actor.name);

  return (
    <div className="min-h-screen w-full bg-white p-3 sm:p-4">
      <AppModal config={modalConfig} onClose={() => setModalConfig(null)} />
      <div className="mx-auto w-full max-w-none space-y-4">
        <section className="rounded-[24px] border border-white/10 bg-gradient-to-br from-blue-950 via-blue-800 to-sky-500 px-4 py-4 text-white shadow-[0_18px_44px_rgba(15,23,42,0.22)] sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-base font-semibold uppercase tracking-[0.28em] text-cyan-200">Edit Token</p>
              <h1 className="mt-1.5 text-xl font-black leading-tight sm:text-2xl">Manage room token with cleaner billing view</h1>
              <p className="mt-1.5 text-lg text-white/80">
                Token #{tokenId || "Not Created"} | {entityType} / {table}
              </p>
            </div>
            <button
              onClick={() => navigate(`/restaurant/menu/${table}`, { state: { entityType, roomData } })}
              className="rounded-full bg-white px-4 py-2.5 text-lg font-bold text-slate-900 shadow-lg"
            >
              Open Menu Card
            </button>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-4 rounded-[24px] border border-slate-200/70 bg-white p-4 shadow-[0_14px_36px_rgba(15,23,42,0.09)]">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-[18px] bg-slate-50 px-4 py-3.5">
                <div className="text-lg uppercase tracking-[0.18em] text-slate-500">Token Code</div>
                <div className="mt-1.5 text-lg font-black text-slate-900">{tokenId || "Not Created"}</div>
              </div>
              <div className="rounded-[18px] bg-slate-50 px-4 py-3.5">
                <div className="text-lg uppercase tracking-[0.18em] text-slate-500">Reference</div>
                <div className="mt-1.5 text-lg font-black text-slate-900">{entityType} / {table}</div>
              </div>
                <div className="rounded-[18px] bg-slate-50 px-4 py-3.5">
                  <div className="text-lg uppercase tracking-[0.18em] text-slate-500">Waiter</div>
                  <div className="mt-1.5 text-lg font-black text-slate-900">{waiterName}</div>
                </div>
              </div>

            {roomData ? (
              <div className="rounded-[16px] bg-[linear-gradient(135deg,#eff6ff_0%,#f8fafc_100%)] px-4 py-3 text-lg text-slate-700">
                Room {table} | {roomData.categoryName || "Room"} | ID {roomData.roomId || "--"}
              </div>
            ) : null}

            {kitchenOrder ? (
              <div
                className={`rounded-[16px] border px-4 py-3 text-lg ${
                  String(kitchenOrder.status || "").toLowerCase() === "ready"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-amber-200 bg-amber-50 text-amber-800"
                }`}
              >
                <div className="text-lg font-semibold uppercase tracking-[0.18em]">
                  Kitchen Status
                </div>
                <div className="mt-2 text-2xl font-black">
                  {kitchenOrder.status || "Pending"}
                </div>
                <div className="mt-1">
                  {String(kitchenOrder.status || "").toLowerCase() === "ready"
                    ? kitchenOrder.readyMessage || `${entityType} ${table} order ready hai.`
                    : `ETA ${kitchenOrder.prepTimeMinutes || 20} min | Ready by ${new Date(
                        kitchenOrder.expectedReadyAt || Date.now(),
                      ).toLocaleTimeString("en-IN", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}`}
                </div>
              </div>
            ) : null}

              <div className="overflow-hidden rounded-[20px] border border-slate-200">
              <div className="hidden bg-slate-100 px-4 py-3 text-base font-bold uppercase tracking-[0.16em] text-slate-600 lg:grid lg:grid-cols-[minmax(0,1.3fr)_88px_112px_100px_190px]">
                <div>Item</div>
                <div className="text-center">Quantity</div>
                <div className="text-center">Rate</div>
                <div className="text-center">Amount</div>
                <div className="text-center">Action</div>
              </div>

              {items.map((item, index) => (
                <div
                  key={item.id}
                  className={`border-t border-slate-100 ${index % 2 ? "bg-slate-50/70" : "bg-white"}`}
                >
                  <div className="grid gap-3 px-4 py-3 lg:hidden">
                    <input value={item.item_name} readOnly className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-lg text-slate-700" />
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="number"
                        value={item.qty}
                        className="w-full rounded-xl border border-slate-200 px-2 py-2 text-center text-lg"
                        onChange={(event) => handleChange(item.id, "qty", event.target.value)}
                      />
                      <input
                        type="number"
                        value={item.rate}
                        className="w-full rounded-xl border border-slate-200 px-2 py-2 text-center text-lg"
                        onChange={(event) => handleChange(item.id, "rate", event.target.value)}
                        readOnly={isWaiter}
                        disabled={isWaiter}
                      />
                      <div className="flex items-center justify-center rounded-xl bg-slate-50 px-2 text-lg font-bold text-slate-900">
                        Rs. {Number(item.qty) * Number(item.rate)}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {/*
                      <button
                        onClick={() => requestItemAction(item, "Complimentary")}
                        className="rounded-xl bg-sky-500 px-3 py-2 text-lg font-bold text-white"
                      >
                        Complimentary
                      </button>
                      <button
                        onClick={() => requestItemAction(item, "Void")}
                        className="rounded-xl bg-amber-500 px-3 py-2 text-lg font-bold text-white"
                      >
                        Void
                      </button>
                      */}
                      {!isWaiter ? (
                        <button
                          onClick={() => deleteItem(item.id)}
                          className="rounded-xl bg-rose-500 px-3 py-2 text-lg font-bold text-white"
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="hidden lg:grid lg:grid-cols-[minmax(0,1.3fr)_88px_112px_100px_190px] lg:items-center lg:gap-2 lg:px-4 lg:py-3">
                    <input value={item.item_name} readOnly className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-lg text-slate-700" />
                    <div className="flex justify-center">
                      <input
                        type="number"
                        value={item.qty}
                        className="w-16 rounded-xl border border-slate-200 px-2 py-2 text-center text-lg"
                        onChange={(event) => handleChange(item.id, "qty", event.target.value)}
                      />
                    </div>
                    <div className="flex justify-center">
                      <input
                        type="number"
                        value={item.rate}
                        className="w-24 rounded-xl border border-slate-200 px-2 py-2 text-center text-lg"
                        onChange={(event) => handleChange(item.id, "rate", event.target.value)}
                        readOnly={isWaiter}
                        disabled={isWaiter}
                      />
                    </div>
                    <div className="text-center text-lg font-bold text-slate-900">Rs. {Number(item.qty) * Number(item.rate)}</div>
                    <div className="flex justify-center">
                      <div className="flex flex-wrap justify-center gap-2">
                      {/*
                      <button
                        onClick={() => requestItemAction(item, "Complimentary")}
                        className="rounded-xl bg-sky-500 px-3 py-2 text-lg font-bold text-white"
                      >
                        Complimentary
                      </button>
                      <button
                        onClick={() => requestItemAction(item, "Void")}
                        className="rounded-xl bg-amber-500 px-3 py-2 text-lg font-bold text-white"
                      >
                        Void
                      </button>
                      */}
                      {!isWaiter ? (
                        <button
                          onClick={() => deleteItem(item.id)}
                          className="rounded-xl bg-rose-500 px-3 py-2 text-lg font-bold text-white"
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </div>
                  </div>
                </div>
              ))}

              {!items.length ? (
                <div className="px-4 py-10 text-center text-xl text-slate-400">No token items found.</div>
              ) : null}
            </div>

            {/* <div className="rounded-[24px] border border-slate-200/70 bg-white p-4 shadow-[0_14px_36px_rgba(15,23,42,0.09)]">
              <p className="text-lg font-semibold uppercase tracking-[0.26em] text-amber-600">Manager Approval</p>
              <h3 className="mt-2 text-2xl font-black text-slate-900">Complimentary / void requests</h3>
              <div className="mt-3 space-y-3">
                {actionRequests.length ? actionRequests.slice(0, 6).map((request) => (
                  <div key={request.id} className="rounded-[18px] bg-slate-50 px-4 py-4 text-lg">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-bold text-slate-900">{request.action_type}</div>
                      <div className="text-base font-semibold text-slate-500">{request.status}</div>
                    </div>
                    <div className="mt-2 text-slate-600">{request.reason}</div>
                    {["manager", "admin"].includes(currentRole) && request.status === "Pending" ? (
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => reviewItemAction(request, "Approved")}
                          className="rounded-xl bg-emerald-600 px-3 py-2 text-lg font-bold text-white"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => reviewItemAction(request, "Rejected")}
                          className="rounded-xl bg-rose-600 px-3 py-2 text-lg font-bold text-white"
                        >
                          Reject
                        </button>
                      </div>
                    ) : null}
                  </div>
                )) : (
                  <div className="rounded-[18px] bg-slate-50 px-4 py-4 text-xl text-slate-500">
                    Koi complimentary/void request pending nahi hai.
                  </div>
                )}
              </div>
            </div> */}
          </div>

          <div className="space-y-5">
            <div className="rounded-[24px] border border-slate-200/70 bg-white p-4 shadow-[0_14px_36px_rgba(15,23,42,0.09)]">
              <p className="text-lg font-semibold uppercase tracking-[0.26em] text-emerald-600">Billing</p>
              <h3 className="mt-2 text-2xl font-black text-slate-900">Token totals</h3>

              <div className="mt-4 space-y-3 rounded-[20px] bg-[linear-gradient(135deg,#f8fbff_0%,#f3f9f5_100%)] p-4">
                <div className="flex items-center justify-between text-lg text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-bold text-slate-900">Rs. {subtotal.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-lg text-slate-600">
                  <span>SGST (2.5%)</span>
                  <span className="font-bold text-slate-900">Rs. {(tax / 2).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-lg text-slate-600">
                  <span>CGST (2.5%)</span>
                  <span className="font-bold text-slate-900">Rs. {(tax / 2).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-lg font-black text-slate-900">
                  <span>Total</span>
                  <span>Rs. {total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200/70 bg-white p-4 shadow-[0_14px_36px_rgba(15,23,42,0.09)]">
              <p className="text-lg font-semibold uppercase tracking-[0.26em] text-sky-700">Actions</p>
              <div className="mt-3 grid gap-3">
                {String(tokenOrderStatus || kitchenOrder?.status || "").toLowerCase() === "ready" && (
                  <button
                    onClick={handlePickup}
                    className="rounded-[16px] bg-purple-600 px-4 py-2.5 text-lg font-bold text-white transition hover:bg-purple-700"
                  >
                    Pick Up Order
                  </button>
                )}
                {String(tokenOrderStatus || kitchenOrder?.status || "").toLowerCase() === "picked_up" && (
                  <button
                    onClick={handleServed}
                    className="rounded-[16px] bg-cyan-600 px-4 py-2.5 text-lg font-bold text-white transition hover:bg-cyan-700"
                  >
                    Mark as Served
                  </button>
                )}
                <button
                  onClick={handleUpdate}
                  className="rounded-[16px] bg-emerald-600 px-4 py-2.5 text-lg font-bold text-white"
                >
                  Update Token
                </button>
                <button
                  onClick={handleInvoice}
                  disabled={!items.length}
                  className="rounded-[16px] bg-blue-600 px-4 py-2.5 text-lg font-bold text-white"
                >
                  Create Invoice
                </button>
                <button
                  onClick={() => navigate("/restaurant")}
                  className="rounded-[16px] border border-slate-200 bg-slate-100 px-4 py-2.5 text-lg font-bold text-slate-700"
                >
                  Back to Dashboard
                </button>
              </div>
              {isWaiter && !isOwnedByCurrentWaiter ? (
                <div className="rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-4 text-lg font-semibold text-amber-800">
                  Ye token kisi aur waiter ke naam par chal raha hai. Aap isse edit ya bill generate nahi kar sakte.
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default EditToken;