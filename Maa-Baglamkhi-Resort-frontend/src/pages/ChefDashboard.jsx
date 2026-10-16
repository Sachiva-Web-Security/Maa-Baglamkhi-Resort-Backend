import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FiRefreshCw } from "react-icons/fi";

import KitchenOrdersList from "../components/Chef/KitchenOrdersList";
import NotificationsPanel from "../components/Chef/NotificationsPanel";

const ChefDashboard = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [notifCount, setNotifCount] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);

  const loadOrders = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError("");
      const { chefService } = await import("../services/chefService");
      const data = await chefService.getOrders();
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load chef orders", err);
      setError("Kitchen orders could not be loaded.");
      if (!silent) setLoading(false);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      const { chefService } = await import("../services/chefService");
      const data = await chefService.getNotifications();
      const list = Array.isArray(data) ? data : [];
      setNotifications(list);
      setNotifCount(list.filter((n) => !n.is_read).length);
    } catch (err) {
      console.error("Failed to load notifications", err);
    }
  }, []);

  useEffect(() => {
    loadOrders(false);
    loadNotifications();
  }, [loadOrders, loadNotifications]);

  // Auto-refresh every 30s, also on tab focus
  useEffect(() => {
    const interval = setInterval(() => loadOrders(true), 30000);
    const onFocus = () => {
      loadOrders(true);
      loadNotifications();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [loadOrders, loadNotifications]);

  const handleStatusUpdate = async (orderId, payload) => {
    try {
      const { chefService } = await import("../services/chefService");
      await chefService.updateOrderStatus(orderId, payload);
      loadOrders(true);
      loadNotifications();
    } catch (err) {
      console.error("Status update failed", err);
      setError(err.response?.data?.message || "Status update failed.");
    }
  };

  const handleMarkRead = async (id) => {
    try {
      const { chefService } = await import("../services/chefService");
      await chefService.markNotificationRead(id);
      loadNotifications();
    } catch (err) {
      console.error("Mark read failed", err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const { chefService } = await import("../services/chefService");
      await chefService.markAllNotificationsRead();
      loadNotifications();
    } catch (err) {
      console.error("Mark all read failed", err);
    }
  };

  const handleDeleteNotification = async (id) => {
    try {
      const { chefService } = await import("../services/chefService");
      await chefService.deleteNotification(id);
      loadNotifications();
    } catch (err) {
      console.error("Delete notification failed", err);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[linear-gradient(180deg,#f4f8ff_0%,#eef4ff_50%,#f7faff_100%)] p-3 transition-all duration-300 sm:p-5 lg:p-7 xl:p-10">
      {/* Background blobs */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[-6%] top-[-8%] h-72 w-72 rounded-full bg-sky-200/35 blur-3xl sm:h-96 sm:w-96" />
        <div className="absolute right-[-8%] top-[4%] h-72 w-72 rounded-full bg-blue-200/30 blur-3xl sm:h-[26rem] sm:w-[26rem]" />
        <div className="absolute bottom-[10%] left-[22%] h-56 w-56 rounded-full bg-cyan-100/40 blur-3xl sm:h-80 sm:w-80" />
      </div>

      <div className="w-full space-y-6">
        {/* Hero Section */}
        <section className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(120deg,#020617_0%,#1d4ed8_55%,#38bdf8_100%)] px-5 py-6 shadow-[0_30px_70px_rgba(29,78,216,0.28)] sm:px-8 sm:py-7 lg:px-10">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -right-16 -bottom-32 h-96 w-96 rounded-full bg-sky-300/25 blur-3xl" />
            <div className="absolute right-[18%] top-[-10%] h-56 w-56 rounded-full border border-white/10" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:64px_64px] opacity-40" />
          </div>

          <div className="relative z-[1] flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="lg:flex-shrink-0">
              <p className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-[13px] font-semibold uppercase tracking-[0.28em] text-sky-100 backdrop-blur-md">
                Chef Workspace
              </p>
              <h1 className="mt-4 whitespace-normal break-words text-[24px] font-black leading-tight text-white sm:whitespace-nowrap sm:text-[32px] lg:text-[32px]">
                Chef Dashboard
              </h1>
              <p className="mt-2 text-[15px] font-medium text-slate-200">
                Kitchen orders aur notifications yahan manage karein.
              </p>
              <div className="mt-5 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-nowrap sm:items-center sm:overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => { loadOrders(false); loadNotifications(); }}
                  className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-[15px] font-bold text-blue-800 shadow-lg transition-all duration-200 hover:-translate-y-0.5 sm:w-auto"
                >
                  <FiRefreshCw className="text-sky-600" />
                  Refresh
                </button>
              </div>
            </div>

            {/* Notification bell */}
            <div className="relative flex justify-center sm:justify-end">
              <button
                type="button"
                onClick={() => setShowNotifs((prev) => !prev)}
                className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white backdrop-blur-md transition hover:bg-white/15 sm:h-16 sm:w-16"
              >
                <span className="text-[28px] sm:text-[32px]">🔔</span>
                {notifCount > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-6 min-w-[24px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[12px] font-black text-white ring-2 ring-[#1d4ed8]">
                    {notifCount > 99 ? "99+" : notifCount}
                  </span>
                )}
              </button>

              {showNotifs && (
                <NotificationsPanel
                  notifications={notifications}
                  onMarkRead={handleMarkRead}
                  onMarkAllRead={handleMarkAllRead}
                  onDelete={handleDeleteNotification}
                  onClose={() => setShowNotifs(false)}
                />
              )}
            </div>
          </div>
        </section>

        {/* Error banner */}
        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3.5 text-sm font-semibold text-rose-700 shadow-sm">
            {error}
          </div>
        )}

        {/* Kitchen Orders */}
        <KitchenOrdersList
          orders={orders}
          loading={loading}
          onStatusUpdate={handleStatusUpdate}
        />

        {/* Restaurant POS quick link */}
        <section className="rounded-[24px] border border-slate-900/5 bg-white p-5 shadow-[0_4px_16px_rgba(15,23,42,0.04)] sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[13px] font-bold uppercase tracking-[0.18em] text-slate-500">Quick Links</p>
              <h2 className="mt-1 text-[22px] font-bold text-slate-900">Other Workspaces</h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate("/kitchen")}
                className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-2.5 text-[15px] font-bold text-slate-700 transition hover:border-slate-900 hover:bg-slate-900 hover:text-white"
              >
                Kitchen
              </button>
              <button
                type="button"
                onClick={() => navigate("/restaurant")}
                className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-2.5 text-[15px] font-bold text-slate-700 transition hover:border-slate-900 hover:bg-slate-900 hover:text-white"
              >
                Restaurant POS
              </button>
              <button
                type="button"
                onClick={() => navigate("/inventory")}
                className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-2.5 text-[15px] font-bold text-slate-700 transition hover:border-slate-900 hover:bg-slate-900 hover:text-white"
              >
                Inventory
              </button>
              <button
                type="button"
                onClick={() => navigate("/profile")}
                className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-2.5 text-[15px] font-bold text-slate-700 transition hover:border-slate-900 hover:bg-slate-900 hover:text-white"
              >
                My Profile
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ChefDashboard;
