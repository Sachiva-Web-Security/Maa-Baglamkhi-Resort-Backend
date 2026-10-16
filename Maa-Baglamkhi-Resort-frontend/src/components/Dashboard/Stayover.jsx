import React, { useEffect, useMemo, useState } from "react";
import {
  FaArrowLeft,
  FaArrowRight,
  FaBed,
  FaBroom,
  FaCalendarAlt,
  FaChevronUp,
  FaDoorOpen,
  FaEdit,
  FaCheckCircle,
  FaExclamationCircle,
  FaHotel,
  FaPlus,
  FaSignInAlt,
  FaSignOutAlt,
  FaTimes,
} from "react-icons/fa";
import { useLocation, useNavigate } from "react-router-dom";

import API from "../../api";
import EditBooking from "../Hotel/EditBooking";
import { pushDashboardNotification } from "./dashboardNotifications";
import {
  getHousekeepingSocket,
  releaseHousekeepingSocket,
} from "../../utils/housekeepingSocket";
import {
  addDays,
  buildStaySummary,
  expandBookings,
  formatCurrency,
  formatHeaderDate,
  formatShortDate,
  getBookingContact,
  getRoomBookingReference,
  getBookingTimelineStatus,
  getRoomBookingForDate,
  mergeBookingsWithRooms,
  normalizeBookingPreview,
  normalizeRooms,
  roomSort,
  STATUS_META,
  todayISO,
} from "./stayoverUtils";
// Cleaning-task state used to be stored in localStorage via the
// bookingSession helpers. That logic has been moved to MySQL (the
// `hk_messages` table). See /housekeeping/notifications, /housekeeping/message,
// /housekeeping/assignee/:id and /housekeeping/status/:id endpoints.

const getHousekeepingUsers = (users) =>
  (Array.isArray(users) ? users : [])
    .filter((user) => String(user.role || "").toLowerCase().includes("housekeeping"))
    .map((user) => user.name)
    .filter(Boolean);

const normalizeStaffName = (value) =>
  String(value || "")
    .replace(/\s*\((busy|available)\)\s*$/i, "")
    .trim()
    .toLowerCase();

const normalizeDateInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
};

const popupTone = {
  success: {
    panel: "border-emerald-200 bg-emerald-50",
    badge: "bg-emerald-100 text-emerald-700",
    button: "bg-emerald-600 hover:bg-emerald-700",
    icon: FaCheckCircle,
  },
  error: {
    panel: "border-rose-200 bg-rose-50",
    badge: "bg-rose-100 text-rose-700",
    button: "bg-rose-600 hover:bg-rose-700",
    icon: FaExclamationCircle,
  },
};

const ACTIVE_BOOKINGS_PAGE_SIZE = 4;

const Stayover = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const today = todayISO();
  const initialStartDate = location.state?.startDate || today;
  const [selectedDate, setSelectedDate] = useState(initialStartDate);
  const [dateWindowStart, setDateWindowStart] = useState(initialStartDate);
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [bookingRecords, setBookingRecords] = useState([]);
  const [housekeepers, setHousekeepers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [dropdownRoom, setDropdownRoom] = useState(null); 
  const [expandedDay, setExpandedDay] = useState(selectedDate);
  const [editBookingModal, setEditBookingModal] = useState(null);
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const [selectedCleaningMinutes, setSelectedCleaningMinutes] = useState(30);
  const [assigningCleaning, setAssigningCleaning] = useState(false);
  const [cleaningNotifications, setCleaningNotifications] = useState([]);
  const [bookingDateDraft, setBookingDateDraft] = useState({ checkIn: "", checkOut: "" });
  const [savingBookingDates, setSavingBookingDates] = useState(false);
  const [actionPopup, setActionPopup] = useState({ open: false, type: "success", message: "" });
  const [cancelBookingModal, setCancelBookingModal] = useState({ open: false, reason: "", submitting: false });
  const [activeBookingsPage, setActiveBookingsPage] = useState(1);
// format: `${room.id}-${date}`
  const showActionPopup = React.useCallback((type, message) => {
    setActionPopup({ open: true, type, message });
  }, []);

  const fetchCleaningNotifications = React.useCallback(async () => {
    try {
      const res = await API.get("/housekeeping/notifications");
      setCleaningNotifications(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error("Notifications fetch failed", error);
      setCleaningNotifications([]);
    }
  }, []);

  const loadData = React.useCallback(async (silent = false) => {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const [bookingResponse, roomResponse, usersResponse] = await Promise.allSettled([
        API.get("/hotel/all-bookings"),
        API.get("/housekeeping"),
        API.get("/users"),
      ]);

      if (bookingResponse.status !== "fulfilled" || roomResponse.status !== "fulfilled") {
        throw bookingResponse.status !== "fulfilled" ? bookingResponse.reason : roomResponse.reason;
      }

      setBookingRecords(Array.isArray(bookingResponse.value.data) ? bookingResponse.value.data : []);
      setBookings(expandBookings(bookingResponse.value.data));
      setRooms(normalizeRooms(roomResponse.value.data));
      setHousekeepers(
        usersResponse.status === "fulfilled" ? getHousekeepingUsers(usersResponse.value.data) : [],
      );
      setError("");
      setHasLoadedOnce(true);
    } catch (err) {
      console.error(err);
      setError("Stay overview could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    fetchCleaningNotifications();
  }, [loadData, fetchCleaningNotifications]);

  useEffect(() => {
    const handleFocus = () => {
      loadData(true);
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadData(true);
      }
    };

    const intervalId = globalThis.setInterval(() => {
      loadData(true);
    }, 30000);

    globalThis.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      globalThis.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      globalThis.clearInterval(intervalId);
    };
  }, [loadData]);

  // Real-time refresh: listen for the `housekeeping-task-updated` event
  // that the backend emits after a housekeeper marks a room clean via
  // `PUT /housekeeping/notifications/:id/complete`. This updates the room
  // strip instantly — no waiting for the 30-second poll cycle.
  useEffect(() => {
    let mounted = true;

    const setupSocket = async () => {
      try {
        const socket = await getHousekeepingSocket();
        if (!socket || !mounted) return;

        const onUpdate = async (payload) => {
          if (!mounted) return;
          // Only react to the "notification completed" event so other
          // housekeeping changes (assignee updates, log entries, etc.)
          // don't trigger unnecessary refreshes.
          if (payload?.type !== "notification-completed") return;
          await loadData(true);
        };

        socket.on("housekeeping-task-updated", onUpdate);
      } catch {
        // Socket connection failed — the 30-second polling keeps the page
        // up to date anyway, so silently fall back.
      }
    };

    setupSocket();

    return () => {
      mounted = false;
      releaseHousekeepingSocket();
    };
  }, [loadData]);

  useEffect(() => {
    let mounted = true;

    const syncExpiredCleaningTasks = async () => {
      // Source of truth = /housekeeping/notifications (the hk_messages table).
      let tasks = [];
      try {
        const res = await API.get("/housekeeping/notifications");
        tasks = Array.isArray(res.data) ? res.data : [];
      } catch (error) {
        console.error("Notifications fetch failed", error);
        return;
      }

      const now = Date.now();
      let changed = false;

      for (const task of tasks) {
        const dueAt = task?.dueAt || task?.due_at;
        const dueMs = dueAt ? new Date(dueAt).getTime() : 0;
        const completed =
          task?.status === "Completed" || task?.completedAt || task?.completed_at;
        if (!dueMs || completed || now < dueMs) continue;

        const taskRoom =
          task.roomId ||
          task.room_id ||
          task.roomNo ||
          task.room_no ||
          task.room;
        if (!taskRoom) continue;

        try {
          await API.put(`/housekeeping/status/${taskRoom}`, {
            status: "Vacant Clean",
          });
        } catch (error) {
          console.error("Auto release failed", error);
        }

        try {
          if (task.id) {
            await API.put(`/housekeeping/notifications/${task.id}/complete`);
          }
        } catch (error) {
          console.error("Mark complete failed", error);
        }

        pushDashboardNotification({
          title: `Cleaning completed - Room ${taskRoom}`,
          message: `Room ${taskRoom} is available again.`,
          type: "success",
          route: "/housekeeping",
        });

        changed = true;
      }

      if (!mounted) return;
      if (changed) {
        await loadData(true);
        await fetchCleaningNotifications();
      }
    };

    syncExpiredCleaningTasks();
    const timer = globalThis.setInterval(syncExpiredCleaningTasks, 60000);
    return () => {
      mounted = false;
      globalThis.clearInterval(timer);
    };
  }, [loadData, fetchCleaningNotifications]);

  useEffect(() => {
    if (!location.state?.startDate) return;
    const nextDate = location.state.startDate;
    setSelectedDate(nextDate);
    setDateWindowStart(nextDate);
    setExpandedDay(nextDate);
  }, [location.state?.startDate]);

  const mergedBookings = useMemo(() => mergeBookingsWithRooms(bookings, rooms), [bookings, rooms]);
  const visibleDates = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(dateWindowStart, index)),
    [dateWindowStart],
  );

  const sortedRooms = useMemo(
    () =>
      [...rooms].sort((left, right) => {
        const categoryOrder = String(left.categoryName || "").localeCompare(String(right.categoryName || ""));
        return categoryOrder || roomSort(left.roomNumber, right.roomNumber);
      }),
    [rooms],
  );

  useEffect(() => {
    setExpandedDay(selectedDate);
  }, [selectedDate]);

  const shiftDateWindow = (days) => {
    const nextStart = addDays(dateWindowStart, days);
    setDateWindowStart(nextStart);
    setSelectedDate(nextStart);
    setExpandedDay(nextStart);
  };

  const staySummary = useMemo(
    () => buildStaySummary(rooms, mergedBookings, dateWindowStart, 7, today),
    [mergedBookings, rooms, dateWindowStart, today],
  );

  useEffect(() => {
    const closeDropdown = () => setDropdownRoom(null);
    globalThis.addEventListener("click", closeDropdown);
    return () => globalThis.removeEventListener("click", closeDropdown);
  }, []);


  const dailySummary = useMemo(
    () =>
      staySummary.map((day) => ({
        date: day.date,
        available: day.availableCount,
        occupied: day.checkedInCount,
        arrivals: day.arrivals.length,
        departures: day.departures.length,
      })),
    [staySummary],
  );

  const selectedDaySummary = useMemo(
    () => staySummary.find((day) => day.date === selectedDate) || staySummary[0] || null,
    [selectedDate, staySummary],
  );

  const upcomingBookings = useMemo(
    () =>
      [...mergedBookings]
        .filter((booking) => booking.checkIn)
        .sort((left, right) => left.checkIn.localeCompare(right.checkIn))
        .slice(0, 8),
    [mergedBookings],
  );

  const activeBookingRecords = useMemo(
    () =>
      [...bookingRecords].sort((left, right) =>
        String(right.bookingId || "").localeCompare(String(left.bookingId || ""), undefined, { numeric: true }),
      ),
    [bookingRecords],
  );

  const totalActiveBookingPages = useMemo(
    () => Math.max(1, Math.ceil(activeBookingRecords.length / ACTIVE_BOOKINGS_PAGE_SIZE)),
    [activeBookingRecords],
  );

  const paginatedActiveBookingRecords = useMemo(
    () =>
      activeBookingRecords.slice(
        (activeBookingsPage - 1) * ACTIVE_BOOKINGS_PAGE_SIZE,
        activeBookingsPage * ACTIVE_BOOKINGS_PAGE_SIZE,
      ),
    [activeBookingRecords, activeBookingsPage],
  );

  useEffect(() => {
    setActiveBookingsPage(1);
  }, [selectedDate]);

  useEffect(() => {
    if (activeBookingsPage > totalActiveBookingPages) {
      setActiveBookingsPage(totalActiveBookingPages);
    }
  }, [activeBookingsPage, totalActiveBookingPages]);

  const activeCleaningTasks = useMemo(() => {
    return cleaningNotifications
      .filter(
        (n) =>
          n.status !== "Completed" && !n.completedAt && !n.completed_at,
      )
      .map((n) => ({
        roomKey:
          n.roomId ||
          n.room_id ||
          n.roomNo ||
          n.room_no ||
          n.room,
        roomId: n.roomId || n.room_id,
        roomNumber: n.roomNo || n.room_no || n.room,
        assignee: n.assignedTo || n.assigned_to,
        minutes: n.minutes,
        dueAt: n.dueAt || n.due_at,
        status: n.status,
      }))
      .filter((task) => task?.assignee || task?.dueAt);
  }, [cleaningNotifications]);

  const busyHousekeepers = useMemo(() => {
    const busy = new Set();
    activeCleaningTasks.forEach((task) => {
      if (task?.assignee) {
        busy.add(normalizeStaffName(task.assignee));
      }
    });
    return busy;
  }, [activeCleaningTasks]);

  const currentCleaningTask = useMemo(() => {
    if (!selectedRoom) return null;
    const candidateKeys = new Set(
      [
        selectedRoom.roomData?.id,
        selectedRoom.roomData?.roomId,
        selectedRoom.roomId,
        selectedRoom.roomNumber,
        selectedRoom.booking?.roomId,
        selectedRoom.booking?.roomNumber,
      ]
        .filter((value) => value !== undefined && value !== null && String(value).trim() !== "")
        .map((value) => String(value).trim()),
    );

    return (
      activeCleaningTasks.find((task) => {
        const taskKeys = [task?.roomId, task?.roomKey, task?.roomNumber]
          .filter((value) => value !== undefined && value !== null && String(value).trim() !== "")
          .map((value) => String(value).trim());
        return taskKeys.some((key) => candidateKeys.has(key));
      }) || null
    );
  }, [activeCleaningTasks, selectedRoom]);

  const selectedAssigneeBusy = useMemo(() => {
    const activeAssignee = currentCleaningTask?.assignee || selectedRoom?.roomData?.assignee || "";
    const normalizedActiveAssignee = normalizeStaffName(activeAssignee);
    const normalizedSelected = normalizeStaffName(selectedAssignee);
    const roomUnderCleaning = Boolean(currentCleaningTask || selectedRoom?.roomData?.status === "cleaning");

    if (!roomUnderCleaning) {
      return busyHousekeepers.has(normalizedSelected);
    }

    if (!normalizedSelected) {
      return true;
    }

    return (
      busyHousekeepers.has(normalizedSelected) ||
      normalizedSelected === normalizedActiveAssignee ||
      normalizedSelected === normalizeStaffName(selectedRoom?.roomData?.assignee)
    );
  }, [busyHousekeepers, currentCleaningTask, selectedAssignee, selectedRoom]);

  const summaryCards = useMemo(
    () => [
      {
        label: "Occupied / Reserved",
        value: (selectedDaySummary?.confirmedCount || 0) + (selectedDaySummary?.checkedInCount || 0),
        helper: "Current booked inventory",
        icon: FaBed,
        tone: "from-sky-600 to-cyan-500",
      },
      {
        label: "Available Rooms",
        value: selectedDaySummary?.availableCount || 0,
        helper: "Ready for booking",
        icon: FaHotel,
        tone: "from-emerald-600 to-lime-500",
      },
      {
        label: "Cleaning Queue",
        value: selectedDaySummary?.cleaningCount || 0,
        helper: "Housekeeping pending",
        icon: FaBroom,
        tone: "from-violet-600 to-fuchsia-500",
      },
    ],
    [selectedDaySummary],
  );

  const handleRoomStatus = async (room, status) => {
    try {
      const housekeepingStatus = status === "available" ? "Vacant Clean" : "Vacant Dirty";
      await API.put(`/housekeeping/status/${room.id}`, { status: housekeepingStatus });
      await loadData(true);
    } catch (err) {
      console.error(err);
      showActionPopup("error", "Room status could not be updated.");
    }
  };

  const handleCellBookingLifecycle = async (room, booking, action) => {
    if (!booking?.bookingId || String(booking.bookingId).startsWith("room-")) {
      showActionPopup("error", "Is room ke liye valid booking record nahi mila.");
      return;
    }

    try {
      await API.put(`/hotel/${action}/${booking.bookingId}`);
      if (action === "check-out") {
        const roomId = room.id || room.roomId || room.roomNumber;
        await API.put(`/housekeeping/status/${roomId}`, { status: "Vacant Dirty" });
      }
      await loadData(true);
      showActionPopup("success", action === "check-in" ? "Guest checked in." : "Guest checked out. Room cleaning me chala gaya.");
    } catch (error) {
      console.error(error);
      showActionPopup("error", action === "check-in" ? "Check-in failed" : "Check-out failed");
    }
  };

  const getCellData = (room, date) => {
    const isHistoricalDate = date < today;
    const booking = getRoomBookingForDate(room.roomNumber, date, mergedBookings, !isHistoricalDate);
    if (room.status === "blocked" && date === today) return { status: "blocked", booking: null };
    if (room.status === "cleaning" && date === today) return { status: "cleaning", booking: null };
    if (isHistoricalDate && !booking) return { status: "no_booking", booking: null };
    return booking
      ? { status: getBookingTimelineStatus(booking, date, today), booking }
      : { status: "available", booking: null };
  };

  const openRoomPreview = (room, booking) => {
    const fallbackBooking =
      booking ||
      getRoomBookingReference(room.roomNumber, selectedDate, mergedBookings);

    setSelectedRoom({
      roomNumber: room.roomNumber,
      roomData: room,
      booking: fallbackBooking ? normalizeBookingPreview(fallbackBooking) : null,
    });
  };

  useEffect(() => {
    if (!selectedRoom) return;

    const roomId =
      selectedRoom.roomData?.id || selectedRoom.roomId || selectedRoom.roomNumber;
    const assignee = selectedRoom.roomData?.assignee;

    const task = activeCleaningTasks.find(
      (t) => String(t.roomKey) === String(roomId),
    );
    setSelectedAssignee(
      task?.assignee ||
        (assignee && assignee !== "No Housekeeper"
          ? assignee
          : housekeepers[0] || ""),
    );
    setSelectedCleaningMinutes(task?.minutes ? Number(task.minutes) || 30 : 30);
  }, [selectedRoom, housekeepers, activeCleaningTasks]);

  useEffect(() => {
    setBookingDateDraft({
      checkIn: normalizeDateInput(selectedRoom?.booking?.checkIn || ""),
      checkOut: normalizeDateInput(selectedRoom?.booking?.checkOut || ""),
    });
  }, [selectedRoom]);

  const bookingDateLimits = useMemo(() => {
    const originalCheckIn = normalizeDateInput(selectedRoom?.booking?.checkIn || "");
    const originalCheckOut = normalizeDateInput(selectedRoom?.booking?.checkOut || "");
    const minCheckIn = [today, originalCheckIn].filter(Boolean).sort().slice(-1)[0] || today;
    const minCheckOut = [today, bookingDateDraft.checkIn || minCheckIn, originalCheckOut]
      .filter(Boolean)
      .sort()
      .slice(-1)[0] || minCheckIn;

    return {
      minCheckIn,
      minCheckOut,
      originalCheckIn,
      originalCheckOut,
    };
  }, [bookingDateDraft.checkIn, selectedRoom, today]);

  const handleBookingDateChange = (field, value) => {
    setBookingDateDraft((prev) => {
      const next = { ...prev, [field]: value };

      if (field === "checkIn" && next.checkOut && next.checkOut < value) {
        next.checkOut = value;
      }

      return next;
    });
  };

  const handleSaveBookingDates = async () => {
    if (!selectedRoom?.booking?.bookingId || String(selectedRoom.booking.bookingId).startsWith("room-")) {
      showActionPopup("error", "Valid booking record nahi mila.");
      return;
    }

    const nextCheckIn = bookingDateDraft.checkIn;
    const nextCheckOut = bookingDateDraft.checkOut;

    if (!nextCheckIn || !nextCheckOut) {
      showActionPopup("error", "Check-in aur check-out dono dates zaroori hain.");
      return;
    }

    if (nextCheckIn < bookingDateLimits.minCheckIn) {
      showActionPopup("error", "Check-in date cannot be before existing booking date or today.");
      return;
    }

    if (nextCheckOut < bookingDateLimits.minCheckOut) {
      showActionPopup("error", "Check-out date cannot be before existing booking date or selected check-in.");
      return;
    }

    try {
      setSavingBookingDates(true);
      const response = await API.get(`/hotel/full-booking/${selectedRoom.booking.bookingId}`);
      const bookingDetails = response.data || {};

      await API.put(`/hotel/full-booking/${selectedRoom.booking.bookingId}`, {
        guest_name: bookingDetails.guest_name || bookingDetails.guestName || selectedRoom.booking.guestName || "",
        mobile: bookingDetails.mobile || selectedRoom.booking.mobile || "",
        company_name: bookingDetails.company_name || bookingDetails.companyName || selectedRoom.booking.company || "",
        paidAmount: bookingDetails.paidAmount || selectedRoom.booking.paidAmount || 0,
        checkIn: nextCheckIn,
        checkOut: nextCheckOut,
        arrival: bookingDetails.arrival || null,
        departure: bookingDetails.departure || null,
        rooms: Array.isArray(bookingDetails.rooms) ? bookingDetails.rooms : [],
      });

      setSelectedRoom((current) =>
        current
          ? {
              ...current,
              booking: {
                ...current.booking,
                checkIn: nextCheckIn,
                checkOut: nextCheckOut,
              },
              roomData: {
                ...current.roomData,
                checkIn: nextCheckIn,
                checkOut: nextCheckOut,
              },
            }
          : current,
      );

      await loadData(true);
      showActionPopup("success", "Booking dates updated.");
    } catch (error) {
      console.error(error);
      showActionPopup("error", "Booking dates could not be updated.");
    } finally {
      setSavingBookingDates(false);
    }
  };

  const handleAssignCleaning = async () => {
    const roomId = selectedRoom?.roomData?.id || selectedRoom?.roomId || selectedRoom?.roomNumber;
    if (!roomId) {
      showActionPopup("error", "Room record missing hai.");
      return;
    }

    if (!selectedAssignee) {
      showActionPopup("error", "Please housekeeper select karein.");
      return;
    }

    try {
      setAssigningCleaning(true);
      await API.put(`/housekeeping/assignee/${roomId}`, { assignee: selectedAssignee });
      await API.put(`/housekeeping/status/${roomId}`, { status: "Vacant Dirty" });

      const receptionist =
        localStorage.getItem("name") ||
        localStorage.getItem("email") ||
        "Front Desk";
      const roomLabel = selectedRoom.roomNumber || roomId;
      const roomType = selectedRoom.roomData?.categoryName || "";

      await API.post("/housekeeping/message", {
        roomId,
        roomNo: roomId,
        assignedTo: selectedAssignee,
        receptionist,
        message: `Cleaning assigned for Room ${roomLabel}${roomType ? ` (${roomType})` : ""} — please complete within ${selectedCleaningMinutes} minutes.`,
        taskLabel: "Manual Cleaning Assignment",
        dueAt: new Date(
          Date.now() + Number(selectedCleaningMinutes || 30) * 60000,
        ).toISOString(),
      });

      pushDashboardNotification({
        title: `Cleaning assigned - Room ${selectedRoom.roomNumber}`,
        message: `Assigned to ${selectedAssignee} for ${selectedCleaningMinutes} min`,
        type: "info",
        route: "/housekeeping",
      });
      await loadData(true);
      await fetchCleaningNotifications();
      setSelectedRoom((prev) =>
        prev
          ? {
              ...prev,
              roomData: {
                ...prev.roomData,
                assignee: selectedAssignee,
                status: "cleaning",
                housekeepingLabel: "Vacant Dirty",
              },
            }
          : prev,
      );
      showActionPopup(
        "success",
        `Cleaning assigned. Visible on /housekeepernotification.`,
      );
    } catch (err) {
      console.error(err);
      showActionPopup("error", "Cleaning could not be assigned.");
    } finally {
      setAssigningCleaning(false);
    }
  };

  const handleMarkClean = async () => {
    const roomId = selectedRoom?.roomData?.id || selectedRoom?.roomId || selectedRoom?.roomNumber;
    if (!roomId) {
      showActionPopup("error", "Room record missing hai.");
      return;
    }

    try {
      setAssigningCleaning(true);
      await API.put(`/housekeeping/status/${roomId}`, { status: "Vacant Clean" });

      // Also flip any matching hk_messages row to Completed so it leaves the
      // /housekeepernotification feed as well.
      const matchingTask = cleaningNotifications.find((n) => {
        if (n.status === "Completed" || n.completedAt || n.completed_at) return false;
        const ids = [n.roomId, n.room_id, n.roomNo, n.room_no, n.room]
          .filter((value) => value !== undefined && value !== null && String(value).trim() !== "")
          .map((value) => String(value).trim());
        return ids.includes(String(roomId));
      });
      if (matchingTask?.id) {
        try {
          await API.put(`/housekeeping/notifications/${matchingTask.id}/complete`);
        } catch (error) {
          console.error("Mark complete failed", error);
        }
      }

      await loadData(true);
      await fetchCleaningNotifications();
      setSelectedRoom((prev) =>
        prev
          ? {
              ...prev,
              roomData: {
                ...prev.roomData,
                status: "available",
                housekeepingLabel: "Vacant Clean",
              },
            }
          : prev,
      );
      showActionPopup("success", "Room marked clean.");
    } catch (err) {
      console.error(err);
      showActionPopup("error", "Mark clean failed.");
    } finally {
      setAssigningCleaning(false);
    }
  };

  const handleBlockedRoom = async (mode) => {
    const roomNumber = selectedRoom?.roomNumber;
    if (!roomNumber) {
      showActionPopup("error", "Room number missing hai.");
      return;
    }

    try {
      if (mode === "block") {
        const blockReason = window.prompt("Block reason likhiye", selectedRoom?.roomData?.blockReason || "Maintenance");
        if (blockReason === null) return;
        const blockFrom = window.prompt("Block from date (YYYY-MM-DD)", selectedDate || todayISO());
        if (blockFrom === null) return;
        const blockTo = window.prompt(
          "Block to date (YYYY-MM-DD)",
          selectedRoom?.roomData?.blockTo || blockFrom || selectedDate || todayISO(),
        );
        if (blockTo === null) return;
        const blockNotes = window.prompt("Notes", selectedRoom?.roomData?.blockNotes || "") ?? "";

        await API.put(`/hotel/rooms/state/${roomNumber}`, {
          status: "Blocked",
          blockReason,
          blockFrom,
          blockTo,
          blockNotes,
          blockedBy: "Front Desk",
        });
      } else {
        await API.put(`/hotel/rooms/state/${roomNumber}`, {
          status: "Available",
        });
      }

      await loadData(true);
      setSelectedRoom(null);
      showActionPopup("success", mode === "block" ? "Room blocked successfully." : "Room unblocked successfully.");
    } catch (error) {
      console.error(error);
      showActionPopup("error", mode === "block" ? "Room could not be blocked." : "Room could not be unblocked.");
    }
  };

  const handleBookingLifecycle = async (action) => {
    if (!selectedRoom?.booking?.bookingId || String(selectedRoom.booking.bookingId).startsWith("room-")) {
      showActionPopup("error", "Is room ke liye valid booking record nahi mila.");
      return;
    }

    try {
      await API.put(`/hotel/${action}/${selectedRoom.booking.bookingId}`);
      if (action === "check-out" && selectedRoom.roomNumber) {
        await API.put(`/housekeeping/status/${selectedRoom.roomData?.id || selectedRoom.roomNumber}`, {
          status: "Vacant Dirty",
        });
      }
      await loadData(true);
      setSelectedRoom(null);
      showActionPopup("success", action === "check-in" ? "Guest checked in." : "Guest checked out. Room cleaning me chala gaya.");
    } catch (error) {
      console.error(error);
      showActionPopup("error", action === "check-in" ? "Check-in failed" : "Check-out failed");
    }
  };

  const handleCancelBooking = async () => {
    const bookingId = selectedRoom?.booking?.bookingId;
    const cancelReason = String(cancelBookingModal.reason || "").trim();

    if (!bookingId || String(bookingId).startsWith("room-")) {
      showActionPopup("error", "Is room ke liye valid booking record nahi mila.");
      return;
    }

    if (!cancelReason) {
      showActionPopup("error", "Cancellation reason zaroor likhiye.");
      return;
    }

    try {
      setCancelBookingModal((current) => ({ ...current, submitting: true }));
      await API.put(`/hotel/cancel/${bookingId}`, { reason: cancelReason });
      await loadData(true);
      setCancelBookingModal({ open: false, reason: "", submitting: false });
      setSelectedRoom(null);
      showActionPopup("success", "Booking cancelled successfully.");
    } catch (error) {
      console.error(error);
      setCancelBookingModal((current) => ({ ...current, submitting: false }));
      showActionPopup("error", error.response?.data?.message || "Booking could not be cancelled.");
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(135deg,#eff8ff_0%,#f6fbf7_42%,#fffaf0_100%)] p-3 sm:p-4 lg:p-5">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-8%] top-[-10%] h-72 w-72 rounded-full bg-cyan-200/60 blur-3xl sm:h-96 sm:w-96" />
        <div className="absolute right-[-8%] top-[8%] h-72 w-72 rounded-full bg-blue-200/45 blur-3xl sm:h-[28rem] sm:w-[28rem]" />
        <div className="absolute bottom-[-8%] left-[22%] h-72 w-72 rounded-full bg-amber-200/40 blur-3xl sm:h-[26rem] sm:w-[26rem]" />
      </div>

      <div className="relative w-full space-y-4 md:space-y-5 lg:space-y-6">
        <section className="overflow-hidden rounded-[24px] sm:rounded-[28px] lg:rounded-[30px] border border-white/70 bg-gradient-to-br from-blue-950 via-blue-800 to-sky-500 px-4 py-5 text-white shadow-[0_24px_70px_rgba(15,23,42,0.18)] sm:px-7 lg:px-8">
          <div className="grid gap-5 md:gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)] lg:items-center">
            <div>
              <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.35em] text-cyan-200">Stay Overview</p>
              <h1 className="mt-2 text-2xl sm:text-4xl font-black leading-tight lg:text-5xl">
                Category-wise room inventory with live booking status
              </h1>
              <p className="mt-2 text-sm sm:text-base font-medium leading-6 sm:leading-7 text-slate-100/90">
Stay Overview provides a live room-wise status view, with the same real-time data seamlessly reflected across the main dashboard.              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => navigate("/dashboard")}
                  className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2.5 text-sm sm:text-base font-bold text-white backdrop-blur transition hover:bg-white/15"
                >
                  <FaDoorOpen />
                  Main Dashboard
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/stayover")}
                  className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm sm:text-base font-bold text-slate-900 shadow-[0_12px_30px_rgba(255,255,255,0.2)] transition hover:-translate-y-0.5"
                >
                  <FaCalendarAlt className="text-sky-600" />
                  Stay Overview
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/hotel/guest", { state: { resetBookingDraft: true } })}
                  className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2.5 text-sm sm:text-base font-bold text-white backdrop-blur transition hover:bg-white/15"
                >
                  <FaPlus />
                  New Booking
                </button>
              </div>
            </div>

            <div className="grid gap-3 grid-cols-1 md:grid-cols-3 xl:grid-cols-3">
              {summaryCards.map((card) => {
                const Icon = card.icon;
                return (
                  <div key={card.label} className="rounded-[18px] sm:rounded-[22px] border border-white/12 bg-white/10 p-3 sm:p-4 backdrop-blur-md">
                    <div className={`inline-flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-gradient-to-r ${card.tone} text-white`}>
                      <Icon />
                    </div>
                    <div className="mt-3 sm:mt-4 text-sm sm:text-base font-bold text-slate-100/90">{card.label}</div>
                    <div className="mt-1 text-3xl sm:text-4xl font-black">{card.value}</div>
                    <div className="mt-1 text-xs sm:text-sm font-medium text-slate-200/80">{card.helper}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="rounded-[24px] sm:rounded-[28px] lg:rounded-[30px] border border-slate-200/70 bg-white/85 p-4 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.28em] text-sky-700">Booking Strip</p>
              <h2 className="mt-1 sm:mt-2 text-2xl sm:text-3xl font-black text-slate-900">Room-number stay overview board</h2>
              <p className="mt-1 sm:mt-2 text-sm sm:text-base font-medium text-slate-500">
Room-wise rows with a 7-day booking timeline, displayed in a Booking Master–style layout.              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl sm:rounded-full border border-slate-200 bg-slate-50 p-2 sm:px-3 sm:py-2 shadow-sm">
                <button
                  type="button"
                  onClick={() => shiftDateWindow(-7)}
                  className="inline-flex items-center justify-center gap-1 sm:gap-2 rounded-full border border-sky-200 bg-sky-600 px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold uppercase tracking-[0.16em] text-white shadow-sm transition hover:bg-sky-700"
                >
                  <FaArrowLeft />
                  <span className="hidden xs:inline">Previous</span>
                  <span className="xs:hidden">Prev</span>
                </button>
                <div className="inline-flex items-center gap-2 rounded-full bg-white px-2 sm:px-3 py-2 text-sm sm:text-base font-semibold text-slate-700 shadow-sm">
                  <FaCalendarAlt className="text-sky-600 text-xs sm:text-base" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(event) => {
                      const nextDate = event.target.value;
                      setSelectedDate(nextDate);
                      setDateWindowStart(nextDate);
                      setExpandedDay(nextDate);
                    }}
                    className="bg-transparent outline-none w-28 sm:w-auto"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => shiftDateWindow(7)}
                  className="inline-flex items-center justify-center gap-1 sm:gap-2 rounded-full border border-sky-200 bg-sky-600 px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold uppercase tracking-[0.16em] text-white shadow-sm transition hover:bg-sky-700"
                >
                  <span className="hidden xs:inline">Next</span>
                  <span className="xs:hidden">Next</span>
                  <FaArrowRight />
                </button>
                <div className="hidden sm:inline-flex rounded-full bg-slate-100 px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold uppercase tracking-[0.18em] text-slate-600">
                  7 day pagination
                </div>
              </div>
              <div className="rounded-full bg-white px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 shadow-sm text-center">
                {formatShortDate(dateWindowStart)} - {formatShortDate(addDays(dateWindowStart, 6))}
              </div>
              <button
                type="button"
                onClick={() => navigate("/hotel/guest", { state: { resetBookingDraft: true } })}
                className="w-full sm:w-auto rounded-full bg-linear-to-r from-sky-600 to-blue-500 px-5 py-3 text-base font-bold text-white shadow-[0_12px_30px_rgba(37,99,235,0.24)] transition hover:-translate-y-0.5"
              >
                Start With Guest
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {Object.entries(STATUS_META).map(([key, value]) => (
              <div
                key={key}
                className={`rounded-full px-4 py-2 text-[13px] font-extrabold tracking-[0.01em] ${value.badge}`}
              >
                {value.label}
              </div>
            ))}
          </div>

          {loading && !hasLoadedOnce ? (
            <div className="mt-6 rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center text-base font-medium text-slate-500">
              Stay overview load ho raha hai...
            </div>
          ) : error ? (
            <div className="mt-6 flex items-center gap-3 rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-5 text-base font-medium text-rose-700">
              <FaExclamationCircle />
              {error}
            </div>
          ) : (
            <>
              {refreshing ? (
                <div className="mt-4 rounded-full bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700">
                  Refreshing live booking data...
                </div>
              ) : null}
              {/* Desktop Room Table */}
              <div className="hidden lg:block mt-6">
                <div className="min-w-[1260px] overflow-hidden rounded-[24px] border border-slate-200 bg-white">
                  <div className="grid grid-cols-[220px_repeat(7,minmax(0,1fr))]">
                    <div className="sticky left-0 z-30 border-r border-b border-slate-200 bg-slate-700 px-4 py-3 text-sm font-bold uppercase tracking-[0.18em] text-white">
                      Rooms
                    </div>
                    {visibleDates.map((date, index) => (
                      <button
                        type="button"
                        key={date}
                        onClick={() => {
                          setSelectedDate(date);
                          setExpandedDay(date);
                        }}
                        className={`relative border-r border-b border-slate-200 px-2 py-2 text-left last:border-r-0 transition hover:opacity-95 ${
                          index === 0
                            ? "bg-gradient-to-b from-orange-500 to-orange-400 text-white"
                            : "bg-gradient-to-b from-slate-100 to-white text-slate-900"
                        }`}
                      >
                        <div
                          className={`rounded-[18px] px-2 py-1.5 ${
                            expandedDay === date ? "bg-white/20 ring-1 ring-white/60" : ""
                          }`}
                        >
                          <div className="pr-10 text-left text-sm font-black leading-tight sm:text-base">
                            {formatHeaderDate(date)}
                          </div>
                        </div>
                        <span
                          className={`absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-lg font-black shadow-sm ${
                            expandedDay === date
                              ? "bg-white text-slate-900"
                              : "bg-white/85 text-slate-700"
                          }`}
                        >
                          <FaChevronUp className="h-3.5 w-3.5" />
                        </span>
                      </button>
                    ))}

                    <div className="sticky left-0 z-30 border-r border-b border-slate-200 bg-[#6b7892] px-4 py-2.5 text-sm font-bold text-white">
                      Total
                    </div>
                    {dailySummary.map((day) => (
                      <div
                        key={day.date}
                        className="border-r border-b border-slate-200 bg-[#7b969f] px-3 py-2.5 text-center text-white last:border-r-0"
                      >
                        <div className="text-2xl font-black">{day.available}</div>
                        <div className="text-sm font-bold uppercase tracking-[0.16em] text-white/85">Available</div>
                        <div className="mt-2 text-sm font-medium text-white/80">
                          {day.occupied} occupied | {day.arrivals} arr | {day.departures} dep
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="max-h-[52vh] overflow-y-auto">
                    <div className="grid grid-cols-[220px_repeat(7,minmax(0,1fr))]">
                      {sortedRooms.map((room) => (
                        <React.Fragment key={room.id}>
                    <div className="sticky left-0 z-20 border-r border-b border-slate-200 bg-slate-50 px-4 py-3">
                            <div className="flex items-start justify-between gap-3">
                              <button type="button" onClick={() => openRoomPreview(room, null)} className="text-left">
                                <div className="text-2xl font-black text-slate-900">{room.roomNumber}</div>
                                <div className="mt-1 text-sm font-bold uppercase tracking-[0.14em] text-sky-700">
                                  ID {room.roomId || room.id || "--"}
                                </div>
                                <div className="text-sm font-bold uppercase tracking-[0.14em] text-slate-500">
                                  {room.categoryName || "Uncategorized"}
                                </div>
                                  <div
                                    className={`mt-2 inline-flex rounded-full px-4 py-2 text-[13px] font-extrabold tracking-[0.01em] ${
                                      STATUS_META[room.status]?.badge || STATUS_META.available.badge
                                    }`}
                                  >
                                    {STATUS_META[room.status]?.label || "Available"}
                                  </div>
                              </button>
                              <button
                                type="button"
                                onClick={() => navigate("/hotel/room", { state: { editRoomId: room.id } })}
                                className="rounded-full bg-white p-2 text-slate-600 shadow-sm"
                              >
                                <FaEdit />
                              </button>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {room.status === "cleaning" ? (
                                <button
                                  type="button"
                                  onClick={() => handleRoomStatus(room, "available")}
                                  className="rounded-full bg-emerald-500 px-3 py-1 text-sm font-bold text-white"
                                >
                                  Mark Clean
                                </button>
                              ) : null}
                              {room.status === "available" ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    navigate("/hotel/guest", {
                                      state: {
                                        roomNumber: room.roomNumber,
                                        category: room.categoryName,
                                        resetBookingDraft: true,
                                      },
                                    })
                                  }
                                  className="rounded-full bg-sky-600 px-3 py-1 text-sm font-bold text-white"
                                >
                                  Book Now
                                </button>
                              ) : null}
                            </div>
                          </div>

                          {visibleDates.map((date) => {
                            const cell = getCellData(room, date);
                            const meta = STATUS_META[cell.status] || STATUS_META.available;
                            return (
                              <div
                                key={`${room.id}-${date}`}
                                className="relative min-h-[84px] border-r border-b border-slate-200 bg-[linear-gradient(180deg,#f8fbfd_0%,#eef5f8_100%)] p-2 last:border-r-0"
                              >
                                <div className="absolute right-1 top-1 z-40">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const key = `${room.id}-${date}`;
                                      setDropdownRoom(dropdownRoom === key ? null : key);
                                    }}
                                    className="text-gray-600 hover:text-black"
                                  >
                                    <FaBroom />
                                  </button>
                                </div>

                                {dropdownRoom === `${room.id}-${date}` && (
                                  <div
                                    className="absolute right-2 top-8 z-50 w-44 rounded-lg border bg-white p-2 shadow-lg"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {room.status !== "cleaning" && (
                                      <button
                                        onClick={() => {
                                          handleRoomStatus(room, "cleaning");
                                          setDropdownRoom(null);
                                        }}
                                        className="block w-full px-3 py-2 text-left text-base font-medium hover:bg-gray-100"
                                      >
                                        Send to Cleaning
                                      </button>
                                    )}

                                    {room.status === "cleaning" && (
                                      <button
                                        onClick={() => {
                                          handleRoomStatus(room, "available");
                                          setDropdownRoom(null);
                                        }}
                                        className="block w-full px-3 py-2 text-left text-base font-medium hover:bg-gray-100"
                                      >
                                        Mark Clean
                                      </button>
                                    )}

                                    <button
                                      onClick={() => {
                                        openRoomPreview(room, cell.booking);
                                        setDropdownRoom(null);
                                      }}
                                      className="block w-full px-3 py-2 text-left text-base font-medium hover:bg-gray-100"
                                    >
                                      View Details
                                    </button>
                                  </div>
                                )}

                                {cell.booking ? (
                                  <button
                                    type="button"
                                    onClick={() => openRoomPreview(room, cell.booking)}
                                    className={`h-full w-full rounded-[16px] border px-3 py-2 text-left shadow-sm ${meta.cell}`}
                                  >
                                    <div className="text-base font-black uppercase">{cell.booking.guestName}</div>
                                    <div className="mt-1 text-sm font-medium">
                                      Room {room.roomNumber} | {room.categoryName}
                                    </div>
                                    <div className="mt-1 text-sm font-bold uppercase tracking-[0.14em]">
                                      {meta.label}
                                    </div>
                                    <div className="mt-2 text-sm font-semibold">
                                      {formatShortDate(cell.booking.checkIn)} to {formatShortDate(cell.booking.checkOut)}
                                    </div>
                                    <div className="mt-1 text-sm font-medium opacity-80">
                                      {cell.booking.bookingCode || cell.booking.bookingId || "--"}
                                    </div>
                                    <div className="mt-1 text-sm font-medium opacity-80">
                                      {getBookingContact(cell.booking) || "No contact"}
                                    </div>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => openRoomPreview(room, null)}
                                    className={`flex h-full w-full items-center justify-center rounded-[16px] border text-sm font-bold uppercase tracking-[0.16em] ${meta.cell}`}
                                  >
                                    {meta.label}
                                  </button>
                                )}

                                {/* Check In / Check Out action buttons */}
                                {cell.booking && !String(cell.booking.bookingId).startsWith("room-") && (() => {
                                  const isCheckedIn = String(cell.booking.bookingStatus || "").toLowerCase().includes("checked in");
                                  const canCheckIn = !isCheckedIn;
                                  const canCheckOut = isCheckedIn;
                                  if (!canCheckIn && !canCheckOut) return null;
                                  return (
                                    <div className="mt-2 flex gap-1.5">
                                      {canCheckIn && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleCellBookingLifecycle(room, cell.booking, "check-in");
                                          }}
                                          className="flex-1 rounded-lg bg-emerald-600 px-2 py-1.5 text-[11px] font-bold text-white shadow-sm transition hover:bg-emerald-700"
                                        >
                                          <FaSignInAlt className="text-[10px]" /> In
                                        </button>
                                      )}
                                      {canCheckOut && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleCellBookingLifecycle(room, cell.booking, "check-out");
                                          }}
                                          className="flex-1 rounded-lg bg-orange-500 px-2 py-1.5 text-[11px] font-bold text-white shadow-sm transition hover:bg-orange-600"
                                        >
                                          <FaSignOutAlt className="text-[10px]" /> Out
                                        </button>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Mobile Room Cards */}
              <div className="lg:hidden mt-4 space-y-3">
                {sortedRooms.map((room) => {
                  const roomStatusMeta = STATUS_META[room.status] || STATUS_META.available;
                  return (
                    <div key={room.id} className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xl font-black text-slate-900">{room.roomNumber}</div>
                          <div className="mt-1 text-sm font-bold uppercase tracking-[0.14em] text-sky-700">
                            ID {room.roomId || room.id || "--"}
                          </div>
                          <div className="text-sm font-bold uppercase tracking-[0.14em] text-slate-500">
                            {room.categoryName || "Uncategorized"}
                          </div>
                          <div className={`mt-2 inline-flex rounded-full px-3 py-1.5 text-xs font-extrabold tracking-[0.01em] ${roomStatusMeta.badge}`}>
                            {roomStatusMeta.label}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate("/hotel/room", { state: { editRoomId: room.id } })}
                          className="rounded-full bg-white p-2 text-slate-600 shadow-sm"
                        >
                          <FaEdit />
                        </button>
                      </div>

                      {/* 7-Day Mini Strip */}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {visibleDates.map((date) => {
                          const cell = getCellData(room, date);
                          const meta = STATUS_META[cell.status] || STATUS_META.available;
                          return (
                            <div key={date} className={`flex-1 min-w-[38px] rounded-lg px-1 py-2 text-center ${meta.badge}`}>
                              <div className="text-[10px] font-bold opacity-80">{formatShortDate(date)}</div>
                              <div className="mt-0.5 text-[11px] font-black truncate">
                                {cell.booking ? (cell.booking.guestName?.split(' ')[0] || '...') : meta.label}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Check In / Check Out for today's booking */}
                      {(() => {
                        const todayCell = getCellData(room, today);
                        if (!todayCell.booking || String(todayCell.booking.bookingId).startsWith("room-")) return null;
                        const isCheckedIn = String(todayCell.booking.bookingStatus || "").toLowerCase().includes("checked in");
                        const canCheckIn = !isCheckedIn;
                        const canCheckOut = isCheckedIn;
                        if (!canCheckIn && !canCheckOut) return null;
                        return (
                          <div className="mt-2 flex gap-2">
                            {canCheckIn && (
                              <button
                                type="button"
                                onClick={() => handleCellBookingLifecycle(room, todayCell.booking, "check-in")}
                                className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700"
                              >
                                <FaSignInAlt className="text-xs" /> Check In
                              </button>
                            )}
                            {canCheckOut && (
                              <button
                                type="button"
                                onClick={() => handleCellBookingLifecycle(room, todayCell.booking, "check-out")}
                                className="flex-1 rounded-lg bg-orange-500 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-orange-600"
                              >
                                <FaSignOutAlt className="text-xs" /> Check Out
                              </button>
                            )}
                          </div>
                        );
                      })()}

                      {/* Action Buttons */}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {room.status === "cleaning" && (
                          <button
                            type="button"
                            onClick={() => handleRoomStatus(room, "available")}
                            className="flex-1 min-w-[70px] rounded-full bg-emerald-500 px-2 py-2 text-xs font-bold text-white"
                          >
                            Mark Clean
                          </button>
                        )}
                        {room.status === "available" && (
                          <button
                            type="button"
                            onClick={() =>
                              navigate("/hotel/guest", {
                                state: {
                                  roomNumber: room.roomNumber,
                                  category: room.categoryName,
                                  resetBookingDraft: true,
                                },
                              })
                            }
                            className="flex-1 min-w-[70px] rounded-full bg-sky-600 px-2 py-2 text-xs font-bold text-white"
                          >
                            Book Now
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openRoomPreview(room, null)}
                          className="flex-1 min-w-[70px] rounded-full border border-slate-200 bg-white px-2 py-2 text-xs font-bold text-slate-700"
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-base font-medium text-slate-500">
                  Showing {sortedRooms.length} rooms in the current 7-day view
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => shiftDateWindow(-7)}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-base font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    Previous 7 Days
                  </button>
                  <div className="rounded-full bg-slate-100 px-4 py-2 text-base font-bold text-slate-700">
                    {formatShortDate(dateWindowStart)} - {formatShortDate(addDays(dateWindowStart, 6))}
                  </div>
                  <button
                    type="button"
                    onClick={() => shiftDateWindow(7)}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-base font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    Next 7 Days
                  </button>
                </div>
              </div>
            </>
          )}
        </section>

        <section className="grid gap-1 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <div className="space-y-6">
            <div className="rounded-[28px] border-slate-200/70 bg-white/85 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.28em] text-emerald-600">Active Booking Data</p>
                  <h3 className="mt-2 text-2xl font-black text-slate-900">{formatShortDate(selectedDate)} ke live stays</h3>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/hotel/all-bookings")}
                  className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-base font-bold text-slate-700 transition hover:bg-slate-100"
                >
                  View All
                </button>
              </div>
              <div className="mt-5 space-y-3">
                {activeBookingRecords.length ? (
                  paginatedActiveBookingRecords.map((booking) => {
                    const roomNumber = String(booking.rooms || "").split(",")[0]?.trim() || booking.rooms || "";
                    const room =
                      rooms.find((item) => String(item.roomNumber) === String(roomNumber)) || {
                        roomNumber,
                        categoryName: booking.company_name || "Direct",
                      };

                    return (
                      <button
                        type="button"
                        key={booking.bookingId}
                        onClick={() => openRoomPreview(room, booking)}
                        className="w-full rounded-[22px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f7fbff_100%)] p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <div className="text-sm font-bold uppercase tracking-[0.24em] text-slate-400">
                              Booking #{booking.bookingId}
                            </div>
                            <div className="mt-1 text-xl font-black text-slate-900">
                              {booking.guest_name || booking.guestName || "Walk-in Guest"}
                            </div>
                            <div className="mt-1 text-base font-medium text-slate-500">
                              Room {booking.rooms || "Not assigned yet"} | {getBookingContact(booking) || "--"} |{" "}
                              {booking.company_name || booking.company || "Direct"}
                            </div>
                            <div className="mt-1 text-sm font-bold uppercase tracking-[0.16em] text-slate-400">
                              {booking.booking_status || "Confirmed"}
                            </div>
                          </div>
                          <div className="rounded-[18px] bg-sky-50 px-4 py-3 text-base font-bold text-sky-700">
                            {formatShortDate(booking.check_in || booking.checkIn)} to{" "}
                            {formatShortDate(booking.check_out || booking.checkOut)}
                          </div>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                          <div className="rounded-[18px] bg-slate-50 px-4 py-3 text-base font-medium text-slate-600">
                            Total Bill
                            <div className="mt-1 text-xl font-black text-slate-900">
                              {formatCurrency(booking.totalAmount)}
                            </div>
                          </div>
                          <div className="rounded-[18px] bg-emerald-50 px-4 py-3 text-base font-medium text-emerald-700">
                            Paid
                            <div className="mt-1 text-xl font-black text-emerald-900">
                              {formatCurrency(booking.paidAmount)}
                            </div>
                          </div>
                          <div className="rounded-[18px] bg-amber-50 px-4 py-3 text-base font-medium text-amber-700">
                            Remaining
                            <div className="mt-1 text-xl font-black text-amber-900">
                              {formatCurrency(booking.remainingAmount)}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center text-base font-medium text-slate-500">
                    Backend se abhi koi active booking record nahi mila.
                  </div>
                )}
              </div>

              {activeBookingRecords.length > ACTIVE_BOOKINGS_PAGE_SIZE ? (
                <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm font-medium text-slate-500">
                    Page {activeBookingsPage} of {totalActiveBookingPages}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveBookingsPage((current) => Math.max(1, current - 1))}
                      disabled={activeBookingsPage === 1}
                      className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Previous
                    </button>
                    {Array.from({ length: totalActiveBookingPages }, (_, index) => index + 1).map((pageNumber) => (
                      <button
                        key={`active-bookings-page-${pageNumber}`}
                        type="button"
                        onClick={() => setActiveBookingsPage(pageNumber)}
                        className={`h-10 min-w-10 rounded-full px-3 text-sm font-bold transition ${
                          activeBookingsPage === pageNumber
                            ? "bg-[#2563eb] text-white shadow-[0_10px_20px_rgba(37,99,235,0.18)]"
                            : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {pageNumber}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setActiveBookingsPage((current) => Math.min(totalActiveBookingPages, current + 1))
                      }
                      disabled={activeBookingsPage === totalActiveBookingPages}
                      className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            </div>

          <div className="space-y-6">
            <div className="rounded-[28px] border border-slate-200/70 bg-white/85 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl">
              <p className="text-sm font-bold uppercase tracking-[0.28em] text-violet-600">Upcoming Bookings</p>
              <h3 className="mt-2 text-2xl font-black text-slate-900">Recent booking feed with dates</h3>
              <div className="mt-5 space-y-3">
                {upcomingBookings.length ? (
                  upcomingBookings.map((booking) => (
                    <div
                      key={`feed-${booking.bookingId}-${booking.roomNumber}-${booking.checkIn}`}
                      className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-base font-black text-slate-900">{booking.guestName}</div>
                          <div className="mt-1 text-sm font-bold uppercase tracking-[0.14em] text-slate-500">
                            Room {booking.roomNumber}
                          </div>
                        </div>
                        <div className="rounded-full bg-white px-3 py-1 text-sm font-bold text-sky-700 shadow-sm">
                          #{booking.bookingId}
                        </div>
                      </div>
                      <div className="mt-3 text-base font-medium text-slate-600">
                        {formatShortDate(booking.checkIn)} to {formatShortDate(booking.checkOut)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[20px] border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-base font-medium text-slate-500">
                    Booking feed abhi empty hai.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      {selectedRoom ? (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/50 px-4 py-5 backdrop-blur-sm"
          onClick={() => setSelectedRoom(null)}
        >
          <div
            className="w-full max-w-5xl overflow-hidden rounded-[32px] border border-white/70 bg-[linear-gradient(135deg,#f8fcff_0%,#f7fbff_38%,#f5fbf7_100%)] shadow-[0_30px_90px_rgba(15,23,42,0.26)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative overflow-hidden border-b border-slate-200 bg-[linear-gradient(135deg,#082f49_0%,#1d4ed8_42%,#0f766e_100%)] px-5 py-5 text-white sm:px-6">
              <div className="pointer-events-none absolute inset-0 opacity-30">
                <div className="absolute left-[-8%] top-[-18%] h-40 w-40 rounded-full bg-white/20 blur-3xl" />
                <div className="absolute right-[-6%] bottom-[-24%] h-44 w-44 rounded-full bg-cyan-200/30 blur-3xl" />
              </div>
              <div className="relative flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-cyan-100">Room Preview</p>
                <h3 className="mt-1 text-2xl font-black text-white">Room {selectedRoom.roomNumber}</h3>
                <p className="mt-1 text-sm text-white/80">
                  {selectedRoom.roomData?.categoryName || "Room Type"} | ID {selectedRoom.roomData?.roomId || selectedRoom.roomData?.id || "--"}
                </p>
                <div className="mt-3 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white/90">
                  Front Office Live View
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRoom(null)}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                <FaTimes />
                Close Preview
              </button>
            </div>
            </div>

            <div className="max-h-[78vh] overflow-y-auto p-5 sm:p-6">
              <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-[1.4rem] border border-sky-100 bg-[linear-gradient(180deg,#ffffff_0%,#f3faff_100%)] px-4 py-4 shadow-[0_14px_30px_rgba(14,165,233,0.08)]">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Status</div>
                  <div className="mt-2 text-base font-black text-slate-900">
                    {selectedRoom.roomData?.status || selectedRoom.roomData?.hotelStatus || "Unknown"}
                  </div>
                </div>
                <div className="rounded-[1.4rem] border border-slate-200 bg-white px-4 py-4 shadow-[0_12px_26px_rgba(15,23,42,0.06)]">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Category</div>
                  <div className="mt-2 text-base font-black text-slate-900">{selectedRoom.roomData?.categoryName || "--"}</div>
                </div>
                <div className="rounded-[1.4rem] border border-slate-200 bg-white px-4 py-4 shadow-[0_12px_26px_rgba(15,23,42,0.06)]">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Room ID</div>
                  <div className="mt-2 text-base font-black text-slate-900">
                    {selectedRoom.roomData?.roomId || selectedRoom.roomData?.id || "--"}
                  </div>
                </div>
                <div className="rounded-[1.4rem] border border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#f4fbf7_100%)] px-4 py-4 shadow-[0_14px_30px_rgba(16,185,129,0.08)]">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Check-In</div>
                  <div className="mt-2 text-base font-black text-slate-900">
                    {selectedRoom.booking?.checkIn ? formatShortDate(selectedRoom.booking.checkIn) : "--"}
                  </div>
                </div>
                <div className="rounded-[1.4rem] border border-amber-100 bg-[linear-gradient(180deg,#ffffff_0%,#fffaf2_100%)] px-4 py-4 shadow-[0_14px_30px_rgba(245,158,11,0.08)]">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Check-Out</div>
                  <div className="mt-2 text-base font-black text-slate-900">
                    {selectedRoom.booking?.checkOut ? formatShortDate(selectedRoom.booking.checkOut) : "--"}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                <div className="space-y-4">
                  {selectedRoom.booking?.bookingId && !String(selectedRoom.booking.bookingId).startsWith("room-") ? (
                    <div className="rounded-[1.65rem] border border-cyan-200 bg-[linear-gradient(180deg,rgba(236,254,255,0.96)_0%,rgba(240,249,255,0.92)_100%)] p-4 shadow-[0_18px_40px_rgba(6,182,212,0.10)]">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">Stay Dates</div>
                          <p className="mt-1 text-xs text-slate-600">
                            Check-in aur check-out ko aage badha sakte hain. Existing date ya aaj se piche nahi ja sakte.
                          </p>
                        </div>
                        <div className="rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-700 shadow-sm">
                          Live Update
                        </div>
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <label className="space-y-2">
                          <span className="block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                            Check-In Date
                          </span>
                          <input
                            type="date"
                            min={bookingDateLimits.minCheckIn}
                            value={bookingDateDraft.checkIn}
                            onChange={(e) => handleBookingDateChange("checkIn", e.target.value)}
                            className="w-full rounded-xl border border-cyan-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-400"
                          />
                        </label>

                        <label className="space-y-2">
                          <span className="block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                            Check-Out Date
                          </span>
                          <input
                            type="date"
                            min={bookingDateLimits.minCheckOut}
                            value={bookingDateDraft.checkOut}
                            onChange={(e) => handleBookingDateChange("checkOut", e.target.value)}
                            className="w-full rounded-xl border border-cyan-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-400"
                          />
                        </label>
                      </div>

                      <div className="mt-3 text-[11px] text-slate-500">
                        Current saved stay: {bookingDateLimits.originalCheckIn ? formatShortDate(bookingDateLimits.originalCheckIn) : "--"} to{" "}
                        {bookingDateLimits.originalCheckOut ? formatShortDate(bookingDateLimits.originalCheckOut) : "--"}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={handleSaveBookingDates}
                          disabled={savingBookingDates}
                          className={`rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-700 ${
                            savingBookingDates ? "cursor-not-allowed opacity-70" : ""
                          }`}
                        >
                          {savingBookingDates ? "Saving..." : "Update Stay Dates"}
                        </button>
                        <div className="rounded-xl border border-cyan-200 bg-white px-4 py-2.5 text-sm text-slate-700">
                          Updated dates preview aur booking feed me dikhengi.
                        </div>
                      </div>
                    </div>
                  ) : null}

                    <div className="rounded-[1.65rem] border border-violet-200 bg-[linear-gradient(180deg,rgba(245,243,255,0.96)_0%,rgba(250,245,255,0.92)_100%)] p-4 shadow-[0_18px_40px_rgba(124,58,237,0.08)]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">Cleaning Task</div>
                        <p className="mt-1 text-xs text-slate-600">
**Assign a housekeeper and set the estimated cleaning time.**
                        </p>
                      </div>
                      <div className="rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-violet-700 shadow-sm">
                        {currentCleaningTask || selectedRoom.roomData?.status === "cleaning" ? "Busy" : "Available"}
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="space-y-2">
                        <span className="block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                          Assign Housekeeper
                        </span>
                        <select
                          value={selectedAssignee}
                          onChange={(e) => setSelectedAssignee(e.target.value)}
                          className="w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-400"
                        >
                          <option value="">Select housekeeper</option>
                          {housekeepers.map((name, index) => {
                            const isBusy = busyHousekeepers.has(normalizeStaffName(name));
                            return (
                              <option key={`${name}-${index}`} value={name} disabled={isBusy && selectedAssignee !== name}>
                                {name} {isBusy ? "(Busy)" : "(Available)"}
                              </option>
                            );
                          })}
                        </select>
                        <div className="text-[11px] text-slate-500">
                          **A busy housekeeper cannot be assigned to another room until their current cleaning task is completed.**
.
                        </div>
                        <div className="text-[11px] font-semibold text-violet-700">
                          Current task status: {selectedAssigneeBusy ? "Busy" : "Available"}
                        </div>
                      </label>

                      <label className="space-y-2">
                        <span className="block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                          Cleaning Time
                        </span>
                        <select
                          value={selectedCleaningMinutes}
                          onChange={(e) => setSelectedCleaningMinutes(Number(e.target.value) || 30)}
                          className="w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-400"
                        >
                          {[15, 30, 45, 60, 90, 120].map((minutes) => (
                            <option key={minutes} value={minutes}>
                              {minutes} minutes
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={selectedRoom.roomData?.status === "cleaning" ? handleMarkClean : handleAssignCleaning}
                        disabled={assigningCleaning}
                        className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition ${
                          selectedRoom.roomData?.status === "cleaning"
                            ? "bg-emerald-600 hover:bg-emerald-700"
                            : "bg-violet-600 hover:bg-violet-700"
                        } ${assigningCleaning ? "cursor-not-allowed opacity-70" : ""}`}
                      >
                        {assigningCleaning
                          ? "Saving..."
                          : selectedRoom.roomData?.status === "cleaning"
                            ? "Mark Clean"
                            : "Assign Cleaning"}
                      </button>
                      <div className="rounded-xl border border-violet-200 bg-white px-4 py-2.5 text-sm text-slate-700">
                        ETA: <span className="font-semibold text-slate-900">{selectedCleaningMinutes} min</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-[1.65rem] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4 shadow-[0_18px_36px_rgba(15,23,42,0.07)]">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-slate-900">Booking snapshot</div>
                      <div className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-600">
                        Guest Profile
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-slate-600">
                      <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2.5 shadow-sm">
                        <span>Room Type</span>
                        <span className="font-semibold text-slate-900">{selectedRoom.roomData?.categoryName || selectedRoom.roomType || "--"}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2.5 shadow-sm">
                        <span>Room ID</span>
                        <span className="font-semibold text-slate-900">{selectedRoom.roomData?.roomId || selectedRoom.roomData?.id || "--"}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2.5 shadow-sm">
                        <span>Guest Name</span>
                        <span className="font-semibold text-slate-900">{selectedRoom.booking?.guestName || "--"}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2.5 shadow-sm">
                        <span>Contact</span>
                        <span className="font-semibold text-slate-900">{selectedRoom.booking?.mobile || "--"}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2.5 shadow-sm">
                        <span>Company</span>
                        <span className="font-semibold text-slate-900">{selectedRoom.booking?.company || "--"}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2.5 shadow-sm">
                        <span>Remaining</span>
                        <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">
                          {formatCurrency(selectedRoom.booking?.remainingAmount || 0)}
                        </span>
                      </div>
                      {String(selectedRoom.roomData?.hotelStatus || selectedRoom.roomData?.status || "").toLowerCase().includes("block") ? (
                        <>
                          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                            <span>Block Reason</span>
                            <span className="font-semibold text-slate-900">{selectedRoom.roomData?.blockReason || "--"}</span>
                          </div>
                          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                            <span>Block Dates</span>
                            <span className="font-semibold text-slate-900">
                              {selectedRoom.roomData?.blockFrom || "--"} to {selectedRoom.roomData?.blockTo || "--"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                            <span>Blocked By</span>
                            <span className="font-semibold text-slate-900">{selectedRoom.roomData?.blockedBy || "Front Desk"}</span>
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {selectedRoom.booking?.bookingId && !String(selectedRoom.booking.bookingId).startsWith("room-") ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleBookingLifecycle("check-in")}
                      disabled={String(selectedRoom.booking?.bookingStatus || "").toLowerCase().includes("checked in")}
                      className="rounded-[1rem] bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(16,185,129,0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(16,185,129,0.24)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <FaSignInAlt className="text-sm" /> Check In
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBookingLifecycle("check-out")}
                      disabled={!String(selectedRoom.booking?.bookingStatus || "").toLowerCase().includes("checked in")}
                      className="rounded-[1rem] bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(249,115,22,0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(249,115,22,0.24)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <FaSignOutAlt className="text-sm" /> Check Out
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={() =>
                    navigate("/restaurant/room-items", {
                      state: {
                        focusRoomNo: selectedRoom.roomNumber,
                        roomData: selectedRoom.roomData,
                      },
                    })
                  }
                  className="rounded-[1rem] bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(249,115,22,0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(249,115,22,0.24)]"
                >
                  Order Book
                </button>
                <button
                  type="button"
                  onClick={() =>
                    navigate("/hotel/guest", {
                      state: {
                        roomNumber: selectedRoom.roomNumber,
                        category: selectedRoom.roomData?.categoryName,
                        resetBookingDraft: true,
                      },
                    })
                  }
                  className="rounded-[1rem] bg-gradient-to-r from-slate-900 to-slate-700 px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5"
                >
                  Create / Update Booking
                </button>
                {selectedRoom.booking?.bookingId && !String(selectedRoom.booking.bookingId).startsWith("room-") ? (
                  <button
                    type="button"
                    onClick={() =>
                      setEditBookingModal({
                        bookingId: selectedRoom.booking.bookingId,
                        bookingCode: selectedRoom.booking.bookingCode,
                        focusRoomNo: selectedRoom.roomNumber,
                      })
                    }
                    className="rounded-[1rem] bg-gradient-to-r from-cyan-600 to-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-700"
                  >
                    Extend Booking
                  </button>
                ) : null}
                {selectedRoom.booking?.bookingId &&
                !String(selectedRoom.booking.bookingId).startsWith("room-") &&
                !String(selectedRoom.booking?.bookingStatus || "").toLowerCase().includes("checked in") ? (
                  <button
                    type="button"
                    onClick={() => setCancelBookingModal({ open: true, reason: "", submitting: false })}
                    className="rounded-[1rem] bg-gradient-to-r from-rose-600 to-pink-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(225,29,72,0.18)] transition hover:-translate-y-0.5"
                  >
                    Cancel Booking
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => navigate("/dashboard")}
                  className="rounded-[1rem] border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50"
                >
                  Open Main Dashboard
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleBlockedRoom(
                      String(selectedRoom.roomData?.hotelStatus || selectedRoom.roomData?.status || "").toLowerCase().includes("block")
                        ? "unblock"
                        : "block",
                    )
                  }
                  className="rounded-[1rem] bg-gradient-to-r from-slate-700 to-slate-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(51,65,85,0.16)] transition hover:-translate-y-0.5"
                >
                  {String(selectedRoom.roomData?.hotelStatus || selectedRoom.roomData?.status || "").toLowerCase().includes("block")
                    ? "Unblock Room"
                    : "Block Room"}
                </button>
              </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {editBookingModal ? (
        <EditBooking
          embedded
          bookingId={editBookingModal.bookingId}
          bookingCode={editBookingModal.bookingCode}
          focusRoomNo={editBookingModal.focusRoomNo}
          onSaved={(savedBooking) => {
            if (savedBooking) {
              setSelectedRoom((current) =>
                current && String(current.booking?.bookingId) === String(savedBooking.bookingId)
                  ? {
                      ...current,
                      booking: {
                        ...current.booking,
                        guestName: savedBooking.guest_name || savedBooking.guestName || current.booking?.guestName,
                        mobile: savedBooking.mobile || current.booking?.mobile,
                        checkIn: savedBooking.checkIn || current.booking?.checkIn,
                        checkOut: savedBooking.checkOut || current.booking?.checkOut,
                        bookingCode: savedBooking.bookingCode || current.booking?.bookingCode,
                      },
                    }
                  : current,
              );
            }
            loadData(true);
          }}
          onClose={() => setEditBookingModal(null)}
        />
      ) : null}

      {cancelBookingModal.open ? (
        <div
          className="fixed inset-0 z-[1150] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm"
          onClick={() => setCancelBookingModal({ open: false, reason: "", submitting: false })}
        >
          <div
            className="w-full max-w-md rounded-[1.75rem] border border-rose-200 bg-white p-5 shadow-[0_24px_70px_rgba(15,23,42,0.22)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="inline-flex rounded-full bg-rose-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-rose-700">
              Cancel Booking
            </div>
            <h3 className="mt-3 text-lg font-black text-slate-900">
              Room {selectedRoom?.roomNumber} booking cancel karna hai?
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Guest: {selectedRoom?.booking?.guestName || "--"} | Booking #{selectedRoom?.booking?.bookingId || "--"}
            </p>
            <label className="mt-4 block">
              <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                Cancellation Reason
              </span>
              <textarea
                value={cancelBookingModal.reason}
                onChange={(event) =>
                  setCancelBookingModal((current) => ({ ...current, reason: event.target.value }))
                }
                rows={4}
                placeholder="Guest cancelled, arrival issue, pricing issue..."
                className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-rose-400"
              />
            </label>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCancelBookingModal({ open: false, reason: "", submitting: false })}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleCancelBooking}
                disabled={cancelBookingModal.submitting}
                className={`rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 ${
                  cancelBookingModal.submitting ? "cursor-not-allowed opacity-70" : ""
                }`}
              >
                {cancelBookingModal.submitting ? "Cancelling..." : "Confirm Cancel"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {actionPopup.open ? (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-sm"
          onClick={() => setActionPopup((current) => ({ ...current, open: false }))}
        >
          <div
            className={`w-full max-w-sm rounded-[1.75rem] border p-5 shadow-[0_24px_70px_rgba(15,23,42,0.22)] ${popupTone[actionPopup.type]?.panel || popupTone.success.panel}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              {(() => {
                const Icon = popupTone[actionPopup.type]?.icon || FaCheckCircle;
                return <Icon className="mt-0.5 text-lg text-slate-900" />;
              })()}
              <div className="min-w-0 flex-1">
                <div className={`inline-flex rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${popupTone[actionPopup.type]?.badge || popupTone.success.badge}`}>
                  {actionPopup.type === "error" ? "Error" : "Success"}
                </div>
                <div className="mt-3 text-sm font-semibold text-slate-900">{actionPopup.message}</div>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setActionPopup((current) => ({ ...current, open: false }))}
                className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition ${popupTone[actionPopup.type]?.button || popupTone.success.button}`}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Stayover;
