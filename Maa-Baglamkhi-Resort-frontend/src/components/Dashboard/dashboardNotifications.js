const NOTIFICATIONS_KEY = "hotel_dashboard_notifications";

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

export const getDashboardNotifications = () => {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_KEY);
    const parsed = safeParse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const pushDashboardNotification = (notification) => {
  const nextItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: notification?.title || "Notification",
    message: notification?.message || "",
    type: notification?.type || "info",
    route: notification?.route || "",
    meta: notification?.meta || {},
    createdAt: notification?.createdAt || new Date().toISOString(),
  };

  const current = getDashboardNotifications();
  const next = [nextItem, ...current].slice(0, 50);

  try {
    localStorage.setItem(NOTIFICATIONS_KEY, safeStringify(next));
    window.dispatchEvent(new CustomEvent("dashboard-notifications-updated"));
  } catch {
    // ignore
  }

  return nextItem;
};

export const upsertDashboardNotification = (notification, matchKeys = []) => {
  const nextItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: notification?.title || "Notification",
    message: notification?.message || "",
    type: notification?.type || "info",
    route: notification?.route || "",
    meta: notification?.meta || {},
    createdAt: notification?.createdAt || new Date().toISOString(),
  };

  const current = getDashboardNotifications();
  const keyList = Array.isArray(matchKeys) ? matchKeys : [];

  const normalized = current.filter((item) => {
    if (!keyList.length) return true;
    return !(
      (keyList.includes("title") ? item.title === nextItem.title : true) &&
      (keyList.includes("message") ? item.message === nextItem.message : true) &&
      (keyList.includes("route") ? item.route === nextItem.route : true) &&
      (keyList.includes("meta.source") ? item?.meta?.source === nextItem?.meta?.source : true) &&
      (keyList.includes("meta.roomNo") ? String(item?.meta?.roomNo || "") === String(nextItem?.meta?.roomNo || "") : true)
    );
  });

  const next = [nextItem, ...normalized].slice(0, 50);

  try {
    localStorage.setItem(NOTIFICATIONS_KEY, safeStringify(next));
    window.dispatchEvent(new CustomEvent("dashboard-notifications-updated"));
  } catch {
    // ignore
  }

  return nextItem;
};

export const clearDashboardNotifications = () => {
  try {
    localStorage.removeItem(NOTIFICATIONS_KEY);
    window.dispatchEvent(new CustomEvent("dashboard-notifications-updated"));
  } catch {
    // ignore
  }
};
