import React, { useEffect, useRef, useState } from "react";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiPrinter,
  FiXCircle,
  FiClipboard,
  FiTrendingUp,
  FiAlertTriangle,
} from "react-icons/fi";
import { FaSyncAlt } from "react-icons/fa";
import API from "../api";
import { restaurantService } from "../services/restaurantService";
import WaiterAssignmentCard from "../components/Restaurant/WaiterAssignmentCard";

const PREP_TIME_OPTIONS = [10, 15, 20, 30, 45, 60];
const ORDERS_PER_PAGE = 6;

const toMillis = (value) => {
  if (!value) return null;

  if (typeof value === "string") {
    const mysqlMatch = value.match(
      /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/,
    );

    if (mysqlMatch) {
      const [, year, month, day, hours, minutes, seconds = "00"] = mysqlMatch;
      const parsed = new Date(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hours),
        Number(minutes),
        Number(seconds),
      ).getTime();
      return Number.isNaN(parsed) ? null : parsed;
    }
  }

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
};

const formatClock = (value) => {
  const parsed = toMillis(value);
  if (!parsed) return "--";
  return new Date(parsed).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
};

const getRemainingMinutes = (order) => {
  const dueAt = toMillis(order.expectedReadyAt);
  if (!dueAt) return null;
  return Math.ceil((dueAt - Date.now()) / 60000);
};

const getRemainingSeconds = (order) => {
  const dueAt = toMillis(order.expectedReadyAt);
  if (!dueAt) return null;
  return Math.max(0, Math.ceil((dueAt - Date.now()) / 1000));
};

const formatCountdown = (totalSeconds) => {
  if (totalSeconds === null || totalSeconds === undefined) return "--:--";
  const safeSeconds = Math.max(0, Number(totalSeconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const isOrderOverdue = (order) => {
  if (String(order.status || "").toLowerCase() === "ready") return false;
  const remaining = getRemainingMinutes(order);
  return remaining !== null && remaining < 0;
};
const Kitchen = () => {
  const [orders, setOrders] = useState([]);
  const [roomRefs, setRoomRefs] = useState(new Set());
  const [etaDrafts, setEtaDrafts] = useState({});
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [cancelledPage, setCancelledPage] = useState(1);
  const [, setTicker] = useState(0);
  const [confirmModal, setConfirmModal] = useState({ open: false, type: "", order: null });
  const [noticeModal, setNoticeModal] = useState({ open: false, type: "success", message: "" });
  // ── Table / Room filter chip ───────────────────────────────────────────────
  const [entityFilter, setEntityFilter] = useState("All"); // "All" | "Table" | "Room"
  const orderSound = useRef(null);
  const firstLoad = useRef(true);
  const seenOrderIds = useRef(new Set());

  const showNotice = (type, message) => {
    setNoticeModal({ open: true, type, message });
  };

  const fetchOrders = async () => {
    if (firstLoad.current) setLoading(true);
    try {
      const data = await restaurantService.getKitchenOrders();
      setOrders(data || []);
      setEtaDrafts((current) => {
        const next = { ...current };
        (data || []).forEach((order) => {
          if (!next[order.id]) {
            next[order.id] = Number(order.prepTimeMinutes || 20);
          }
        });
        return next;
      });

      const incomingIds = new Set((data || []).map((order) => String(order.id)));
      const hasNewOrder = (data || []).some((order) => !seenOrderIds.current.has(String(order.id)));

      if (!firstLoad.current && hasNewOrder && orderSound.current) {
        orderSound.current.currentTime = 0;
        orderSound.current.play().catch(() => {});
      }
      seenOrderIds.current = incomingIds;
    } catch (err) {
      console.error("Failed to load kitchen orders", err);
      setOrders([]);
    } finally {
      if (firstLoad.current) {
        setLoading(false);
        firstLoad.current = false;
      }
    }
  };

  const fetchRoomRefs = async () => {
    try {
      const response = await API.get("/housekeeping");
      setRoomRefs(
        new Set(
          (Array.isArray(response.data) ? response.data : [])
            .map((room) => String(room.roomNo || room.roomNumber || "").trim())
            .filter(Boolean),
        ),
      );
    } catch (err) {
      console.error("Failed to load kitchen room refs", err);
      setRoomRefs(new Set());
    }
  };

  const resolveEntityType = (order) => {
    const ref = String(order.table || order.table_number || order.table_no || "").trim();
    if (!ref) return "Table";

    const explicitType = String(order.entityType || "").trim();
    if (explicitType) return explicitType;

    const localType = localStorage.getItem(`entityType:${ref}`);
    if (localType) return localType;

    if (String(order.waiter || order.waiter_name || "").toLowerCase().includes("room")) {
      return "Room";
    }

    if (roomRefs.has(ref)) {
      return "Room";
    }

    return "Table";
  };

  useEffect(() => {
    orderSound.current = new Audio("/order.mp3");
    fetchOrders();
    fetchRoomRefs();
    const interval = setInterval(fetchOrders, 4000);
    const ticker = setInterval(() => setTicker((current) => current + 1), 1000);
    window.addEventListener("kitchenUpdated", fetchOrders);
    return () => {
      clearInterval(interval);
      clearInterval(ticker);
      window.removeEventListener("kitchenUpdated", fetchOrders);
    };
  }, []);

  const cancelOrder = async (order) => {
    try {
      const response = await restaurantService.cancelKitchenOrder(order.id);
      fetchOrders();
      showNotice("success", response?.message || "Order cancelled successfully.");
    } catch (err) {
      console.error(err);
      showNotice("error", err.response?.data?.message || "Failed to cancel order");
    }
  };

  const restoreOrder = async (order) => {
    try {
      await restaurantService.updateKitchenOrderStatus(order.id, {
        status: "Pending",
        prepTimeMinutes: Number(etaDrafts[order.id] || order.prepTimeMinutes || 20),
        readyMessage: "",
      });
      fetchOrders();
      showNotice("success", "The cancelled order has been returned to the kitchen queue.");
    } catch (err) {
      console.error(err);
      showNotice("error", err.response?.data?.message || "Unable to restore the order.");
    }
  };

  const removeCancelledOrder = async (order) => {
    try {
      const response = await restaurantService.removeKitchenOrder(order.id);
      fetchOrders();
      showNotice("success", response?.message || "The cancelled order has been permanently removed.");
    } catch (err) {
      console.error(err);
      showNotice("error", err.response?.data?.message || "The cancelled order could not be removed.");
    }
  };

  const updateEta = async (order) => {
    try {
      await restaurantService.updateKitchenOrderStatus(order.id, {
        status: order.status || "Pending",
        prepTimeMinutes: Number(etaDrafts[order.id] || order.prepTimeMinutes || 20),
      });
      fetchOrders();
    } catch (err) {
      console.error(err);
      showNotice("error", "ETA could not be updated.");
    }
  };

  const markOrderReady = async (order) => {
    const ref = order.table || order.table_number || order.table_no || "--";
    const entityType = resolveEntityType(order);
    try {
      await restaurantService.updateKitchenOrderStatus(order.id, {
        status: "Ready",
        readyMessage: `${entityType} ${ref} order is ready. Please send it for service.`,
      });

      // Send notification to the waiter using both ID and name
      const waiterId = order.waiter_id;
      const waiterName = order.waiter_name || order.waiter || "";

      if (waiterId || waiterName) {
        const notification = {
          id: `ready-${order.id}-${Date.now()}`,
          title: "Order Ready!",
          message: `${entityType} ${ref} order is ready. You can serve it now`,
          type: "success",
          route: `/restaurant/edit-token/${ref}`,
          meta: {
            orderId: order.id,
            tableNumber: ref,
            entityType: entityType,
            waiterId: waiterId,
            waiterName: waiterName,
          },
          createdAt: new Date().toISOString(),
          read: false,
        };

        // Store by waiter ID if available
        if (waiterId) {
          localStorage.setItem(`waiter_notification_id_${waiterId}`, JSON.stringify(notification));
          window.dispatchEvent(new CustomEvent(`waiter-notification-id-${waiterId}`));
        }

        // Also store by waiter name (normalized)
        if (waiterName) {
          const normalizedName = waiterName.toLowerCase().replace(/\s+/g, "_");
          localStorage.setItem(`waiter_notification_name_${normalizedName}`, JSON.stringify(notification));
          window.dispatchEvent(new CustomEvent(`waiter-notification-name-${normalizedName}`));
        }
      }

      fetchOrders();
      showNotice("success", "Order ready marked. Waiter notified.");
    } catch (err) {
      console.error(err);
      showNotice("error", "Order could not be marked as ready.");
    }
  };

  const markOrderPreparing = async (order) => {
    try {
      const etaMinutes = order.prepTimeMinutes || 20;
      await restaurantService.updateKitchenOrderStatus(order.id, {
        status: "Preparing",
        prepTimeMinutes: etaMinutes,
      });

      // Send notification to the waiter using both ID and name
      const waiterId = order.waiter_id;
      const waiterName = order.waiter_name || order.waiter || "";

      if (waiterId || waiterName) {
        const notification = {
          id: `prep-${order.id}-${Date.now()}`,
          title: "Order Being Prepared",
          message: `Your order for ${order.table || order.table_number || "Table"} is now being prepared. ETA: ${etaMinutes} minutes.`,
          type: "info",
          route: `/restaurant/edit-token/${order.table || order.table_number}`,
          meta: {
            orderId: order.id,
            tableNumber: order.table || order.table_number,
            etaMinutes: etaMinutes,
            waiterId: waiterId,
            waiterName: waiterName,
          },
          createdAt: new Date().toISOString(),
          read: false,
        };

        // Store by waiter ID if available
        if (waiterId) {
          localStorage.setItem(`waiter_notification_id_${waiterId}`, JSON.stringify(notification));
          window.dispatchEvent(new CustomEvent(`waiter-notification-id-${waiterId}`));
        }

        // Also store by waiter name (normalized)
        if (waiterName) {
          const normalizedName = waiterName.toLowerCase().replace(/\s+/g, "_");
          localStorage.setItem(`waiter_notification_name_${normalizedName}`, JSON.stringify(notification));
          window.dispatchEvent(new CustomEvent(`waiter-notification-name-${normalizedName}`));
        }
      }

      fetchOrders();
      showNotice("success", `Order is now being prepared. Waiter notified. ETA: ${etaMinutes} minutes.`);
    } catch (err) {
      console.error(err);
      showNotice("error", "Order could not be marked as preparing.");
    }
  };

  const openCancelOrderModal = (order) => {
    setConfirmModal({ open: true, type: "cancel-order", order });
  };

  const openRemoveOrderModal = (order) => {
    setConfirmModal({ open: true, type: "remove-order", order });
  };

  const closeConfirmModal = () => {
    setConfirmModal({ open: false, type: "", order: null });
  };

  const handleConfirmAction = async () => {
    const { type, order } = confirmModal;
    closeConfirmModal();
    if (!order) return;

    if (type === "cancel-order") {
      await cancelOrder(order);
      return;
    }

    if (type === "remove-order") {
      await removeCancelledOrder(order);
    }
  };

  const printBill = (order) => {
    const ref = order.table || order.table_number || order.table_no;
    const entityType = resolveEntityType(order);
    const total = order.items.reduce((sum, item) => {
      const qty = Number(item.qty ?? item.quantity ?? 0);
      return sum + Number(item.price || 0) * qty;
    }, 0);

    const printWindow = window.open("", "_blank");

    const itemsHTML = order.items
      .map(
        (item) => `
      <tr>
        <td>${item.name || item.item_name}</td>
        <td>${item.qty ?? item.quantity ?? "-"}</td>
        <td>Rs ${item.price}</td>
        <td>Rs ${Number(item.price || 0) * Number(item.qty ?? item.quantity ?? 0)}</td>
      </tr>
    `,
      )
      .join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <title>KOT - ${entityType} ${ref}</title>
          <style>
            @page { size: 80mm auto; margin: 0; }
            * { box-sizing: border-box; }
            html, body { width: 80mm; margin: 0; padding: 3mm; }
            body {
              font-family: 'Courier New', Courier, monospace;
              color: #000;
              background: #fff;
            }
            h1 { font-size: 16px; margin: 0 0 4px; text-align: center; color: #000; }
            h2 { font-size: 14px; margin: 6px 0; text-align: center; color: #000; }
            h3 { font-size: 14px; margin: 8px 0; text-align: right; color: #000; font-weight: bold; }
            p  { font-size: 12px; margin: 4px 0; color: #000; }
            table { width: 100%; border-collapse: collapse; margin-top: 6px; color: #000; }
            th, td { padding: 6px 4px; border-bottom: 1px dashed #000; font-size: 13px; color: #000; text-align: left; }
            th { font-weight: bold; border-bottom: 2px solid #000; }
            .divider { border-top: 1px dashed #000; margin: 6px 0; }
            .meta-row { display: flex; justify-content: space-between; font-size: 12px; color: #000; margin-top: 2px; }
            .meta-row span:first-child { font-weight: bold; }
            .footer { margin-top: 8px; text-align: center; font-size: 11px; color: #000; }
            .badge {
              display: inline-block; background: #000; color: #fff;
              padding: 2px 6px; font-size: 10px; font-weight: bold; margin-top: 6px;
            }
          </style>
        </head>
        <body>
          <h1>KITCHEN ORDER TICKET</h1>
          <div class="divider"></div>
          <div class="meta-row"><span>${entityType}:</span><span>${ref || ""}</span></div>
          <div class="meta-row"><span>Waiter:</span><span>${order.waiter_name || order.waiter || ""}</span></div>
          <div class="meta-row"><span>Date:</span><span>${new Date().toLocaleDateString("en-IN")}</span></div>
          <div class="meta-row"><span>Time:</span><span>${new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}</span></div>
          <div class="meta-row"><span>Order #:</span><span>${order.id || ""}</span></div>
          <div class="divider"></div>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>${itemsHTML}</tbody>
          </table>
          <div class="divider"></div>
          <h3>Total: Rs ${total}</h3>
          <div class="footer">
            <div>Printed at ${new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}</div>
            <div class="badge">-- KITCHEN COPY --</div>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.print();
  };

  const totalOrders = orders.length;
  const cancelledOrders = orders.filter((o) => String(o.status || "").toLowerCase() === "cancelled");
  const visibleOrders = orders.filter((o) => {
    const status = String(o.status || "").toLowerCase();
    if (["cancelled", "saved", "served", "complete", "completed"].includes(status)) return false;
    // Entity filter chip
    if (entityFilter === "Table") {
      return resolveEntityType(o) === "Table";
    }
    if (entityFilter === "Room") {
      return resolveEntityType(o) === "Room";
    }
    return true;
  });
  const readyCount = visibleOrders.filter((o) => o.status === "Ready").length;
  const pendingCount = Math.max(0, visibleOrders.length - readyCount);
  const overdueCount = visibleOrders.filter((o) => isOrderOverdue(o)).length;
  const totalVisiblePages = Math.max(1, Math.ceil(visibleOrders.length / ORDERS_PER_PAGE));
  const totalCancelledPages = Math.max(1, Math.ceil(cancelledOrders.length / ORDERS_PER_PAGE));
  const paginatedVisibleOrders = visibleOrders.slice(
    (currentPage - 1) * ORDERS_PER_PAGE,
    currentPage * ORDERS_PER_PAGE,
  );
  const paginatedCancelledOrders = cancelledOrders.slice(
    (cancelledPage - 1) * ORDERS_PER_PAGE,
    cancelledPage * ORDERS_PER_PAGE,
  );

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalVisiblePages));
  }, [totalVisiblePages]);

  useEffect(() => {
    setCancelledPage((page) => Math.min(page, totalCancelledPages));
  }, [totalCancelledPages]);

  const renderPagination = (page, totalPages, setPage) => {
    if (totalPages <= 1) return null;

    const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);

    return (
      <div className="mt-8 flex flex-col gap-4 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-[15px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          Page {page} of {totalPages}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page === 1}
            className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-[16px] font-bold text-slate-600 shadow-sm transition-all duration-200 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
          >
            Previous
          </button>
          {pageNumbers.map((pageNumber) => (
            <button
              type="button"
              key={pageNumber}
              onClick={() => setPage(pageNumber)}
              className={`h-10 min-w-10 rounded-full px-3 text-[16px] font-bold transition-all duration-200 ${
                page === pageNumber
                  ? "bg-gradient-to-br from-blue-700 to-sky-500 text-white shadow-md shadow-blue-200"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              }`}
            >
              {pageNumber}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={page === totalPages}
            className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-[16px] font-bold text-slate-600 shadow-sm transition-all duration-200 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
          >
            Next
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="relative isolate min-h-screen w-full overflow-x-hidden bg-[linear-gradient(180deg,#f4f8ff_0%,#eef4ff_50%,#f7faff_100%)] p-4 transition-all duration-300 sm:p-6 lg:p-8 xl:p-10">
        <div className="w-full space-y-6 animate-pulse">
          <div className="h-64 rounded-[32px] bg-blue-100/70" />
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {[...Array(3)].map((_, index) => (
              <div key={index} className="h-64 rounded-[28px] bg-white/80" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const statusBadgeClasses = (status, overdue) => {
    if (overdue) return "bg-rose-50 text-rose-600 ring-1 ring-inset ring-rose-100";
    if (status === "Ready") return "bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100";
    if (status === "Preparing") return "bg-sky-50 text-sky-600 ring-1 ring-inset ring-sky-100";
    return "bg-orange-50 text-orange-600 ring-1 ring-inset ring-orange-100";
  };

  const rowGridCols =
    "grid-cols-1 lg:grid-cols-[1.3fr_0.95fr_1.15fr_1.25fr_1.3fr_1.7fr_0.85fr_1.25fr]";

  return (
    <div className="relative isolate min-h-screen w-full overflow-x-hidden bg-[linear-gradient(180deg,#f4f8ff_0%,#eef4ff_45%,#f7faff_100%)] p-4 transition-all duration-300 sm:p-6 lg:p-8 xl:p-10 2xl:p-12">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[-6%] top-[-8%] h-72 w-72 rounded-full bg-sky-200/35 blur-3xl sm:h-96 sm:w-96" />
        <div className="absolute right-[-8%] top-[4%] h-72 w-72 rounded-full bg-blue-200/30 blur-3xl sm:h-[26rem] sm:w-[26rem]" />
        <div className="absolute bottom-[10%] left-[22%] h-56 w-56 rounded-full bg-cyan-100/40 blur-3xl sm:h-80 sm:w-80" />
      </div>

      <div className="w-full space-y-8">
        {/* ── HERO ─────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden rounded-[32px] bg-[linear-gradient(120deg,#020617_0%,#1d4ed8_55%,#38bdf8_100%)] px-6 py-6 shadow-[0_30px_70px_rgba(29,78,216,0.28)] sm:px-8 sm:py-7 lg:px-10">
  {/* Background Effects */}
  <div className="pointer-events-none absolute inset-0">
    <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
    <div className="absolute -right-16 -bottom-32 h-96 w-96 rounded-full bg-sky-300/25 blur-3xl" />
    <div className="absolute right-[18%] top-[-10%] h-56 w-56 rounded-full border border-white/10" />
    <div className="absolute right-[10%] top-[6%] h-40 w-40 rounded-full border border-white/10" />
    <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:64px_64px] opacity-40" />
  </div>

  <div className="relative z-[1] flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">

    {/* Left Side */}
    <div className="lg:flex-shrink-0">
      <p className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-[13px] font-semibold uppercase tracking-[0.28em] text-sky-100 backdrop-blur-md">
        Resort Command Center
      </p>

      <h1 className="mt-4 whitespace-normal break-words text-[24px] font-black leading-tight text-white sm:whitespace-nowrap sm:text-[32px] lg:text-[32px]">
        Kitchen Order Dashboard
      </h1>

      <div className="mt-5 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-nowrap sm:items-center sm:overflow-x-auto pb-1">
        <button
          type="button"
          onClick={fetchOrders}
          className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-[15px] font-bold text-blue-800 shadow-lg transition-all duration-200 hover:-translate-y-0.5 sm:w-auto"
        >
          <FaSyncAlt className="text-sky-600" />
          Refresh Queue
        </button>

        <div className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/10 px-5 py-3 text-[15px] font-semibold text-blue-50 backdrop-blur-md sm:w-auto sm:justify-start">
          <FiClock className="text-sky-200" />
          Auto refresh every 4 seconds
        </div>
      </div>
    </div>

    {/* Right Side */}
    <div className="flex flex-1 justify-center sm:justify-end">
      <div className="grid w-full grid-cols-2 gap-3 sm:w-auto sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Active Orders",
            value: String(totalOrders),
            icon: FiClipboard,
            accent: "from-blue-500/40 to-blue-400/10 text-blue-50",
          },
          {
            label: "Ready Orders",
            value: String(readyCount),
            icon: FiCheckCircle,
            accent: "from-emerald-400/40 to-emerald-300/10 text-emerald-50",
          },
          {
            label: "Pending Orders",
            value: String(pendingCount),
            icon: FiTrendingUp,
            accent: "from-slate-400/40 to-slate-300/10 text-slate-50",
          },
          {
            label: "Overdue Orders",
            value: String(overdueCount),
            icon: FiAlertTriangle,
            accent: "from-indigo-400/40 to-indigo-300/10 text-indigo-50",
          },
        ].map((item) => (
          <div
            key={item.label}
            className="group w-full rounded-2xl border border-white/15 bg-white/10 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:bg-white/15 sm:w-[145px] lg:w-[155px]"
          >
            <div
              className={`mb-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br ${item.accent} ring-1 ring-inset ring-white/20`}
            >
              <item.icon className="text-base" />
            </div>

            <div className="text-[14px] font-medium leading-tight text-blue-50/80">
              {item.label}
            </div>

            <div className="mt-1 text-[24px] font-black leading-none text-white sm:text-[30px]">
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </div>

  </div>
</section>

        {/* ── KITCHEN ORDERS ───────────────────────────────────────────── */}
        <section className="space-y-4">
          <div className="rounded-[30px] border border-white/70 bg-white/90 p-4 shadow-[0_20px_55px_rgba(30,64,175,0.08)] backdrop-blur-xl sm:p-7 lg:p-8">
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[15px] font-bold uppercase tracking-[0.24em] text-sky-500">
                  Live Kitchen Queue
                </p>
                <h2 className="mt-1 text-[24px] font-black text-slate-900 sm:text-[30px] lg:text-[34px]">
                  Kitchen Orders
                </h2>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                {/* ── Table / Room filter chips ─────────────────────────── */}
                <div className="grid w-full grid-cols-3 gap-2 rounded-full bg-slate-100/80 p-1.5 sm:flex sm:w-auto sm:flex-wrap">
                  {["All", "Table", "Room"].map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => { setEntityFilter(filter); setCurrentPage(1); }}
                      className={`rounded-full px-3 py-2 text-center text-[15px] font-bold transition-all duration-200 sm:px-5 sm:text-[16px] ${
                        entityFilter === filter
                          ? "bg-gradient-to-r from-blue-700 to-sky-500 text-white shadow-md shadow-blue-200"
                          : "text-slate-500 hover:bg-white hover:text-slate-800"
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={fetchOrders}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-blue-700 to-sky-500 px-6 py-3 text-[17px] font-bold text-white shadow-[0_14px_30px_rgba(14,116,233,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(14,116,233,0.34)] sm:w-auto"
                >
                  <FaSyncAlt />
                  Refresh Now
                </button>
              </div>
            </div>

            {visibleOrders.length ? (
              <div className="space-y-3">
                {/* header row — desktop only */}
                <div className={`hidden ${rowGridCols} gap-4 rounded-2xl bg-slate-50 px-5 py-3 lg:grid`}>
                  <div className="text-[16px] font-bold uppercase tracking-[0.1em] text-slate-400">Reference</div>
                  <div className="text-[16px] font-bold uppercase tracking-[0.1em] text-slate-400">Status</div>
                  <div className="text-[16px] font-bold uppercase tracking-[0.1em] text-slate-400">Waiter Info</div>
                  <div className="text-[16px] font-bold uppercase tracking-[0.1em] text-slate-400">Kitchen ETA</div>
                  <div className="text-[16px] font-bold uppercase tracking-[0.1em] text-slate-400">Ready Window</div>
                  <div className="text-[16px] font-bold uppercase tracking-[0.1em] text-slate-400">Items</div>
                  <div className="text-[16px] font-bold uppercase tracking-[0.1em] text-slate-400">Total</div>
                  <div className="text-center text-[16px] font-bold uppercase tracking-[0.1em] text-slate-400">Actions</div>
                </div>

                {paginatedVisibleOrders.map((order) => {
                  const ref = order.table || order.table_number || order.table_no;
                  const entityType = resolveEntityType(order);
                  const label = `${entityType} ${ref || "--"}`;
                  const status = order.status || "Pending";
                  const overdue = isOrderOverdue(order);
                  const remainingMinutes = getRemainingMinutes(order);
                  const total = (order.items || []).reduce((sum, item) => {
                    const qty = Number(item.qty ?? item.quantity ?? 0);
                    return sum + Number(item.price || 0) * qty;
                  }, 0);

                  return (
                    <div
                      key={order.id}
                      className={`grid ${rowGridCols} w-full items-start gap-4 rounded-[22px] border p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(30,64,175,0.1)] sm:p-5 ${
                        overdue
                          ? "border-rose-100 bg-rose-50/40"
                          : "border-slate-100 bg-white"
                      }`}
                    >
                      {/* Reference */}
                      <div className="min-w-0">
                        <div className="break-words text-[20px] font-black leading-tight text-slate-900 sm:text-[22px]">{label}</div>
                        <div className="mt-1 text-[15px] text-slate-400">Order #{order.id}</div>
                        {order.readyMessage ? (
                          <div className="mt-2 break-words rounded-[12px] border border-emerald-100 bg-emerald-50 px-3 py-2 text-[15px] font-semibold text-emerald-700">
                            {order.readyMessage}
                          </div>
                        ) : null}
                      </div>

                      {/* Status */}
                      <div>
                        <span className="lg:hidden mb-1 block text-[13px] font-bold uppercase tracking-wide text-slate-400">Status</span>
                        <span
                          className={`inline-flex rounded-full px-4 py-1.5 text-[15px] font-bold ${statusBadgeClasses(status, overdue)}`}
                        >
                          {overdue ? "Overdue" : status}
                        </span>
                      </div>

                      {/* Waiter Info */}
                      <div className="min-w-0">
                        <span className="lg:hidden mb-1 block text-[13px] font-bold uppercase tracking-wide text-slate-400">Waiter Info</span>
                        <div className="break-words text-[17px] font-semibold text-slate-900">
                          {order.waiter_name || order.waiter || "--"}
                        </div>
                        <div className="text-[14px] text-slate-400">
                          ID: {order.waiter_id || "--"}
                        </div>
                      </div>

                      {/* Kitchen ETA */}
                      <div className="min-w-0">
                        <span className="lg:hidden mb-1 block text-[13px] font-bold uppercase tracking-wide text-slate-400">Kitchen ETA</span>
                        <div className="flex w-full items-center gap-2 sm:min-w-[160px]">
                          <select
                            value={etaDrafts[order.id] ?? order.prepTimeMinutes ?? 20}
                            onChange={(event) =>
                              setEtaDrafts((current) => ({
                                ...current,
                                [order.id]: Number(event.target.value),
                              }))
                            }
                            className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[16px] font-semibold text-slate-700 transition-colors focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
                          >
                            {PREP_TIME_OPTIONS.map((minutes) => (
                              <option key={minutes} value={minutes}>
                                {minutes} min
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => updateEta(order)}
                            className="shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[15px] font-bold text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                          >
                            Set
                          </button>
                        </div>
                      </div>

                      {/* Ready Window */}
                      <div>
                        <span className="lg:hidden mb-1 block text-[13px] font-bold uppercase tracking-wide text-slate-400">Ready Window</span>
                        <div className="flex items-center gap-2 text-[20px] font-bold text-slate-900 sm:text-[22px]">
                          <FiClock className={overdue ? "text-rose-500" : "text-sky-500"} />
                          {formatCountdown(getRemainingSeconds(order))}
                        </div>
                        <div className={`mt-1 text-[15px] ${overdue ? "text-rose-600" : "text-slate-400"}`}>
                          {status === "Ready"
                            ? "Order ready for service"
                            : remainingMinutes === null
                            ? "ETA not set"
                            : remainingMinutes > 0
                            ? `${remainingMinutes} min left`
                            : "Time up"}
                        </div>
                      </div>

                      {/* Items */}
                      <div className="min-w-0">
                        <span className="lg:hidden mb-1 block text-[13px] font-bold uppercase tracking-wide text-slate-400">Items</span>
                        <div className="w-full space-y-2 sm:min-w-[220px]">
                          {(order.items || []).map((item, index) => (
                            <div
                              key={index}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] border border-slate-100 bg-slate-50/70 px-3 py-2.5 sm:flex-nowrap sm:gap-3"
                            >
                              <div className="min-w-0">
                                <div className="break-words text-[17px] font-semibold text-slate-900">
                                  {item.name || item.item_name}
                                </div>
                                <div className="text-[14px] text-slate-400">
                                  Qty: {item.qty ?? item.quantity ?? "-"}
                                </div>
                              </div>
                              <div className="shrink-0 text-[17px] font-bold text-slate-600">Rs. {item.price}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Total */}
                      <div>
                        <span className="lg:hidden mb-1 block text-[13px] font-bold uppercase tracking-wide text-slate-400">Total</span>
                        <div className="text-[20px] font-black text-slate-900 sm:text-[22px]">Rs. {total}</div>
                      </div>

                      {/* Actions */}
                      <div className="min-w-0">
                        <span className="lg:hidden mb-1 block text-[13px] font-bold uppercase tracking-wide text-slate-400">Actions</span>
                        <div className="flex w-full flex-col gap-2 sm:min-w-[180px]">
                          {status !== "Ready" && status !== "Preparing" ? (
                            <button
                              type="button"
                              onClick={() => markOrderPreparing(order)}
                              className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-amber-400 px-4 py-2.5 text-[16px] font-bold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                            >
                              <FiClock />
                              Start Preparing
                            </button>
                          ) : null}
                          {status === "Preparing" ? (
                            <button
                              type="button"
                              onClick={() => markOrderReady(order)}
                              className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 px-4 py-2.5 text-[16px] font-bold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                            >
                              <FiCheckCircle />
                              Order Ready
                            </button>
                          ) : null}
                          {/* Room-order ready: show waiter assignment card inline */}
                          {/*
                          {status === "Ready" && entityType === "Room" ? (
                            <WaiterAssignmentCard
                              order={order}
                              onAssigned={(id, data) => {
                                global.io?.emit("room-service-waiter-assigned", { kitchenOrderId: id });
                              }}
                              onDelivered={(id, data) => {
                                fetchOrders();
                                showNotice("success", "Delivery confirmed. Charge posted to guest folio.");
                              }}
                            />
                          ) : null}
                          */}
                          <button
                            type="button"
                            onClick={() => openCancelOrderModal(order)}
                            className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-rose-600 to-rose-500 px-4 py-2.5 text-[16px] font-bold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                          >
                            <FiXCircle />
                            Cancel Order
                          </button>
                          <button
                            type="button"
                            onClick={() => printBill(order)}
                            className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-[16px] font-bold text-slate-600 transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                          >
                            <FiPrinter />
                            Print
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-[26px] border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center sm:p-10 lg:p-14">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
                  <FiAlertCircle className="text-3xl text-blue-400" />
                </div>
                <div className="text-[20px] font-black text-slate-900 sm:text-[22px]">No orders in kitchen queue</div>
                <div className="mx-auto mt-2 max-w-md text-[17px] leading-7 text-slate-500 sm:text-[20px] sm:leading-8">
                  New orders from the restaurant will automatically appear here as they come in
                </div>
              </div>
            )}

            {renderPagination(currentPage, totalVisiblePages, setCurrentPage)}
          </div>
        </section>

        {/* ── CANCELLED ORDERS ─────────────────────────────────────────── */}
        {cancelledOrders.length ? (
          <section className="rounded-[30px] border border-white/70 bg-white/90 p-4 shadow-[0_20px_55px_rgba(30,64,175,0.08)] backdrop-blur-xl sm:p-7 lg:p-8">
            <div className="mb-6">
              <p className="text-[15px] font-bold uppercase tracking-[0.24em] text-rose-400">
                Cancelled Orders
              </p>
              <h2 className="mt-1 text-[24px] font-black text-slate-900 sm:text-[30px] lg:text-[34px]">
                Cancelled kitchen records
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:[grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
              {paginatedCancelledOrders.map((order) => {
                const ref = order.table || order.table_number || order.table_no;
                const entityType = resolveEntityType(order);
                const total = (order.items || []).reduce((sum, item) => {
                  const qty = Number(item.qty ?? item.quantity ?? 0);
                  return sum + Number(item.price || 0) * qty;
                }, 0);

                return (
                  <div
                    key={`cancelled-${order.id}`}
                    className="rounded-[24px] border border-rose-100 bg-rose-50/50 p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[14px] font-bold uppercase tracking-[0.18em] text-rose-400">
                          Reference
                        </div>
                        <div className="mt-2 break-words text-[20px] font-black text-slate-900 sm:text-[22px] lg:text-[24px]">
                          {entityType} {ref || "--"}
                        </div>
                        <div className="mt-1 text-[15px] text-slate-400">
                          Order #{order.id}
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full bg-rose-100 px-4 py-1.5 text-[15px] font-bold text-rose-600">
                        Cancelled
                      </span>
                    </div>

                    <div className="mt-4 break-words rounded-[16px] border border-rose-100 bg-white/70 px-4 py-4 text-[17px] text-slate-600">
                      {order.readyMessage || `${entityType} ${ref || "--"} order cancelled.`}
                    </div>

                    <div className="mt-4 text-[17px] text-slate-500">
                      Total: <span className="text-[20px] font-black text-slate-900">Rs. {total}</span>
                    </div>
                    <div className="mt-2 text-[15px] font-semibold text-rose-500">
                      Cancelled order amounts are not added to accounts.
                    </div>
                    <div className="mt-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                        <button
                          type="button"
                          onClick={() => restoreOrder(order)}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-slate-900 to-slate-700 px-4 py-2.5 text-[15px] font-bold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:w-auto"
                        >
                          Restore Order
                        </button>
                        <button
                          type="button"
                          onClick={() => openRemoveOrderModal(order)}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-rose-600 to-rose-500 px-4 py-2.5 text-[15px] font-bold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:w-auto"
                        >
                          Remove Order
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {renderPagination(cancelledPage, totalCancelledPages, setCancelledPage)}
          </section>
        ) : null}
      </div>

      {/* ── CONFIRM MODAL ────────────────────────────────────────────────── */}
      {confirmModal.open ? (
        <div
          className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-950/50 px-4 backdrop-blur-sm"
          onClick={closeConfirmModal}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-[32px] border border-white/70 bg-white shadow-[0_40px_100px_rgba(15,23,42,0.32)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-rose-100 bg-[linear-gradient(135deg,#7f1d1d_0%,#be123c_48%,#ea580c_100%)] px-5 py-6 text-white sm:px-8 sm:py-7">
              <div className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[15px] font-bold uppercase tracking-[0.18em] text-white/90">
                Confirm Action
              </div>
              <h3 className="mt-4 text-[22px] font-black leading-snug sm:text-[30px]">
                {confirmModal.type === "remove-order" ? "Remove cancelled order?" : "Cancel this kitchen order?"}
              </h3>
              <p className="mt-2 text-[16px] leading-6 text-white/85 sm:text-[17px] sm:leading-7">
                {confirmModal.type === "remove-order"
                  ? "This order will be permanently removed from the list."
                  : "The order will be removed from the queue, and the active service flow will be stopped."}
              </p>
            </div>

            <div className="space-y-6 px-5 py-6 sm:px-8 sm:py-7">
              <div className="rounded-[22px] border border-rose-100 bg-rose-50/70 p-5">
                <div className="text-[14px] font-bold uppercase tracking-[0.18em] text-rose-500">Order Reference</div>
                <div className="mt-2 break-words text-[22px] font-black text-slate-900 sm:text-[24px]">
                  {resolveEntityType(confirmModal.order || {})}{" "}
                  {confirmModal.order?.table || confirmModal.order?.table_number || confirmModal.order?.table_no || "--"}
                </div>
                <div className="mt-1 text-[17px] text-slate-500">Order #{confirmModal.order?.id || "--"}</div>
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
                <button
                  type="button"
                  onClick={closeConfirmModal}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-6 py-3 text-[17px] font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50 sm:w-auto"
                >
                  Keep Order
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAction}
                  className="w-full rounded-2xl bg-gradient-to-r from-rose-600 to-orange-500 px-6 py-3 text-[17px] font-semibold text-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg sm:w-auto"
                >
                  {confirmModal.type === "remove-order" ? "Remove Permanently" : "Yes, Cancel Order"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── NOTICE MODAL ─────────────────────────────────────────────────── */}
      {noticeModal.open ? (
        <div
          className="fixed inset-0 z-[1110] flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-sm"
          onClick={() => setNoticeModal((current) => ({ ...current, open: false }))}
        >
          <div
            className={`w-full max-w-md overflow-hidden rounded-[30px] border bg-white shadow-[0_40px_100px_rgba(15,23,42,0.28)] ${
              noticeModal.type === "error" ? "border-rose-200" : "border-emerald-200"
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className={`px-5 py-5 text-white sm:px-7 sm:py-6 ${
                noticeModal.type === "error"
                  ? "bg-[linear-gradient(135deg,#991b1b_0%,#e11d48_100%)]"
                  : "bg-[linear-gradient(135deg,#065f46_0%,#0f766e_100%)]"
              }`}
            >
              <div className="text-[15px] font-bold uppercase tracking-[0.18em] text-white/85">
                {noticeModal.type === "error" ? "Action Failed" : "Action Complete"}
              </div>
              <div className="mt-2 text-[20px] font-black sm:text-[26px]">
                {noticeModal.type === "error" ? "Something went wrong" : "Kitchen updated"}
              </div>
            </div>
            <div className="px-5 py-6 sm:px-7 sm:py-7">
              <p className="break-words text-[17px] leading-7 text-slate-700">{noticeModal.message}</p>
              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => setNoticeModal((current) => ({ ...current, open: false }))}
                  className={`w-full rounded-2xl px-6 py-3 text-[17px] font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:w-auto ${
                    noticeModal.type === "error" ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Kitchen;