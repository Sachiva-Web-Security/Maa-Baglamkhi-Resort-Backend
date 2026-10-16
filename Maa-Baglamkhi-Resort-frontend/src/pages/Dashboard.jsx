import {
  FaBed,
  FaCalendarAlt,
  FaCheckCircle,
  FaClipboardCheck,
  FaChevronDown,
  FaDoorOpen,
  FaExclamationTriangle,
  FaBell,
  FaKey,
  FaRupeeSign,
  FaSyncAlt,
  FaTimes,
} from "react-icons/fa";
import { ToastContainer, toast } from "react-toastify";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "react-toastify/dist/ReactToastify.css";

import API from "../api";
import FoodSalesChart from "../components/Dashboard/Charts/FoodSalesChart";
import MonthlyRevenueChart from "../components/Dashboard/Charts/MonthlyRevenueChart";
import RoomOccupancyChart from "../components/Dashboard/Charts/RoomOccupancyChart";
import MetricCard from "../components/Dashboard/MetricCard/MetricCard";
// Cleaning-task state now lives in the DB (housekeeping + hk_messages tables);
// no localStorage helpers are imported here anymore.
import { pushDashboardNotification } from "../components/Dashboard/dashboardNotifications";
import {
  addDays,
  BOARD_BUCKET_META,
  buildStaySummary,
  expandBookings,
  formatDateLabel,
  formatCurrency,
  getBookingContact,
  getRoomBookingReference,
  formatShortDate,
  mergeBookingsWithRooms,
  normalizeBookingPreview,
  normalizeRooms,
  todayISO,
} from "../components/Dashboard/stayoverUtils";

const boardOrder = ["available", "confirmed", "blocked", "checked_in", "checkout"];
const CLEANING_TIME_OPTIONS = [15, 30, 45, 60, 90, 120];
const METRIC_PANEL_PAGE_SIZE = 6;
const AVAILABLE_ROOM_TYPE_ORDER = [
  "AC ROOM",
  "NON-AC ROOM",
  "DELUXE ROOM",
  "SUPER DELUXE ROOM",
  "SUITE ROOM",
  "DELUXE DORMITORY",
];

const getHousekeepingUsers = (users) =>
  Array.from(
    new Set(
      (Array.isArray(users) ? users : [])
        .filter((user) => String(user.role || "").toLowerCase().includes("housekeeping"))
        .map((user) => String(user.name || "").trim())
        .filter(Boolean),
    ),
  );

const normalizeAvailableRoomType = (value) => {
  const raw = String(value || "").trim();
  const lower = raw.toLowerCase();

  if (lower.includes("super deluxe")) return "SUPER DELUXE ROOM";
  if (lower.includes("deluxe dormitory")) return "DELUXE DORMITORY";
  if (lower.includes("suite")) return "SUITE ROOM";
  if (lower.includes("non ac") || lower.includes("non-ac") || lower.includes("standard")) {
    return "NON-AC ROOM";
  }
  if (lower.includes("ac") && !lower.includes("non")) return "AC ROOM";
  if (lower.includes("hotel room")) return "AC ROOM";
  if (lower.includes("deluxe")) return "DELUXE ROOM";
  return raw ? raw.toUpperCase() : "ROOM TYPE";
};

const groupRoomsByType = (items = []) => {
  const buckets = AVAILABLE_ROOM_TYPE_ORDER.reduce((acc, label) => {
    acc[label] = [];
    return acc;
  }, {});
  const extras = {};

  (items || []).forEach((item) => {
    const roomTypeLabel = normalizeAvailableRoomType(item.roomType);
    if (Object.hasOwn(buckets, roomTypeLabel)) {
      buckets[roomTypeLabel].push(item);
      return;
    }

    if (!extras[roomTypeLabel]) extras[roomTypeLabel] = [];
    extras[roomTypeLabel].push(item);
  });

  return [
    ...AVAILABLE_ROOM_TYPE_ORDER.map((label) => ({
      label,
      items: buckets[label].sort((left, right) => String(left.roomNumber).localeCompare(String(right.roomNumber), undefined, { numeric: true })),
    })),
    ...Object.entries(extras).map(([label, items]) => ({
      label,
      items: items.sort((left, right) => String(left.roomNumber).localeCompare(String(right.roomNumber), undefined, { numeric: true })),
    })),
  ].filter((group) => AVAILABLE_ROOM_TYPE_ORDER.includes(group.label) || group.items.length > 0);
};

const getRoomTaskKey = (room) =>
  String(room?.roomData?.id || room?.roomId || room?.roomNumber || "").trim();

const isCleaningTaskEditable = (room) => {
  const statusTokens = [
    String(room?.roomData?.status || ""),
    String(room?.roomData?.hotelStatus || ""),
    String(room?.roomData?.housekeepingLabel || ""),
    String(room?.status || ""),
  ]
    .join(" ")
    .toLowerCase();

  return (
    statusTokens.includes("clean") ||
    statusTokens.includes("dirty") ||
    statusTokens.includes("cleaning") ||
    statusTokens.includes("vacant")
  );
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(localStorage.getItem("freshLogin") === "true");
  const [blurBg, setBlurBg] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [expandedBoardDay, setExpandedBoardDay] = useState(todayISO());
  const [boardStartDate, setBoardStartDate] = useState(todayISO());
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [openMetricPanel, setOpenMetricPanel] = useState("");
  const [metricPanelPage, setMetricPanelPage] = useState(1);
  const [bucketOpen, setBucketOpen] = useState(() =>
    boardOrder.reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {}),
  );
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [availableTypeOpen, setAvailableTypeOpen] = useState("");
  const [activeDashboardTab, setActiveDashboardTab] = useState("main");
  const [housekeepers, setHousekeepers] = useState([]);
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const [selectedCleaningMinutes, setSelectedCleaningMinutes] = useState(30);
  const [assigningCleaning, setAssigningCleaning] = useState(false);
  const [refreshingDashboard, setRefreshingDashboard] = useState(false);
  const [apiMetrics, setApiMetrics] = useState({
    totalRooms: 0,
    occupiedRooms: 0,
    todayRevenue: 0,
    todayCheckins: 0,
    expectedArrivals: 0,
    expectedCheckouts: 0,
    totalRevenueGenerated: 0,
    expectedArrivalDetails: [],
    expectedCheckoutDetails: [],
    todayCheckinDetails: [],
  });
  const [rooms, setRooms] = useState([]);
  const [roomsSetup, setRoomsSetup] = useState([]);
  const [bookings, setBookings] = useState([]);

  const loadDashboardData = useCallback(async (silent = false) => {
    try {
      if (silent) setRefreshingDashboard(true);

      const [metricsRes, roomsRes, roomsSetupRes, bookingsRes, usersRes] = await Promise.all([
        API.get("/dashboard/metrics"),
        API.get("/housekeeping"),
        API.get("/hotel/rooms/setup"),
        API.get("/hotel/all-bookings"),
        API.get("/users"),
      ]);

      setApiMetrics({
        totalRooms: metricsRes.data.totalRooms || 0,
        occupiedRooms: metricsRes.data.occupiedRooms || 0,
        todayRevenue: metricsRes.data.todayRevenue || 0,
        todayCheckins: metricsRes.data.todayCheckins || 0,
        expectedArrivals: metricsRes.data.expectedArrivals || 0,
        expectedCheckouts: metricsRes.data.expectedCheckouts || 0,
        totalRevenueGenerated: metricsRes.data.totalRevenueGenerated || 0,
        expectedArrivalDetails: metricsRes.data.expectedArrivalDetails || [],
        expectedCheckoutDetails: metricsRes.data.expectedCheckoutDetails || [],
        todayCheckinDetails: metricsRes.data.todayCheckinDetails || [],
      });
      setRooms(normalizeRooms(roomsRes.data));
      setRoomsSetup(Array.isArray(roomsSetupRes.data) ? roomsSetupRes.data : []);
      setBookings(expandBookings(bookingsRes.data));
      setHousekeepers(getHousekeepingUsers(usersRes.data));
    } finally {
      if (silent) setRefreshingDashboard(false);
    }
  }, []);

  useEffect(() => {
    const previousHtmlOverflowX = document.documentElement.style.overflowX;
    const previousBodyOverflowX = document.body.style.overflowX;
    document.documentElement.style.overflowX = "hidden";
    document.body.style.overflowX = "hidden";
    return () => {
      document.documentElement.style.overflowX = previousHtmlOverflowX;
      document.body.style.overflowX = previousBodyOverflowX;
    };
  }, []);

  useEffect(() => {
    const freshLoginFlag = localStorage.getItem("freshLogin");
    if (freshLoginFlag !== "true") {
      setLoading(false);
      return;
    }

    setBlurBg(true);
    const blurTimer = setTimeout(() => setBlurBg(false), 500);
    const loaderTimer = setTimeout(() => {
      setLoading(false);
      localStorage.removeItem("freshLogin");
    }, 1000);

    return () => {
      clearTimeout(blurTimer);
      clearTimeout(loaderTimer);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchDashboardData = async () => {
      try {
        if (!isMounted) return;
        await loadDashboardData();
      } catch (error) {
        console.error(error);
        if (isMounted) {
          toast.error("Dashboard data could not be loaded.", {
            position: "bottom-right",
          });
        }
      }
    };

    fetchDashboardData();

    return () => {
      isMounted = false;
    };
  }, [loadDashboardData]);

  useEffect(() => {
    const refreshDashboard = () => {
      loadDashboardData(true).catch((error) => {
        console.error("Dashboard refresh failed", error);
      });
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshDashboard();
      }
    };

    const intervalId = globalThis.setInterval(refreshDashboard, 30000);
    globalThis.addEventListener("focus", refreshDashboard);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      globalThis.clearInterval(intervalId);
      globalThis.removeEventListener("focus", refreshDashboard);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadDashboardData]);

  useEffect(() => {
    let mounted = true;

    const syncExpiredCleaningTasks = async () => {
      // Pull active cleaning-task messages directly from MySQL via the
      // /housekeeping/notifications endpoint. For each task whose due_at has
      // passed, flip the room back to "Vacant Clean" and mark the message
      // Completed — both writes go to the DB.
      let tasks = [];
      try {
        const res = await API.get("/housekeeping/notifications");
        tasks = Array.isArray(res.data) ? res.data : [];
      } catch (error) {
        console.error("Failed to load cleaning notifications", error);
        return;
      }

      const now = Date.now();
      let changed = false;

      for (const task of tasks) {
        if (!task || task.status === "Completed") continue;
        const dueAt = task.dueAt ? new Date(task.dueAt).getTime() : 0;
        if (!dueAt || now < dueAt) continue;

        const roomKey = task.roomNo || task.roomId;
        if (!roomKey) continue;

        try {
          await API.put(`/housekeeping/status/${roomKey}`, {
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
          console.error("Auto complete failed", error);
        }

        pushDashboardNotification({
          title: `Cleaning completed - Room ${roomKey}`,
          message: `Room ${roomKey} is available again.`,
          type: "success",
          route: "/housekeeping",
        });
        changed = true;
      }

      if (!mounted) return;

      if (changed) {
        await loadDashboardData();
      }
    };

    syncExpiredCleaningTasks();
    const timer = setInterval(syncExpiredCleaningTasks, 60000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [loadDashboardData]);

  const mergedBookings = useMemo(() => mergeBookingsWithRooms(bookings, rooms), [bookings, rooms]);

  const stayOverview = useMemo(
    () => buildStaySummary(rooms, mergedBookings, boardStartDate),
    [boardStartDate, mergedBookings, rooms],
  );

  const selectedBoardDay = stayOverview.find((day) => day.date === selectedDate) || stayOverview[0] || null;
  const selectedDaySnapshot = selectedBoardDay?.board || {
    available: [],
    confirmed: [],
    cleaning: [],
    pencil: [],
    blocked: [],
    checked_in: [],
    checkout: [],
  };

  const availableRoomGroups = useMemo(() => groupRoomsByType(selectedDaySnapshot.available), [selectedDaySnapshot.available]);
  const confirmedRoomGroups = useMemo(() => groupRoomsByType(selectedDaySnapshot.confirmed), [selectedDaySnapshot.confirmed]);
  const cleaningRoomGroups = useMemo(() => groupRoomsByType(selectedDaySnapshot.cleaning), [selectedDaySnapshot.cleaning]);
  const pencilRoomGroups = useMemo(() => groupRoomsByType(selectedDaySnapshot.pencil), [selectedDaySnapshot.pencil]);
  const blockedRoomGroups = useMemo(() => groupRoomsByType(selectedDaySnapshot.blocked), [selectedDaySnapshot.blocked]);
  const checkedInRoomGroups = useMemo(() => groupRoomsByType(selectedDaySnapshot.checked_in), [selectedDaySnapshot.checked_in]);
  const checkoutRoomGroups = useMemo(() => groupRoomsByType(selectedDaySnapshot.checkout), [selectedDaySnapshot.checkout]);

  const attentionCount = useMemo(
    () =>
      rooms.filter((room) => {
        const status = String(room.housekeepingLabel || room.status || "").toLowerCase();
        return status.includes("dirty") || !room.assignee || room.assignee === "No Housekeeper";
      }).length,
    [rooms],
  );
  const dirtyRoomCount = useMemo(
    () =>
      rooms.filter((room) =>
        String(room.housekeepingLabel || room.status || "").toLowerCase().includes("dirty"),
      ).length,
    [rooms],
  );
  const unassignedHousekeepingCount = useMemo(
    () =>
      rooms.filter((room) => {
        const assignee = String(room.assignee || "").trim().toLowerCase();
        return !assignee || assignee === "no housekeeper";
      }).length,
    [rooms],
  );
  const actionableAlerts = useMemo(
    () => [
      {
        key: "attention",
        tone: "border-rose-200 bg-rose-50",
        icon: FaExclamationTriangle,
        iconClass: "text-rose-500",
        title: `${attentionCount} live room issue${attentionCount === 1 ? "" : "s"}`,
        detail: `${dirtyRoomCount} dirty room, ${unassignedHousekeepingCount} unassigned housekeeping room.`,
      },
      {
        key: "confirmed",
        tone: "border-amber-200 bg-amber-50",
        icon: FaCalendarAlt,
        iconClass: "text-amber-500",
        title: `${selectedDaySnapshot.confirmed.length} confirmed room${selectedDaySnapshot.confirmed.length === 1 ? "" : "s"}`,
        detail: `Confirmed for ${formatDateLabel(selectedDate)} from live booking board.`,
      },
      {
        key: "checked-in",
        tone: "border-cyan-200 bg-cyan-50",
        icon: FaKey,
        iconClass: "text-cyan-500",
        title: `${selectedDaySnapshot.checked_in.length} checked-in room${selectedDaySnapshot.checked_in.length === 1 ? "" : "s"}`,
        detail: `In-house rooms for ${formatDateLabel(selectedDate)} from active stay data.`,
      },
    ],
    [
      attentionCount,
      dirtyRoomCount,
      selectedDate,
      selectedDaySnapshot.checked_in.length,
      selectedDaySnapshot.cleaning.length,
      selectedDaySnapshot.confirmed.length,
      unassignedHousekeepingCount,
    ],
  );
  const pendingSettlementAmount = useMemo(
    () =>
      bookings.reduce((sum, booking) => sum + Number(booking.remainingAmount || 0), 0),
    [bookings],
  );
  const pendingSettlementCount = useMemo(
    () => bookings.filter((booking) => Number(booking.remainingAmount || 0) > 0).length,
    [bookings],
  );
  const dashboardNotifications = useMemo(
    () =>
      [
        {
          id: `notif-attention-${selectedDate}`,
          title: `${attentionCount} rooms need attention`,
          message: `${dirtyRoomCount} dirty room and ${unassignedHousekeepingCount} room without housekeeper assignment.`,
          route: "/housekeeping",
          createdAt: `${selectedDate}T09:00:00`,
        },
        {
          id: `notif-confirmed-${selectedDate}`,
          title: `${selectedDaySnapshot.confirmed.length} confirmed rooms`,
          message: `Confirmed arrivals for ${formatDateLabel(selectedDate)} from live booking board.`,
          route: "/stayover",
          createdAt: `${selectedDate}T08:00:00`,
        },
        {
          id: `notif-checkin-${selectedDate}`,
          title: `${selectedDaySnapshot.checked_in.length} checked-in rooms`,
          message: `In-house occupied rooms for ${formatDateLabel(selectedDate)} from active stay data.`,
          route: "/stayover",
          createdAt: `${selectedDate}T06:00:00`,
        },
        {
          id: `notif-settlement-${selectedDate}`,
          title: `${pendingSettlementCount} bookings pending settlement`,
          message: `${formatCurrency(pendingSettlementAmount)} still due across active bookings.`,
          route: "/accounts",
          createdAt: `${selectedDate}T05:00:00`,
        },
      ].filter((item) => {
        const digits = item.title.match(/\d+/g);
        const total = digits ? digits.reduce((sum, value) => sum + Number(value || 0), 0) : 0;
        return total > 0;
      }),
    [
      attentionCount,
      dirtyRoomCount,
      pendingSettlementAmount,
      pendingSettlementCount,
      selectedDate,
      selectedDaySnapshot.checked_in.length,
      selectedDaySnapshot.cleaning.length,
      selectedDaySnapshot.confirmed.length,
      unassignedHousekeepingCount,
    ],
  );

  const liveTotalRooms = rooms.length || apiMetrics.totalRooms || 0;
  const liveOccupiedRooms = rooms.filter((room) => {
    const status = String(room.status || room.hotelStatus || "").toLowerCase();
    return status.includes("occupied") || status.includes("in house") || status.includes("checked in");
  }).length;
  const liveCheckins = selectedBoardDay?.arrivals?.length || apiMetrics.todayCheckins || 0;
  const occupancyRate = liveTotalRooms ? `${Math.round((liveOccupiedRooms / liveTotalRooms) * 100)}%` : "0%";
  // "Today's Revenue" must always reflect the authoritative figure computed by
  // the backend (/dashboard/metrics -> getTodayRevenue), which sums invoices,
  // restaurant bills, banquet bookings, and room bookings for CURDATE() on the
  // server. We previously overrode this with a client-side "liveRevenue" that
  // only summed today's *hotel arrivals* paid/collected amounts for whichever
  // date happened to be selected in the Stay Overview board (which can silently
  // fall back to a non-today date, see the stayOverview effect above). That
  // partial, sometimes wrong-day number is what made the card look "fake" —
  // it ignored restaurant + banquet revenue entirely and could reflect the
  // wrong day. Always trust the backend total instead.
  const displayRevenue = Number(apiMetrics.todayRevenue || 0);
  const totalGeneratedRevenue = Number(apiMetrics.totalRevenueGenerated || 0);
  const metricPanelData = {
    expected_arrivals: {
      title: "Expected Arrivals",
      subtitle: "Guests expected to arrive today with booking date details.",
      items: apiMetrics.expectedArrivalDetails || [],
      empty: "There was no expected arrival today.",
    },
    expected_checkouts: {
      title: "Expected Check-outs",
      subtitle: "Guests scheduled to check out today.",
      items: apiMetrics.expectedCheckoutDetails || [],
      empty: "There was no expected checkout today.",
    },
    today_checkins: {
      title: "Today's Check-ins",
      subtitle: "Guests who are already marked as checked in today.",
      items: apiMetrics.todayCheckinDetails || [],
      empty: "There was no checked-in arrival record today.",
    },
  };
  const activeMetricPanel = metricPanelData[openMetricPanel] || null;
  const activeMetricPanelTotalPages = activeMetricPanel
    ? Math.max(1, Math.ceil(activeMetricPanel.items.length / METRIC_PANEL_PAGE_SIZE))
    : 1;
  const paginatedMetricPanelItems = activeMetricPanel
    ? activeMetricPanel.items.slice(
        (metricPanelPage - 1) * METRIC_PANEL_PAGE_SIZE,
        metricPanelPage * METRIC_PANEL_PAGE_SIZE,
      )
    : [];

  const metrics = [
    {
      title: "Total Rooms",
      value: String(liveTotalRooms),
      subtitle: "Calm inventory overview",
      icon: FaBed,
      gradient: "bg-slate-700",
      route: "/hotel/all-bookings",
    },
    {
      title: "Occupied Rooms",
      value: String(liveOccupiedRooms || apiMetrics.occupiedRooms || 0),
      subtitle: `${occupancyRate} occupancy`,
      icon: FaKey,
      gradient: "bg-blue-600",
      route: "/stayover",
    },
    {
      title: "Today's Revenue",
      value: `Rs. ${Number(displayRevenue || 0).toLocaleString()}`,
      subtitle: "Front office and F&B earnings",
      icon: FaRupeeSign,
      gradient: "bg-amber-500",
      route: "/accounts",
    },
    {
      title: "Today's Check-ins",
      value: String(liveCheckins),
      subtitle: "Guest arrival momentum",
      icon: FaCheckCircle,
      gradient: "bg-emerald-500",
      route: "/hotel",
      panelKey: "today_checkins",
    },
    {
      title: "Expected Arrivals",
      value: String(apiMetrics.expectedArrivals || 0),
      subtitle: "Scheduled arrivals for today",
      icon: FaDoorOpen,
      gradient: "bg-blue-500",
      route: "/hotel/all-bookings",
      panelKey: "expected_arrivals",
    },
    {
      title: "Expected Check-outs",
      value: String(apiMetrics.expectedCheckouts || 0),
      subtitle: "Planned departures for today",
      icon: FaCalendarAlt,
      gradient: "bg-amber-400",
      route: "/hotel/all-bookings",
      panelKey: "expected_checkouts",
    },
    {
      title: "Total Revenue Generated",
      value: `Rs. ${totalGeneratedRevenue.toLocaleString()}`,
      subtitle: "Overall billed revenue snapshot",
      icon: FaClipboardCheck,
      gradient: "bg-slate-900",
      route: "/accounts",
    },
  ];

  const handleMetricClick = (metric) => {
    if (metric.panelKey) {
      setOpenMetricPanel((current) => (current === metric.panelKey ? "" : metric.panelKey));
      return;
    }
    navigate(metric.route);
  };
  const quickActions = [
    {
      label: "New Booking",
      helper: "Front desk guest entry",
      liveValue: `${liveCheckins}`,
      liveLabel: "today check-ins",
      detail: `${selectedDaySnapshot.confirmed.length} confirmed room(s) for ${formatDateLabel(selectedDate)}`,
      icon: FaDoorOpen,
      route: "/hotel/guest",
      tone: "from-blue-600 to-blue-500",
    },
    {
      label: "Settlement Review",
      helper: "Track billing movement",
      liveValue: formatCurrency(pendingSettlementAmount),
      liveLabel: "balance due",
      detail: `${pendingSettlementCount} booking(s) still waiting for settlement`,
      icon: FaClipboardCheck,
      route: "/accounts",
      tone: "from-amber-500 to-amber-400",
    },
  ];

  const roomPreviewStats = selectedRoom
    ? [
        {
          label: "Room Status",
          value: selectedRoom.roomData?.status || selectedRoom.roomData?.hotelStatus || "Unknown",
        },
        {
          label: "Check-In",
          value: selectedRoom.booking?.checkIn ? formatShortDate(selectedRoom.booking.checkIn) : "--",
        },
        {
          label: "Check-Out",
          value: selectedRoom.booking?.checkOut ? formatShortDate(selectedRoom.booking.checkOut) : "--",
        },
        {
          label: "Remaining",
          value: formatCurrency(selectedRoom.booking?.remainingAmount || 0),
        },
    ]
    : [];

  const isRoomInStay = (booking) => {
    if (!booking) return false;

    const status = String(booking.bookingStatus || "").toLowerCase();
    if (
      status.includes("checked in") ||
      status.includes("check in") ||
      status.includes("occupied") ||
      status.includes("in house")
    ) {
      return true;
    }

    if (!booking.checkIn || !booking.checkOut) return false;
    const today = selectedDate || todayISO();
    return today >= booking.checkIn && today < booking.checkOut;
  };

  const openRoomPreview = (item) => {
    const roomNumber =
      item?.roomNumber ||
      item?.roomNo ||
      item?.room ||
      item?.roomData?.roomNumber ||
      item?.roomData?.roomNo ||
      item?.booking?.roomNumber ||
      item?.booking?.roomNo ||
      "";
    const roomId =
      item?.roomId ||
      item?.roomData?.roomId ||
      item?.roomData?.id ||
      item?.booking?.roomId ||
      item?.booking?.roomId ||
      "";
    const roomType =
      item?.roomType ||
      item?.roomData?.categoryName ||
      item?.roomData?.roomType ||
      item?.roomData?.housekeepingLabel ||
      "Room";

    const fallbackBooking =
      item?.booking || getRoomBookingReference(roomNumber, selectedDate || todayISO(), mergedBookings);

    const booking = fallbackBooking ? normalizeBookingPreview(fallbackBooking) : null;

    setSelectedRoom({
      ...item,
      roomNumber,
      roomId,
      roomType,
      roomData: item?.roomData || item,
      booking,
    });

    const bookingId = booking?.bookingId;
    if (!bookingId || String(bookingId).startsWith("room-")) return;

    if (getBookingContact(booking)) return;

    API.get(`/hotel/full-booking/${bookingId}`)
      .then((response) => {
        const fullBooking = response?.data || {};
        const normalizedFullBooking = normalizeBookingPreview(fullBooking);

        setSelectedRoom((current) =>
          current && String(current.booking?.bookingId) === String(bookingId)
            ? {
                ...current,
                booking: {
                  ...current.booking,
                  ...normalizedFullBooking,
                },
              }
            : current,
        );
      })
      .catch((error) => {
        console.error("Full booking hydrate failed", error);
      });
  };

  useEffect(() => {
    if (!stayOverview.length) return;

    const isSelectedDateVisible = stayOverview.some((day) => day.date === selectedDate);
    if (!isSelectedDateVisible) {
      setSelectedDate(stayOverview[0].date);
      setExpandedBoardDay(stayOverview[0].date);
      setAvailableTypeOpen("");
      return;
    }

    if (expandedBoardDay && !stayOverview.some((day) => day.date === expandedBoardDay)) {
      setExpandedBoardDay(stayOverview[0].date);
      setAvailableTypeOpen("");
    }
  }, [expandedBoardDay, selectedDate, stayOverview]);

  useEffect(() => {
    setMetricPanelPage(1);
  }, [openMetricPanel]);

  useEffect(() => {
    if (metricPanelPage > activeMetricPanelTotalPages) {
      setMetricPanelPage(activeMetricPanelTotalPages);
    }
  }, [activeMetricPanelTotalPages, metricPanelPage]);

  const jumpBoardWindow = (nextDate) => {
    setBoardStartDate(nextDate);
    setSelectedDate(nextDate);
    setExpandedBoardDay(nextDate);
    setAvailableTypeOpen("");
  };

  const toggleBoardDay = (date) => {
    setSelectedDate(date);
    setExpandedBoardDay((current) => (current === date ? "" : date));
    setAvailableTypeOpen("");
  };

  const renderBoardColumnContent = (day, key) => {
    const items = day?.board?.[key] || [];

    // For "available" and "cleaning", derive room lists from /hotel/rooms/setup
    // inventory so category-wise counts always reflect actual room data and update dynamically.
    // After checkout, room status becomes "Vacant Dirty" → disappears from Available,
    // appears in Cleaning — both columns use the same source of truth.
    const availableInventory = key === "available"
      ? roomsSetup.flatMap((category) =>
          (category.roomDetails || [])
            .filter((detail) => String(detail.status || "").toLowerCase() === "available")
            .map((detail) => ({
              id: `available-${category.id}-${detail.roomNumber}`,
              roomId: detail.roomNumber,
              roomNumber: detail.roomNumber,
              roomType: normalizeAvailableRoomType(category.name),
              title: category.name,
              subtitle: "Ready to sell",
            })),
        )
      : items;

    const cleaningInventory = key === "cleaning"
      ? roomsSetup.flatMap((category) =>
          (category.roomDetails || [])
            .filter((detail) => {
              const s = String(detail.status || "").toLowerCase();
              return s.includes("dirty") || s.includes("cleaning") || s.includes("vacant");
            })
            .map((detail) => ({
              id: `cleaning-${category.id}-${detail.roomNumber}`,
              roomId: detail.roomNumber,
              roomNumber: detail.roomNumber,
              roomType: normalizeAvailableRoomType(category.name),
              title: category.name,
              subtitle: detail.status || "Cleaning",
            })),
        )
      : items;

    const groups = groupRoomsByType(
      key === "cleaning" ? cleaningInventory : availableInventory,
    );

    if (["available", "confirmed", "cleaning", "blocked", "checked_in", "checkout"].includes(key)) {
      const toneMap = {
        available: {
          border: "border-emerald-400",
          soft: "bg-[linear-gradient(135deg,rgba(236,253,245,0.92)_0%,rgba(220,252,231,0.8)_100%)]",
          badge: "border-emerald-200 bg-[linear-gradient(135deg,#ecfdf5_0%,#d1fae5_100%)] text-emerald-700 shadow-[0_10px_24px_rgba(16,185,129,0.18)]",
          title: "text-emerald-900",
          sub: "text-emerald-700",
          button: "border-emerald-300 bg-[linear-gradient(135deg,rgba(255,255,255,0.7)_0%,rgba(236,253,245,0.95)_100%)]",
          dot: "border-emerald-200 bg-[linear-gradient(135deg,#ecfdf5_0%,#d1fae5_100%)] text-emerald-600",
          empty: "border-dashed border-emerald-400 bg-[linear-gradient(135deg,rgba(255,255,255,0.65)_0%,rgba(236,253,245,0.75)_100%)] text-emerald-500",
          pill: "border-emerald-200 bg-[linear-gradient(135deg,#ecfdf5_0%,#d1fae5_100%)] text-emerald-700",
        },
        confirmed: {
          border: "border-orange-400",
          soft: "bg-[linear-gradient(135deg,rgba(255,247,237,0.92)_0%,rgba(254,215,170,0.45)_100%)]",
          badge: "border-orange-200 bg-[linear-gradient(135deg,#fff7ed_0%,#fed7aa_100%)] text-orange-700 shadow-[0_10px_24px_rgba(249,115,22,0.18)]",
          title: "text-orange-900",
          sub: "text-orange-700",
          button: "border-orange-300 bg-[linear-gradient(135deg,rgba(255,255,255,0.7)_0%,rgba(255,247,237,0.95)_100%)]",
          dot: "border-orange-200 bg-[linear-gradient(135deg,#fff7ed_0%,#fed7aa_100%)] text-orange-600",
          empty: "border-dashed border-orange-400 bg-[linear-gradient(135deg,rgba(255,255,255,0.65)_0%,rgba(255,247,237,0.78)_100%)] text-orange-500",
          pill: "border-orange-200 bg-[linear-gradient(135deg,#fff7ed_0%,#fed7aa_100%)] text-orange-700",
        },
        cleaning: {
          border: "border-violet-400",
          soft: "bg-[linear-gradient(135deg,rgba(245,243,255,0.92)_0%,rgba(233,213,255,0.52)_100%)]",
          badge: "border-violet-200 bg-[linear-gradient(135deg,#f5f3ff_0%,#e9d5ff_100%)] text-violet-700 shadow-[0_10px_24px_rgba(124,58,237,0.18)]",
          title: "text-violet-900",
          sub: "text-violet-700",
          button: "border-violet-300 bg-[linear-gradient(135deg,rgba(255,255,255,0.7)_0%,rgba(245,243,255,0.95)_100%)]",
          dot: "border-violet-200 bg-[linear-gradient(135deg,#f5f3ff_0%,#e9d5ff_100%)] text-violet-600",
          empty: "border-dashed border-violet-400 bg-[linear-gradient(135deg,rgba(255,255,255,0.65)_0%,rgba(245,243,255,0.78)_100%)] text-violet-500",
          pill: "border-violet-200 bg-[linear-gradient(135deg,#f5f3ff_0%,#e9d5ff_100%)] text-violet-700",
        },
        blocked: {
          border: "border-slate-400",
          soft: "bg-[linear-gradient(135deg,rgba(248,250,252,0.92)_0%,rgba(226,232,240,0.72)_100%)]",
          badge: "border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#e2e8f0_100%)] text-slate-700 shadow-[0_10px_24px_rgba(100,116,139,0.18)]",
          title: "text-slate-900",
          sub: "text-slate-600",
          button: "border-slate-300 bg-[linear-gradient(135deg,rgba(255,255,255,0.7)_0%,rgba(248,250,252,0.95)_100%)]",
          dot: "border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#e2e8f0_100%)] text-slate-600",
          empty: "border-dashed border-slate-400 bg-[linear-gradient(135deg,rgba(255,255,255,0.65)_0%,rgba(248,250,252,0.78)_100%)] text-slate-500",
          pill: "border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#e2e8f0_100%)] text-slate-700",
        },
        checked_in: {
          border: "border-sky-400",
          soft: "bg-[linear-gradient(135deg,rgba(240,249,255,0.92)_0%,rgba(186,230,253,0.62)_100%)]",
          badge: "border-sky-200 bg-[linear-gradient(135deg,#f0f9ff_0%,#bae6fd_100%)] text-sky-700 shadow-[0_10px_24px_rgba(14,165,233,0.18)]",
          title: "text-sky-900",
          sub: "text-sky-700",
          button: "border-sky-300 bg-[linear-gradient(135deg,rgba(255,255,255,0.7)_0%,rgba(240,249,255,0.95)_100%)]",
          dot: "border-sky-200 bg-[linear-gradient(135deg,#f0f9ff_0%,#bae6fd_100%)] text-sky-600",
          empty: "border-dashed border-sky-400 bg-[linear-gradient(135deg,rgba(255,255,255,0.65)_0%,rgba(240,249,255,0.78)_100%)] text-sky-500",
          pill: "border-sky-200 bg-[linear-gradient(135deg,#f0f9ff_0%,#bae6fd_100%)] text-sky-700",
        },
        checkout: {
          border: "border-rose-400",
          soft: "bg-[linear-gradient(135deg,rgba(255,241,242,0.92)_0%,rgba(254,205,211,0.55)_100%)]",
          badge: "border-rose-200 bg-[linear-gradient(135deg,#fff1f2_0%,#fecdd3_100%)] text-rose-700 shadow-[0_10px_24px_rgba(244,63,94,0.18)]",
          title: "text-rose-900",
          sub: "text-rose-700",
          button: "border-rose-300 bg-[linear-gradient(135deg,rgba(255,255,255,0.7)_0%,rgba(255,241,242,0.95)_100%)]",
          dot: "border-rose-200 bg-[linear-gradient(135deg,#fff1f2_0%,#fecdd3_100%)] text-rose-600",
          empty: "border-dashed border-rose-400 bg-[linear-gradient(135deg,rgba(255,255,255,0.65)_0%,rgba(255,241,242,0.78)_100%)] text-rose-500",
          pill: "border-rose-200 bg-[linear-gradient(135deg,#fff1f2_0%,#fecdd3_100%)] text-rose-700",
        },
      };

      const subtitleMap = {
        available: "available",
        confirmed: "confirmed",
        blocked: "blocked",
        checked_in: "checked in",
        checkout: "due for check-out",
      };

      const tone = toneMap[key];

      return (
        <div className="max-h-[290px] space-y-3 overflow-y-auto pr-1">
          {groups.length ? (
            groups.map((group) => {
              const typeKey = `${day?.date || "today"}-${key}-${group.label}`;
              const isTypeOpen = availableTypeOpen === typeKey;

              return (
                <div key={group.label} className="relative w-full overflow-visible">
                  <span className={`absolute -right-1 -top-2 z-20 flex h-8 w-8 items-center justify-center rounded-full border text-sm font-black backdrop-blur-sm ${tone.badge}`}>
                    {group.items.length}
                  </span>
                  <div className={`overflow-hidden rounded-[22px] border bg-white/55 shadow-[0_16px_38px_rgba(15,23,42,0.08)] backdrop-blur-md ${tone.border}`}>
                    <button
                      type="button"
                      onClick={() => toggleAvailableType(typeKey)}
                      className={`flex w-full items-center justify-between gap-3 border-b px-4 py-3.5 text-left transition ${tone.button}`}
                    >
                      <div className="min-w-0">
                        <div className={`text-base font-black uppercase tracking-[0.12em] ${tone.title}`}>
                          {group.label}
                        </div>
                        <div className={`mt-1 text-sm font-medium ${tone.sub}`}>
                          {group.items.length} room(s) {subtitleMap[key]}
                        </div>
                      </div>
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-full border shadow-sm transition-transform duration-500 ease-out ${
                          isTypeOpen ? "rotate-180" : "rotate-0"
                        } ${tone.dot}`}
                      >
                        <FaChevronDown className="text-sm" />
                      </span>
                    </button>

                    <div
                      style={{ gridTemplateRows: isTypeOpen ? "1fr" : "0fr" }}
                      className="grid transition-[grid-template-rows] duration-500 ease-out"
                    >
                      <div
                        className={`overflow-hidden px-3 pb-3 transition-all duration-500 ease-out ${
                          isTypeOpen ? "opacity-100 translate-y-0" : "pointer-events-none opacity-0 translate-y-2"
                        }`}
                      >
                        <div className="space-y-2.5 pt-2.5">
                          {group.items.length ? (
                            group.items.map((item) => (
                            <div
                              key={item.id}
                              className={`rounded-[16px] border shadow-[0_10px_24px_rgba(15,23,42,0.06)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_28px_rgba(15,23,42,0.1)] ${tone.border} ${tone.soft}`}
                            >
                              <button
                                type="button"
                                onClick={() => openRoomPreview(item)}
                                className="block w-full px-3.5 pt-3 pb-2 text-left text-sm"
                              >
                                {item.statusLabel ? (
                                  <div className="mb-1 flex justify-end">
                                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.14em] ${tone.pill}`}>
                                      {item.statusLabel}
                                    </span>
                                  </div>
                                ) : null}
                                <div className={`text-base font-black ${tone.title}`}>
                                  {key === "confirmed"
                                    ? item.booking?.guestName || `Room ${item.roomNumber}`
                                    : `Room ${item.roomNumber}`}
                                </div>
                                <div className={`mt-1 text-sm font-semibold uppercase tracking-[0.14em] ${tone.sub}`}>
                                  {key === "confirmed"
                                    ? `Room ${item.roomNumber} | ID ${item.roomId || "--"}`
                                    : `ID ${item.roomId || "--"}`}
                                </div>
                                {key === "confirmed" ? (
                                  <div className={`mt-1 text-sm ${tone.title}`}>
                                    {item.booking?.mobile || item.subtitle || item.statusLabel || "Booking details"}
                                  </div>
                                ) : null}
                              </button>

                              {key === "available" ? (
                                <div className="flex flex-wrap items-center justify-end gap-1.5 border-t border-white/40 px-2.5 pb-2.5 pt-2 sm:flex-nowrap sm:gap-2 sm:px-3.5 sm:pb-3 sm:pt-2">
                                  <button
                                    type="button"
                                    onClick={() => openRoomPreview(item)}
                                    className={`flex-1 basis-[40%] whitespace-nowrap rounded-md border border-current/30 bg-white/70 px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] sm:rounded-lg sm:basis-auto sm:px-3 sm:text-xs sm:tracking-[0.12em] ${tone.sub} transition hover:bg-white`}
                                  >
                                    Preview
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      navigate("/hotel/guest", {
                                        state: {
                                          roomNumber: item.roomNumber,
                                          category: item.roomType || item.title || "",
                                          checkIn: selectedDate || todayISO(),
                                          checkOut: selectedDate || todayISO(),
                                          resetBookingDraft: true,
                                        },
                                      });
                                    }}
                                    className="inline-flex flex-1 basis-[40%] items-center justify-center gap-1 whitespace-nowrap rounded-md bg-gradient-to-r from-blue-600 to-blue-700 px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-white shadow-sm transition hover:from-blue-700 hover:to-blue-800 sm:basis-auto sm:rounded-lg sm:px-3 sm:text-xs sm:tracking-[0.12em]"
                                  >
                                    Book Now
                                  </button>
                                </div>
                              ) : null}

                              {key === "checkout" && item.booking ? (
                                <div className="flex flex-wrap items-center justify-end gap-1.5 border-t border-white/40 px-2.5 pb-2.5 pt-2 sm:flex-nowrap sm:gap-2 sm:px-3.5 sm:pb-3 sm:pt-2">
                                  <button
                                    type="button"
                                    onClick={() => handleManageBooking(item)}
                                    className={`inline-flex flex-1 basis-[40%] items-center justify-center gap-1 whitespace-nowrap rounded-md bg-gradient-to-r from-rose-600 to-rose-700 px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-white shadow-sm transition hover:from-rose-700 hover:to-rose-800 sm:basis-auto sm:rounded-lg sm:px-3 sm:text-xs sm:tracking-[0.12em]`}
                                  >
                                    Manage Booking
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          ))
                        ) : (
                            <div className={`rounded-[16px] border px-3 py-4 text-center text-sm ${tone.empty}`}>
                              No rooms
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-[18px] border border-dashed border-slate-400 bg-white/40 px-3 py-6 text-center text-sm text-slate-500 backdrop-blur-sm">
              No rooms
            </div>
          )}
        </div>
      );
    }

    const meta = BOARD_BUCKET_META[key];
    return (
      <div className="space-y-2">
        {items.length ? (
          items.slice(0, 6).map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => openRoomPreview(item)}
              className={`w-full rounded-[16px] border px-3 py-2 text-left text-xs shadow-sm ${meta.soft}`}
            >
              {item.statusLabel ? (
                <div className="mb-1 flex justify-end">
                  <span className="rounded-full border border-white/60 bg-white/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                    {item.statusLabel}
                  </span>
                </div>
              ) : null}
              <div className="font-black">Room {item.roomNumber}</div>
              <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em]">
                {item.roomType || "Room Type"} | ID {item.roomId || "--"}
              </div>
              <div className="mt-1 line-clamp-2">{item.title}</div>
            </button>
          ))
        ) : (
          <div className="rounded-[16px] border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">
            No rooms
          </div>
        )}
        {items.length > 6 ? (
          <div className="text-sm font-semibold text-slate-500">
            +{items.length - 6} more rooms
          </div>
        ) : null}
      </div>
    );
  };

  const renderExpandedBoard = (day) => (
    <div className="w-full grid grid-cols-[110px_repeat(5,minmax(180px,1fr))] border-t border-sky-400 bg-[linear-gradient(180deg,rgba(255,255,255,0.32)_0%,rgba(255,255,255,0.16)_100%)] md:grid-cols-[120px_repeat(5,minmax(210px,1fr))] xl:grid-cols-[150px_repeat(5,1fr)]">
      <div className="border-r border-sky-400 bg-[linear-gradient(180deg,rgba(224,242,254,0.55)_0%,rgba(240,249,255,0.2)_100%)]" />
      {boardOrder.map((key) => {
        const meta = BOARD_BUCKET_META[key];
        const items = day?.board?.[key] || [];
        const isOpen = bucketOpen[key] !== false;

        return (
          <div key={`${day.date}-${key}`} className="border-r border-sky-400 bg-[linear-gradient(180deg,rgba(255,255,255,0.4)_0%,rgba(255,255,255,0.16)_100%)] backdrop-blur-sm last:border-r-0 flex flex-col min-w-0">
            <div className="h-1.5 w-full flex-shrink-0" style={{ background: meta.bar.replace('bg-', '').replace('bg-[', '').replace(']', '') }} />
            <div className="flex flex-col flex-1 min-h-0 w-full px-2 py-2 sm:px-3 sm:py-3">
              <button
                type="button"
                onClick={() => toggleBucket(key)}
                className={`flex w-full items-center justify-between gap-2 rounded-[14px] border px-2.5 py-1.5 text-left text-xs shadow-sm sm:rounded-[16px] sm:px-3 sm:py-2 sm:text-sm ${meta.soft}`}
              >
                <div className="text-xs font-black tracking-[0.04em] text-slate-900 sm:text-sm">
                  {meta.label} ({items.length})
                </div>
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full border border-sky-400 bg-white/70 text-slate-500 shadow-sm transition-transform duration-500 ease-out sm:h-8 sm:w-8 ${
                    isOpen ? "rotate-180" : "rotate-0"
                  }`}
                >
                  <FaChevronDown className="text-[11px] transition-transform duration-500 ease-out sm:text-xs" />
                </span>
              </button>

              <div
                style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
                className="mt-2 grid min-h-0 flex-1 w-full transition-[grid-template-rows] duration-500 ease-out sm:mt-3"
              >
                <div
                  className={`min-h-0 overflow-hidden transition-all duration-500 ease-out ${
                    isOpen ? "opacity-100 translate-y-0" : "pointer-events-none opacity-0 translate-y-2"
                  }`}
                >
                  <div className="w-full">
                    {renderBoardColumnContent(day, key)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  useEffect(() => {
    if (!selectedRoom) return;

    const assignee = selectedRoom.roomData?.assignee;
    setSelectedAssignee(assignee && assignee !== "No Housekeeper" ? assignee : "");
    setSelectedCleaningMinutes(30);
  }, [selectedRoom]);

  const handleAssignCleaning = async () => {
    const roomId = getRoomTaskKey(selectedRoom);
    if (!roomId) {
      toast.error("Room record missing hai.");
      return;
    }

    if (!selectedAssignee) {
      toast.error("Please housekeeper select karein.");
      return;
    }

    const cleaningMinutes = Number(selectedCleaningMinutes || 0);
    if (!Number.isFinite(cleaningMinutes) || cleaningMinutes <= 0) {
      toast.error("Cleaning time valid select karein.");
      return;
    }

    try {
      setAssigningCleaning(true);
      const dueAt = new Date(Date.now() + cleaningMinutes * 60000).toISOString();

      // Persist everything to the DB — no localStorage:
      //   1. /housekeeping/assignee/<room> -> housekeeping.assignee
      //   2. /housekeeping/status/<room>   -> housekeeping.status = "Vacant Dirty"
      //      (the backend also mirrors to hotel_room_inventory.status = "Cleaning")
      //   3. /housekeeping/message         -> new row in hk_messages (task with
      //      due_at, assigned_to, task_label) so the cleaning queue + the
      //      /housekeepernotification page pick it up.
      await API.put(`/housekeeping/assignee/${roomId}`, { assignee: selectedAssignee });
      await API.put(`/housekeeping/status/${roomId}`, { status: "Vacant Dirty" });

      const receptionist =
        localStorage.getItem("name") ||
        localStorage.getItem("email") ||
        "Front Desk";
      const roomLabel = selectedRoom.roomNumber || selectedRoom.roomNo || roomId;
      const roomType = selectedRoom.roomType || selectedRoom.roomData?.categoryName || "";

      await API.post("/housekeeping/message", {
        roomId,
        roomNo: roomId,
        assignedTo: selectedAssignee,
        receptionist,
        message: `Cleaning assigned for Room ${roomLabel}${roomType ? ` (${roomType})` : ""} — please complete within ${cleaningMinutes} minutes.`,
        taskLabel: "Manual Cleaning Assignment",
        dueAt,
      });

      pushDashboardNotification({
        title: `Cleaning assigned - Room ${selectedRoom.roomNumber}`,
        message: `Assigned to ${selectedAssignee} for ${cleaningMinutes} min`,
        type: "info",
        route: "/housekeeping",
      });
      await loadDashboardData();
      setSelectedRoom((prev) =>
        prev
          ? {
              ...prev,
              roomData: {
              ...prev.roomData,
                assignee: selectedAssignee,
                status: "Vacant Dirty",
                housekeepingLabel: "Vacant Dirty",
              },
            }
          : prev,
      );
      toast.success(
        `Task sent to ${selectedAssignee}. Visible on /housekeepernotification.`,
      );
    } catch (error) {
      console.error(error);
      toast.error("Housekeeping assignment could not be saved.");
    } finally {
      setAssigningCleaning(false);
    }
  };

  const handleBlockedRoom = async (mode) => {
    const roomNumber = selectedRoom?.roomNumber;
    if (!roomNumber) {
      alert("Room number missing hai.");
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

      await loadDashboardData();
      setSelectedRoom(null);
      toast.success(mode === "block" ? "Room blocked successfully." : "Room unblocked successfully.");
    } catch (error) {
      console.error(error);
      toast.error(mode === "block" ? "Room could not be blocked." : "Room could not be unblocked.");
    }
  };

  const toggleBucket = (key) => {
    setBucketOpen((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const toggleAvailableType = (typeKey) => {
    setAvailableTypeOpen((prev) => (prev === typeKey ? "" : typeKey));
  };

  const handleManageBooking = (item) => {
    const bookingId = item?.booking?.bookingId;
    const isRoomDerived = !bookingId || String(bookingId).startsWith("room-");

    navigate("/hotel/edit-booking", {
      state: {
        bookingId: isRoomDerived ? null : bookingId,
        bookingCode: isRoomDerived ? null : item.booking.bookingCode,
        focusRoomNo: item.roomNumber,
        guestName: isRoomDerived ? (item.booking?.guestName || item.title) : undefined,
        autoManage: true,
      },
    });
  };

  const handleBookingLifecycle = async (action) => {
    if (!selectedRoom?.booking?.bookingId || String(selectedRoom.booking.bookingId).startsWith("room-")) {
      alert("Is room ke liye valid booking record nahi mila.");
      return;
    }

    try {
      await API.put(`/hotel/${action}/${selectedRoom.booking.bookingId}`);
      if (action === "check-out" && selectedRoom.roomNumber) {
        await API.put(`/housekeeping/status/${selectedRoom.roomData?.id || selectedRoom.roomNumber}`, {
          status: "Vacant Dirty",
        });
      }
      pushDashboardNotification({
        title: action === "check-out" ? `Guest checked out - Room ${selectedRoom.roomNumber}` : `Guest checked in - Room ${selectedRoom.roomNumber}`,
        message: action === "check-out" ? "Booking history me move ho gaya." : "Current stay active ho gaya.",
        type: action === "check-out" ? "warning" : "success",
        route: action === "check-out" ? "/hotel/booking-history" : "/hotel/all-bookings",
      });
      await loadDashboardData();
      setSelectedRoom(null);
      toast.success(action === "check-in" ? "Guest checked in." : "Guest checked out. Room cleaning me chala gaya.");
    } catch (error) {
      console.error(error);
      toast.error(action === "check-in" ? "Check-in failed" : "Check-out failed");
    }
  };

  return (
    <>
      <ToastContainer theme="dark" />

      {loading ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="h-16 w-16 animate-spin rounded-full border-4 border-white/30 border-t-white" />
            <p className="text-lg font-semibold text-slate-900">Loading Dashboard...</p>
          </div>
        </div>
      ) : null}

      <div
        className={`dashboard-typography dashboard-shell relative isolate min-h-fit w-full transition-all duration-300 ${
          blurBg ? "blur-[6px]" : ""
        }`}
      >
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute left-[-8%] top-[-6%] h-72 w-72 rounded-full bg-blue-100/70 blur-3xl sm:h-96 sm:w-96" />
          <div className="absolute right-[-10%] top-[8%] h-72 w-72 rounded-full bg-emerald-100/60 blur-3xl sm:h-[28rem] sm:w-[28rem]" />
          <div className="absolute bottom-[18%] left-[18%] h-56 w-56 rounded-full bg-slate-100/80 blur-3xl sm:h-80 sm:w-80" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:88px_88px] opacity-60" />
        </div>

        <div className="relative w-full overflow-x-hidden space-y-5 px-3 pb-10 pt-3 sm:space-y-6 sm:px-4 sm:pt-4 lg:px-6 xl:px-8">
          {/* Page header with gradient background */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-950 via-blue-800 to-blue-500 p-5 shadow-[0_18px_48px_rgba(2,6,23,0.35)] sm:rounded-[2rem] sm:p-6 xl:p-8">
            {/* Animated background orbs */}
            <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/[0.07] blur-2xl" />
            <div className="pointer-events-none absolute -bottom-10 -left-10 h-44 w-44 rounded-full bg-sky-300/[0.12] blur-xl" />
            <div className="pointer-events-none absolute right-[30%] top-[10%] h-32 w-32 rounded-full bg-blue-400/[0.08] blur-xl" />

            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-sky-100 backdrop-blur-sm sm:text-[11px] sm:tracking-[0.22em]">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inset-0 rounded-full bg-sky-300 animate-ping" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-200" />
                  </span>
                  Front Desk
                </p>
                <h1 className="mt-3 text-[32px] font-black tracking-tight text-white drop-shadow-sm sm:text-[38px] lg:text-[42px]">
                  Dashboard
                </h1>
                <p className="mt-2 text-sm font-medium text-blue-100/90 sm:text-base">
                  {formatDateLabel(todayISO())} &middot; {liveTotalRooms} rooms &middot; {occupancyRate} occupied
                </p>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => loadDashboardData(true)}
                  title="Refresh dashboard"
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-all duration-200 hover:bg-white/20 hover:scale-105 active:scale-95"
                >
                  <FaSyncAlt className={refreshingDashboard ? "animate-spin" : ""} />
                </button>
                <button
                  type="button"
                  onClick={() => setNotificationOpen(true)}
                  title="Notifications"
                  className="dashboard-button-secondary relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-all duration-200 hover:bg-white/20 hover:scale-105 active:scale-95"
                >
                  <FaBell />
                  {dashboardNotifications.length ? (
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white shadow-lg ring-2 ring-white">
                      {dashboardNotifications.length}
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/hotel/guest", { state: { resetBookingDraft: true } })}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-xs font-bold uppercase tracking-[0.14em] text-blue-900 shadow-[0_10px_24px_rgba(2,6,23,0.25)] transition-all duration-200 hover:bg-sky-50 hover:scale-[1.02] active:scale-[0.98] sm:w-auto sm:inline-flex"
                >
                  <FaDoorOpen /> New Booking
                </button>
              </div>
            </div>
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* Metrics                                                          */}
          {/* ---------------------------------------------------------------- */}
          {/* Responsive metrics grid: 1 col on phone, 2 on sm, 3 on md, 4 on lg, 7 on xl */}
          <div className="grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            {metrics.map((metric) => (
              <MetricCard
                key={metric.title}
                title={metric.title}
                value={metric.value}
                subtitle={metric.subtitle}
                icon={metric.icon}
                gradient={metric.gradient}
                onClick={() => handleMetricClick(metric)}
              />
            ))}
          </div>

          {activeMetricPanel ? (
            <div className="dashboard-card p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="dashboard-label text-blue-600">
                    Live Details
                  </p>
                  <h3 className="dashboard-heading mt-1">{activeMetricPanel.title}</h3>
                  <p className="dashboard-subheading mt-1">{activeMetricPanel.subtitle}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenMetricPanel("")}
                  className="dashboard-button-secondary inline-flex items-center gap-2 self-start px-3 py-2 text-xs font-semibold"
                >
                  <FaTimes className="text-[11px]" />
                  Close
                </button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {activeMetricPanel.items.length ? (
                  paginatedMetricPanelItems.map((item) => (
                    <div
                      key={`${openMetricPanel}-${item.bookingId}-${item.checkIn}-${item.checkOut}`}
                      className="dashboard-card-subtle p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-lg font-black text-slate-900">{item.guestName || "Guest"}</div>
                          <div className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                            {item.bookingCode || "Direct Booking"}
                          </div>
                        </div>
                        <span className="shrink-0 rounded-full bg-blue-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700">
                          {item.bookingStatus || "Confirmed"}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div className="dashboard-card-subtle px-3 py-3">
                          <div className="dashboard-label">Check-In</div>
                          <div className="mt-1 text-base font-bold text-slate-900">
                            {item.checkIn ? formatShortDate(item.checkIn) : "--"}
                          </div>
                        </div>
                        <div className="dashboard-card-subtle px-3 py-3">
                          <div className="dashboard-label">Check-Out</div>
                          <div className="mt-1 text-base font-bold text-slate-900">
                            {item.checkOut ? formatShortDate(item.checkOut) : "--"}
                          </div>
                        </div>
                      </div>

                      <div className="dashboard-card-subtle mt-3 border-dashed px-3 py-3">
                        <div className="dashboard-label">Rooms</div>
                        <div className="mt-1 text-base font-semibold text-slate-800">
                          {item.rooms || "Room not linked"}
                        </div>
                        {item.mobile ? (
                          <div className="mt-2 text-sm text-slate-500">Contact: {item.mobile}</div>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="dashboard-card-subtle border-dashed px-4 py-8 text-lg font-semibold text-slate-600 sm:col-span-2 xl:col-span-3">
                    {activeMetricPanel.empty}
                  </div>
                )}
              </div>

              {activeMetricPanel.items.length > METRIC_PANEL_PAGE_SIZE ? (
                <div className="dashboard-card-subtle mt-4 flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="dashboard-body">
                    Showing{" "}
                    <span className="font-semibold text-slate-900">
                      {(metricPanelPage - 1) * METRIC_PANEL_PAGE_SIZE + 1}
                    </span>{" "}
                    to{" "}
                    <span className="font-semibold text-slate-900">
                      {Math.min(metricPanelPage * METRIC_PANEL_PAGE_SIZE, activeMetricPanel.items.length)}
                    </span>{" "}
                    of{" "}
                    <span className="font-semibold text-slate-900">
                      {activeMetricPanel.items.length}
                    </span>{" "}
                    entries
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMetricPanelPage((current) => Math.max(1, current - 1))}
                      disabled={metricPanelPage === 1}
                      className="dashboard-button-secondary rounded-full px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Previous
                    </button>

                    {Array.from({ length: activeMetricPanelTotalPages }, (_, index) => {
                      const page = index + 1;
                      const isActive = page === metricPanelPage;

                      return (
                        <button
                          key={`metric-page-${page}`}
                          type="button"
                          onClick={() => setMetricPanelPage(page)}
                          className={`h-9 min-w-[36px] rounded-full border px-3 text-xs font-bold transition ${
                            isActive
                              ? "border-blue-600 bg-blue-600 text-white shadow-[0_10px_24px_rgba(37,99,235,0.18)]"
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {page}
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() =>
                        setMetricPanelPage((current) => Math.min(activeMetricPanelTotalPages, current + 1))
                      }
                      disabled={metricPanelPage === activeMetricPanelTotalPages}
                      className="dashboard-button-secondary rounded-full px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* ---------------------------------------------------------------- */}
          {/* Stay overview board                                              */}
          {/* Desktop (xl+): exact original board with 6-column grid.           */}
          {/* Mobile/tablet: compact expandable cards per day with room lists.  */}
          {/* ---------------------------------------------------------------- */}
          <section id="dashboard-stay-overview" className="flex w-full flex-col gap-5 sm:gap-6">
            <div className="dashboard-card w-full self-stretch p-4 sm:p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="dashboard-label text-blue-600">
                    Stay Overview
                  </p>
                  <p className="dashboard-subheading mt-2">
                    Shows all room statuses for the selected date.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => navigate("/dashboard")}
                    className={`flex-1 rounded-full border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] transition sm:flex-none sm:px-4 sm:text-[11px] ${
                      activeDashboardTab === "main"
                        ? "dashboard-button-primary"
                        : "dashboard-button-secondary"
                    }`}
                  >
                    Main Dashboard
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/stayover")}
                    className={`flex-1 rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] transition sm:flex-none sm:px-4 sm:text-[11px] ${
                      activeDashboardTab === "stay"
                        ? "dashboard-button-primary"
                        : "dashboard-button-secondary border"
                    }`}
                  >
                    Stay Overview
                  </button>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="dashboard-label normal-case tracking-[0.08em] text-slate-500">
                  Selected date: <span className="font-semibold text-slate-700">{formatDateLabel(selectedDate)}</span>
                </div>
                <div className="dashboard-card-subtle inline-flex flex-wrap items-center gap-2 rounded-full px-3 py-2 shadow-sm sm:ml-auto">
                  <button
                    type="button"
                    onClick={() => jumpBoardWindow(addDays(boardStartDate, -1))}
                    className="dashboard-button-primary inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.16em]"
                  >
                    Previous
                  </button>
                  <div className="dashboard-button-secondary inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-slate-700">
                    <FaCalendarAlt className="text-blue-600" />
                    <input
                      type="date"
                      value={boardStartDate}
                      onChange={(event) => jumpBoardWindow(event.target.value)}
                      className="bg-transparent outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => jumpBoardWindow(addDays(boardStartDate, 1))}
                    className="dashboard-button-primary inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.16em]"
                  >
                    Next
                  </button>
                </div>
              </div>

              {/* ===== Unified Stay Overview board: full 5-column Kanban at all breakpoints ===== */}
              <div className="mt-4 -mx-3 overflow-x-auto px-3 pb-1 [scrollbar-width:thin] sm:-mx-4 sm:px-4 sm:mx-0 sm:px-0">
                <div className="min-w-[1040px] space-y-3 md:min-w-[1180px] xl:min-w-[1080px]">
                  {stayOverview.map((day) => {
                    const isExpanded = expandedBoardDay === day.date;

                    return (
                      <div
                        key={`inline-${day.date}`}
                        className={`overflow-hidden rounded-xl border shadow-sm transition ${
                          isExpanded
                            ? "border-blue-200 bg-slate-50/60 shadow-[0_14px_30px_rgba(37,99,235,0.08)]"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleBoardDay(day.date)}
                          className="grid w-full grid-cols-[110px_repeat(5,minmax(180px,1fr))] text-left md:grid-cols-[120px_repeat(5,minmax(210px,1fr))] xl:grid-cols-[130px_repeat(5,minmax(150px,1fr))]"
                        >
                          <div
                            className={`flex items-center justify-between gap-2 border-r px-2 py-3 text-xs font-bold sm:px-3 sm:text-sm md:text-base ${
                              isExpanded
                                ? "border-slate-200 bg-slate-50 text-slate-900"
                                : "border-slate-200 bg-white text-slate-700"
                            }`}
                          >
                            <span className="truncate">{formatDateLabel(day.date)}</span>
                            <span
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-transparent text-slate-500 shadow-sm transition-transform duration-500 ease-out sm:h-8 sm:w-8 ${
                                isExpanded ? "rotate-180 border-blue-200 text-blue-700" : "rotate-0 border-slate-200"
                              }`}
                            >
                              <FaChevronDown className="text-xs sm:text-sm" />
                            </span>
                          </div>

                          {boardOrder.map((key) => (
                            <div
                              key={`inline-${day.date}-${key}`}
                              className={`border-r px-2 py-3 text-center last:border-r-0 sm:px-3 ${
                                isExpanded ? "border-slate-200 bg-slate-50/40" : "border-slate-200 bg-white"
                              }`}
                            >
                              <div className="text-xs font-black text-slate-900 sm:text-sm md:text-base">{BOARD_BUCKET_META[key].label}</div>
                              <div className={`mt-1 text-xs font-semibold sm:text-sm ${isExpanded ? "text-blue-700" : "text-slate-500"}`}>
                                {day.board[key].length} rooms
                              </div>
                            </div>
                          ))}
                        </button>

                        <div
                          style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
                          className="grid transition-[grid-template-rows] duration-500 ease-out"
                        >
                          <div
                            className={`overflow-hidden transition-all duration-500 ease-out ${
                              isExpanded ? "opacity-100 translate-y-0" : "pointer-events-none opacity-0 -translate-y-2"
                            }`}
                          >
                            {renderExpandedBoard(day)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ===== Mobile & Tablet board removed: unified Kanban board above handles all breakpoints ===== */}
              </div>

            {/* -------------------------------------------------------------- */}
            {/* Quick actions + alerts                                         */}
            {/* -------------------------------------------------------------- */}
            <div className="grid w-full items-stretch gap-4 sm:gap-5 lg:grid-cols-2">
              <div className="dashboard-card flex h-full w-full min-w-0 self-start p-3 sm:p-5">
                <div className="flex w-full flex-col">
                  <div className="mb-4">
                    <p className="dashboard-label text-blue-600">Quick Actions</p>
                    <h3 className="dashboard-heading mt-1">Daily shortcuts</h3>
                  </div>
                  <div className="space-y-3">
                    {quickActions.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() =>
                            navigate(
                              item.route,
                              item.route === "/hotel/guest"
                                ? { state: { resetBookingDraft: true } }
                                : undefined,
                            )
                          }
                          className="dashboard-card-subtle relative flex w-full min-w-0 flex-col items-start gap-3 overflow-hidden px-3 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4"
                        >
                          <div className="flex w-full min-w-0 items-start gap-3 sm:w-auto sm:flex-1 sm:items-center">
                            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r ${item.tone} text-white sm:h-11 sm:w-11 sm:rounded-2xl`}>
                              <Icon />
                            </span>
                            <div className="min-w-0">
                              <div className="dashboard-subheading text-sm text-slate-900 sm:text-base">{item.label}</div>
                              <div className="dashboard-body text-xs sm:text-sm">{item.helper}</div>
                              <div className="mt-1 text-xs font-semibold leading-5 text-slate-700 sm:text-sm md:text-[15px]">
                                {item.detail}
                              </div>
                            </div>
                          </div>
                          <div className="flex w-full shrink-0 items-center justify-between gap-3 border-t border-slate-200 pt-2 text-left sm:w-auto sm:min-w-[128px] sm:flex-col sm:items-end sm:justify-center sm:border-t-0 sm:pt-0 sm:text-right">
                            <div className="max-w-full break-words text-sm font-black text-slate-900 sm:text-base md:text-lg">{item.liveValue}</div>
                            <div className="dashboard-label mt-0 text-[10px] tracking-[0.12em] text-slate-400 sm:mt-1 sm:text-[11px]">
                              {item.liveLabel}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="dashboard-card flex h-full w-full min-w-0 self-start p-3 sm:p-5 lg:p-6">
                <div className="flex w-full flex-col">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="dashboard-label text-amber-500">Front Office Alert</p>
                      <h3 className="dashboard-heading mt-1.5 text-lg sm:mt-2 sm:text-[22px]">Actionable room issues</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate("/housekeeping")}
                      className="dashboard-button-secondary inline-flex w-full items-center justify-center px-4 py-2 text-sm font-semibold text-amber-700 sm:w-fit"
                    >
                      Review All
                    </button>
                  </div>

                  <div className="dashboard-card-subtle mt-4 p-3 sm:mt-6 sm:p-5">
                    <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-100 pb-3 sm:mb-4">
                      <div className="dashboard-heading">Alerts</div>
                    </div>

                    <div className="space-y-2">
                      {actionableAlerts.map((item) => {
                        const accentMap = {
                          attention: { line: "border-rose-100/80" },
                          confirmed: { line: "border-amber-100/80" },
                          "checked-in": { line: "border-sky-100/80" },
                        };
                        const accent = accentMap[item.key] || { line: "border-slate-100" };
                        const Icon = item.icon;

                        return (
                          <div
                            key={item.key}
                            className={`rounded-xl border bg-white px-3 py-3 transition hover:bg-slate-50 sm:px-4 ${accent.line}`}
                          >
                            <div className="flex min-w-0 items-start gap-2.5 sm:gap-3">
                              <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-50 sm:h-9 sm:w-9 ${item.iconClass}`}>
                                <Icon className="text-sm sm:text-base" />
                              </span>
                              <div className="min-w-0">
                                <div className="dashboard-subheading text-sm text-slate-900 sm:text-base">{item.title}</div>
                                <div className="dashboard-body mt-1 text-xs sm:text-sm">{item.detail}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ---------------------------------------------------------------- */}
          {/* Charts                                                           */}
          {/* ---------------------------------------------------------------- */}
          <div className="grid w-full grid-cols-1 gap-5 sm:gap-6 xl:grid-cols-3 xl:items-stretch">
            <div className="dashboard-card flex h-full min-w-0 flex-col px-4 py-4 sm:px-6 sm:py-6">
              <div className="min-h-0 h-[260px] flex-1 sm:h-[320px] xl:h-[360px]">
                <MonthlyRevenueChart />
              </div>
            </div>
            <div className="dashboard-card flex h-full min-w-0 flex-col p-4 sm:p-5">
              <div className="min-h-0 h-[260px] w-full flex-1 sm:h-[320px] xl:h-[360px]">
                <FoodSalesChart />
              </div>
            </div>
            <div className="dashboard-card flex h-full min-w-0 flex-col p-4 sm:p-5">
              <div className="w-full">
                <p className="dashboard-label text-blue-600">Room Mix</p>
                <div className="dashboard-subheading mb-3 mt-1 text-slate-900">Occupancy overview</div>
                <RoomOccupancyChart
                  rooms={rooms}
                  occupiedRooms={liveOccupiedRooms || apiMetrics.occupiedRooms || 0}
                  totalRooms={liveTotalRooms}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Notification center modal                                        */}
      {/* ---------------------------------------------------------------- */}
      {notificationOpen ? (
        <div
          className="fixed inset-0 z-[1100] flex items-start justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm"
          onClick={() => setNotificationOpen(false)}
        >
          <div
            className="mt-10 w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/70 bg-[linear-gradient(180deg,#fbfdff_0%,#f6f9ff_100%)] shadow-[0_30px_80px_rgba(15,23,42,0.24)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-violet-600">Notification Center</p>
                <h3 className="mt-1 text-2xl font-bold text-slate-900">All messages</h3>
              </div>
              <button
                type="button"
                onClick={() => setNotificationOpen(false)}
                className="rounded-full border border-slate-200 bg-white p-2 text-slate-500 transition hover:text-slate-900"
              >
                <FaTimes />
              </button>
            </div>

            <div className="max-h-[70vh] space-y-3 overflow-y-auto p-5 sm:p-6">
              {dashboardNotifications.length ? (
                dashboardNotifications.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (item.route) navigate(item.route);
                      setNotificationOpen(false);
                    }}
                    className="w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                        <div className="mt-1 text-xs leading-5 text-slate-500">{item.message}</div>
                      </div>
                      <div className="rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {new Date(item.createdAt || Date.now()).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                  There are no notifications at this time.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* ---------------------------------------------------------------- */}
      {/* Room preview modal                                                */}
      {/* ---------------------------------------------------------------- */}
      {selectedRoom ? (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm"
          onClick={() => setSelectedRoom(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[2rem] border border-white/70 bg-[linear-gradient(180deg,#fbfdff_0%,#f5faf8_100%)] shadow-[0_30px_80px_rgba(15,23,42,0.24)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-[#fbfdff]/95 px-5 py-5 backdrop-blur sm:px-6">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-cyan-700">Room Preview</p>
                <h3 className="mt-1 text-2xl font-bold text-slate-900">
                  Room {selectedRoom.roomNumber || selectedRoom.roomNo || "--"}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedRoom.roomType || "Room Type"} | Room No {selectedRoom.roomNumber || selectedRoom.roomNo || "--"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRoom(null)}
                className="rounded-full border border-slate-200 bg-white p-2 text-slate-500 transition hover:text-slate-900"
              >
                <FaTimes />
              </button>
            </div>

            <div className="space-y-5 p-5 sm:p-6">
              <div className="grid gap-3 sm:grid-cols-2">
                {roomPreviewStats.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-[1.25rem] border border-slate-200 bg-white px-4 py-4 shadow-sm"
                  >
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">{item.label}</div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">{item.value}</div>
                  </div>
                ))}
              </div>

              <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-sm font-semibold text-slate-900">Booking snapshot</div>
                <div className="mt-4 space-y-3 text-sm text-slate-600">
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                    <span>Room Type</span>
                    <span className="font-semibold text-slate-900">{selectedRoom.roomType || "--"}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                    <span>Room ID</span>
                    <span className="font-semibold text-slate-900">{selectedRoom.roomId || selectedRoom.roomData?.id || "--"}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                    <span>Guest Name</span>
                    <span className="font-semibold text-slate-900">{selectedRoom.booking?.guestName || "--"}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                    <span>Contact</span>
                    <span className="font-semibold text-slate-900">
                      {getBookingContact(selectedRoom.booking) || selectedRoom.booking?.mobile || "--"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                    <span>Company</span>
                    <span className="font-semibold text-slate-900">{selectedRoom.booking?.company || "--"}</span>
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

              {isCleaningTaskEditable(selectedRoom) ? (
                <div className="rounded-[1.5rem] border border-violet-200 bg-violet-50/60 p-4 shadow-sm">
                  <div className="text-sm font-semibold text-violet-900">Assign housekeeping</div>
                  <p className="mt-1 text-xs text-violet-700">
                    Send a cleaning task to a housekeeper with a time-bound deadline.
                  </p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-700">Housekeeper</span>
                      <select
                        value={selectedAssignee}
                        onChange={(event) => setSelectedAssignee(event.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-violet-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-violet-400"
                      >
                        <option value="">Select housekeeper</option>
                        {housekeepers.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-700">Time allotted</span>
                      <select
                        value={selectedCleaningMinutes}
                        onChange={(event) => setSelectedCleaningMinutes(Number(event.target.value))}
                        className="mt-1.5 w-full rounded-xl border border-violet-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-violet-400"
                      >
                        {CLEANING_TIME_OPTIONS.map((minutes) => (
                          <option key={minutes} value={minutes}>
                            {minutes} min
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={handleAssignCleaning}
                    disabled={assigningCleaning}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  >
                    {assigningCleaning ? "Assigning..." : "Assign Cleaning"}
                  </button>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                {selectedRoom.booking?.bookingId && !String(selectedRoom.booking.bookingId).startsWith("room-") ? (
                  <button
                    type="button"
                    onClick={() =>
                      handleBookingLifecycle(isRoomInStay(selectedRoom.booking) ? "check-out" : "check-in")
                    }
                    className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
                  >
                    {isRoomInStay(selectedRoom.booking) ? "Check Out" : "Check In"}
                  </button>
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
                  className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
                >
                  Order Book
                </button>
                <button
                  type="button"
                  onClick={() =>
                    navigate("/stayover", {
                      state: {
                        startDate: selectedRoom.booking?.checkIn || selectedDate,
                        focusRoomNumber: selectedRoom.roomNumber,
                      },
                    })
                  }
                  className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Open Stay Overview
                </button>
                <button
                  type="button"
                  onClick={() =>
                    navigate("/hotel/edit-booking", {
                      state: {
                        bookingId: selectedRoom.booking?.bookingId,
                        bookingCode: selectedRoom.booking?.bookingCode,
                        focusRoomNo: selectedRoom.roomNumber,
                      },
                    })
                  }
                  className="rounded-xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-700"
                >
                  Extend Booking
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
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Book / Update Room
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
                  className="rounded-xl bg-slate-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  {String(selectedRoom.roomData?.hotelStatus || selectedRoom.roomData?.status || "").toLowerCase().includes("block")
                    ? "Unblock Room"
                    : "Block Room"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default Dashboard;