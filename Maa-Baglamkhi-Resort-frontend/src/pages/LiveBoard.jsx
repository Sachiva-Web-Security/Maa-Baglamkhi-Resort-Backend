import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FaUtensils, FaHome, FaClock, FaUser, FaCheckCircle, FaSpinner, FaPlay, FaHandshake } from "react-icons/fa";
import { FiRefreshCw } from "react-icons/fi";
import API from "../api";
import { getCurrentActor } from "../utils/currentActor";

const getStatusColor = (status) => {
  switch (status) {
    case "pending":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "preparing":
      return "bg-sky-100 text-sky-700 border-sky-200";
    case "ready":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "picked_up":
      return "bg-purple-100 text-purple-700 border-purple-200";
    case "served":
      return "bg-cyan-100 text-cyan-700 border-cyan-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
};

const getStatusLabel = (status) => {
  switch (status) {
    case "pending":
      return "Pending";
    case "preparing":
      return "Preparing";
    case "ready":
      return "Ready";
    case "picked_up":
      return "Picked Up";
    case "served":
      return "Served";
    default:
      return status || "Unknown";
  }
};

const formatTimeSince = (timestamp) => {
  if (!timestamp) return "--";
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const hours = Math.floor(diffMins / 60);
  if (hours < 24) return `${hours}h ${diffMins % 60}m ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const LiveBoard = () => {
  const navigate = useNavigate();
  const actor = getCurrentActor();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all, mine, tables, rooms
  const [actionLoading, setActionLoading] = useState(null);

  const fetchLiveBoard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await API.get("/waiter/live-board");
      setOrders(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Failed to fetch live board:", error);
      setOrders([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLiveBoard();
    const interval = setInterval(() => fetchLiveBoard(true), 5000);
    return () => clearInterval(interval);
  }, [fetchLiveBoard]);

  const handlePickup = async (order) => {
    if (!order.isOwnedByCurrentWaiter) return;
    setActionLoading(order.tokenId);
    try {
      await API.patch(`/waiter/orders/${order.tokenId}/pickup`);
      await fetchLiveBoard(true);
    } catch (error) {
      alert(error.response?.data?.message || "Failed to pickup order");
    } finally {
      setActionLoading(null);
    }
  };

  const handleServed = async (order) => {
    if (!order.isOwnedByCurrentWaiter) return;
    setActionLoading(order.tokenId);
    try {
      await API.patch(`/waiter/orders/${order.tokenId}/served`);
      await fetchLiveBoard(true);
    } catch (error) {
      alert(error.response?.data?.message || "Failed to mark as served");
    } finally {
      setActionLoading(null);
    }
  };

  const handleGoToTable = (order) => {
    if (order.entityType === "Room") {
      navigate(`/restaurant/roomitem/${order.tokenId}`);
    } else {
      navigate(`/restaurant/edit-token/${order.tableNumber}`);
    }
  };

  const filteredOrders = orders.filter((order) => {
    if (filter === "mine") return order.isOwnedByCurrentWaiter;
    if (filter === "tables") return order.entityType === "Table";
    if (filter === "rooms") return order.entityType === "Room";
    return true;
  });

  const myOrders = orders.filter((o) => o.isOwnedByCurrentWaiter);
  const otherOrders = orders.filter((o) => !o.isOwnedByCurrentWaiter);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 p-5">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-sky-600">Floor Operations</p>
            <h1 className="mt-1 text-2xl font-black text-slate-900 sm:text-3xl">Live Board</h1>
            <p className="mt-1 text-sm text-slate-600">
              All active tables and rooms with owner and status
            </p>
          </div>
          <button
            onClick={() => fetchLiveBoard()}
            className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-md transition hover:bg-slate-50"
          >
            <FiRefreshCw className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-7">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Active</p>
            <p className="mt-1 text-2xl font-black text-slate-900">{orders.length}</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-500">My Orders</p>
            <p className="mt-1 text-2xl font-black text-emerald-600">{myOrders.length}</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-red-500">Pending</p>
            <p className="mt-1 text-2xl font-black text-red-600">
              {orders.filter((o) => o.orderStatus === "pending").length}
            </p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-sky-500">Preparing</p>
            <p className="mt-1 text-2xl font-black text-sky-600">
              {orders.filter((o) => o.orderStatus === "preparing").length}
            </p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-500">Ready to Pick</p>
            <p className="mt-1 text-2xl font-black text-amber-600">
              {orders.filter((o) => o.orderStatus === "ready").length}
            </p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-purple-500">Picked Up</p>
            <p className="mt-1 text-2xl font-black text-purple-600">
              {orders.filter((o) => o.orderStatus === "picked_up").length}
            </p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-cyan-500">Served</p>
            <p className="mt-1 text-2xl font-black text-cyan-600">
              {orders.filter((o) => o.orderStatus === "served").length}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap gap-2">
          {["all", "mine", "tables", "rooms"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                filter === f
                  ? "bg-slate-800 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {f === "all" ? "All" : f === "mine" ? "My Orders" : f === "tables" ? "Tables" : "Rooms"}
            </button>
          ))}
        </div>

        {/* Orders Grid */}
        {loading ? (
          <div className="flex items-center justify-center rounded-2xl bg-white py-20 shadow-sm">
            <FaSpinner className="animate-spin text-3xl text-slate-400" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex items-center justify-center rounded-2xl bg-white py-20 shadow-sm">
            <div className="text-center">
              <FaUtensils className="mx-auto text-4xl text-slate-300" />
              <p className="mt-3 text-lg font-bold text-slate-500">No active orders</p>
              <p className="mt-1 text-sm text-slate-400">All tables and rooms are available</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredOrders.map((order) => (
              <div
                key={`${order.entityType}-${order.table}-${order.tokenId}`}                className={`rounded-2xl border-2 bg-white p-4 shadow-sm transition ${
                  order.isOwnedByCurrentWaiter
                    ? "border-emerald-300 ring-2 ring-emerald-100"
                    : "border-slate-200"
                }`}
              >
                {/* Header */}
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {order.entityType === "Room" ? (
                      <FaHome className="text-sky-600" />
                    ) : (
                      <FaUtensils className="text-emerald-600" />
                    )}
                    <span className="text-lg font-black text-slate-900">
                      {order.entityType} {order.tableNumber}
                    </span>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusColor(order.orderStatus)}`}>
                    {getStatusLabel(order.orderStatus)}
                  </span>
                </div>

                {/* Owner */}
                <div className="mb-3 flex items-center gap-2">
                  <FaUser className="text-slate-400" />
                  <span className={`text-sm font-semibold ${order.isOwnedByCurrentWaiter ? "text-emerald-600" : "text-slate-600"}`}>
                    {order.isOwnedByCurrentWaiter ? "Your order" : `Handled by ${order.ownerName || "Unknown"}`}
                  </span>
                </div>

                {/* Kitchen Status */}
                {order.kitchenStatus && (
                  <div className="mb-3 rounded-xl bg-slate-50 p-2 text-xs text-slate-600">
                    Kitchen: <span className="font-bold">{order.kitchenStatus}</span>
                    {order.prepTimeMinutes && ` • ETA: ${order.prepTimeMinutes} min`}
                  </div>
                )}

                {/* Time */}
                <div className="mb-3 flex items-center gap-2 text-xs text-slate-400">
                  <FaClock />
                  <span>{formatTimeSince(order.lockedAt || order.sentAt)}</span>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  {order.isOwnedByCurrentWaiter ? (
                    <>
                      {String(order.orderStatus).toLowerCase() === "ready" && (
                        <button
                          onClick={() => handlePickup(order)}
                          disabled={actionLoading === order.tokenId}
                          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-purple-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-purple-700 disabled:opacity-50"
                        >
                          {actionLoading === order.tokenId ? (
                            <FaSpinner className="animate-spin" />
                          ) : (
                            <>
                              <FaHandshake />
                              Pick Up
                            </>
                          )}
                        </button>
                      )}
                      {String(order.orderStatus).toLowerCase() === "picked_up" && (
                        <button
                          onClick={() => handleServed(order)}
                          disabled={actionLoading === order.tokenId}
                          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-cyan-700 disabled:opacity-50"
                        >
                          {actionLoading === order.tokenId ? (
                            <FaSpinner className="animate-spin" />
                          ) : (
                            <>
                              <FaCheckCircle />
                              Mark Served
                            </>
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => handleGoToTable(order)}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
                      >
                        View
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-center text-xs font-semibold text-slate-400">
                        Status: {order.orderStatus || "unknown"}
                      </div>
                      <button
                        onClick={() => handleGoToTable(order)}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
                      >
                        View
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
};

export default LiveBoard;
