import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FaClipboardCheck,
  FaFileInvoiceDollar,
  FaHistory,
  FaHotel,
  FaMoneyBillWave,
  FaReceipt,
  FaTasks,
  FaUtensils,
  FaChartLine,
  FaFileAlt,
} from "react-icons/fa";

import API from "../api";
import RoleDashboardShell from "../components/roleDashboards/RoleDashboardShell";
import useDashboardAutoRefresh from "../hooks/useDashboardAutoRefresh";

const formatINR = (amount) =>
  `Rs. ${Number(amount || 0).toLocaleString("en-IN")}`;

const AccountsDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState({});
  const [metrics, setMetrics] = useState({});
  const [transactions, setTransactions] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [bookingHistory, setBookingHistory] = useState([]);
  const [banquets, setBanquets] = useState([]);
  const [restaurantBills, setRestaurantBills] = useState([]);
  const [assignments, setAssignments] = useState([]);

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError("");

      const role = localStorage.getItem("role");
      const name = localStorage.getItem("name");
      const results = await Promise.allSettled([
        API.get("/accounts/summary"),
        // /dashboard/metrics is the same authoritative endpoint used by the
        // main admin Dashboard and Manager Dashboard — it computes
        // todayRevenue and totalRevenueGenerated straight from invoices +
        // restaurant bills + banquet bookings + room bookings in the DB.
        // The Accounts dashboard previously had no real "today's revenue"
        // figure at all (only an all-time "Total Payments" number), which is
        // why it looked like it wasn't showing real data.
        API.get("/dashboard/metrics"),
        API.get("/accounts/transactions"),
        API.get("/hotel/all-bookings"),
        API.get("/hotel/booking-history"),
        API.get("/banquet"),
        API.get("/restaurant/bills"),
        API.get("/assignments", {
          params: { role, name: name || "" },
        }),
      ]);

      const [
        summaryRes,
        metricsRes,
        transactionRes,
        bookingRes,
        historyRes,
        banquetRes,
        billsRes,
        assignmentsRes,
      ] = results;

      setSummary(summaryRes.status === "fulfilled" ? summaryRes.value.data || {} : {});
      setMetrics(metricsRes.status === "fulfilled" ? metricsRes.value.data || {} : {});
      setTransactions(transactionRes.status === "fulfilled" ? transactionRes.value.data || [] : []);
      setBookings(bookingRes.status === "fulfilled" ? bookingRes.value.data || [] : []);
      setBookingHistory(historyRes.status === "fulfilled" ? historyRes.value.data || [] : []);
      setBanquets(banquetRes.status === "fulfilled" ? banquetRes.value.data || [] : []);
      setRestaurantBills(billsRes.status === "fulfilled" ? billsRes.value.data || [] : []);
      setAssignments(assignmentsRes.status === "fulfilled" ? assignmentsRes.value.data || [] : []);

      if (summaryRes.status !== "fulfilled" && transactionRes.status !== "fulfilled") {
        setError("Accounts dashboard data could not be loaded.");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useDashboardAutoRefresh(load);

  const pendingDues = useMemo(
    () =>
      bookings.reduce(
        (sum, item) => sum + (Number(item.remainingAmount || item.balanceAmount || 0) || 0),
        0
      ),
    [bookings]
  );

  const billableBookings = useMemo(() => {
    const merged = [...bookings, ...bookingHistory];
    const seen = new Set();

    return merged.filter((booking) => {
      const key = String(booking.bookingId || booking.id || "");
      if (!key) {
        console.warn("Booking missing identifier:", {
          checkIn: booking.checkIn,
          roomNumber: booking.roomNumber,
        });
        return false;
      }

      if (seen.has(key)) return false;

      seen.add(key);
      return true;
    });
  }, [bookingHistory, bookings]);

  const pendingAssignments = useMemo(
    () =>
      assignments.filter(
        (item) => !["completed", "cancelled"].includes(String(item.status || "").toLowerCase())
      ).length,
    [assignments]
  );

  const completedAssignments = useMemo(
    () =>
      assignments.filter((item) => String(item.status || "").toLowerCase() === "completed").length,
    [assignments]
  );

  const stats = useMemo(() => [
    {
      label: "Today's Revenue",
      value: formatINR(metrics.todayRevenue),
      note: "Real-time total across invoices, restaurant, banquet and room bookings for today.",
      icon: FaMoneyBillWave,
      tone: "emerald",
    },
    {
      label: "Total Revenue Generated",
      value: formatINR(metrics.totalRevenueGenerated),
      note: "Overall billed revenue snapshot across every department.",
      icon: FaChartLine,
      tone: "cyan",
    },
    {
      label: "Total Payments",
      value: formatINR(summary.income),
      note: "Combined income captured in accounts summary.",
      icon: FaMoneyBillWave,
      tone: "emerald",
    },
    {
      label: "Pending Dues",
      value: formatINR(pendingDues),
      note: "Remaining balance across current guest bookings.",
      icon: FaReceipt,
      tone: "rose",
    },
    {
      label: "Guest Billing",
      value: billableBookings.length,
      note: "Active plus checked-out bookings visible for billing and reconciliation.",
      icon: FaHotel,
      tone: "cyan",
    },
    {
      label: "Banquet Bills",
      value: banquets.length,
      note: "Banquet records available for payment review.",
      icon: FaFileInvoiceDollar,
      tone: "amber",
    },
    {
      label: "Restaurant Billing",
      value: restaurantBills.length,
      note: "Issued restaurant bills ready for verification.",
      icon: FaUtensils,
      tone: "violet",
    },
    {
      label: "Assigned Tasks",
      value: assignments.length,
      note: "Finance tasks currently assigned to this account.",
      icon: FaTasks,
      tone: "slate",
    },
  ], [assignments.length, banquets.length, billableBookings.length, metrics.todayRevenue, metrics.totalRevenueGenerated, pendingDues, restaurantBills.length, summary.income]);

  const insights = useMemo(() => [
    {
      label: "Net Position",
      value: formatINR(summary.net),
      note: "Income minus expense from the current finance summary.",
      icon: FaChartLine,
      tone: "emerald",
    },
    {
      label: "GST Payable",
      value: formatINR(summary.gstPayable),
      note: "Tax payable snapshot for current financial entries.",
      icon: FaFileAlt,
      tone: "amber",
    },
    {
      label: "Expense Load",
      value: formatINR(summary.expense),
      note: "Total expense values posted in the accounts module.",
      icon: FaReceipt,
      tone: "rose",
    },
    {
      label: "Pending Tasks",
      value: pendingAssignments,
      note: "Assignments still waiting for action on this accountant login.",
      icon: FaClipboardCheck,
      tone: "slate",
    },
    {
      label: "Completed Tasks",
      value: completedAssignments,
      note: "Assignments already closed from this accounts workflow.",
      icon: FaClipboardCheck,
      tone: "cyan",
    },
  ], [completedAssignments, pendingAssignments, summary]);

  const table = useMemo(() => {
    if (assignments.length) {
      return {
        eyebrow: "Assigned Work",
        title: "Accounts tasks assigned to you",
        meta: `${assignments.length} tasks`,
        columns: [
          { key: "room_number", label: "Room" },
          { key: "task", label: "Task" },
          { key: "priority", label: "Priority" },
          { key: "status", label: "Status" },
          { key: "assigned_by", label: "Assigned By" },
        ],
        rows: assignments.slice(0, 8),
        emptyText: "No finance assignments found for this account.",
      };
    }

    return {
      eyebrow: "Accounts Feed",
      title: "Recent transactions",
      meta: `${transactions.length} transactions`,
      columns: [
        { key: "date", label: "Date" },
        { key: "type", label: "Type" },
        { key: "description", label: "Description" },
        { key: "amount", label: "Amount", render: (row) => formatINR(row.amount) },
        { key: "paymentMode", label: "Mode" },
      ],
      rows: transactions.slice(0, 8),
      emptyText: "No transactions found for accounts dashboard.",
    };
  }, [assignments, transactions]);

  return (
    <RoleDashboardShell
      badge="Accounts Overview"
      title="Accounts dashboard for billing and collections"
      description="Access payments, guest balances, banquet invoices, restaurant collections, and transaction history—all organized in one centralized finance dashboard."
      stats={stats}
      quickActions={[
        { label: "Open Accounts", helper: "Income, expense aur invoices manage karein.", route: "/accounts", icon: FaMoneyBillWave, tone: "emerald" },
        { label: "My Assignments", helper: "Manager ya admin ke diye finance tasks dekhein.", route: "/assignments", icon: FaClipboardCheck, tone: "slate" },
        { label: "Reports", helper: "Collections aur finance reports ko review karein.", route: "/reports", icon: FaHistory, tone: "cyan" },
        { label: "Hotel Billing", helper: "Guest booking balances ko reconcile karein.", route: "/hotel/all-bookings", icon: FaHotel, tone: "amber" },
        { label: "Restaurant Bills", helper: "Food billing aur outlet settlement review karein.", route: "/restaurant/payment-bills", icon: FaUtensils, tone: "violet" },
      ]}
      insights={insights}
      table={table}
      loading={loading}
      error={error}
    />
  );
};

export default AccountsDashboard;