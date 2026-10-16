import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell,
  CheckCircle2,
  Clock3,
  User,
  BedDouble,
  Sparkles,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import API from "../api";

const PAGE_SIZES = [5, 10, 20, 50];

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const normalizeNotification = (row) => ({
  id: row.id,
  room: row.roomNo || row.room_no || row.room || "-",
  assignedTo: row.assignedTo || row.assigned_to || "No Housekeeper",
  receptionist: row.receptionist || "Reception",
  task: row.message || row.taskLabel || row.task_label || "Room Cleaning",
  taskLabel: row.taskLabel || row.task_label || "Room Cleaning",
  sentAt: row.sentAt || row.sent_at,
  dueAt: row.dueAt || row.due_at,
  completedAt: row.completedAt || row.completed_at,
  status: row.status || "New",
});

export default function HousekeeperNotification() {
  const currentUser = localStorage.getItem("name") || "";
  const currentRole = String(localStorage.getItem("role") || "").toLowerCase();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      // Admins/managers see everything; regular housekeepers only see their own.
      // The backend supports `?assignee=` so we don't pull rows we'll have to hide.
      const isPrivileged = ["admin", "manager"].includes(currentRole);
      const params = isPrivileged ? {} : currentUser ? { assignee: currentUser } : { status: "None" };
      const response = await API.get("/housekeeping/notifications", { params });
      const rows = Array.isArray(response.data) ? response.data : [];
      // Default: hide Completed unless the user is privileged and the call returned the full set.
      const filtered = isPrivileged
        ? rows
        : rows.filter((row) => String(row.status).toLowerCase() !== "completed");
      setNotifications(filtered.map(normalizeNotification));
      setCurrentPage(1);
    } catch {
      setError("Housekeeping notifications could not be loaded.");
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [currentRole, currentUser]);

  useEffect(() => {
    fetchNotifications();

    // Auto-refresh so newly-assigned tasks from /stayover or /dashboard
    // surface without a manual reload.
    const intervalId = globalThis.setInterval(fetchNotifications, 30000);
    const onFocus = () => fetchNotifications();
    globalThis.addEventListener("focus", onFocus);

    return () => {
      globalThis.clearInterval(intervalId);
      globalThis.removeEventListener("focus", onFocus);
    };
  }, [fetchNotifications]);

  const canComplete = (item) => {
    if (["admin", "manager"].includes(currentRole)) return true;
    return Boolean(currentUser) && item.assignedTo === currentUser;
  };

  const completeTask = async (id) => {
    const previous = notifications;
    setNotifications((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, status: "Completed", completedAt: new Date().toISOString() }
          : item,
      ),
    );

    try {
      await API.put(`/housekeeping/notifications/${id}/complete`);

      // Small pause so the housekeeper sees the confirmation message
      // before the card is removed by the Completed filter below.
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Re-fetch so the row is either refreshed or vanishes from the
      // housekeeper's list (Completed items are filtered out for them).
      await fetchNotifications();
    } catch {
      setNotifications(previous);
      setError("Task completion could not be updated. Please retry.");
    }
  };

  const total = notifications.length;
  const completed = notifications.filter((n) => n.status === "Completed").length;
  const pending = notifications.filter((n) => n.status !== "Completed").length;
  const assignedToYou = useMemo(
    () => notifications.filter((n) => currentUser && n.assignedTo === currentUser).length,
    [currentUser, notifications],
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize]);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return notifications.slice(start, start + pageSize);
  }, [notifications, safePage, pageSize]);

  const goToPage = (page) => {
    const p = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(p);
  };

  const getPageRange = () => {
    const delta = 2;
    const range = [];
    const left = Math.max(1, safePage - delta);
    const right = Math.min(totalPages, safePage + delta);
    for (let i = left; i <= right; i++) range.push(i);
    return range;
  };

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-100 p-3 sm:p-6 lg:p-10">
      <div className="rounded-2xl bg-gradient-to-r from-blue-900 via-blue-700 to-sky-500 p-5 text-white shadow-2xl sm:rounded-3xl sm:p-8">
        <div className="flex flex-col gap-6 sm:gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1.5 sm:gap-3 sm:px-5 sm:py-2">
              <Bell className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" />
              <span className="text-xs font-semibold sm:text-sm">Housekeeping Notifications</span>
            </div>

            <h1 className="mt-4 text-2xl font-extrabold sm:mt-5 sm:text-3xl lg:text-4xl">
              Task Assignment Center
            </h1>

            <p className="mt-2 max-w-2xl text-sm text-blue-100 sm:mt-3 sm:text-lg">
              Real room assignments sent from reception and the cleaning log panel.
            </p>
          </div>

          <div className="flex h-16 w-16 shrink-0 items-center justify-center self-start rounded-full bg-white/15 backdrop-blur-xl sm:h-24 sm:w-24 lg:h-32 lg:w-32 lg:self-auto">
            <Bell className="h-8 w-8 text-white sm:h-12 sm:w-12 lg:h-16 lg:w-16" />
          </div>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 sm:mt-6 sm:px-5 sm:py-4 sm:text-base">
          {error}
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:mt-8 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4">
        <div className="rounded-2xl bg-white p-4 shadow-xl sm:rounded-3xl sm:p-6">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-sm text-slate-500 sm:text-base">Total Notifications</p>
              <h2 className="mt-1 text-2xl font-bold text-blue-900 sm:mt-2 sm:text-4xl">{total}</h2>
            </div>
            <div className="shrink-0 rounded-2xl bg-blue-100 p-3 sm:p-4">
              <Bell className="h-6 w-6 text-blue-700 sm:h-8 sm:w-8" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-xl sm:rounded-3xl sm:p-6">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-sm text-slate-500 sm:text-base">Pending Tasks</p>
              <h2 className="mt-1 text-2xl font-bold text-orange-500 sm:mt-2 sm:text-4xl">{pending}</h2>
            </div>
            <div className="shrink-0 rounded-2xl bg-orange-100 p-3 sm:p-4">
              <Clock3 className="h-6 w-6 text-orange-500 sm:h-8 sm:w-8" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-xl sm:rounded-3xl sm:p-6">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-sm text-slate-500 sm:text-base">Completed</p>
              <h2 className="mt-1 text-2xl font-bold text-green-600 sm:mt-2 sm:text-4xl">{completed}</h2>
            </div>
            <div className="shrink-0 rounded-2xl bg-green-100 p-3 sm:p-4">
              <CheckCircle2 className="h-6 w-6 text-green-600 sm:h-8 sm:w-8" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-xl sm:rounded-3xl sm:p-6">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-sm text-slate-500 sm:text-base">Assigned To You</p>
              <h2 className="mt-1 text-2xl font-bold text-sky-600 sm:mt-2 sm:text-4xl">{assignedToYou}</h2>
            </div>
            <div className="shrink-0 rounded-2xl bg-sky-100 p-3 sm:p-4">
              <User className="h-6 w-6 text-sky-600 sm:h-8 sm:w-8" />
            </div>
          </div>
        </div>
      </div>

      {/* Results info */}
      {!loading && total > 0 && (
        <p className="mt-4 text-xs font-medium text-slate-500 sm:mt-6 sm:text-sm">
          Showing {Math.min((safePage - 1) * pageSize + 1, total)} –{" "}
          {Math.min(safePage * pageSize, total)} of {total} notifications
        </p>
      )}

      <div className="mt-3 space-y-4 sm:mt-4 sm:space-y-6">
        {loading ? (
          <div className="rounded-2xl bg-white p-6 text-center text-base font-semibold text-slate-500 shadow-xl sm:rounded-3xl sm:p-10 sm:text-lg">
            Loading housekeeping notifications...
          </div>
        ) : pageItems.length === 0 ? (
          <div className="rounded-2xl bg-white p-6 text-center shadow-xl sm:rounded-3xl sm:p-10">
            {currentUser ? (
              <>
                <p className="text-base font-semibold text-slate-700 sm:text-lg">
                  No housekeeping tasks assigned to {currentUser} yet.
                </p>
                <p className="mt-2 text-sm font-medium text-slate-500">
                  Tasks assigned from the Stay Overview or Dashboard will show up here automatically.
                </p>
              </>
            ) : (
              <p className="text-base font-semibold text-slate-700 sm:text-lg">
                Please log in to view your housekeeping tasks.
              </p>
            )}
          </div>
        ) : (
          pageItems.map((item) => {
            const isMine = Boolean(currentUser) && item.assignedTo === currentUser;
            const allowedToComplete = canComplete(item);

            return (
              <div
                key={item.id}
                className="rounded-2xl border border-blue-100 bg-white shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl sm:rounded-3xl"
              >
                <div className="p-4 sm:p-6 lg:p-8">
                  <div className="flex flex-col gap-5 sm:gap-6 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-1 gap-3 sm:gap-5 min-w-0">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-900 to-sky-500 text-white shadow-lg sm:h-16 sm:w-16">
                        <BedDouble className="h-6 w-6 sm:h-8 sm:w-8" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                          <h2 className="break-words text-lg font-bold text-slate-900 sm:text-2xl">
                            Room {item.room}
                          </h2>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold sm:px-4 sm:text-sm ${
                              item.status === "Completed"
                                ? "bg-green-100 text-green-700"
                                : item.status === "In Progress"
                                  ? "bg-orange-100 text-orange-700"
                                  : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {item.status}
                          </span>
                        </div>

                        <p className="mt-2 break-words text-sm text-slate-600 sm:mt-3 sm:text-base">
                          <span className="font-semibold text-blue-800">Receptionist:</span> {item.receptionist}
                        </p>

                        <p className="mt-1 break-words text-sm text-slate-600 sm:text-base">
                          <span className="font-semibold text-blue-800">Assigned To:</span> {item.assignedTo}
                        </p>

                        <p className="mt-1 break-words text-sm text-slate-600 sm:text-base">
                          <span className="font-semibold text-blue-800">Message:</span> {item.task}
                        </p>

                        <p className="mt-1 break-words text-sm text-slate-600 sm:text-base">
                          <span className="font-semibold text-blue-800">Task:</span> {item.taskLabel}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500 sm:mt-4 sm:gap-6 sm:text-sm">
                          <div className="flex items-center gap-2">
                            <CalendarDays size={16} className="shrink-0 sm:hidden" />
                            <CalendarDays size={18} className="hidden shrink-0 sm:block" />
                            Sent {formatDate(item.sentAt)}
                          </div>

                          <div className="flex items-center gap-2">
                            <Clock3 size={16} className="shrink-0 sm:hidden" />
                            <Clock3 size={18} className="hidden shrink-0 sm:block" />
                            {formatTime(item.sentAt)}
                          </div>

                          <div className="flex items-center gap-2 font-semibold text-orange-600">
                            <Clock3 size={16} className="shrink-0 sm:hidden" />
                            <Clock3 size={18} className="hidden shrink-0 sm:block" />
                            Due {formatDate(item.dueAt)} {formatTime(item.dueAt)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-stretch gap-3 sm:gap-4 lg:items-end">
                      {allowedToComplete ? (
                        item.status === "Completed" ? (
                          <div className="flex flex-col items-stretch gap-2 lg:items-end">
                            <div className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-100 px-4 py-2.5 text-sm font-semibold text-emerald-700 sm:justify-start sm:px-5 sm:py-3 sm:text-base">
                              <CheckCircle2 size={18} className="shrink-0 sm:hidden" />
                              <CheckCircle2 size={20} className="hidden shrink-0 sm:block" />
                              Marked Clean
                            </div>
                            <div className="rounded-2xl border border-emerald-200 bg-white px-4 py-2.5 text-center text-sm font-semibold text-emerald-700 shadow-sm sm:px-5 sm:py-3 sm:text-base sm:text-left">
                              This room is ready to book now.
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => completeTask(item.id)}
                            className="w-full whitespace-nowrap rounded-2xl bg-gradient-to-r from-blue-900 via-blue-700 to-sky-500 px-6 py-3 font-semibold text-white shadow-lg transition-all duration-300 hover:scale-105 sm:w-auto sm:px-8"
                          >
                            <span className="flex items-center justify-center gap-2">
                              <Check size={18} />
                              Mark Clean
                            </span>
                          </button>
                        )
                      ) : (
                        <div className="rounded-2xl bg-slate-100 px-4 py-2.5 text-center text-sm font-medium text-slate-500 sm:px-5 sm:py-3 sm:text-base sm:text-left">
                          Assigned to another housekeeper
                        </div>
                      )}

                      {isMine && (
                        <div className="self-start rounded-full bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
                          <Sparkles className="mr-2 inline h-4 w-4" />
                          Assigned to You
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="mt-6 flex flex-col items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-3 py-4 shadow-sm sm:rounded-3xl sm:px-4 sm:flex-row">
          {/* Page-size selector */}
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span className="font-medium">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 outline-none"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>

          {/* Page number buttons */}
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {/* First */}
            <button
              type="button"
              onClick={() => goToPage(1)}
              disabled={safePage === 1}
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-sm font-bold text-slate-600 transition hover:border-blue-300 hover:text-blue-700 disabled:opacity-40 sm:h-9 sm:w-9"
              title="First page"
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </button>

            {/* Prev */}
            <button
              type="button"
              onClick={() => goToPage(safePage - 1)}
              disabled={safePage === 1}
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-sm font-bold text-slate-600 transition hover:border-blue-300 hover:text-blue-700 disabled:opacity-40 sm:h-9 sm:w-9"
              title="Previous page"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>

            {/* Page numbers */}
            {getPageRange().map((p) => (
              <button
                type="button"
                key={p}
                onClick={() => goToPage(p)}
                className={`inline-flex h-8 min-w-[2rem] items-center justify-center rounded-xl px-2 text-sm font-bold transition sm:h-9 sm:min-w-[2.25rem] ${
                  p === safePage
                    ? "border border-blue-600 bg-blue-600 text-white shadow-md"
                    : "border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-700"
                }`}
              >
                {p}
              </button>
            ))}

            {/* Next */}
            <button
              type="button"
              onClick={() => goToPage(safePage + 1)}
              disabled={safePage === totalPages}
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-sm font-bold text-slate-600 transition hover:border-blue-300 hover:text-blue-700 disabled:opacity-40 sm:h-9 sm:w-9"
              title="Next page"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>

              <button
                type="button"
                onClick={() => goToPage(totalPages)}
                disabled={safePage === totalPages}
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-sm font-bold text-slate-600 transition hover:border-blue-300 hover:text-blue-700 disabled:opacity-40 sm:h-9 sm:w-9"
                title="Last page"
              >
                <ChevronsRight className="h-3.5 w-3.5" />
              </button>
          </div>

          {/* Page indicator */}
          <p className="text-sm font-medium text-slate-500">
            Page {safePage} of {totalPages}
          </p>
        </div>
      )}
    </div>
  );
}