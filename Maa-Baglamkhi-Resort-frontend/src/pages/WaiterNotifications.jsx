import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaBell,
  FaCheckCircle,
  FaExclamationCircle,
  FaClock,
  FaTrash,
  FaUtensils,
  FaArrowLeft,
} from "react-icons/fa";
import useReadyOrdersCount from "../hooks/useReadyOrdersCount";
import API from "../api";
import { getCurrentActor } from "../utils/currentActor";

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
    return safeParse(raw);
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

const WaiterNotifications = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [activeTab, setActiveTab] = useState("all");
  const { count: readyCount } = useReadyOrdersCount();

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
    const handler = () => loadNotifications();
    window.addEventListener("kitchenUpdated", handler);
    return () => window.removeEventListener("kitchenUpdated", handler);
  }, [loadNotifications]);

  // Listen for waiter-specific notifications
  useEffect(() => {
    const actor = getCurrentActor();
    const waiterId = actor.id;
    const waiterName = actor.name || "";
    const normalizedName = waiterName.toLowerCase().replace(/\s+/g, "_");

    const handler = (key, removeKey) => {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const notification = JSON.parse(raw);
          // Add to main notifications list
          const current = getWaiterNotifications();
          const next = [notification, ...current].slice(0, 50);
          localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(next));
          localStorage.removeItem(removeKey);
          window.dispatchEvent(new CustomEvent("waiter-notifications-updated"));
        }
      } catch (e) {
        console.error("Error loading waiter notification:", e);
      }
    };

    // Set up listeners
    const listeners = [];

    // Listen by waiter ID
    if (waiterId) {
      const idHandler = () => handler(`waiter_notification_id_${waiterId}`, `waiter_notification_id_${waiterId}`);
      window.addEventListener(`waiter-notification-id-${waiterId}`, idHandler);
      listeners.push({ event: `waiter-notification-id-${waiterId}`, handler: idHandler });
    }

    // Listen by waiter name
    if (normalizedName) {
      const nameHandler = () => handler(`waiter_notification_name_${normalizedName}`, `waiter_notification_name_${normalizedName}`);
      window.addEventListener(`waiter-notification-name-${normalizedName}`, nameHandler);
      listeners.push({ event: `waiter-notification-name-${normalizedName}`, handler: nameHandler });
    }

    // Also poll for notifications every 2 seconds as backup
    const pollHandler = () => {
      if (waiterId) {
        handler(`waiter_notification_id_${waiterId}`, `waiter_notification_id_${waiterId}`);
      }
      if (normalizedName) {
        handler(`waiter_notification_name_${normalizedName}`, `waiter_notification_name_${normalizedName}`);
      }
    };
    const interval = setInterval(pollHandler, 2000);

    return () => {
      listeners.forEach(({ event, handler }) => window.removeEventListener(event, handler));
      clearInterval(interval);
    };
  }, []);

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
        return {
          icon: FaCheckCircle,
          color: "text-emerald-500",
          bg: "bg-emerald-50 border-emerald-200",
        };
      case "warning":
        return {
          icon: FaExclamationCircle,
          color: "text-amber-500",
          bg: "bg-amber-50 border-amber-200",
        };
      case "kitchen":
        return {
          icon: FaUtensils,
          color: "text-blue-500",
          bg: "bg-blue-50 border-blue-200",
        };
      default:
        return {
          icon: FaBell,
          color: "text-slate-500",
          bg: "bg-slate-50 border-slate-200",
        };
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 sm:p-6 lg:p-10">
      <div className="w-full">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/restaurant")}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
            >
              <FaArrowLeft className="text-[18px] text-slate-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Notifications</h1>
              <p className="text-[19px] text-slate-500">
                {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-[17px] font-semibold text-white transition hover:bg-blue-700"
              >
                Mark all read
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={handleClearAll}
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-200 transition hover:bg-rose-50 hover:text-rose-600"
              >
                <FaTrash className="text-[16px]" />
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-3 overflow-x-auto pb-2">
          {[
            { key: "all", label: "All", count: notifications.length },
            { key: "unread", label: "Unread", count: unreadCount },
            { key: "ready", label: "Ready Orders", count: readyCount },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`shrink-0 rounded-full px-5 py-2.5 text-[16px] font-semibold transition ${
                activeTab === tab.key
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {tab.label}{" "}
              {tab.count > 0 && (
                <span className="text-[15px] font-semibold">({tab.count})</span>
              )}
            </button>
          ))}
        </div>

        {/* Notification List */}
        <div className="space-y-4">
          {filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-20 shadow-sm ring-1 ring-slate-200">
              <FaBell className="mb-4 text-5xl text-slate-300" />
              <p className="text-[22px] font-semibold text-slate-600">No notifications</p>
              <p className="mt-1 text-[18px] text-slate-400">
                {activeTab === "ready"
                  ? "Ready orders will appear here"
                  : activeTab === "unread"
                  ? "All notifications have been read"
                  : "You're all caught up!"}
              </p>
            </div>
          ) : (
            filteredNotifications.map((notification) => {
              const typeConfig = getTypeConfig(notification.type);
              const TypeIcon = typeConfig.icon;

              return (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`cursor-pointer rounded-2xl border p-5 transition hover:shadow-md ${
                    !notification.read ? typeConfig.bg : "bg-white"
                  } ${!notification.read ? "" : "border-slate-200"}`}
                >
                  <div className="flex gap-4">
                    <div
                      className={`flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl ${typeConfig.bg}`}
                    >
                      <TypeIcon className={`text-2xl ${typeConfig.color}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={`text-[23px] font-semibold ${
                            !notification.read ? "text-slate-800" : "text-slate-600"
                          }`}
                        >
                          {notification.title}
                        </p>
                        {!notification.read && (
                          <span className="mt-2 h-3 w-3 shrink-0 rounded-full bg-blue-500" />
                        )}
                      </div>
                      <p className="mt-1.5 text-[17px] text-slate-500 line-clamp-2">
                        {notification.message}
                      </p>
                      <div className="mt-2.5 flex items-center gap-1.5 text-[15px] text-slate-400">
                        <FaClock className="text-[12px]" />
                        {formatTime(notification.createdAt)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Quick Action */}
        {notifications.length > 0 && (
          <div className="mt-8 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
            <p className="text-[23px] font-semibold">View Ready Orders</p>
            <p className="mt-1 text-[18px] text-blue-100">
              Check which orders are ready for pickup
            </p>
            <button
              onClick={() => navigate("/restaurant/room-items")}
              className="mt-4 rounded-lg bg-white px-5 py-2.5 text-[17px] font-semibold text-blue-700 transition hover:bg-blue-50"
            >
              Go to Room Orders →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WaiterNotifications;