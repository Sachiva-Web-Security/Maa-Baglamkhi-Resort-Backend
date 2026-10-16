import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

const NOTIFICATIONS_KEY = "waiter_notifications";

const safeParse = (value) => {
  try {
    return value ? JSON.parse(value) : [];
  } catch {
    return [];
  }
};

const safeStringify = (value) => {
  try {
    return JSON.stringify(value || []);
  } catch {
    return "[]";
  }
};

export const getWaiterNotifications = () => {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_KEY);
    const parsed = safeParse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const pushWaiterNotification = (notification) => {
  const nextItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: notification?.title || "Notification",
    message: notification?.message || "",
    type: notification?.type || "info",
    route: notification?.route || "",
    meta: notification?.meta || {},
    read: false,
    createdAt: notification?.createdAt || new Date().toISOString(),
  };

  const current = getWaiterNotifications();
  const next = [nextItem, ...current].slice(0, 50);

  try {
    localStorage.setItem(NOTIFICATIONS_KEY, safeStringify(next));
    window.dispatchEvent(new CustomEvent("waiter-notifications-updated"));
  } catch {
    // ignore
  }

  return nextItem;
};

export const markWaiterNotificationRead = (id) => {
  const current = getWaiterNotifications();
  const next = current.map((item) => (item.id === id ? { ...item, read: true } : item));
  try {
    localStorage.setItem(NOTIFICATIONS_KEY, safeStringify(next));
    window.dispatchEvent(new CustomEvent("waiter-notifications-updated"));
  } catch {
    // ignore
  }
};

export const markAllWaiterNotificationsRead = () => {
  const current = getWaiterNotifications();
  const next = current.map((item) => ({ ...item, read: true }));
  try {
    localStorage.setItem(NOTIFICATIONS_KEY, safeStringify(next));
    window.dispatchEvent(new CustomEvent("waiter-notifications-updated"));
  } catch {
    // ignore
  }
};

export const clearWaiterNotifications = () => {
  try {
    localStorage.setItem(NOTIFICATIONS_KEY, "[]");
    window.dispatchEvent(new CustomEvent("waiter-notifications-updated"));
  } catch {
    // ignore
  }
};

const WaiterNotificationPanel = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [activeTab, setActiveTab] = useState("all");

  const loadNotifications = useCallback(() => {
    setNotifications(getWaiterNotifications());
  }, []);

  useEffect(() => {
    loadNotifications();
    const handler = () => loadNotifications();
    window.addEventListener("waiter-notifications-updated", handler);
    return () => window.removeEventListener("waiter-notifications-updated", handler);
  }, [loadNotifications]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = () => loadNotifications();
    window.addEventListener("kitchenUpdated", handler);
    return () => window.removeEventListener("kitchenUpdated", handler);
  }, [isOpen, loadNotifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filteredNotifications =
    activeTab === "unread"
      ? notifications.filter((n) => !n.read)
      : activeTab === "ready"
      ? notifications.filter((n) => n.type === "ready")
      : notifications;

  const handleNotificationClick = (notification) => {
    markWaiterNotificationRead(notification.id);
    if (notification.route) {
      navigate(notification.route);
      onClose?.();
    }
  };

  const handleMarkAllRead = () => {
    markAllWaiterNotificationsRead();
    loadNotifications();
  };

  const handleClearAll = () => {
    clearWaiterNotifications();
    loadNotifications();
  };

  const getTypeConfig = (type) => {
    switch (type) {
      case "ready":
        return { icon: "✅", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" };
      case "warning":
        return { icon: "⚠️", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" };
      case "kitchen":
        return { icon: "🍳", color: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/30" };
      default:
        return { icon: "🔔", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30" };
    }
  };

  const formatTime = (timestamp) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diff = now - date;
      const minutes = Math.floor(diff / 60000);
      if (minutes < 1) return "Just now";
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;
      return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    } catch {
      return "";
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1050] flex items-start justify-end pt-16 px-4 sm:px-6">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-hidden rounded-[24px] border border-white/10 bg-[#0b1728] shadow-[0_30px_80px_rgba(0,0,0,0.5)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400">
              🔔
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Notifications</h3>
              <p className="text-xs text-slate-400">
                {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="rounded-lg px-3 py-1.5 text-xs font-bold text-blue-400 transition hover:bg-blue-500/10"
              >
                Mark all read
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          {[
            { key: "all", label: "All" },
            { key: "unread", label: `Unread${unreadCount > 0 ? ` (${unreadCount})` : ""}` },
            { key: "ready", label: `Ready` },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-3 text-sm font-bold transition ${
                activeTab === tab.key
                  ? "border-b-2 border-blue-500 text-blue-400"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Notification List */}
        <div className="max-h-[400px] overflow-y-auto">
          {filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-3 text-3xl text-slate-600">🔔</div>
              <p className="text-sm font-semibold text-slate-400">No notifications</p>
              <p className="mt-1 text-xs text-slate-500">
                {activeTab === "ready"
                  ? "Ready orders will appear here"
                  : activeTab === "unread"
                  ? "All notifications have been read"
                  : "You're all caught up!"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {filteredNotifications.map((notification) => {
                const typeConfig = getTypeConfig(notification.type);

                return (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`cursor-pointer transition hover:bg-white/5 ${
                      !notification.read ? typeConfig.bg : ""
                    }`}
                  >
                    <div className="flex gap-3 px-5 py-3.5">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${typeConfig.bg}`}
                      >
                        <span className="text-base">{typeConfig.icon}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={`text-sm font-semibold ${!notification.read ? "text-white" : "text-slate-300"}`}
                          >
                            {notification.title}
                          </p>
                          {!notification.read && (
                            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-slate-400 line-clamp-2">{notification.message}</p>
                        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                          <span>🕐</span>
                          {formatTime(notification.createdAt)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="flex items-center justify-between border-t border-white/10 px-5 py-3">
            <button
              type="button"
              onClick={handleClearAll}
              className="text-xs font-semibold text-rose-400 transition hover:text-rose-300"
            >
              Clear all
            </button>
            <button
              type="button"
              onClick={() => {
                navigate("/restaurant/room-items");
                onClose?.();
              }}
              className="text-xs font-semibold text-blue-400 transition hover:text-blue-300"
            >
              View Room Orders →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WaiterNotificationPanel;
