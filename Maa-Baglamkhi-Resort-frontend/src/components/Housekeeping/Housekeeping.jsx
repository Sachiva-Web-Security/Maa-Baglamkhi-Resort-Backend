import { useEffect, useState, useMemo, useCallback } from "react";
import {
  FaSyncAlt,
  FaCheckCircle,
  FaBuilding,
  FaBroom,
  FaUsers,
  FaExclamationTriangle,
  FaClipboardList,
  FaBed,
} from "react-icons/fa";
import API from "../../api";

const normalizeNotification = (row) => ({
  id: row.id,
  roomId: row.roomId || row.room_id,
  roomNo: row.roomNo || row.room_no || row.room,
  assignedTo: row.assignedTo || row.assigned_to || "No Housekeeper",
  assignedBy: row.receptionist || "Front Desk",
  task: row.message || row.taskLabel || row.task_label || "Room Cleaning",
  taskLabel: row.taskLabel || row.task_label || "Room Cleaning",
  sentAt: row.sentAt || row.sent_at,
  dueAt: row.dueAt || row.due_at,
  completedAt: row.completedAt || row.completed_at,
  status: row.status || "New",
});

const normalizeStatus = (raw) =>
  String(raw || "").trim().replaceAll("_", " ");

const fallback = "--";

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const statusPill = (status) => {
  const s = normalizeStatus(status).toLowerCase();
  if (s.includes("clean") && !s.includes("dirty")) return { label: status, cls: "bg-emerald-50 text-emerald-700 border border-emerald-200" };
  if (s.includes("dirty")) return { label: status, cls: "bg-amber-50 text-amber-700 border border-amber-200" };
  if (s.includes("progress") || s.includes("cleaning")) return { label: status, cls: "bg-violet-50 text-violet-700 border border-violet-200" };
  if (s.includes("occupied")) return { label: status, cls: "bg-blue-50 text-blue-700 border border-blue-200" };
  if (s.includes("block") || s.includes("service")) return { label: status, cls: "bg-rose-50 text-rose-700 border border-rose-200" };
  return { label: status || "Unknown", cls: "bg-slate-50 text-slate-600 border border-slate-200" };
};

const durationFromTimestamps = (sentAt, dueAt) => {
  const start = sentAt ? new Date(sentAt) : null;
  const end = dueAt ? new Date(dueAt) : null;
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "--";
  const diffMs = end.getTime() - start.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins <= 0) return "< 1 min";
  return `${mins} min`;
};

const timeLeftLabel = (dueAt) => {
  if (!dueAt) return null;
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return null;
  const diffMs = due.getTime() - Date.now();
  if (diffMs < 0) return { text: "Overdue", cls: "text-rose-600 font-semibold" };
  const mins = Math.round(diffMs / 60000);
  if (mins < 60) return { text: `${mins} min left`, cls: "text-amber-600 font-semibold" };
  const hrs = Math.round(mins / 60);
  return { text: `${hrs} hr left`, cls: "text-slate-600" };
};

export default function Housekeeping() {
  const [rooms, setRooms] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [blockedRooms, setBlockedRooms] = useState([]);
  const [assignmentPage, setAssignmentPage] = useState(1);
  const [checkoutPage, setCheckoutPage] = useState(1);
  const PAGE_SIZE = 10;

  const fetchData = useCallback(async () => {
    try {
      const [roomsRes, notifRes, blocksRes] = await Promise.allSettled([
        API.get("/housekeeping"),
        API.get("/housekeeping/notifications"),
        API.get("/hotel/room-blocks", { params: { status: "Active" } }),
      ]);

      const ok = (r) => r.status === "fulfilled" && r.value?.status >= 200 && r.value?.status < 300;

      const roomsData = ok(roomsRes) && Array.isArray(roomsRes.value?.data)
        ? roomsRes.value.data
        : [];
      const notifData = ok(notifRes) && Array.isArray(notifRes.value?.data)
        ? notifRes.value.data
        : [];
      const blocksData = ok(blocksRes) && Array.isArray(blocksRes.value?.data)
        ? blocksRes.value.data
        : [];

      if (roomsRes.status === "fulfilled" && !Array.isArray(roomsRes.value?.data)) {
        console.warn("[Housekeeping] /housekeeping did not return an array. status=",
          roomsRes.value?.status, "body=", roomsRes.value?.data);
      }
      if (notifRes.status === "fulfilled" && !Array.isArray(notifRes.value?.data)) {
        console.warn("[Housekeeping] /housekeeping/notifications did not return an array. status=",
          notifRes.value?.status, "body=", notifRes.value?.data);
      }

      setRooms(roomsData);
      setNotifications(notifData.map(normalizeNotification));
      setBlockedRooms(blocksData);
      setAssignmentPage(1);
      setCheckoutPage(1);
    } catch (err) {
      console.error("[Housekeeping] fetchData error:", err);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 30 s so the list stays live.
  useEffect(() => {
    const id = globalThis.setInterval(fetchData, 30000);
    return () => globalThis.clearInterval(id);
  }, [fetchData]);

  const stats = useMemo(() => ({
    total:    rooms.length,
    clean:    rooms.filter(r => String(r.status || "").toLowerCase().includes("clean") && !String(r.status || "").toLowerCase().includes("dirty")).length,
    dirty:    rooms.filter(r => String(r.status || "").toLowerCase().includes("dirty")).length,
    occupied: rooms.filter(r => String(r.status || "").toLowerCase().includes("occupied")).length,
    oos:      rooms.filter(r => String(r.status || "").toLowerCase().includes("out of service") || String(r.status || "").toLowerCase().includes("block")).length,
  }), [rooms]);

  // Lookup: which rooms are currently under an active block?
  const blockedRoomMap = useMemo(() => {
    const map = new Map();
    blockedRooms.forEach((b) => {
      const key = String(b.room_number || "").trim();
      if (!key) return;
      map.set(key, b);
    });
    return map;
  }, [blockedRooms]);

  // Index the most-recent notification per room.
  const notifMap = useMemo(() => {
    const map = new Map();
    notifications.forEach((n) => {
      const key = String(n.roomNo || n.roomId || "").trim();
      if (!key) return;
      const existing = map.get(key);
      if (!existing || (n.sentAt && (!existing.sentAt || new Date(n.sentAt) > new Date(existing.sentAt)))) {
        map.set(key, n);
      }
    });
    return map;
  }, [notifications]);

  // Build one table row per room — joined with its most-recent notification
  // so we get: assigned to, assigned by (receptionist), task label, duration, time left.
  const assignmentEntries = useMemo(() => {
    return rooms
      .map((room, index) => {
        const roomKey = String(room.roomNo || room.roomNumber || "").trim();
        const n = notifMap.get(roomKey) || null;
        return {
          id: room.id || `row-${index}-${roomKey}`,
          roomNo: room.roomNo || room.roomNumber || fallback,
          roomType: room.roomType || room.type || "Accommodation",
          status: room.status || "Unknown",
          statusPill: statusPill(room.status),
          assignedTo: n?.assignedTo || room.assignee || "No Housekeeper",
          assignedBy: n?.assignedBy || "Front Desk",
          taskLabel: n?.taskLabel || "Room Cleaning",
          duration: durationFromTimestamps(n?.sentAt, n?.dueAt),
          timeLeft: timeLeftLabel(n?.dueAt),
          isBlocked: blockedRoomMap.has(roomKey),
          blockInfo: blockedRoomMap.get(roomKey) || null,
        };
      })
      .filter((e) => e.roomNo !== fallback)
      .sort((a, b) => {
        const aScore = a.status.toLowerCase().includes("clean") && !a.status.toLowerCase().includes("dirty") ? 2 : a.status.toLowerCase().includes("dirty") ? 0 : 1;
        const bScore = b.status.toLowerCase().includes("clean") && !b.status.toLowerCase().includes("dirty") ? 2 : b.status.toLowerCase().includes("dirty") ? 0 : 1;
        if (aScore !== bScore) return aScore - bScore;
        return String(a.roomNo).localeCompare(String(b.roomNo), undefined, { numeric: true });
      });
  }, [rooms, notifMap, blockedRoomMap]);

  // Rooms that are clean — available for checkout / new booking.
  const checkoutReadyRooms = useMemo(() => {
    return rooms
      .filter((room) => {
        const s = normalizeStatus(room.status).toLowerCase();
        return s.includes("clean") && !s.includes("dirty") && !s.includes("progress");
      })
      .sort((a, b) => String(a.roomNo || a.roomNumber).localeCompare(String(b.roomNo || b.roomNumber), undefined, { numeric: true }));
  }, [rooms]);

  // Pagination for assignment list
  const assignmentTotalPages = Math.max(1, Math.ceil(assignmentEntries.length / PAGE_SIZE));
  const paginatedAssignmentEntries = useMemo(() => {
    const safePage = Math.min(assignmentPage, assignmentTotalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    return assignmentEntries.slice(start, start + PAGE_SIZE);
  }, [assignmentEntries, assignmentPage, assignmentTotalPages]);

  // Pagination for checkout-ready rooms
  const checkoutTotalPages = Math.max(1, Math.ceil(checkoutReadyRooms.length / PAGE_SIZE));
  const paginatedCheckoutRooms = useMemo(() => {
    const safePage = Math.min(checkoutPage, checkoutTotalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    return checkoutReadyRooms.slice(start, start + PAGE_SIZE);
  }, [checkoutReadyRooms, checkoutPage, checkoutTotalPages]);

  const PaginationBar = ({ page, totalPages, totalCount, onChange, accent = "blue" }) => {
    if (totalCount === 0) return null;
    const colors =
      accent === "emerald"
        ? "border-emerald-100 text-emerald-700 hover:bg-emerald-50"
        : "border-blue-100 text-blue-700 hover:bg-blue-50";
    const activeColors =
      accent === "emerald"
        ? "bg-emerald-600 text-white border-emerald-600"
        : "bg-blue-600 text-white border-blue-600";
    const start = (page - 1) * PAGE_SIZE + 1;
    const end = Math.min(page * PAGE_SIZE, totalCount);

    const goTo = (p) => {
      const clamped = Math.min(Math.max(1, p), totalPages);
      onChange(clamped);
    };

    const pages = [];
    const maxButtons = 5;
    let from = Math.max(1, page - 2);
    let to = Math.min(totalPages, from + maxButtons - 1);
    from = Math.max(1, to - maxButtons + 1);
    for (let i = from; i <= to; i++) pages.push(i);

    return (
      <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-4 py-4 sm:flex-row sm:px-6">
        <p className="text-sm font-medium text-slate-500 sm:text-base">
          Showing <span className="font-bold text-slate-800">{start}</span>–
          <span className="font-bold text-slate-800">{end}</span> of{" "}
          <span className="font-bold text-slate-800">{totalCount}</span>
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            disabled={page === 1}
            onClick={() => goTo(1)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${colors}`}
          >
            «
          </button>
          <button
            type="button"
            disabled={page === 1}
            onClick={() => goTo(page - 1)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${colors}`}
          >
            ‹ Prev
          </button>
          {pages.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => goTo(p)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-bold transition ${
                p === page ? activeColors : colors
              }`}
            >
              {p}
            </button>
          ))}
          <button
            type="button"
            disabled={page === totalPages}
            onClick={() => goTo(page + 1)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${colors}`}
          >
            Next ›
          </button>
          <button
            type="button"
            disabled={page === totalPages}
            onClick={() => goTo(totalPages)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${colors}`}
          >
            »
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-gradient-to-br from-blue-50 via-slate-50 to-blue-50 p-3 sm:p-4 lg:p-6">
      <div className="w-full">

        {/* Header */}
        <div className="mb-5 flex flex-col gap-4 rounded-3xl bg-gradient-to-r from-[#0a1e57] via-[#1e56e6] to-sky-500 p-5 shadow-[0_8px_30px_rgba(37,99,235,0.25)] sm:flex-row sm:items-center sm:justify-between lg:p-10">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white ring-1 ring-white/30 sm:h-16 sm:w-16">
              <FaBuilding className="text-2xl sm:text-3xl" />
            </div>
            <div className="min-w-0">
              <h1 className="text-[26px] font-black leading-tight text-white xs:text-[28px] sm:text-[38px] lg:text-[32px]">Housekeeping</h1>
              <p className="mt-0.5 break-words text-sm text-blue-50 sm:text-lg lg:text-xl">Manage room assignments, monitor room status, and track checkout-ready rooms from one organized dashboard.</p>
            </div>
          </div>
          <button
            onClick={fetchData}
            className="inline-flex w-full items-center justify-center gap-2 self-start whitespace-nowrap rounded-xl border border-white/60 bg-white/10 px-5 py-3 text-base font-bold text-white shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/20 hover:shadow-md sm:w-auto sm:self-auto sm:text-lg lg:text-xl"
          >
            <FaSyncAlt className="text-lg lg:text-xl" /> Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
          {[
            { label: "Total Rooms", desc: "All Rooms", value: stats.total, icon: FaBuilding, iconBg: "bg-blue-100", iconColor: "text-blue-600", valueColor: "text-blue-600" },
            { label: "Clean / Ready", desc: "Ready for Check-in", value: stats.clean, icon: FaCheckCircle, iconBg: "bg-emerald-100", iconColor: "text-emerald-600", valueColor: "text-emerald-600" },
            { label: "Dirty", desc: "Needs Cleaning", value: stats.dirty, icon: FaBroom, iconBg: "bg-amber-100", iconColor: "text-amber-600", valueColor: "text-amber-600" },
            { label: "Occupied", desc: "Currently Occupied", value: stats.occupied, icon: FaUsers, iconBg: "bg-sky-100", iconColor: "text-sky-600", valueColor: "text-sky-600" },
            { label: "Out of Service", desc: "Maintenance / Issues", value: stats.oos, icon: FaExclamationTriangle, iconBg: "bg-rose-100", iconColor: "text-rose-600", valueColor: "text-rose-600" },
          ].map((s) => (
            <div
              key={s.label}
              className="group min-w-0 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg sm:p-5"
            >
              <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl ${s.iconBg} ${s.iconColor} transition-transform duration-300 group-hover:scale-110 sm:h-14 sm:w-14`}>
                <s.icon className="text-lg sm:text-2xl" />
              </div>
              <div className="truncate text-xs font-bold uppercase tracking-wide text-slate-400 sm:text-sm">{s.label}</div>
              <div className={`mt-1 text-[26px] font-black leading-none sm:text-[38px] ${s.valueColor}`}>{s.value}</div>
              <div className="mt-1 truncate text-xs text-slate-400 sm:text-base">{s.desc}</div>
            </div>
          ))}
        </div>

        {/* Blocked Rooms Banner */}
        {blockedRooms.length > 0 && (
          <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 shadow-sm sm:px-5">
            <p className="text-sm font-bold text-rose-700 sm:text-base">
              Blocked Rooms ({blockedRooms.length}):
              <span className="mt-2 flex flex-wrap gap-2 pt-2 sm:inline sm:pt-0">
                {blockedRooms.map((b) => (
                  <span key={b.id} className="ml-0 mr-2 mt-2 inline-flex items-center gap-1 whitespace-normal rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700 sm:ml-3 sm:mt-0">
                    Room {b.room_number} — {b.block_type} (until {formatDate(b.blocked_until)})
                  </span>
                ))}
              </span>
            </p>
          </div>
        )}

        {/* Full Assignment List */}
        <div className="mb-5 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
          <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-5 sm:gap-4 sm:px-6">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 sm:h-12 sm:w-12">
              <FaClipboardList className="text-lg sm:text-xl" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[20px] font-black text-slate-900 sm:text-[30px] lg:text-[32px]">Room Assignment List</h2>
              <p className="mt-0.5 break-words text-xs text-slate-500 sm:text-base lg:text-lg">
Access room assignment details, room type, duration of stay, assigned by information, and current room status in one organized list.              </p>
            </div>
          </div>
          <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
            <table className="min-w-full text-left">
              <thead className="bg-blue-50/60 text-[13px] font-bold uppercase tracking-[0.14em] text-blue-500 sm:text-sm">
                <tr>
                  <th className="whitespace-nowrap px-5 py-3.5 sm:px-6">Room No</th>
                  <th className="whitespace-nowrap px-5 py-3.5 sm:px-6">Room Type</th>
                  <th className="whitespace-nowrap px-5 py-3.5 sm:px-6">Assigned To (Housekeeper)</th>
                  <th className="whitespace-nowrap px-5 py-3.5 sm:px-6">Assigned By</th>
                  <th className="whitespace-nowrap px-5 py-3.5 sm:px-6">Task</th>
                  <th className="whitespace-nowrap px-5 py-3.5 sm:px-6">Duration Given</th>
                  <th className="whitespace-nowrap px-5 py-3.5 sm:px-6">Real Status</th>
                </tr>
              </thead>
              <tbody>
                {paginatedAssignmentEntries.length ? (
                  paginatedAssignmentEntries.map((row) => (
                    <tr
                      key={row.id}
                      className={`border-t text-sm text-slate-700 transition-colors duration-200 hover:bg-blue-50/40 sm:text-base ${
                        row.isBlocked ? "border-rose-100 bg-rose-50/50" : "border-slate-50"
                      }`}
                    >
                      <td className="whitespace-nowrap px-5 py-4 text-[17px] font-bold text-slate-900 sm:px-6">
                        {row.roomNo}
                        {row.isBlocked && (
                          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                            🔒 BLOCKED
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 sm:px-6">{row.roomType}</td>
                      <td className="whitespace-nowrap px-5 py-4 sm:px-6">{row.assignedTo}</td>
                      <td className="whitespace-nowrap px-5 py-4 sm:px-6">{row.assignedBy}</td>
                      <td className="whitespace-nowrap px-5 py-4 sm:px-6">{row.taskLabel}</td>
                      <td className="whitespace-nowrap px-5 py-4 sm:px-6">{row.duration}</td>
                      <td className="whitespace-nowrap px-5 py-4 sm:px-6">
                        <span className={`inline-flex rounded-full px-3 py-1 text-[15px] font-bold sm:text-base ${row.statusPill.cls}`}>
                          {row.isBlocked ? `Out of Service (${row.blockInfo?.block_type})` : row.statusPill.label}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-5 py-16">
                      <div className="flex flex-col items-center justify-center gap-3 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-400 sm:h-16 sm:w-16">
                          <FaClipboardList className="text-xl sm:text-2xl" />
                        </div>
                        <p className="text-lg font-bold text-slate-800 sm:text-[21px]">No room Assignment found.</p>
                        <p className="text-base text-slate-400 sm:text-lg">Whenever a room is assigned, it will appear here.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <PaginationBar
            page={assignmentPage}
            totalPages={assignmentTotalPages}
            totalCount={assignmentEntries.length}
            onChange={setAssignmentPage}
            accent="blue"
          />
        </div>

        {/* Checkout Available Rooms */}
        <div className="overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
          <div className="flex items-center gap-3 border-b border-emerald-100 bg-emerald-50/40 px-4 py-5 sm:gap-4 sm:px-6">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 sm:h-12 sm:w-12">
              <FaCheckCircle className="text-lg sm:text-xl" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[20px] font-black text-slate-900 sm:text-[30px] lg:text-[32px]">Rooms Available for Checkout / New Booking</h2>
              <p className="mt-0.5 break-words text-xs text-slate-500 sm:text-base lg:text-lg">
                {checkoutReadyRooms.length} rooms are currently cleaned and available for a new check-in.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
            <table className="min-w-full text-left">
              <thead className="bg-emerald-50/60 text-[13px] font-bold uppercase tracking-[0.14em] text-emerald-600 sm:text-sm">
                <tr>
                  <th className="whitespace-nowrap px-5 py-3.5 sm:px-6">Room No</th>
                  <th className="whitespace-nowrap px-5 py-3.5 sm:px-6">Room Type</th>
                  <th className="whitespace-nowrap px-5 py-3.5 sm:px-6">Status</th>
                  <th className="whitespace-nowrap px-5 py-3.5 sm:px-6">Assigned To</th>
                </tr>
              </thead>
              <tbody>
                {paginatedCheckoutRooms.length ? (
                  paginatedCheckoutRooms.map((room, index) => (
                    <tr key={room.id || index} className="border-t border-emerald-50 text-sm text-slate-700 transition-colors duration-200 hover:bg-emerald-50/40 sm:text-base">
                      <td className="whitespace-nowrap px-5 py-4 text-[17px] font-bold text-slate-900 sm:px-6">{room.roomNo || room.roomNumber}</td>
                      <td className="whitespace-nowrap px-5 py-4 sm:px-6">{room.roomType || room.type || "Accommodation"}</td>
                      <td className="whitespace-nowrap px-5 py-4 sm:px-6">
                        <span className={`inline-flex rounded-full px-3 py-1 text-[15px] font-bold sm:text-base ${statusPill(room.status).cls}`}>
                          {statusPill(room.status).label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 sm:px-6">{room.assignee || "No Housekeeper"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-5 py-16">
                      <div className="flex flex-col items-center justify-center gap-3 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-400 sm:h-16 sm:w-16">
                          <FaBed className="text-xl sm:text-2xl" />
                        </div>
                        <p className="text-lg font-bold text-slate-800 sm:text-[21px]">No rooms currently available for checkout.</p>
                        <p className="text-base text-slate-400 sm:text-lg">Whenever a room becomes available for checkout, it will appear here.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <PaginationBar
            page={checkoutPage}
            totalPages={checkoutTotalPages}
            totalCount={checkoutReadyRooms.length}
            onChange={setCheckoutPage}
            accent="emerald"
          />
        </div>

      </div>
    </div>
  );
}