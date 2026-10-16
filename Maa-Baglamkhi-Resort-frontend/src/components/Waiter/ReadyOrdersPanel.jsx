import React, { useEffect, useRef, useState } from "react";
import { FiBell, FiClock, FiCheckCircle, FiAlertCircle } from "react-icons/fi";

import { useWaiterOrders } from "../../hooks/useWaiterOrders";
import { restaurantService } from "../../services/restaurantService";
import { getCurrentActor } from "../../utils/currentActor";

const formatCurrency = (value) => `Rs. ${Number(value || 0).toLocaleString("en-IN")}`;
const formatTime = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
};

const ReadyOrdersPanel = ({ onNavigateToKitchen }) => {
  const actor = getCurrentActor();
  const { readyOrders, loading, pickupOrder, markServed, activeOrders, error } = useWaiterOrders();
  const [pickingUp, setPickingUp] = useState(null);
  const [serving, setServing] = useState(null);
  const [notification, setNotification] = useState(null);

  // Track previous count to detect new orders
  const prevReadyCount = useRef(readyOrders.length);

  // Play sound and show notification when new ready orders arrive
  useEffect(() => {
    if (readyOrders.length > prevReadyCount.current) {
      const newOrder = readyOrders[readyOrders.length - 1];

      // Play alert sound
      try {
        const audio = new Audio("/order.mp3");
        audio.volume = 0.7;
        audio.play().catch(() => {
          // Audio play failed - user hasn't interacted with page yet
        });
      } catch {
        // Audio not supported
      }

      // Show notification
      setNotification({
        message: `New order ready: ${newOrder.entityType} ${newOrder.tableNumber}`,
        orderId: newOrder.tokenId,
      });

      // Auto-hide notification after 5 seconds
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }

    // Update previous count
    prevReadyCount.current = readyOrders.length;
  }, [readyOrders.length]);

  const handlePickup = async (tokenId) => {
    setPickingUp(tokenId);
    const result = await pickupOrder(tokenId);

    if (result.success) {
      setNotification({
        message: "Order picked up successfully!",
        type: "success",
      });
      setTimeout(() => setNotification(null), 3000);
    } else if (result.alreadyTaken) {
      setNotification({
        message: "Order was picked up by another waiter",
        type: "warning",
      });
      setTimeout(() => setNotification(null), 4000);
    } else {
      setNotification({
        message: result.message || "Failed to pickup order",
        type: "error",
      });
      setTimeout(() => setNotification(null), 4000);
    }

    setPickingUp(null);
  };

  const handleMarkServed = async (tokenId) => {
    setServing(tokenId);
    const result = await markServed(tokenId);

    if (result.success) {
      setNotification({
        message: "Order marked as served!",
        type: "success",
      });
      setTimeout(() => setNotification(null), 3000);
    } else {
      setNotification({
        message: result.message || "Failed to mark as served",
        type: "error",
      });
      setTimeout(() => setNotification(null), 4000);
    }

    setServing(null);
  };

  return (
    <div className="space-y-6">
      {/* Notification Banner */}
      {notification && (
        <div
          className={`fixed top-20 right-5 z-50 max-w-md rounded-2xl border p-4 shadow-2xl animate-pulse ${
            notification.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : notification.type === "warning"
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          <div className="flex items-start gap-3">
            {notification.type === "success" ? (
              <FiCheckCircle className="mt-0.5 text-xl text-emerald-600" />
            ) : notification.type === "warning" ? (
              <FiAlertCircle className="mt-0.5 text-xl text-amber-600" />
            ) : (
              <FiAlertCircle className="mt-0.5 text-xl text-rose-600" />
            )}
            <div className="flex-1">
              <p className="text-sm font-bold">{notification.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setNotification(null)}
              className="text-current opacity-60 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Ready Orders Section */}
      <section className="rounded-[24px] border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center rounded-xl bg-amber-100 p-2">
              <FiBell className="text-xl text-amber-600" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">
                Ready to Pick Up
              </h3>
              <p className="text-sm text-slate-600">
                {readyOrders.length > 0
                  ? `${readyOrders.length} order${readyOrders.length > 1 ? "s" : ""} waiting`
                  : "No orders ready yet"}
              </p>
            </div>
          </div>

          {readyOrders.length > 0 && (
            <button
              type="button"
              onClick={onNavigateToKitchen}
              className="rounded-full border border-amber-200 bg-white px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-50"
            >
              View Kitchen
            </button>
          )}
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* Ready Orders Grid */}
        {readyOrders.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {readyOrders.map((order) => (
              <div
                key={order.tokenId}
                className="rounded-2xl border-2 border-amber-300 bg-white p-5 shadow-md transition hover:shadow-lg"
              >
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <div className="text-base font-black text-slate-900">
                      {order.entityType} {order.tableNumber}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <FiClock />
                      {formatTime(order.readyAt)}
                    </div>
                  </div>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">
                    Ready
                  </span>
                </div>

                {/* Items List */}
                <div className="mb-3 space-y-1.5">
                  {order.items?.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-slate-700">
                        {item.name} x{item.qty}
                      </span>
                      <span className="font-semibold text-slate-900">
                        {formatCurrency(item.qty * item.rate)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Total */}
                {order.items?.length > 0 && (
                  <div className="mb-3 flex items-center justify-between border-t border-slate-200 pt-2 text-sm font-bold text-slate-900">
                    <span>Total</span>
                    <span>
                      {formatCurrency(
                        order.items.reduce(
                          (sum, item) => sum + item.qty * item.rate,
                          0
                        )
                      )}
                    </span>
                  </div>
                )}

                {/* Pickup Button */}
                <button
                  type="button"
                  onClick={() => handlePickup(order.tokenId)}
                  disabled={pickingUp === order.tokenId}
                  className={`w-full rounded-xl py-2.5 text-sm font-bold transition ${
                    pickingUp === order.tokenId
                      ? "cursor-not-allowed bg-slate-300 text-slate-500"
                      : "bg-gradient-to-r from-emerald-600 to-teal-500 text-white hover:shadow-md"
                  }`}
                >
                  {pickingUp === order.tokenId ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Picking up...
                    </span>
                  ) : (
                    "✓ Pick Up Order"
                  )}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-amber-200 bg-white/50 p-8 text-center text-sm text-slate-500">
            {loading ? "Checking for ready orders..." : "No orders ready to pick up"}
          </div>
        )}
      </section>

      {/* Active Orders (Picked Up) Section */}
      {activeOrders.length > 0 && (
        <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex items-center justify-center rounded-xl bg-blue-100 p-2">
              <FiCheckCircle className="text-xl text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">
                Orders with You
              </h3>
              <p className="text-sm text-slate-600">
                {activeOrders.length} order{activeOrders.length > 1 ? "s" : ""} picked up
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeOrders.map((order) => (
              <div
                key={order.tokenId}
                className="rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50 p-5 shadow-sm"
              >
                <div className="mb-3">
                  <div className="text-base font-black text-slate-900">
                    {order.entityType} {order.tableNumber}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                    <FiClock />
                    Picked up at {formatTime(order.pickedUpAt)}
                  </div>
                </div>

                {/* Items Preview */}
                <div className="mb-3 space-y-1">
                  {order.items?.slice(0, 3).map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-slate-700">
                        {item.name} x{item.qty}
                      </span>
                    </div>
                  ))}
                  {order.items?.length > 3 && (
                    <div className="text-xs text-slate-500">
                      +{order.items.length - 3} more items
                    </div>
                  )}
                </div>

                {/* Mark Served Button */}
                <button
                  type="button"
                  onClick={() => handleMarkServed(order.tokenId)}
                  disabled={serving === order.tokenId}
                  className={`w-full rounded-xl py-2.5 text-sm font-bold transition ${
                    serving === order.tokenId
                      ? "cursor-not-allowed bg-slate-300 text-slate-500"
                      : "bg-gradient-to-r from-blue-600 to-indigo-500 text-white hover:shadow-md"
                  }`}
                >
                  {serving === order.tokenId ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Marking...
                    </span>
                  ) : (
                    "✓ Mark as Served"
                  )}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default ReadyOrdersPanel;
