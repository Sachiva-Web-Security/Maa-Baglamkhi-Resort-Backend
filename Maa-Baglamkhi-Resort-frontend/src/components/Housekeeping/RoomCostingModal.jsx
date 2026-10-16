import { useState, useEffect, useCallback } from "react";
import {
  FaTimes,
  FaCalculator,
  FaPlus,
  FaSyncAlt,
  FaDownload,
  FaCheckCircle,
  FaExclamationTriangle,
} from "react-icons/fa";
import API from "../../api";

const DEFAULT_COSTS = {
  staffCostPerHour: 120,
  avgCleaningHours: 0.5,
  lineCostPerClean: 45,
  toiletrieCostPerClean: 30,
  miscCostPerClean: 15,
};

export default function RoomCostingModal({ rooms, onClose, apiBase }) {
  const [costs, setCosts] = useState(DEFAULT_COSTS);
  const [costLogs, setCostLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("calculator");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState({
    open: false,
    type: "success",
    title: "",
    message: "",
  });

  // Per-room overrides
  const [roomOverrides, setRoomOverrides] = useState({});
  const [selectedRoom, setSelectedRoom] = useState("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get("/housekeeping/costing");
      setCostLogs(res.data);
    } catch { setCostLogs([]); }
    finally { setLoading(false); }
  }, [apiBase]);

  useEffect(() => { if (tab === "history") fetchLogs(); }, [tab, fetchLogs]);

  const calcCostPerClean = (override = {}) => {
    const c = { ...costs, ...override };
    return (
      (c.staffCostPerHour * c.avgCleaningHours) +
      c.lineCostPerClean +
      c.toiletrieCostPerClean +
      c.miscCostPerClean +
      (c.extraLinen || 0) +
      (c.extraMisc || 0)
    );
  };

  const totalCostPerClean = calcCostPerClean();
  const feedbackTone =
    feedback.type === "success"
      ? {
          icon: FaCheckCircle,
          accent: "from-emerald-600 via-teal-600 to-cyan-600",
          badge: "Success",
          button: "bg-emerald-600 hover:bg-emerald-700",
        }
      : {
          icon: FaExclamationTriangle,
          accent: "from-rose-600 via-red-600 to-orange-500",
          badge: "Action Error",
          button: "bg-rose-600 hover:bg-rose-700",
        };

  const handleLogCost = async () => {
    if (!selectedRoom) return;
    setSaving(true);
    const room = rooms.find(r => String(r.id) === selectedRoom);
    const costData = { ...costs, ...(roomOverrides[selectedRoom] || {}) };
    const totalCost = calcCostPerClean(roomOverrides[selectedRoom]);
    try {
      await API.post("/housekeeping/costing", {
        roomId: selectedRoom,
        roomNo: room?.roomNo,
        ...costData,
        totalCost,
        loggedBy: localStorage.getItem("username") || "Staff",
      });
      setFeedback({
        open: true,
        type: "success",
        title: "Cost Logged Successfully",
        message: `Room ${room?.roomNo || "--"} ke liye cleaning cost Rs. ${totalCost.toFixed(2)} save ho gayi.`,
      });
      fetchLogs();
      setTab("history");
    } catch {
      setFeedback({
        open: true,
        type: "error",
        title: "Save Failed",
        message: "Room cleaning cost could not be saved. Please try again.",
      });
    }
    setSaving(false);
  };

  const exportCSV = () => {
    const rows = [["Room", "Staff Cost", "Linen", "Toiletries", "Misc", "Total", "Date", "By"]];
    costLogs.forEach(r => rows.push([r.room_no, r.staff_cost, r.linen_cost, r.toiletrie_cost, r.misc_cost, r.total_cost, r.created_at?.slice(0, 10), r.logged_by]));
    const csv = rows.map(r => r.join(",")).join("\n");
    const a = document.createElement("a"); a.href = "data:text/csv," + encodeURIComponent(csv); a.download = "room_costing.csv"; a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-5xl max-h-[94vh] overflow-y-auto rounded-[36px] bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-[36px] border-b border-slate-100 bg-white px-8 py-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100">
              <FaCalculator className="text-2xl text-indigo-600" />
            </div>
            <div>
              <h3 className="text-3xl font-black text-slate-900">Room Costing</h3>
              <p className="text-xl text-slate-500">Calculate cost per clean including staff, linen & supplies</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-3 text-slate-400 hover:bg-slate-100"><FaTimes size={24} /></button>
        </div>

        <div className="p-8">
          <div className="mb-6 flex w-fit gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1.5">
            {[{ key: "calculator", label: "Calculator" }, { key: "history", label: "Cost History" }].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`rounded-xl px-6 py-3 text-xl font-semibold transition ${tab === t.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === "calculator" && (
            <>
              {/* Global Parameters */}
              <div className="mb-8 rounded-[28px] border border-indigo-100 bg-indigo-50 p-6">
                <h4 className="mb-5 text-2xl font-bold text-indigo-900">Default Cost Parameters</h4>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  {[
                    { label: "Staff Cost / Hour (₹)", key: "staffCostPerHour" },
                    { label: "Avg Cleaning Time (hrs)", key: "avgCleaningHours" },
                    { label: "Linen Cost / Clean (₹)", key: "lineCostPerClean" },
                    { label: "Toiletries / Clean (₹)", key: "toiletrieCostPerClean" },
                    { label: "Misc / Clean (₹)", key: "miscCostPerClean" },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="mb-2 block text-xl font-semibold text-indigo-700">{f.label}</label>
                      <input
                        type="number" min="0" step="0.01"
                        value={costs[f.key]}
                        onChange={e => setCosts(prev => ({ ...prev, [f.key]: parseFloat(e.target.value) || 0 }))}
                        className="w-full rounded-2xl border border-indigo-200 bg-white px-5 py-4 text-xl outline-none"
                      />
                    </div>
                  ))}
                </div>

                {/* Cost Breakdown */}
                <div className="mt-6 rounded-2xl border border-indigo-200 bg-white p-5">
                  <div className="mb-3 text-base font-bold uppercase text-indigo-600">Cost Breakdown</div>
                  <div className="space-y-3 text-xl">
                    <div className="flex justify-between"><span className="text-slate-600">Staff Labour</span><span className="font-semibold">₹{(costs.staffCostPerHour * costs.avgCleaningHours).toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-600">Linen</span><span className="font-semibold">₹{costs.lineCostPerClean.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-600">Toiletries</span><span className="font-semibold">₹{costs.toiletrieCostPerClean.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-600">Misc</span><span className="font-semibold">₹{costs.miscCostPerClean.toFixed(2)}</span></div>
                    <div className="flex justify-between border-t border-slate-200 pt-3 font-black text-indigo-700">
                      <span>Total Cost / Clean</span>
                      <span className="text-3xl">&#8377;{totalCostPerClean.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Log Cost for Room */}
              <div className="rounded-[28px] border border-slate-200 p-6">
                <h4 className="mb-5 text-2xl font-bold text-slate-900">Log Cleaning Cost for Room</h4>
                <div className="mb-4">
                  <label className="mb-2 block text-xl font-semibold text-slate-600">Select Room</label>
                  <select value={selectedRoom} onChange={e => setSelectedRoom(e.target.value)} className="w-full rounded-2xl border border-slate-200 px-5 py-4 text-xl outline-none">
                    <option value="">Select Room</option>
                    {rooms.map(r => <option key={r.id} value={r.id}>Room {r.roomNo} – {r.roomType || "N/A"}</option>)}
                  </select>
                </div>

                {selectedRoom && (
                  <div className="mb-5 rounded-2xl border border-slate-100 bg-slate-50 p-5">
                    <div className="mb-3 text-base font-semibold text-slate-500">Room-specific override (optional)</div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {[
                        { label: "Extra Linen (₹)", key: "extraLinen" },
                        { label: "Extra Misc (₹)", key: "extraMisc" },
                      ].map(f => (
                        <div key={f.key}>
                          <label className="mb-2 block text-xl text-slate-600">{f.label}</label>
                          <input
                            type="number" min="0" step="0.01"
                            value={roomOverrides[selectedRoom]?.[f.key] || ""}
                            onChange={e => setRoomOverrides(prev => ({ ...prev, [selectedRoom]: { ...(prev[selectedRoom] || {}), [f.key]: parseFloat(e.target.value) || 0 } }))}
                            placeholder="0"
                            className="w-full rounded-2xl border border-slate-200 px-5 py-4 text-xl outline-none"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 text-right text-xl font-black text-indigo-700">
                      Total for this room: ₹{calcCostPerClean(roomOverrides[selectedRoom]).toFixed(2)}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3">
                  <button onClick={handleLogCost} disabled={!selectedRoom || saving} className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-8 py-3 text-xl font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                    <FaPlus className="text-sm" /> {saving ? "Saving..." : "Log Cleaning Cost"}
                  </button>
                </div>
              </div>
            </>
          )}

          {tab === "history" && (
            <>
              <div className="mb-5 flex gap-3">
                <button onClick={fetchLogs} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-5 py-3 text-xl font-semibold text-slate-700 hover:bg-slate-50">
                  <FaSyncAlt className="text-sm" /> Refresh
                </button>
                <button onClick={exportCSV} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-5 py-3 text-xl font-semibold text-slate-700 hover:bg-slate-50">
                  <FaDownload className="text-sm" /> Export
                </button>
              </div>

              {loading ? (
                <div className="py-12 text-center text-xl text-slate-400"><FaSyncAlt className="animate-spin inline mr-2" />Loading...</div>
              ) : costLogs.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 py-12 text-center text-xl text-slate-400">No cost records yet.</div>
              ) : (
                <>
                  <div className="mb-5 flex flex-wrap gap-4">
                    <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-4">
                      <div className="text-base font-semibold text-indigo-600">Total Logged</div>
                      <div className="text-3xl font-black text-indigo-900">{costLogs.length} cleans</div>
                    </div>
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4">
                      <div className="text-base font-semibold text-rose-600">Total Cost</div>
                      <div className="text-3xl font-black text-rose-900">₹{costLogs.reduce((s, r) => s + parseFloat(r.total_cost || 0), 0).toFixed(0)}</div>
                    </div>
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
                      <div className="text-base font-semibold text-emerald-600">Avg Cost / Clean</div>
                      <div className="text-3xl font-black text-emerald-900">₹{costLogs.length ? (costLogs.reduce((s, r) => s + parseFloat(r.total_cost || 0), 0) / costLogs.length).toFixed(0) : 0}</div>
                    </div>
                  </div>
                  <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="w-full text-xl">
                      <thead className="bg-slate-50">
                        <tr>{["Room", "Staff", "Linen", "Toiletries", "Misc", "Total", "Date", "By"].map(h => <th key={h} className="px-4 py-4 text-left text-base font-semibold text-slate-500 uppercase">{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {costLogs.map((r, i) => (
                          <tr key={r.id || i} className="border-t border-slate-100 hover:bg-slate-50">
                            <td className="px-4 py-4 font-semibold">{r.room_no}</td>
                            <td className="px-4 py-4">₹{parseFloat(r.staff_cost || 0).toFixed(0)}</td>
                            <td className="px-4 py-4">₹{parseFloat(r.linen_cost || 0).toFixed(0)}</td>
                            <td className="px-4 py-4">₹{parseFloat(r.toiletrie_cost || 0).toFixed(0)}</td>
                            <td className="px-4 py-4">₹{parseFloat(r.misc_cost || 0).toFixed(0)}</td>
                            <td className="px-4 py-4 font-black text-indigo-700">₹{parseFloat(r.total_cost || 0).toFixed(0)}</td>
                            <td className="px-4 py-4 text-slate-400">{r.created_at?.slice(0, 10)}</td>
                            <td className="px-4 py-4 text-slate-400">{r.logged_by}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {feedback.open ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-[3px]">
          <div className="w-full max-w-xl overflow-hidden rounded-[32px] border border-white/70 bg-white shadow-[0_32px_90px_rgba(15,23,42,0.28)]">
            <div className={`bg-gradient-to-r ${feedbackTone.accent} px-7 py-6 text-white`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15">
                    {feedbackTone.icon === FaCheckCircle ? (
                      <FaCheckCircle className="text-2xl" />
                    ) : (
                      <FaExclamationTriangle className="text-2xl" />
                    )}
                  </div>
                  <div>
                    <div className="inline-flex rounded-full bg-white/15 px-3 py-1 text-[11px] font-black uppercase tracking-[0.24em] text-white">
                      {feedbackTone.badge}
                    </div>
                    <h3 className="mt-3 text-3xl font-black leading-tight">{feedback.title}</h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFeedback((current) => ({ ...current, open: false }))}
                  className="rounded-full p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
                >
                  <FaTimes size={20} />
                </button>
              </div>
            </div>

            <div className="px-7 pb-7 pt-6">
              <p className="text-xl leading-8 text-slate-600">{feedback.message}</p>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => setFeedback((current) => ({ ...current, open: false }))}
                  className={`rounded-2xl px-8 py-3 text-xl font-semibold text-white transition ${feedbackTone.button}`}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

