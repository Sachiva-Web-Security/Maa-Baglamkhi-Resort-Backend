import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../api";

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

const formatDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const today = () => new Date().toISOString().slice(0, 10);

const BLOCK_TYPES = [
  "Maintenance", "Deep Clean", "Renovation",
  "Inspection", "Pest Control", "Other",
];

const STATUS_STYLES = {
  Active:    "bg-rose-100 text-rose-700 border-rose-200",
  Completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Cancelled: "bg-slate-100 text-slate-500 border-slate-200",
};

const BLOCK_ICONS = {
  Maintenance:  "🔧",
  "Deep Clean": "🧹",
  Renovation:   "🏗️",
  Inspection:   "🔍",
  "Pest Control": "🪲",
  Other:        "📌",
};

const BLOCK_ACCENT = {
  Maintenance:  "bg-amber-500",
  "Deep Clean": "bg-sky-500",
  Renovation:   "bg-violet-500",
  Inspection:   "bg-teal-500",
  "Pest Control": "bg-rose-500",
  Other:        "bg-slate-500",
};

const BLOCK_TYPE_LABEL = {
  Maintenance:  "Maintenance",
  "Deep Clean": "Deep Clean",
  Renovation:   "Renovation",
  Inspection:   "Inspection",
  "Pest Control": "Pest Control",
  Other:        "Other",
};

/* ─── Block Room Modal ─────────────────────────────────────────────────────── */

const BlockModal = ({ rooms, onClose, onSaved }) => {
  const currentUser = localStorage.getItem("name") || "Manager";
  const [form, setForm] = useState({
    room_number: rooms[0]?.roomNumber || "",
    block_type: "Maintenance",
    reason: "",
    blocked_from: today(),
    blocked_until: today(),
    blocked_by: currentUser,
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.room_number) {
      alert("Room number required");
      return;
    }
    if (form.blocked_from > form.blocked_until) {
      alert("End date cannot be before start date");
      return;
    }
    try {
      setSaving(true);
      await API.post("/hotel/room-block", form);
      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-slate-900 px-6 py-4">
          <p className="text-sm font-bold uppercase tracking-widest text-slate-400">
            Room Block
          </p>
          <h2 className="mt-1 text-2xl font-bold text-white">Schedule Maintenance</h2>
        </div>

        <div className="space-y-5 p-6">
          <div>
            <label className="mb-2 block text-sm font-semibold uppercase tracking-wider text-slate-500">
              Room Number
            </label>
            {rooms.length > 0 ? (
              <select
                value={form.room_number}
                onChange={(e) => set("room_number", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-4 py-3 text-base outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                {rooms.map((r) => (
                  <option key={r.roomNumber} value={r.roomNumber}>
                    {r.roomNumber} — {r.categoryName}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                placeholder="Room Number (e.g. 101)"
                value={form.room_number}
                onChange={(e) => set("room_number", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-4 py-3 text-base outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold uppercase tracking-wider text-slate-500">
              Block Type
            </label>
            <select
              value={form.block_type}
              onChange={(e) => set("block_type", e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-4 py-3 text-base outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              {BLOCK_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-sm font-semibold uppercase tracking-wider text-slate-500">
                From Date
              </label>
              <input
                type="date"
                value={form.blocked_from}
                min={today()}
                onChange={(e) => set("blocked_from", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-4 py-3 text-base outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold uppercase tracking-wider text-slate-500">
                Until Date
              </label>
              <input
                type="date"
                value={form.blocked_until}
                min={form.blocked_from || today()}
                onChange={(e) => set("blocked_until", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-4 py-3 text-base outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold uppercase tracking-wider text-slate-500">
              Reason / Notes
            </label>
            <textarea
              rows={3}
              placeholder="Water pipe leaking, AC servicing, etc."
              value={form.reason}
              onChange={(e) => set("reason", e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-4 py-3 text-base outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold uppercase tracking-wider text-slate-500">
              Blocked By
            </label>
            <input
              type="text"
              value={form.blocked_by}
              onChange={(e) => set("blocked_by", e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-4 py-3 text-base outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 rounded-lg bg-slate-900 py-3 text-base font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? "Blocking…" : "Block Room"}
            </button>
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-5 py-3 text-base font-bold text-slate-600 transition hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── Main Component ───────────────────────────────────────────────────────── */

const RoomMaintenance = () => {
  const navigate = useNavigate();
  const currentRole = String(localStorage.getItem("role") || "").toLowerCase();
  const currentUser = localStorage.getItem("name") || "Manager";
  const canCreateBlock = ["admin", "manager", "receptionist"].includes(currentRole);
  const canResolveBlock = ["admin", "manager"].includes(currentRole);

  const [blocks, setBlocks] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState("Active");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [blocksRes, setupRes] = await Promise.all([
        API.get("/hotel/room-blocks"),
        API.get("/hotel/rooms/setup"),
      ]);
      setBlocks(Array.isArray(blocksRes.data) ? blocksRes.data : []);
      const allRooms = [];
      if (Array.isArray(setupRes.data)) {
        for (const cat of setupRes.data) {
          for (const rn of cat.rooms || []) {
            allRooms.push({ roomNumber: rn, categoryName: cat.name });
          }
        }
      }
      setRooms(allRooms);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStatusChange = async (blockId, newStatus) => {
    try {
      await API.put(`/hotel/room-block/${blockId}`, { status: newStatus });
      setBlocks((prev) =>
        prev.map((b) =>
          b.id === blockId ? { ...b, status: newStatus } : b,
        ),
      );
    } catch (err) {
      console.error(err);
      alert("Update failed");
    }
  };

  const filteredBlocks = blocks.filter(
    (b) => filterStatus === "All" || b.status === filterStatus,
  );

  const activeCount = blocks.filter((b) => b.status === "Active").length;

  return (
    <>
      {showModal && (
        <BlockModal
          rooms={rooms}
          onClose={() => setShowModal(false)}
          onSaved={loadData}
        />
      )}

      <div className="min-h-screen bg-slate-50">
        <div className="px-4 py-6 sm:px-6 lg:px-8">

          {/* ── Back Button ── */}
          <div className="mb-5">
            <button
              type="button"
              onClick={() => navigate("/hotel/all-bookings")}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-base font-bold text-slate-600 transition hover:bg-slate-50"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              All Bookings
            </button>
          </div>

          {/* ── Top Bar: Block Room button (left) + Filters (right) ── */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            {canCreateBlock && (
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-3 text-base font-bold text-white shadow-sm transition hover:bg-slate-800"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Block Room
              </button>
            )}

            <div className="flex items-center gap-1.5">
              {["All", "Active", "Completed", "Cancelled"].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFilterStatus(s)}
                  className={`rounded-lg px-4 py-2 text-base font-semibold transition ${
                    filterStatus === s
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* ── Page Header ── */}
          <div className="mb-6">
            <h1 className="text-4xl font-bold text-slate-900">
              Room Blocking &amp; Maintenance
            </h1>
            <p className="mt-2 text-lg text-slate-500">
              Manage room blocks for maintenance, cleaning, and other purposes.
            </p>
          </div>

          {/* ── Stats Row ── */}
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                Total Rooms
              </div>
              <div className="mt-3 text-3xl font-bold text-slate-900">{rooms.length}</div>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-5">
              <div className="text-sm font-semibold uppercase tracking-wider text-rose-500">
                Active Blocks
              </div>
              <div className="mt-3 text-3xl font-bold text-rose-700">{activeCount}</div>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
              <div className="text-sm font-semibold uppercase tracking-wider text-emerald-500">
                Completed
              </div>
              <div className="mt-3 text-3xl font-bold text-emerald-700">
                {blocks.filter((b) => b.status === "Completed").length}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                Cancelled
              </div>
              <div className="mt-3 text-3xl font-bold text-slate-900">
                {blocks.filter((b) => b.status === "Cancelled").length}
              </div>
            </div>
          </div>

          {/* ── Blocks List ── */}
          {loading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />
              <p className="mt-3 text-base text-slate-500">Loading…</p>
            </div>
          ) : filteredBlocks.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white p-12 text-center">
              <div className="text-4xl">🔧</div>
              <p className="mt-3 text-base font-semibold text-slate-500">
                {filterStatus === "Active"
                  ? "No active maintenance blocks."
                  : "No records found."}
              </p>
              {canCreateBlock && (
                <button
                  type="button"
                  onClick={() => setShowModal(true)}
                  className="mt-4 rounded-lg bg-slate-900 px-5 py-2.5 text-base font-bold text-white transition hover:bg-slate-800"
                >
                  Schedule First Block
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredBlocks.map((block) => (
                <div
                  key={block.id}
                  className="rounded-xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="p-5 sm:p-6">
                    {/* Top Row: Icon + Room + Type + Status */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-2xl">
                          {BLOCK_ICONS[block.block_type] || "🔧"}
                        </div>
                        <div>
                          <div className="text-xl font-bold text-slate-900">
                            Room {block.room_number}
                          </div>
                          <div className="text-sm font-semibold text-slate-500">
                            {BLOCK_TYPE_LABEL[block.block_type] || block.block_type}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`rounded-full border px-4 py-1.5 text-sm font-bold ${
                          STATUS_STYLES[block.status] ||
                          "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        {block.status}
                      </span>
                    </div>

                    {/* Date Range */}
                    <div className="mt-5 flex flex-wrap items-center gap-4 text-base">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold uppercase tracking-wider text-slate-400">From</span>
                        <span className="font-semibold text-slate-800">{formatDate(block.blocked_from)}</span>
                      </div>
                      <svg className="h-5 w-5 text-slate-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold uppercase tracking-wider text-slate-400">Until</span>
                        <span className="font-semibold text-slate-800">{formatDate(block.blocked_until)}</span>
                      </div>
                    </div>

                    {/* Reason */}
                    {block.reason && (
                      <p className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
                        {block.reason}
                      </p>
                    )}

                    {/* Footer: Blocked by + Actions */}
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                      <span className="text-sm text-slate-400">
                        By: {block.blocked_by || "—"}
                      </span>

                      {block.status === "Active" && canResolveBlock && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleStatusChange(block.id, "Completed")}
                            className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-emerald-700"
                          >
                            Mark Complete
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(block.id, "Cancelled")}
                            className="rounded-lg border border-slate-200 bg-white px-5 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                      {block.status === "Active" && !canResolveBlock && (
                        <span className="text-sm text-slate-400">
                          Only Manager/Admin can resolve
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Colored top accent bar */}
                  <div className={`h-1 w-full rounded-t-xl ${BLOCK_ACCENT[block.block_type] || "bg-slate-400"}`} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default RoomMaintenance;
