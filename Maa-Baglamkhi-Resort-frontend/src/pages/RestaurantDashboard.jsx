import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FaCashRegister,
  FaChair,
  FaClipboardCheck,
  FaReceipt,
  FaUtensils,
} from "react-icons/fa";

import RoleDashboardShell from "../components/roleDashboards/RoleDashboardShell";
import useDashboardAutoRefresh from "../hooks/useDashboardAutoRefresh";
import { restaurantService } from "../services/restaurantService";
import { getRestaurantSocket, releaseRestaurantSocket } from "../utils/restaurantSocket";
import { getCurrentActor } from "../utils/currentActor";

const normalizeName = (value) => String(value || "").trim().toLowerCase();

const RestaurantDashboard = () => {
  const actor = getCurrentActor() || {};
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [orders, setOrders] = useState([]);
  const [kitchenOrders, setKitchenOrders] = useState([]);
  const [readyNotification, setReadyNotification] = useState(null);

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError("");
      const [ordersData, kitchenData] = await Promise.all([
        restaurantService.getOrders(),
        restaurantService.getKitchenOrders(),
      ]);

      setOrders(Array.isArray(ordersData) ? ordersData : []);
      setKitchenOrders(Array.isArray(kitchenData) ? kitchenData : []);
    } catch (err) {
      setError("Restaurant dashboard data could not be loaded.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useDashboardAutoRefresh(load);

  useEffect(() => {
    let activeSocket = null;
    let unsubscribed = false;
    const currentUserName = normalizeName(localStorage.getItem("name"));
    const currentRole = normalizeName(localStorage.getItem("role"));

    const setupSocket = async () => {
      const socket = await getRestaurantSocket();
      if (!socket || unsubscribed) return;
      activeSocket = socket;

      const onReady = (payload = {}) => {
        const assignedWaiter = normalizeName(payload.waiter);
        if (!assignedWaiter || !currentUserName) return;
        if (assignedWaiter !== currentUserName) return;
        if (currentRole !== "waiter" && currentRole !== "admin" && currentRole !== "manager") return;

        setReadyNotification({
          orderId: payload.id,
          waiter: payload.waiter,
          referenceLabel:
            payload.referenceLabel ||
            `${String(payload.entityType || "Table")} ${payload.table || "--"}`,
          message:
            payload.readyMessage ||
            `${String(payload.entityType || "Table")} ${payload.table || "--"} order ready hai. Serve on the ${String(payload.entityType || "table").toLowerCase()}.`,
        });
        load(true);
      };

      socket.on("kitchen-order-ready", onReady);
      return () => {
        socket.off("kitchen-order-ready", onReady);
      };
    };

    const teardownPromise = setupSocket();
    return () => {
      unsubscribed = true;
      Promise.resolve(teardownPromise).then((teardown) => teardown && teardown());
      activeSocket = null;
      releaseRestaurantSocket();
    };
  }, [load]);

  const activeTables = useMemo(
    () =>
      new Set(
        orders.map((item) => item.tableNumber || item.table || item.roomNumber).filter(Boolean)
      ).size,
    [orders]
  );

  const runningOrders = useMemo(
    () =>
      orders.filter((item) => !String(item.status || "").toLowerCase().includes("paid")).length,
    [orders]
  );

  const stats = useMemo(() => [
    { label: "Active Tables", value: activeTables, note: "Tables or room refs with live order activity.", icon: FaChair, tone: "cyan" },
    { label: "Running Orders", value: runningOrders, note: "Orders not yet fully settled or closed.", icon: FaUtensils, tone: "amber" },
    { label: "Ready KOT", value: kitchenOrders.filter((item) => String(item.status || "").toLowerCase().includes("ready")).length, note: "Kitchen tickets ready for service handover.", icon: FaClipboardCheck, tone: "emerald" },
    { label: "Billing Shortcut", value: orders.filter((item) => String(item.status || "").toLowerCase().includes("paid")).length, note: "Completed or billed orders visible in the system.", icon: FaReceipt, tone: "violet" },
  ], [activeTables, kitchenOrders, orders, runningOrders]);

  const insights = useMemo(() => [
    {
      label: "Order Queue",
      value: orders.length,
      note: "Restaurant order count currently tracked in the POS layer.",
    },
    {
      label: "Kitchen Dependency",
      value: kitchenOrders.filter((item) => String(item.status || "").toLowerCase().includes("prepar")).length,
      note: "Orders still waiting on kitchen completion.",
    },
    {
      label: "Settlement Ready",
      value: kitchenOrders.filter((item) => String(item.status || "").toLowerCase().includes("ready")).length,
      note: "Ready dishes that can move to billing and serving.",
    },
  ], [kitchenOrders, orders.length]);

  const table = useMemo(() => ({
    eyebrow: "Service Queue",
    title: "Running order overview",
    meta: `${orders.length} active records`,
    columns: [
      { key: "ref", label: "Reference", render: (row) => row.tableNumber || row.table || row.roomNumber || "--" },
      { key: "orderId", label: "Order ID", render: (row) => row.orderId || row.id || "--" },
      { key: "itemCount", label: "Items", render: (row) => row.itemCount || row.qty || row.items?.length || "--" },
      { key: "status", label: "Status" },
      { key: "amount", label: "Amount", render: (row) => row.totalAmount || row.amount || "--" },
    ],
    rows: orders.slice(0, 10),
    emptyText: "No restaurant orders are currently visible.",
  }), [orders]);

  return (
    <>
      <RoleDashboardShell
        badge="Restaurant Service"
        title="Waiter dashboard for tables and running orders"
        description="Active tables, running orders, KOT readiness aur billing shortcuts ko service team ke liye role-specific tarike se dikhaya gaya hai."
        stats={stats}
        quickActions={[
          { label: "My Tables", helper: "Assigned ya available tables se waiter flow start karein.", route: "/restaurant", icon: FaCashRegister, tone: "cyan" },
          { label: "My Bills", helper: "Generated aur settled waiter-linked bills dekhein.", route: "/restaurant/payment-bills", icon: FaReceipt, tone: "emerald" },
          { label: "Running Orders", helper: "Open token items aur service records review karein.", route: "/restaurant", icon: FaClipboardCheck, tone: "amber" },
          { label: "Kitchen Queue", helper: actor.isWaiter ? "Ready aur preparing KOT updates live dekhein." : "Kitchen workspace kholein.", route: actor.isWaiter ? "/restaurant" : "/kitchen", icon: FaUtensils, tone: "violet" },
        ]}
        insights={insights}
        table={table}
        loading={loading}
        error={error}
      />

      {readyNotification ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/50 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-white/30 bg-white p-6 shadow-[0_32px_80px_rgba(15,23,42,0.24)]">
            <div className="rounded-[22px] bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_55%,#0f766e_100%)] px-5 py-5 text-white">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-100/80">Service Alert</p>
              <h3 className="mt-2 text-2xl font-black">Order Ready</h3>
              <p className="mt-2 text-sm text-white/85">{readyNotification.referenceLabel}</p>
            </div>

            <div className="mt-5 rounded-[20px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-semibold text-emerald-800">
              {readyNotification.message}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setReadyNotification(null)}
                className="rounded-full bg-slate-900 px-5 py-3 text-sm font-bold text-white"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default RestaurantDashboard;
