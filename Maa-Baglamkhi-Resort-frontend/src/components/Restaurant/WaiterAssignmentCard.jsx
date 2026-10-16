/**
 * WaiterAssignmentCard.jsx
 * Cloned from HousekeepingRow assignee card pattern.
 * Assigns a waiter to a ready room-order and handles delivery confirmation.
 */
import React, { useState, useEffect, useMemo } from "react";
import { FaUserCheck, FaClock, FaCheckCircle, FaExclamationCircle } from "react-icons/fa";
import API from "../../api";

const DELIVERY_ETA_OPTIONS = [5, 10, 15, 20, 30, 45];

export default function WaiterAssignmentCard({ order, onAssigned, onDelivered, assigneeOptions = [] }) {
  const [waiter, setWaiter] = useState("");
  const [eta, setEta] = useState(15);
  const [assigning, setAssigning] = useState(false);
  const [delivering, setDelivering] = useState(false);
  const [assignmentId, setAssignmentId] = useState(order?.assignment_id || null);
  const [isAssigned, setIsAssigned] = useState(Boolean(order?.assignment_id));
  const [isDelivered, setIsDelivered] = useState(false);
  const [error, setError] = useState("");

  // Auto-fill waiter from logged-in actor
  useEffect(() => {
    try {
      const actor = JSON.parse(localStorage.getItem("currentActor") || "{}");
      if (actor?.name) setWaiter(actor.name);
    } catch {
      // ignore
    }
  }, []);

  const items = useMemo(() => {
    if (Array.isArray(order?.items)) return order.items;
    try {
      return JSON.parse(order?.items || "[]");
    } catch {
      return [];
    }
  }, [order?.items]);

  const total = useMemo(
    () =>
      items.reduce((sum, item) => {
        const qty = Number(item.qty ?? item.quantity ?? 1);
        return sum + qty * Number(item.price || 0);
      }, 0),
    [items],
  );

  const roomLabel = useMemo(() => {
    const ref = order?.table || order?.table_number || order?.table_no || "--";
    const entityType = String(order?.entityType || order?.entity_type || "Room");
    const label = entityType.charAt(0).toUpperCase() + entityType.slice(1).toLowerCase();
    return `${label} ${ref}`;
  }, [order]);

  const handleAssign = async () => {
    if (!waiter || assigning) return;
    setAssigning(true);
    setError("");
    try {
      const res = await API.post("/room-service-delivery/assign-waiter", {
        kitchenOrderId: order.id,
        waiterName: waiter,
        deliveryEtaMinutes: Number(eta),
        bookingId: order?.booking_id || 0,
        roomNumber: order?.table || order?.table_number || "",
      });
      setAssignmentId(res.data?.assignmentId || null);
      setIsAssigned(true);
      onAssigned?.(order.id, res.data);
    } catch (err) {
      const msg = err.response?.data?.message || "Waiter assignment failed";
      setError(msg);
    } finally {
      setAssigning(false);
    }
  };

  const handleMarkDelivered = async () => {
    if (!assignmentId || delivering) return;
    setDelivering(true);
    setError("");
    try {
      const res = await API.post(`/room-service-delivery/mark-delivered/${assignmentId}`);
      setIsDelivered(true);
      onDelivered?.(order.id, res.data);
    } catch (err) {
      const msg = err.response?.data?.message || "Delivery confirmation failed";
      setError(msg);
    } finally {
      setDelivering(false);
    }
  };

  // Delivered state
  if (isDelivered) {
    return (
      <div className="rounded-[22px] border border-emerald-200 bg-[linear-gradient(180deg,#ecfdf5_0%,#f0fdf4_100%)] p-5 shadow-[0_12px_35px_rgba(15,23,42,0.08)]">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-emerald-500 p-3 text-white">
            <FaCheckCircle className="text-2xl" />
          </div>
          <div>
            <h3 className="text-xl font-black text-emerald-800">Delivered</h3>
            <p className="text-lg text-emerald-600">
              Rs. {total.toLocaleString("en-IN")} posted to folio
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Assigned but not yet delivered — show delivery button
  if (isAssigned && assignmentId) {
    return (
      <div className="rounded-[22px] border border-sky-200 bg-[linear-gradient(180deg,#eff6ff_0%,#f8fbff_100%)] p-5 shadow-[0_12px_35px_rgba(15,23,42,0.08)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-sky-500 p-3 text-white">
              <FaUserCheck className="text-2xl" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900">{waiter}</h3>
              <p className="text-lg text-slate-500">
                ETA: {eta} min &middot; {roomLabel}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleMarkDelivered}
            disabled={delivering}
            className="inline-flex items-center gap-2 rounded-[14px] bg-emerald-500 px-5 py-3 text-lg font-bold text-white shadow-md transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {delivering ? (
              <>
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Confirming...
              </>
            ) : (
              <>
                <FaCheckCircle /> Mark Delivered
              </>
            )}
          </button>
        </div>
        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-lg text-rose-700">
            <FaExclamationCircle /> {error}
          </div>
        )}
      </div>
    );
  }

  // Unassigned — show assignment form
  return (
    <div className="rounded-[22px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-5 shadow-[0_12px_35px_rgba(15,23,42,0.08)]">
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-full bg-amber-100 p-3 text-amber-600">
          <FaClock className="text-2xl" />
        </div>
        <div>
          <h3 className="text-xl font-black text-slate-900">Assign Waiter</h3>
          <p className="text-lg text-slate-500">
            {roomLabel} &middot; Rs. {total.toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-600">
            Waiter
          </label>
          <input
            type="text"
            value={waiter}
            onChange={(e) => setWaiter(e.target.value)}
            placeholder="Enter waiter name"
            list="waiter-list"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-lg text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
          />
          <datalist id="waiter-list">
            {assigneeOptions.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-600">
            Delivery ETA (minutes)
          </label>
          <select
            value={eta}
            onChange={(e) => setEta(Number(e.target.value))}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-lg text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
          >
            {DELIVERY_ETA_OPTIONS.map((m) => (
              <option key={m} value={m}>{m} min</option>
            ))}
          </select>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-base text-rose-700">
            <FaExclamationCircle /> {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleAssign}
          disabled={!waiter || assigning}
          className="w-full rounded-[14px] bg-gradient-to-r from-sky-600 to-cyan-500 px-5 py-3 text-lg font-bold text-white shadow-md transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {assigning ? (
            <>
              <span className="mr-2 inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Assigning...
            </>
          ) : (
            "Assign Waiter"
          )}
        </button>
      </div>
    </div>
  );
}
