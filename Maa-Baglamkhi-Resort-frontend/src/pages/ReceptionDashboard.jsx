import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FaBed,
  FaCalendarCheck,
  FaCalendarTimes,
  FaBoxes,
  FaDoorOpen,
  FaExchangeAlt,
  FaUserCheck,
} from "react-icons/fa";

import API from "../api";
import RoleDashboardShell from "../components/roleDashboards/ReceptionDashboardLayout";
import useDashboardAutoRefresh from "../hooks/useDashboardAutoRefresh";

const todayISO = () => new Date().toISOString().slice(0, 10);

const ReceptionDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bookings, setBookings] = useState([]);
  const [rooms, setRooms] = useState([]);

 const load = useCallback(async (silent = false, signal) => {
    try {
      if (!silent) setLoading(true);
      setError("");

     const results = await Promise.allSettled([
       API.get("/hotel/all-bookings", { signal }),
       API.get("/housekeeping", { signal }),
     ]);

      const [bookingsRes, roomsRes] = results;
      setBookings(bookingsRes.status === "fulfilled" ? bookingsRes.value.data || [] : []);
      setRooms(roomsRes.status === "fulfilled" ? roomsRes.value.data || [] : []);

      if (bookingsRes.status !== "fulfilled" && roomsRes.status !== "fulfilled") {
        setError("Reception dashboard data could not be loaded.");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useDashboardAutoRefresh(load);

  const stats = useMemo(() => {
    const today = todayISO();
    const arrivals = bookings.filter((item) => String(item.checkIn || "").slice(0, 10) === today).length;
    const departures = bookings.filter((item) => String(item.checkOut || "").slice(0, 10) === today).length;
    const pendingBookings = bookings.filter((item) =>
      String(item.bookingStatus || item.status || "").toLowerCase().includes("pending")
    ).length;
    const availableRooms = rooms.filter((item) => {
      const status = String(item.status || item.housekeepingLabel || "").toLowerCase();
      return status.includes("clean") || status.includes("vacant");
    }).length;

    return [
      {
        label: "Today's Arrivals",
        value: arrivals,
        note: "Check-in queue for the front desk today.",
        icon: FaCalendarCheck,
        tone: "cyan",
      },
      {
        label: "Today's Departures",
        value: departures,
        note: "Rooms expected to vacate by end of day.",
        icon: FaCalendarTimes,
        tone: "amber",
      },
      {
        label: "Room Availability",
        value: availableRooms,
        note: "Rooms currently clean or ready for allocation.",
        icon: FaBed,
        tone: "emerald",
      },
      {
        label: "Pending Bookings",
        value: pendingBookings,
        note: "Reservations that still need action or confirmation.",
        icon: FaUserCheck,
        tone: "violet",
      },
    ];
  }, [bookings, rooms]);

  const insights = useMemo(() => [
    {
      label: "Guest Queue",
      value: bookings.slice(0, 5).length,
      note: "Top guests visible for quick desk review.",
    },
    {
      label: "Dirty Rooms",
      value: rooms.filter((item) => String(item.status || "").toLowerCase().includes("dirty")).length,
      note: "Housekeeping follow-up needed before new allotments.",
    },
    {
      label: "Check-out Ready",
      value: bookings.filter((item) => String(item.checkOut || "").slice(0, 10) === todayISO()).length,
      note: "Front office settlement preparation for departing guests.",
    },
  ], [bookings, rooms]);

  const table = useMemo(() => ({
    eyebrow: "Desk Activity",
    title: "Today's guest movement",
    meta: `${bookings.length} bookings`,
    columns: [
      { key: "guest", label: "Guest" },
      { key: "room", label: "Room" },
      { key: "arrival", label: "Arrival" },
      { key: "departure", label: "Departure" },
      { key: "status", label: "Status" },
    ],
    rows: bookings
      .filter((item) => {
        const today = todayISO();
        return String(item.checkIn || "").slice(0, 10) === today || String(item.checkOut || "").slice(0, 10) === today;
      })
      .slice(0, 8)
      .map((item, index) => ({
        id: item.id || item.bookingId || index,
        guest: item.guestName || item.name || "Guest",
        room: item.roomNumber || item.roomNo || "--",
        arrival: item.checkIn || "--",
        departure: item.checkOut || "--",
        status: item.bookingStatus || item.status || "--",
      })),
    emptyText: "No arrival or departure movement found for today.",
  }), [bookings]);

  return (
    <RoleDashboardShell
      badge="Reception Hub"
      title="Reception dashboard for live guest movement"
      description="Monitor arrivals, departures, room readiness, and essential front-desk operations from one streamlined dashboard."
      stats={stats}
      quickActions={[
        { label: "Guest Check-In", helper: "Create a new booking or quickly check in a walk-in guest.", route: "/hotel/guest", icon: FaDoorOpen, tone: "cyan" },
        { label: "Guest Check-Out", helper: "Manage departing guest settlements and follow-up actions.", route: "/hotel/communication", icon: FaExchangeAlt, tone: "amber" },
        { label: "All Bookings", helper: "Manage the reservation queue directly from the front desk.", route: "/hotel/all-bookings", icon: FaCalendarCheck, tone: "emerald" },
        { label: "Inventory", helper: "Review and manage inventory items and supply status from one place.", route: "/inventory", icon: FaBoxes, tone: "rose" },
        { label: "Booking History", helper: "Review guest stay history and reference details.", route: "/hotel/booking-history", icon: FaUserCheck, tone: "violet" },
      ]}
      insights={insights}
      table={table}
      loading={loading}
      error={error}
    />
  );
};

export default ReceptionDashboard;
