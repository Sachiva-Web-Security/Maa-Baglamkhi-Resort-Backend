export const DASHBOARD_SEARCH_TARGETS = [
  { label: "Dashboard", route: "/dashboard", helper: "Operational snapshot", keywords: ["dashboard", "home", "snapshot"] },
  { label: "Stay Overview", route: "/stayover", helper: "Room status board", keywords: ["stayover", "stay overview", "room board", "availability"] },
  { label: "Housekeeping", route: "/housekeeping", helper: "Cleaning log and assignments", keywords: ["housekeeping", "cleaning", "timer", "cleaning log"] },
  { label: "All Bookings", route: "/hotel/all-bookings", helper: "Active booking list", keywords: ["all booking", "all bookings", "booking", "active booking"] },
  { label: "Booking History", route: "/hotel/booking-history", helper: "Past booking records", keywords: ["history", "booking history", "past booking"] },
  { label: "Guest Booking", route: "/hotel/guest", helper: "New booking entry", keywords: ["guest", "new booking", "book room", "booking steps"] },
  { label: "Communication", route: "/hotel/communication", helper: "Invoice and guest communication", keywords: ["communication", "message", "invoice", "check in", "check out"] },
  { label: "Attendance", route: "/attendance", helper: "Staff attendance tracker", keywords: ["attendance", "staff", "punch"] },
  { label: "Accounts", route: "/accounts", helper: "Revenue and finance", keywords: ["accounts", "finance", "revenue", "income"] },
  { label: "Inventory", route: "/inventory", helper: "Stock and item control", keywords: ["inventory", "stock", "item"] },
  { label: "Users", route: "/user", helper: "User management", keywords: ["user", "users", "staff", "employee"] },
  { label: "Reports", route: "/reports", helper: "Summary and analytics", keywords: ["reports", "report", "analytics"] },
  { label: "Audit Logs", route: "/reports/audit", helper: "Security and activity trail", keywords: ["audit", "audit log", "activity log", "history"] },
  { label: "Kitchen", route: "/kitchen", helper: "Kitchen status", keywords: ["kitchen", "food", "prep"] },
  { label: "Restaurant", route: "/restaurant", helper: "Restaurant dashboard", keywords: ["restaurant", "table", "menu"] },
  { label: "Banquet", route: "/banquet", helper: "Event and hall ops", keywords: ["banquet", "hall", "event"] },
];

export const getDashboardSearchResults = (query) => {
  const normalized = String(query || "").trim().toLowerCase();

  if (!normalized) {
    return DASHBOARD_SEARCH_TARGETS.slice(0, 6);
  }

  const tokens = normalized.split(/\s+/).filter(Boolean);
  return DASHBOARD_SEARCH_TARGETS.filter((item) => {
    const haystack = [item.label, item.route, item.helper, ...(item.keywords || [])]
      .join(" ")
      .toLowerCase();
    return tokens.every((token) => haystack.includes(token));
  }).slice(0, 8);
};
