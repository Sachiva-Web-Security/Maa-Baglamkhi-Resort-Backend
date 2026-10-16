import React, { useEffect, useMemo, useState } from "react";
import {
  FaCheckCircle,
  FaClipboardList,
  FaPlayCircle,
  FaTasks,
  FaInfoCircle,
  FaUserCircle,
  FaBed,
  FaFlag,
  FaClock,
  FaStickyNote,
  FaUsers,
  FaDoorOpen,
  FaExclamationTriangle,
  FaEdit,
  FaTrashAlt,
  FaPlus,
  FaChevronDown,
} from "react-icons/fa";

import API from "../api";

const fieldCls =
  "block w-full max-w-full h-12 sm:h-[60px] rounded-2xl border border-blue-100 bg-white pl-11 pr-8 text-xs sm:pl-12 sm:pr-4 sm:text-[16px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 shadow-sm";

const textAreaCls =
  "w-full min-h-[132px] resize-y rounded-2xl border border-blue-100 bg-white pl-12 pr-4 py-4 text-sm sm:text-[16px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 shadow-sm";

const managerRoles = new Set(["admin", "manager", "receptionist"]);
const assignableRoles = new Set(["housekeeping", "accountant", "staff"]);
const statusOptions = ["Pending", "In Progress", "Completed", "Cancelled"];
const priorityOptions = ["Urgent", "High", "Normal", "Low"];

const normalizeText = (value) => String(value || "").trim();
const normalizeLower = (value) => normalizeText(value).toLowerCase();

const compactRoomType = (value) =>
  normalizeText(value)
    .replace(/\bROOM\b/gi, "")
    .replace(/NON-AC/gi, "Non-AC")
    .replace(/AC/gi, "AC")
    .replace(/\s{2,}/g, " ")
    .trim();

const compactRoomStatus = (value) =>
  normalizeText(value)
    .replace(/Vacant Clean/gi, "Clean")
    .replace(/Vacant Dirty/gi, "Dirty")
    .replace(/Occupied/gi, "Occ")
    .replace(/\s{2,}/g, " ")
    .trim();

const formatRoomOptionLabel = (room) => {
  const parts = [`Rm ${room.roomNo}`];
  const roomType = compactRoomType(room.roomType);
  const status = compactRoomStatus(room.status);

  if (roomType) parts.push(roomType);
  if (status) parts.push(status);

  return parts.join(" - ");
};

const roomSortValue = (roomNo) => {
  const numericValue = Number.parseInt(String(roomNo || ""), 10);
  return Number.isFinite(numericValue) ? numericValue : Number.MAX_SAFE_INTEGER;
};

const isPreferredRoom = (room) => {
  const hotelStatus = normalizeLower(room.hotelStatus);
  const status = normalizeLower(room.status);

  return (
    hotelStatus === "available" ||
    status === "available" ||
    status.includes("vacant clean")
  );
};

const mergeRoomSources = (housekeepingRows, setupRows) => {
  const roomMap = new Map();

  (housekeepingRows || []).forEach((room) => {
    const roomNo = normalizeText(room.roomNo || room.room_number);
    if (!roomNo) return;

    roomMap.set(roomNo, {
      roomNo,
      roomType: normalizeText(room.roomType),
      status: normalizeText(room.status || room.hotelStatus || "Unknown"),
      hotelStatus: normalizeText(room.hotelStatus),
      preferred: isPreferredRoom(room),
    });
  });

  (setupRows || []).forEach((category) => {
    const categoryName = normalizeText(category?.name);
    const detailRows = Array.isArray(category?.roomDetails)
      ? category.roomDetails
      : Array.isArray(category?.rooms)
      ? category.rooms.map((roomNo) => ({ roomNumber: roomNo }))
      : [];

    detailRows.forEach((detail) => {
      const roomNo = normalizeText(detail?.roomNumber || detail?.room_number);
      if (!roomNo) return;

      const current = roomMap.get(roomNo) || {
        roomNo,
        roomType: categoryName,
        status: normalizeText(detail?.status || "Unknown"),
        hotelStatus: normalizeText(detail?.status),
        preferred: isPreferredRoom(detail),
      };

      roomMap.set(roomNo, {
        roomNo,
        roomType: current.roomType || categoryName,
        status: current.status || normalizeText(detail?.status || "Unknown"),
        hotelStatus: current.hotelStatus || normalizeText(detail?.status),
        preferred: current.preferred || isPreferredRoom(detail),
      });
    });
  });

  return [...roomMap.values()].sort((left, right) => {
    if (Number(right.preferred) !== Number(left.preferred)) {
      return Number(right.preferred) - Number(left.preferred);
    }

    const numericDiff = roomSortValue(left.roomNo) - roomSortValue(right.roomNo);
    if (numericDiff !== 0) return numericDiff;

    return left.roomNo.localeCompare(right.roomNo, undefined, { numeric: true });
  });
};

const getStatusBadge = (status) => {
  const normalized = normalizeLower(status);

  if (normalized === "completed") {
    return "border border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (normalized === "in progress") {
    return "border border-sky-200 bg-sky-50 text-sky-700";
  }
  if (normalized === "cancelled") {
    return "border border-slate-200 bg-slate-100 text-slate-600";
  }

  return "border border-amber-200 bg-amber-50 text-amber-700";
};

const getPriorityBadge = (priority) => {
  const normalized = normalizeLower(priority);

  if (normalized === "urgent") {
    return "bg-gradient-to-r from-rose-600 to-rose-400 text-white shadow-sm shadow-rose-200";
  }
  if (normalized === "high") {
    return "bg-gradient-to-r from-orange-500 to-amber-400 text-white shadow-sm shadow-orange-200";
  }
  if (normalized === "low") {
    return "bg-gradient-to-r from-slate-400 to-slate-300 text-white shadow-sm shadow-slate-200";
  }

  return "bg-gradient-to-r from-sky-600 to-cyan-400 text-white shadow-sm shadow-sky-200";
};

const formatTimestamp = (value) => {
  if (!value) return "--";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);

  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const Assignment = () => {
  const currentRole = normalizeLower(localStorage.getItem("role"));
  const currentName = normalizeText(localStorage.getItem("name"));
  const canManageAssignments = managerRoles.has(currentRole);

  const [form, setForm] = useState({
    staff_name: "",
    room_number: "",
    task: "",
    priority: "Normal",
    due_time: "",
    notes: "",
    status: "Pending",
  });
  const [assignments, setAssignments] = useState([]);
  const [users, setUsers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [stats, setStats] = useState({});
  const [editId, setEditId] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assignmentNotice, setAssignmentNotice] = useState("");

  // Single source of truth for which custom dropdown (if any) is open.
  // Using one state instead of three booleans guarantees only one panel
  // is ever open at a time, which is what keeps their positioning correct.
  const [openDropdown, setOpenDropdown] = useState(null); // 'staff' | 'room' | 'priority' | null

  const staffDropdownOpen = openDropdown === "staff";
  const roomDropdownOpen = openDropdown === "room";
  const priorityDropdownOpen = openDropdown === "priority";

  const toggleDropdown = (name) => {
    setOpenDropdown((prev) => (prev === name ? null : name));
  };

  const loadUsers = async () => {
    try {
      const res = await API.get("/users");
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.log(error);
      setUsers([]);
    }
  };

  const loadAssignments = async () => {
    try {
      const res = await API.get("/assignments", {
        params: { role: currentRole, name: currentName },
      });
      setAssignments(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.log(error);
      setAssignments([]);
    }
  };

  const loadStats = async () => {
    try {
      const res = await API.get("/assignments/stats", {
        params: { role: currentRole, name: currentName },
      });
      setStats(res.data || {});
    } catch (error) {
      console.log(error);
      setStats({});
    }
  };

  const loadRooms = async () => {
    const [housekeepingResult, setupResult] = await Promise.allSettled([
      API.get("/housekeeping"),
      API.get("/hotel/rooms/setup"),
    ]);

    const housekeepingRows =
      housekeepingResult.status === "fulfilled" && Array.isArray(housekeepingResult.value.data)
        ? housekeepingResult.value.data
        : [];

    const setupRows =
      setupResult.status === "fulfilled" && Array.isArray(setupResult.value.data)
        ? setupResult.value.data
        : [];

    setRooms(mergeRoomSources(housekeepingRows, setupRows));
  };

  useEffect(() => {
    let active = true;

    const loadPage = async () => {
      setPageLoading(true);
      try {
        await Promise.all([loadUsers(), loadAssignments(), loadStats(), loadRooms()]);
      } finally {
        if (active) {
          setPageLoading(false);
        }
      }
    };

    loadPage();

    return () => {
      active = false;
    };
  }, []);

  const refreshAssignments = async () => {
    await Promise.all([loadAssignments(), loadStats()]);
  };

  const resetForm = () => {
    setForm({
      staff_name: "",
      room_number: "",
      task: "",
      priority: "Normal",
      due_time: "",
      notes: "",
      status: "Pending",
    });
    setEditId(null);
    setOpenDropdown(null);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleStaffSelect = (name) => {
    setForm((prev) => ({ ...prev, staff_name: name }));
    setOpenDropdown(null);
  };

  const handleRoomSelect = (roomNo) => {
    setForm((prev) => ({ ...prev, room_number: roomNo }));
    setOpenDropdown(null);
  };

  const handlePrioritySelect = (priority) => {
    setForm((prev) => ({ ...prev, priority }));
    setOpenDropdown(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.room_number) {
      setAssignmentNotice("Please select a room before assigning the task.");
      return;
    }
    setSaving(true);

    try {
      if (editId) {
        await API.put(`/assignments/${editId}`, {
          staffName: form.staff_name,
          roomNumber: form.room_number,
          task: form.task,
          priority: form.priority,
          dueTime: form.due_time,
          notes: form.notes,
          status: form.status,
        });
      } else {
        await API.post("/assignments", {
          staffName: form.staff_name,
          roomNumber: form.room_number,
          task: form.task,
          priority: form.priority,
          dueTime: form.due_time,
          notes: form.notes,
          assignedBy: currentName,
        });

        setAssignmentNotice(
          `Task assigned on ${formatTimestamp(new Date().toISOString())}`,
        );
      }

      resetForm();
      await refreshAssignments();
    } catch (error) {
      console.log(error);
      window.alert("Error assigning task");
    } finally {
      setSaving(false);
    }
  };

  const updateTaskStatus = async (id, status) => {
    try {
      await API.patch(`/assignments/${id}/status`, {
        status,
        actorName: currentName,
      });
      await refreshAssignments();
    } catch (error) {
      console.log(error);
      window.alert("Task status update failed");
    }
  };

  const deleteTask = async (id) => {
    try {
      await API.delete(`/assignments/${id}`);
      await refreshAssignments();
    } catch (error) {
      console.log(error);
      window.alert("Task delete failed");
    }
  };

  const editTask = (taskRow) => {
    setForm({
      staff_name: normalizeText(taskRow.staff_name),
      room_number: normalizeText(taskRow.room_number),
      task: normalizeText(taskRow.task),
      priority: normalizeText(taskRow.priority) || "Normal",
      due_time: normalizeText(taskRow.due_time),
      notes: normalizeText(taskRow.notes),
      status: normalizeText(taskRow.status) || "Pending",
    });
    setEditId(taskRow.id);
  };

  const selectableUsers = useMemo(
    () =>
      users
        .filter((user) => assignableRoles.has(normalizeLower(user.role)))
        .sort((left, right) =>
          normalizeText(left.name).localeCompare(normalizeText(right.name)),
        ),
    [users],
  );

  const selectableRooms = useMemo(() => {
    const rows = [...rooms];
    if (
      form.room_number &&
      !rows.some((room) => String(room.roomNo) === String(form.room_number))
    ) {
      rows.unshift({
        roomNo: form.room_number,
        roomType: "",
        status: "Selected",
      });
    }
    return rows;
  }, [form.room_number, rooms]);

  const selectedRoom = useMemo(
    () => selectableRooms.find((room) => String(room.roomNo) === String(form.room_number)) || null,
    [form.room_number, selectableRooms],
  );

  const selectableStaff = useMemo(() => {
    const rows = [...selectableUsers];
    if (
      form.staff_name &&
      !rows.some((user) => String(user.name) === String(form.staff_name))
    ) {
      rows.unshift({
        id: `selected-${form.staff_name}`,
        name: form.staff_name,
        role: "selected",
      });
    }
    return rows;
  }, [form.staff_name, selectableUsers]);

  const summaryCards = [
    { icon: FaTasks, label: "Total Tasks", value: stats.total || 0 },
    { icon: FaClipboardList, label: "Pending", value: stats.pending || 0 },
    { icon: FaPlayCircle, label: "In Progress", value: stats.inProgress || 0 },
    { icon: FaCheckCircle, label: "Completed", value: stats.completed || 0 },
  ];

  // Shared action buttons used inside both the table row and the mobile card
  const renderActionButtons = (assignment) => (
    <div className="flex flex-wrap gap-2">
      {normalizeLower(assignment.status) === "pending" && (
        <button
          onClick={() => updateTaskStatus(assignment.id, "In Progress")}
          className="rounded-full bg-gradient-to-r from-sky-600 to-cyan-400 px-4 py-2 text-sm font-bold text-white shadow-sm shadow-sky-200 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
        >
          Start
        </button>
      )}
      {normalizeLower(assignment.status) === "in progress" && (
        <button
          onClick={() => updateTaskStatus(assignment.id, "Completed")}
          className="rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 px-4 py-2 text-sm font-bold text-white shadow-sm shadow-emerald-200 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
        >
          Complete
        </button>
      )}
      {canManageAssignments && (
        <button
          onClick={() => editTask(assignment)}
          className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-700 to-blue-500 px-4 py-2 text-sm font-bold text-white shadow-sm shadow-blue-200 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
        >
          <FaEdit className="text-xs" />
          Edit
        </button>
      )}
      {canManageAssignments && (
        <button
          onClick={() => deleteTask(assignment.id)}
          className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-rose-600 to-rose-400 px-4 py-2 text-sm font-bold text-white shadow-sm shadow-rose-200 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
        >
          <FaTrashAlt className="text-xs" />
          Delete
        </button>
      )}
    </div>
  );

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="w-full space-y-6 sm:space-y-7">
        {/* HERO */}
        <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-blue-950 via-blue-700 to-sky-500 px-5 py-7 shadow-[0_25px_60px_rgba(15,23,80,0.28)] sm:px-8 sm:py-9">
          {/* dot grid pattern */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.18]"
            style={{
              backgroundImage:
                "radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px)",
              backgroundSize: "18px 18px",
            }}
          />
          {/* glowing circles */}
          <div className="pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-sky-300/30 blur-3xl sm:h-80 sm:w-80" />
          <div className="pointer-events-none absolute -right-10 top-10 h-64 w-64 rounded-full bg-cyan-200/30 blur-3xl sm:h-96 sm:w-96" />
          <div className="pointer-events-none absolute bottom-[-40%] left-1/3 h-72 w-72 rounded-full bg-blue-400/20 blur-3xl" />

          {/* abstract wave */}
          <svg
            className="pointer-events-none absolute bottom-0 left-0 h-24 w-full opacity-40 sm:h-32"
            viewBox="0 0 1200 200"
            preserveAspectRatio="none"
          >
            <path
              d="M0,120 C200,180 400,60 600,110 C800,160 1000,80 1200,130 L1200,200 L0,200 Z"
              fill="rgba(255,255,255,0.10)"
            />
            <path
              d="M0,150 C250,90 450,170 700,120 C900,80 1050,150 1200,110 L1200,200 L0,200 Z"
              fill="rgba(255,255,255,0.06)"
            />
          </svg>

          <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(360px,1fr)] lg:items-center">
            <div className="space-y-3 sm:space-y-4">
              <p className="text-xs font-bold uppercase tracking-wide text-sky-100 sm:text-sm md:text-[14px]">
                Task Assignment
              </p>
              <h1 className="text-[26px] font-black leading-tight text-white sm:text-[32px] md:text-[36px] lg:text-[40px]">
                Assignment operations board
              </h1>
              <p className="max-w-3xl text-sm font-medium leading-7 text-sky-50/90 sm:text-[16px] md:text-[18px]">
                Tasks assigned by reception, managers, and admins are shown here in real time.
                Housekeeping, accounts, and staff teams can start and complete their assigned work.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {summaryCards.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="group rounded-3xl border border-white/40 bg-white px-4 py-4 shadow-[0_14px_35px_rgba(15,23,42,0.14)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_45px_rgba(15,23,42,0.2)] sm:px-5 sm:py-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-xs font-semibold text-slate-500 sm:text-sm md:text-[16px]">
                          {item.label}
                        </span>
                        <div className="mt-2 text-[26px] font-bold leading-none text-blue-900 sm:text-[30px] md:text-[34px] lg:text-[42px]">
                          {item.value}
                        </div>
                      </div>
                      <span className="rounded-2xl bg-blue-50 p-3 text-blue-700 transition-transform duration-300 group-hover:scale-110">
                        <Icon />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* NOTIFICATION */}
        {assignmentNotice ? (
          <section className="flex items-center gap-3 rounded-[22px] border border-blue-200 bg-blue-50/70 px-5 py-4 text-sm font-semibold text-blue-800 shadow-[0_12px_30px_rgba(37,99,235,0.08)] backdrop-blur-md sm:text-[16px]">
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              <FaInfoCircle />
            </span>
            {assignmentNotice}
          </section>
        ) : null}

        {/* FORM */}
        {canManageAssignments && (
          <section className="w-full max-w-full overflow-visible rounded-[22px] border border-white/70 bg-white/85 p-4 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:rounded-[28px] sm:p-7">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-blue-500 sm:text-sm md:text-[16px]">
                  New Assignment
                </p>
                <h2 className="mt-1 text-xl font-black text-slate-900 sm:text-2xl md:text-[28px] lg:text-[34px]">
                  Assign task with priority and timing
                </h2>
              </div>
              <div className="space-y-2 text-right text-sm text-slate-500 sm:text-[16px]">
                <div className="flex items-center justify-end gap-2">
                  <span>{selectableStaff.length} assignable staff loaded</span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                    <FaUsers className="text-xs" />
                  </span>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <span>{selectableRooms.length} current rooms loaded</span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                    <FaDoorOpen className="text-xs" />
                  </span>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <span>{stats.overdue || 0} overdue tasks right now</span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                    <FaExclamationTriangle className="text-xs" />
                  </span>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="grid w-full min-w-0 max-w-full gap-3 sm:gap-4 lg:grid-cols-4">
              {/* STAFF - custom dropdown so the panel always stays within the field width/screen */}
              <div
                className="relative min-w-0 self-start"
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) {
                    setOpenDropdown((prev) => (prev === "staff" ? null : prev));
                  }
                }}
              >
                <span className="pointer-events-none absolute inset-y-0 left-4 z-10 flex items-center text-blue-400">
                  <FaUserCircle />
                </span>
                <button
                  type="button"
                  className={`${fieldCls} text-left`}
                  aria-haspopup="listbox"
                  aria-expanded={staffDropdownOpen}
                  onClick={() => toggleDropdown("staff")}
                >
                  <span className="block truncate pr-5">
                    {form.staff_name
                      ? form.staff_name
                      : selectableStaff.length
                        ? "Select Staff"
                        : "No staff available"}
                  </span>
                </button>
                <span className="pointer-events-none absolute inset-y-0 right-4 z-10 flex items-center text-blue-400">
                  <FaChevronDown
                    className={`text-xs transition-transform duration-200 ${staffDropdownOpen ? "rotate-180" : ""}`}
                  />
                </span>
                <input type="hidden" name="staff_name" value={form.staff_name} required />
                {staffDropdownOpen ? (
                  <div
                    className="absolute left-0 right-0 top-full z-[80] mt-2 max-h-[220px] overflow-y-auto overscroll-contain rounded-2xl border border-blue-100 bg-white py-1.5 text-xs text-slate-900 shadow-[0_18px_45px_rgba(15,23,42,0.18)] sm:text-sm"
                    role="listbox"
                  >
                    {selectableStaff.length ? (
                      selectableStaff.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          role="option"
                          aria-selected={String(form.staff_name) === String(user.name)}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => handleStaffSelect(user.name)}
                          className={`block w-full truncate px-4 py-2.5 text-left transition hover:bg-blue-50 ${
                            String(form.staff_name) === String(user.name)
                              ? "bg-blue-600 font-bold text-white hover:bg-blue-600"
                              : "text-slate-900"
                          }`}
                        >
                          {user.name} ({user.role})
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-slate-500">No staff available</div>
                    )}
                  </div>
                ) : null}
              </div>

              {/* ROOM - custom dropdown */}
              <div
                className="relative min-w-0 self-start"
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) {
                    setOpenDropdown((prev) => (prev === "room" ? null : prev));
                  }
                }}
              >
                <span className="pointer-events-none absolute inset-y-0 left-4 z-10 flex items-center text-blue-400">
                  <FaBed />
                </span>
                <button
                  type="button"
                  className={`${fieldCls} text-left`}
                  aria-haspopup="listbox"
                  aria-expanded={roomDropdownOpen}
                  onClick={() => toggleDropdown("room")}
                >
                  <span className="block truncate pr-5">
                    {selectedRoom
                      ? formatRoomOptionLabel(selectedRoom)
                      : selectableRooms.length
                        ? "Select Room"
                        : "No rooms available"}
                  </span>
                </button>
                <span className="pointer-events-none absolute inset-y-0 right-4 z-10 flex items-center text-blue-400">
                  <FaChevronDown
                    className={`text-xs transition-transform duration-200 ${roomDropdownOpen ? "rotate-180" : ""}`}
                  />
                </span>
                <input type="hidden" name="room_number" value={form.room_number} required />
                {roomDropdownOpen ? (
                  <div className="absolute left-0 right-0 top-full z-[80] mt-2 max-h-[220px] overflow-y-auto overscroll-contain rounded-2xl border border-blue-100 bg-white py-1.5 text-xs text-slate-900 shadow-[0_18px_45px_rgba(15,23,42,0.18)] sm:text-sm" role="listbox">
                    {selectableRooms.length ? (
                      selectableRooms.map((room) => (
                        <button
                          key={room.roomNo}
                          type="button"
                          role="option"
                          aria-selected={String(form.room_number) === String(room.roomNo)}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => handleRoomSelect(room.roomNo)}
                          className={`block w-full truncate px-4 py-2.5 text-left transition hover:bg-blue-50 ${
                            String(form.room_number) === String(room.roomNo)
                              ? "bg-blue-600 font-bold text-white hover:bg-blue-600"
                              : "text-slate-900"
                          }`}
                        >
                          {formatRoomOptionLabel(room)}
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-slate-500">No rooms available</div>
                    )}
                  </div>
                ) : null}
              </div>

              {/* PRIORITY - custom dropdown so the panel always stays within the field width/screen */}
              <div
                className="relative min-w-0 self-start"
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) {
                    setOpenDropdown((prev) => (prev === "priority" ? null : prev));
                  }
                }}
              >
                <span className="pointer-events-none absolute inset-y-0 left-4 z-10 flex items-center text-blue-400">
                  <FaFlag />
                </span>
                <button
                  type="button"
                  className={`${fieldCls} text-left`}
                  aria-haspopup="listbox"
                  aria-expanded={priorityDropdownOpen}
                  onClick={() => toggleDropdown("priority")}
                >
                  <span className="block truncate pr-5">{form.priority} Priority</span>
                </button>
                <span className="pointer-events-none absolute inset-y-0 right-4 z-10 flex items-center text-blue-400">
                  <FaChevronDown
                    className={`text-xs transition-transform duration-200 ${priorityDropdownOpen ? "rotate-180" : ""}`}
                  />
                </span>
                <input type="hidden" name="priority" value={form.priority} />
                {priorityDropdownOpen ? (
                  <div
                    className="absolute left-0 right-0 top-full z-[80] mt-2 max-h-[220px] overflow-y-auto overscroll-contain rounded-2xl border border-blue-100 bg-white py-1.5 text-xs text-slate-900 shadow-[0_18px_45px_rgba(15,23,42,0.18)] sm:text-sm"
                    role="listbox"
                  >
                    {priorityOptions.map((priority) => (
                      <button
                        key={priority}
                        type="button"
                        role="option"
                        aria-selected={form.priority === priority}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => handlePrioritySelect(priority)}
                        className={`block w-full truncate px-4 py-2.5 text-left transition hover:bg-blue-50 ${
                          form.priority === priority
                            ? "bg-blue-600 font-bold text-white hover:bg-blue-600"
                            : "text-slate-900"
                        }`}
                      >
                        {priority} Priority
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="relative min-w-0 self-start">
                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-blue-400">
                  <FaClock />
                </span>
                <input
                  type="time"
                  name="due_time"
                  value={form.due_time}
                  onChange={handleChange}
                  className={fieldCls}
                />
              </div>

              <div className="relative min-w-0 self-start">
                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-blue-400">
                  <FaClipboardList />
                </span>
                <input
                  type="text"
                  name="task"
                  placeholder="Task"
                  value={form.task}
                  onChange={handleChange}
                  className={fieldCls}
                  required
                />
              </div>

              <div className="relative min-w-0 self-start">
                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-blue-400">
                  <FaCheckCircle />
                </span>
                <select
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  className={`${fieldCls} disabled:opacity-60`}
                  disabled={!editId}
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-2">
                <div className="relative min-w-0 self-start">
                  <span className="pointer-events-none absolute left-4 top-5 text-blue-400">
                    <FaStickyNote />
                  </span>
                  <textarea
                    name="notes"
                    placeholder="Notes for team"
                    value={form.notes}
                    onChange={handleChange}
                    className={textAreaCls}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-start gap-3 lg:col-span-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-900 to-blue-500 px-6 py-3.5 text-sm font-bold text-white shadow-[0_18px_38px_rgba(30,64,175,0.35)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_45px_rgba(30,64,175,0.45)] disabled:opacity-60 sm:text-[16px]"
                >
                  <FaPlus className="text-xs" />
                  {saving ? "Saving..." : editId ? "Update Task" : "Assign Task"}
                </button>
                {editId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-2xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-bold text-slate-700 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md sm:text-[16px]"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
            </form>
          </section>
        )}

        {/* MOBILE CARDS (phone view only) */}
        <section className="space-y-4 sm:hidden">
          {pageLoading && (
            <div className="rounded-[22px] border border-white/70 bg-white/90 px-5 py-10 text-center text-sm font-semibold text-slate-500 shadow-[0_14px_35px_rgba(15,23,42,0.08)]">
              Loading assignments...
            </div>
          )}

          {!pageLoading && assignments.length === 0 && (
            <div className="rounded-[22px] border border-white/70 bg-white/90 px-5 py-10 text-center text-sm font-semibold text-slate-500 shadow-[0_14px_35px_rgba(15,23,42,0.08)]">
              No tasks assigned yet
            </div>
          )}

          {assignments.map((assignment) => (
            <div
              key={assignment.id}
              className="rounded-[22px] border border-white/70 bg-white/95 p-4 shadow-[0_14px_35px_rgba(15,23,42,0.1)]"
            >
              {/* Top row: staff + room */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                    <FaUserCircle />
                  </span>
                  <div>
                    <div className="text-[15px] font-bold text-slate-900">
                      {assignment.staff_name}
                    </div>
                    <div className="flex items-center gap-1 text-xs font-semibold text-slate-500">
                      <FaBed className="text-[10px]" />
                      Room {assignment.room_number}
                    </div>
                  </div>
                </div>
                <span
                  className={`inline-flex flex-shrink-0 rounded-full px-3 py-1 text-xs font-bold ${getPriorityBadge(assignment.priority)}`}
                >
                  {assignment.priority || "Normal"}
                </span>
              </div>

              {/* Task + notes */}
              <div className="mt-3 border-t border-slate-100 pt-3">
                <div className="text-sm font-semibold text-slate-700">{assignment.task}</div>
                {assignment.notes ? (
                  <div className="mt-1.5 flex items-start gap-1.5 text-xs leading-5 text-slate-500">
                    <FaStickyNote className="mt-0.5 flex-shrink-0 text-[10px]" />
                    <span>{assignment.notes}</span>
                  </div>
                ) : null}
              </div>

              {/* Status + due time */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${getStatusBadge(assignment.status)}`}
                >
                  {assignment.status || "Pending"}
                </span>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                  <FaClock className="text-[10px]" />
                  Due: {assignment.due_time || "--"}
                </div>
              </div>

              {/* Meta info */}
              <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
                <div>
                  Assigned by:{" "}
                  <span className="font-semibold text-slate-700">
                    {assignment.assigned_by || assignment.created_by_name || "--"}
                  </span>
                </div>
                <div>Assigned on: {formatTimestamp(assignment.created_at)}</div>
                <div>
                  Updated: {formatTimestamp(assignment.updated_at || assignment.created_at)}
                </div>
              </div>

              {/* Actions */}
              <div className="mt-4 border-t border-slate-100 pt-3">
                {renderActionButtons(assignment)}
              </div>
            </div>
          ))}
        </section>

        {/* TABLE (tablet & desktop view) */}
        <section className="hidden rounded-[28px] border border-white/70 bg-white/90 shadow-[0_20px_50px_rgba(15,23,42,0.08)] sm:block">
          <div className="max-h-[640px] overflow-auto rounded-[28px]">
            <table className="min-w-full text-left">
              <thead className="sticky top-0 z-10 bg-slate-50/95 text-[15px] uppercase tracking-wide text-slate-500 backdrop-blur">
                <tr>
                  <th className="px-5 py-4 font-bold">Staff</th>
                  <th className="px-5 py-4 font-bold">Room</th>
                  <th className="px-5 py-4 font-bold">Task</th>
                  <th className="px-5 py-4 font-bold">Priority</th>
                  <th className="px-5 py-4 font-bold hidden lg:table-cell">Due</th>
                  <th className="px-5 py-4 font-bold">Status</th>
                  <th className="px-5 py-4 font-bold hidden xl:table-cell">Assigned By</th>
                  <th className="px-5 py-4 font-bold hidden xl:table-cell">Assigned On</th>
                  <th className="px-5 py-4 font-bold hidden xl:table-cell">Updated</th>
                  <th className="px-5 py-4 font-bold">Action</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((assignment, index) => (
                  <tr
                    key={assignment.id}
                    className={`border-t border-slate-100 align-top transition-colors duration-200 hover:bg-blue-50/60 ${
                      index % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                    }`}
                  >
                    <td className="px-5 py-4 text-[16px] font-semibold text-slate-900">
                      {assignment.staff_name}
                    </td>
                    <td className="px-5 py-4 text-[16px] text-slate-600">
                      {assignment.room_number}
                    </td>
                    <td className="px-5 py-4 text-[16px] text-slate-600">
                      <div className="font-medium text-slate-700">{assignment.task}</div>
                      {assignment.notes ? (
                        <div className="mt-2 text-sm leading-5 text-slate-500">
                          {assignment.notes}
                        </div>
                      ) : null}
                      <div className="mt-2 text-sm font-semibold text-slate-500 xl:hidden">
                        Assigned on: {formatTimestamp(assignment.created_at)}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-3.5 py-1.5 text-sm font-bold ${getPriorityBadge(assignment.priority)}`}
                      >
                        {assignment.priority || "Normal"}
                      </span>
                    </td>
                    <td className="px-5 py-4 hidden text-[16px] text-slate-600 lg:table-cell">
                      {assignment.due_time || "--"}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-3.5 py-1.5 text-sm font-bold ${getStatusBadge(assignment.status)}`}
                      >
                        {assignment.status || "Pending"}
                      </span>
                    </td>
                    <td className="px-5 py-4 hidden text-[16px] text-slate-600 xl:table-cell">
                      {assignment.assigned_by || assignment.created_by_name || "--"}
                    </td>
                    <td className="px-5 py-4 hidden text-[16px] text-slate-600 xl:table-cell">
                      {formatTimestamp(assignment.created_at)}
                    </td>
                    <td className="px-5 py-4 hidden text-[16px] text-slate-600 xl:table-cell">
                      {formatTimestamp(assignment.updated_at || assignment.created_at)}
                    </td>
                    <td className="px-5 py-4">{renderActionButtons(assignment)}</td>
                  </tr>
                ))}

                {!pageLoading && assignments.length === 0 && (
                  <tr>
                    <td
                      colSpan="10"
                      className="px-5 py-14 text-center text-[16px] font-semibold text-slate-500"
                    >
                      No tasks assigned yet
                    </td>
                  </tr>
                )}

                {pageLoading && (
                  <tr>
                    <td
                      colSpan="10"
                      className="px-5 py-14 text-center text-[16px] font-semibold text-slate-500"
                    >
                      Loading assignments...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Assignment;