import { useState, useCallback } from "react";
import { FiCheckCircle, FiXCircle, FiTrash2, FiClock } from "react-icons/fi";

const getTypeConfig = (type) => {
  switch (String(type || "").toLowerCase()) {
    case "success":
    case "ready":
      return { icon: FiCheckCircle, color: "text-emerald-500", bg: "bg-emerald-50 border-emerald-200" };
    case "warning":
      return { icon: FiXCircle, color: "text-amber-500", bg: "bg-amber-50 border-amber-200" };
    case "error":
      return { icon: FiXCircle, color: "text-rose-500", bg: "bg-rose-50 border-rose-200" };
    case "kitchen":
      return { icon: "🍳", color: "text-blue-500", bg: "bg-blue-50 border-blue-200" };
    default:
      return { icon: "🔔", color: "text-slate-500", bg: "bg-slate-50 border-slate-200" };
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

const NotificationsPanel = ({ notifications, onMarkRead, onMarkAllRead, onDelete, onClose }) => {
  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const [activeTab, setActiveTab] = useState("all");
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const filtered = activeTab === "unread"
    ? notifications.filter((n) => !n.is_read)
    : notifications;

  const handleClick = (notification) => {
    if (!notification.is_read) {
      onMarkRead(notification.id);
    }
  };

  if (!onClose) {
    // Full-page mode (when navigated to /chef/dashboard as a full page)
    return null; // We don't use full-page mode in this implementation
  }

  // Dropdown panel mode
  return (
    <div className="absolute right-0 top-full z-50 mt-3 w-[380px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[24px] border border-white/10 bg-[#0b1728] shadow-[0_30px_80px_rgba(0,0,0,0.5)]">
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
              onClick={onMarkAllRead}
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
      <div className="max-h-[420px] overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-3 text-3xl text-slate-600">🔔</div>
            <p className="text-sm font-semibold text-slate-400">No notifications</p>
            <p className="mt-1 text-xs text-slate-500">You're all caught up!</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filtered.map((notification) => {
              const typeConfig = getTypeConfig(notification.type);
              const TypeIcon = typeof typeConfig.icon === "function" ? typeConfig.icon : null;

              return (
                <div
                  key={notification.id}
                  onClick={() => handleClick(notification)}
                  className={`cursor-pointer transition hover:bg-white/5 ${
                    !notification.is_read ? typeConfig.bg : ""
                  }`}
                >
                  <div className="flex gap-3 px-5 py-3.5">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${typeConfig.bg}`}
                    >
                      {TypeIcon ? (
                        <TypeIcon className={`text-base ${typeConfig.color}`} />
                      ) : (
                        <span className="text-base">{typeConfig.icon}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={`text-sm font-semibold ${
                            !notification.is_read ? "text-white" : "text-slate-300"
                          }`}
                        >
                          {notification.title || "Notification"}
                        </p>
                        {!notification.is_read && (
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                        )}
                      </div>
                      {notification.message && (
                        <p className="mt-0.5 text-xs text-slate-400 line-clamp-2">
                          {notification.message}
                        </p>
                      )}
                      <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                        <FiClock className="text-[11px]" />
                        {formatTime(notification.created_at)}
                      </div>
                    </div>
                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm("Delete this notification?")) {
                          onDelete(notification.id);
                        }
                      }}
                      className="shrink-0 self-center rounded-lg p-1.5 text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-400"
                      title="Delete"
                    >
                      <FiTrash2 className="text-[13px]" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPanel;
