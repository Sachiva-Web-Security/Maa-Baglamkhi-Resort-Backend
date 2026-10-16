import { useEffect, useMemo, useState } from "react";
import {
  FaCheck,
  FaChevronLeft,
  FaChevronRight,
  FaClock,
  FaExclamationTriangle,
  FaPaperPlane,
  FaSearch,
} from "react-icons/fa";

const PAGE_SIZE = 6;
const PAGE_WINDOW = 10;
const NOOP = () => {};

const formatTimeRange = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDateTime = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "--" : date.toLocaleString("en-IN");
};

const formatCountdown = (ms) => {
  if (ms === null || ms === undefined) return "--";
  const totalSeconds = Math.max(Math.floor(ms / 1000), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

export default function CleaningLogPanel({
  logs = [],
  rows = [],
  warningRows = [],
  completedTodayRows = [],
  logSearch = "",
  setLogSearch = NOOP,
  logStatus = "All",
  setLogStatus = NOOP,
  logAssignee = "All",
  setLogAssignee = NOOP,
  housekeepers = [],
  roomMessageDrafts = {},
  setRoomMessageDrafts = NOOP,
  onSendCleaningMessage = NOOP,
  onExtendCleaningTime = NOOP,
  onMarkCleaningComplete = NOOP,
}) {
  const isAdvancedMode = Array.isArray(rows) && rows.length > 0;
  const [currentPage, setCurrentPage] = useState(1);
  const [extraMinutesByRoom, setExtraMinutesByRoom] = useState({});

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return rows.slice(startIndex, startIndex + PAGE_SIZE);
  }, [currentPage, rows]);

  useEffect(() => {
    setCurrentPage(1);
  }, [logSearch, logStatus, logAssignee, rows.length]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const visibleStart = rows.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const visibleEnd = Math.min(currentPage * PAGE_SIZE, rows.length);

  const pageNumbers = useMemo(() => {
    if (totalPages <= PAGE_WINDOW) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const middleWindow = PAGE_WINDOW - 2;
    const halfWindow = Math.floor(middleWindow / 2);
    let start = Math.max(2, currentPage - halfWindow);
    let end = Math.min(totalPages - 1, start + middleWindow - 1);

    if (end - start + 1 < middleWindow) {
      start = Math.max(2, end - middleWindow + 1);
    }

    const numbers = [1];
    if (start > 2) numbers.push("ellipsis-start");

    for (let page = start; page <= end; page += 1) {
      numbers.push(page);
    }

    if (end < totalPages - 1) numbers.push("ellipsis-end");
    numbers.push(totalPages);
    return numbers;
  }, [currentPage, totalPages]);

  const goToPage = (page) => {
    setCurrentPage(Math.min(Math.max(page, 1), totalPages));
  };

  const handleApplyFilters = () => {
    setCurrentPage(1);
  };

  const handleExtendClick = (room) => {
    const roomKey = String(room.id || room.roomNo || room.roomNumber);
    const parsedValue = Number(extraMinutesByRoom[roomKey]);
    const extraMinutes = Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 5;
    onExtendCleaningTime(room, extraMinutes);
    setExtraMinutesByRoom((prev) => ({ ...prev, [roomKey]: "" }));
  };

  if (!isAdvancedMode) {
    return (
      <div className="rounded-[28px] border border-white/70 bg-white/85 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-6">
        <div className="mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700">
            Audit Trail
          </p>
          <h2 className="mt-2 text-2xl font-black text-slate-900">Cleaning Logs</h2>
        </div>

        {logs.length === 0 ? (
          <div className="rounded-[1.6rem] border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
            No logs found
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[1.6rem] border border-slate-200">
            <table className="min-w-full border-collapse overflow-hidden bg-white">
              <thead>
                <tr className="bg-[linear-gradient(135deg,#0f172a_0%,#1e3a8a_100%)] text-left text-white">
                  <th className="px-4 py-4 text-xs uppercase tracking-[0.16em]">Room</th>
                  <th className="px-4 py-4 text-xs uppercase tracking-[0.16em]">Old Status</th>
                  <th className="px-4 py-4 text-xs uppercase tracking-[0.16em]">New Status</th>
                  <th className="px-4 py-4 text-xs uppercase tracking-[0.16em]">Assignee</th>
                  <th className="px-4 py-4 text-xs uppercase tracking-[0.16em]">Notes</th>
                  <th className="px-4 py-4 text-xs uppercase tracking-[0.16em]">Changed At</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-slate-200 bg-white text-sm text-slate-600"
                  >
                    <td className="px-4 py-3 font-semibold text-slate-900">{log.roomNo}</td>
                    <td className="px-4 py-3">{log.oldStatus || "-"}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{log.newStatus}</td>
                    <td className="px-4 py-3">{log.assignee || "-"}</td>
                    <td className="px-4 py-3">{log.notes || "-"}</td>
                    <td className="whitespace-nowrap px-4 py-3">{formatDateTime(log.changed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-[2rem] border border-slate-900/20 bg-[linear-gradient(135deg,#0f172a_0%,#1e3a8a_45%,#0f766e_100%)] shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
        <div className="grid gap-5 p-5 lg:grid-cols-[1.12fr,0.88fr] lg:p-6">
          <div className="rounded-[1.7rem] border p-5 shadow-[0_18px_45px_rgba(2,6,23,0.2)] backdrop-blur-sm">
            <p className="text-[16px] font-semibold uppercase tracking-[0.28em] text-slate-300">
              Housekeeping Page
            </p>
            <h3 className="mt-1 text-2xl font-semibold text-white">Cleaning Log</h3>
            <p className="mt-2 max-w-xl text-xl leading-6 text-slate-200">
         View room-wise cleaning activity, timer status, assignee updates, and reception notes in a polished live board.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[14px] border border-white/8 bg-white/10 px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                  Rooms
                </div>
                <div className="mt-2 flex items-end gap-2">
                  <span className="text-[34px] font-black leading-none text-white">{rows.length}</span>
                  <span className="pb-1 text-[12px] font-medium text-slate-400">Total</span>
                </div>
              </div>
              <div className="rounded-[14px] border border-white/8 bg-white/10 px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                  Warnings
                </div>
                <div className="mt-2 flex items-end gap-2">
                  <span className="text-[34px] font-black leading-none text-rose-300">
                    {String(warningRows.length).padStart(2, "0")}
                  </span>
                  <span className="pb-1 text-[12px] font-medium text-rose-200">Urgent</span>
                </div>
              </div>
              <div className="rounded-[14px] border border-white/8 bg-white/10 px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                  Assignees
                </div>
                <div className="mt-2 flex items-end gap-2">
                  <span className="text-[34px] font-black leading-none text-white">{housekeepers.length}</span>
                  <span className="pb-1 text-[12px] font-medium text-sky-200">Active</span>
                </div>
              </div>
              <div className="rounded-[14px] border border-white/8 bg-white/10 px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-200">
                  Completed
                </div>
                <div className="mt-2 flex items-end gap-2">
                  <span className="text-[34px] font-black leading-none text-emerald-300">
                    {completedTodayRows.length}
                  </span>
                  <span className="pb-1 text-[12px] font-medium text-emerald-200">Today</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="flex items-center justify-between gap-3 rounded-[14px] border border-rose-200 bg-rose-50 px-4 py-3 shadow-sm">
              <div className="flex items-center gap-3 text-[14px] font-semibold text-rose-700">
                <FaExclamationTriangle className="text-rose-500" />
                <span>
                  Live cleaning alerts:{" "}
                  {warningRows.length
                    ? `${warningRows.length} room(s) require immediate attention.`
                    : "No urgent inspection alerts right now."}
                </span>
              </div>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-rose-400 transition hover:bg-rose-100 hover:text-rose-600"
              >
                <FaCheck className="text-xs" />
              </button>
            </div>

            <div className="rounded-[18px] border border-white/80 bg-white/95 p-3 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur-xl">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <label className="flex min-w-0 flex-1 items-center gap-3 rounded-[10px] bg-slate-100 px-4 py-3 text-slate-700">
              <FaSearch className="text-slate-400" />
              <input
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                placeholder="Search rooms, staff..."
                className="w-full bg-transparent text-[16px] font-semibold text-slate-900 outline-none placeholder:text-slate-400"
              />
            </label>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={logStatus}
                    onChange={(e) => setLogStatus(e.target.value)}
                    className="min-w-[100px] rounded-[10px] border border-slate-200 bg-slate-100 px-4 py-3 text-[16px] font-semibold text-slate-900 outline-none"
                    style={{ color: "#0f172a", fontSize: "16px", fontWeight: 600 }}
                  >
                    <option value="All" style={{ color: "#0f172a", fontSize: "16px", fontWeight: 600 }}>Status</option>
                    <option value="dirty" style={{ color: "#0f172a", fontSize: "16px", fontWeight: 600 }}>Dirty</option>
                    <option value="clean" style={{ color: "#0f172a", fontSize: "16px", fontWeight: 600 }}>Clean</option>
                    <option value="occupied" style={{ color: "#0f172a", fontSize: "16px", fontWeight: 600 }}>Occupied</option>
                    <option value="out of service" style={{ color: "#0f172a", fontSize: "16px", fontWeight: 600 }}>Out of Service</option>
                  </select>

                  <select
                    value={logAssignee}
                    onChange={(e) => setLogAssignee(e.target.value)}
                    className="min-w-[110px] rounded-[10px] border border-slate-200 bg-slate-100 px-4 py-3 text-[16px] font-semibold text-slate-900 outline-none"
                    style={{ color: "#0f172a", fontSize: "16px", fontWeight: 600 }}
                  >
                    <option value="All" style={{ color: "#0f172a", fontSize: "16px", fontWeight: 600 }}>Assignee</option>
                    <option value="No Housekeeper" style={{ color: "#0f172a", fontSize: "16px", fontWeight: 600 }}>No Housekeeper</option>
                    {housekeepers.map((hk, index) => (
                      <option
                        key={`${hk}-${index}`}
                        value={hk}
                        style={{ color: "#0f172a", fontSize: "16px", fontWeight: 600 }}
                      >
                        {hk}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={handleApplyFilters}
                    className="rounded-[10px] bg-slate-900 px-5 py-3 text-[14px] font-semibold text-white transition hover:bg-slate-800"
                  >
                    Filter
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLogSearch("");
                      setLogStatus("All");
                      setLogAssignee("All");
                    }}
                    className="px-3 py-3 text-[16px] font-semibold text-slate-600 transition hover:text-slate-900"
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[16px] font-semibold text-slate-600">
                <div>
                  Showing <span className="font-semibold text-slate-900">{visibleStart || 0}</span>-
                  <span className="font-semibold text-slate-900">{visibleEnd || 0}</span> of{" "}
                  <span className="font-semibold text-slate-900">{rows.length}</span> rooms
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[22px] border border-emerald-200 bg-[linear-gradient(135deg,#effcf4_0%,#e5fbf1_100%)] p-6 shadow-[0_18px_38px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-[14px] font-bold text-teal-900">Completed Cleaning Rooms</h3>
            <span className="rounded-full bg-emerald-500 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white">
              Completed
            </span>
          </div>
          <button
            type="button"
            className="text-[14px] font-semibold text-teal-700 transition hover:text-teal-900"
          >
            View History
          </button>
        </div>

        <div className="mt-5 overflow-x-auto rounded-[18px] border border-white/90 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
          <table className="min-w-full text-left text-[14px] text-slate-700">
            <thead className="border-b border-slate-100 bg-white text-[11px] uppercase tracking-[0.16em] text-slate-400">
              <tr>
                <th className="px-5 py-4">Room</th>
                <th className="px-5 py-4">Assignee</th>
                <th className="px-5 py-4">Guest Status</th>
                <th className="px-5 py-4 text-right">Completed At</th>
              </tr>
            </thead>
            <tbody>
              {completedTodayRows.length ? (
                completedTodayRows.map((entry, index) => (
                  <tr
                    key={`${entry.roomId || entry.roomNo}-${entry.completedAt || index}`}
                    className="border-t border-slate-100"
                  >
                    <td className="px-5 py-4 text-[22px] font-bold text-slate-900">{entry.roomNo}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="h-5 w-5 rounded-full bg-slate-200" />
                        <span className="font-medium text-slate-700">
                          {entry.assignee || "No Housekeeper"}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-500">{entry.guestStatus || "-"}</td>
                    <td className="px-5 py-4 text-right font-medium text-slate-700">
                      {formatTimeRange(entry.completedAt)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-slate-500">
                    No room has been marked as completed so far today.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {rows.length ? (
        <>
          <div className="rounded-[1.6rem] border border-slate-200 bg-white shadow-[0_18px_38px_rgba(15,23,42,0.08)]">
            <div className="border-b border-slate-200 px-5 py-5">
              <div className="text-[14px] font-bold uppercase tracking-[0.18em] text-slate-700">
                Cleaning Table View
              </div>
              <div className="mt-2 text-[16px] font-medium text-slate-700">
                Active housekeeping rooms are shown below in a table layout.
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[1600px] w-full text-left text-[16px] text-slate-800">
                <thead className="bg-slate-50 text-[13px] uppercase tracking-[0.14em] text-slate-700">
                <tr>
                  <th className="px-5 py-4">Room</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Assignee</th>
                  <th className="px-5 py-4">Guest</th>
                  <th className="px-5 py-4">Timer Details</th>
                  <th className="px-5 py-4">Reception Message</th>
                  <th className="px-5 py-4">Add Time</th>
                  <th className="px-5 py-4">Complete</th>
                </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((room) => (
                    <tr key={`clean-${room.id}`} className="border-t border-slate-100 align-top">
                      <td className="px-5 py-5">
                        <div className="font-bold text-slate-950">Room {room.roomNo}</div>
                        <div className="mt-1 text-[14px] font-medium text-slate-500">{room.roomType || "-"}</div>
                      </td>
                      <td className="px-5 py-5">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1.5 text-[14px] font-semibold ${
                            room.isOverdue
                              ? "border-rose-200 bg-rose-50 text-rose-700"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {room.status}
                        </span>
                      </td>
                      <td className="px-5 py-5 font-semibold text-slate-900">{room.assignee}</td>
                      <td className="px-5 py-5 font-medium text-slate-700">{room.guestStatus || "-"}</td>
                      <td className="px-5 py-5">
                        <div className="min-w-[300px]">
                          <div className="flex items-center gap-2">
                            <span
                              className={`flex h-8 w-8 items-center justify-center rounded-full ${
                                room.isOverdue ? "bg-rose-600 text-white" : "bg-violet-600 text-white"
                              }`}
                            >
                              <FaClock className="text-xs" />
                            </span>
                            <div>
                              <div className="text-[16px] font-semibold text-slate-900">
                                {room.isOverdue
                                  ? "Deadline crossed"
                                  : room.remainingMs !== null
                                    ? `Due in ${formatCountdown(room.remainingMs)}`
                                    : room.task?.dueAt || room.task?.startedAt
                                      ? "Timer scheduled"
                                      : "No cleaning timer"}
                              </div>
                              <div className="mt-1 text-[14px] font-medium text-slate-500">
                                Start {formatTimeRange(room.task?.startedAt)} | Due {formatTimeRange(room.task?.dueAt)}
                              </div>
                            </div>
                          </div>
                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full ${
                                room.isOverdue ? "bg-rose-500" : "bg-gradient-to-r from-violet-500 to-cyan-400"
                              }`}
                              style={{
                                width: `${room.progress || 34}%`,
                                transition: "width 900ms linear",
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-5">
                        <div className="min-w-[360px]">
                          <textarea
                            value={
                              roomMessageDrafts[String(room.id || room.roomNo || room.roomNumber)] ??
                              room.task?.message ??
                              ""
                            }
                            onChange={(event) =>
                              setRoomMessageDrafts((prev) => ({
                                ...prev,
                                [String(room.id || room.roomNo || room.roomNumber)]: event.target.value,
                              }))
                            }
                            rows={3}
                            placeholder="Write message for reception / front desk..."
                            className="w-full resize-none rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-[15px] font-medium text-slate-800 outline-none placeholder:text-slate-400"
                          />
                          <button
                            type="button"
                            onClick={() => onSendCleaningMessage(room)}
                            className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2.5 text-[14px] font-semibold text-white transition hover:bg-emerald-700"
                          >
                            <FaPaperPlane className="text-[12px]" />
                            Send
                          </button>
                        </div>
                      </td>
                      <td className="px-5 py-5">
                        <div className="flex min-w-[250px] flex-wrap items-center gap-3">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={extraMinutesByRoom[String(room.id || room.roomNo || room.roomNumber)] ?? ""}
                            onChange={(event) =>
                              setExtraMinutesByRoom((prev) => ({
                                ...prev,
                                [String(room.id || room.roomNo || room.roomNumber)]: event.target.value,
                              }))
                            }
                            placeholder="Minutes"
                            className="w-28 rounded-full border border-violet-200 bg-white px-3 py-2.5 text-[14px] font-semibold text-slate-900 outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleExtendClick(room)}
                            className="rounded-full bg-violet-600 px-4 py-2.5 text-[14px] font-semibold text-white transition hover:bg-violet-700"
                          >
                            Add Time
                          </button>
                          <button
                            type="button"
                            onClick={() => onExtendCleaningTime(room, 5)}
                            className="rounded-full border border-violet-200 bg-white px-3 py-2.5 text-[14px] font-semibold text-violet-700 transition hover:bg-violet-100"
                          >
                            +5
                          </button>
                        </div>
                      </td>
                      <td className="px-5 py-5">
                        <button
                          type="button"
                          onClick={() => onMarkCleaningComplete(room)}
                          className="inline-flex min-w-[220px] items-center justify-center gap-2 rounded-[1rem] bg-gradient-to-r from-emerald-600 to-teal-500 px-5 py-3.5 text-[14px] font-semibold text-white transition hover:opacity-95"
                        >
                          <FaCheck className="text-[12px]" />
                          Mark Cleaning Complete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-[1.5rem] border border-slate-200 bg-white px-4 py-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)] sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-600">
              Page <span className="font-semibold text-slate-900">{currentPage}</span> of{" "}
              <span className="font-semibold text-slate-900">{totalPages}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="inline-flex items-center gap-2 rounded-full border border-slate-900 bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <FaChevronLeft className="text-xs" />
                Prev
              </button>

              {pageNumbers.map((item) =>
                item === "ellipsis-start" || item === "ellipsis-end" ? (
                  <span key={item} className="px-2 text-slate-400">
                    ...
                  </span>
                ) : (
                  <button
                    type="button"
                    key={item}
                    onClick={() => goToPage(item)}
                    className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition ${
                      currentPage === item
                        ? "bg-slate-900 text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)]"
                        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {item}
                  </button>
                ),
              )}

              <button
                type="button"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="inline-flex items-center gap-2 rounded-full border border-slate-900 bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
                <FaChevronRight className="text-xs" />
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-[1.6rem] border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
          No logs found
        </div>
      )}
    </div>
  );
}


