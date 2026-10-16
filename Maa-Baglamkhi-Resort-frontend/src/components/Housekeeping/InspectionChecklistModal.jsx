import { useState, useEffect, useCallback } from "react";
import { FaTimes, FaClipboardList, FaCheck, FaExclamationTriangle, FaSyncAlt, FaDownload } from "react-icons/fa";
import API from "../../api";

const INSPECTION_CHECKLIST = [
  {
    category: "Bed & Linen",
    items: ["Bed made properly", "Clean sheets / pillow covers", "No stains on linen", "Correct number of pillows", "Blanket folded neatly"],
  },
  {
    category: "Bathroom",
    items: ["Bathroom clean and dry", "WC cleaned and disinfected", "Mirror spotless", "Towels replaced & arranged", "Toiletries replenished", "Floor dry & clean"],
  },
  {
    category: "Room General",
    items: ["Floor vacuumed / mopped", "Dust on all surfaces removed", "AC/Fan working", "TV & remote working", "Lights working", "Safe operational", "Wi-Fi details card in place"],
  },
  {
    category: "Mini Bar & Supplies",
    items: ["Minibar restocked", "Water bottles placed", "Stationery replenished", "Laundry bag placed", "Slippers placed"],
  },
  {
    category: "Doors, Windows & Fixtures",
    items: ["Door lock working", "Windows clean & closed", "Curtains / blinds working", "No damage to furniture"],
  },
];

const PRIORITY_COLORS = {
  Normal: "bg-slate-100 text-slate-700 border-slate-200",
  High:   "bg-amber-100 text-amber-700 border-amber-200",
  Urgent: "bg-rose-100 text-rose-700 border-rose-200",
};

export default function InspectionChecklistModal({ rooms, onClose, apiBase }) {
  const [tab, setTab] = useState("new");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  // New inspection form
  const [selectedRoom, setSelectedRoom] = useState("");
  const [inspectorName, setInspectorName] = useState(localStorage.getItem("username") || "");
  const [priority, setPriority] = useState("Normal");
  const [checkedItems, setCheckedItems] = useState({});
  const [overallNotes, setOverallNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get("/housekeeping/inspections");
      setHistory(res.data);
    } catch { setHistory([]); }
    finally { setLoading(false); }
  }, [apiBase]);

  useEffect(() => { if (tab === "history") fetchHistory(); }, [tab, fetchHistory]);

  const allItems = INSPECTION_CHECKLIST.flatMap(c => c.items);
  const checkedCount = Object.values(checkedItems).filter(Boolean).length;
  const totalItems = allItems.length;
  const score = totalItems ? Math.round((checkedCount / totalItems) * 100) : 0;

  const scoreColor = score >= 90 ? "text-emerald-600" : score >= 70 ? "text-amber-600" : "text-rose-600";
  const scoreBg = score >= 90 ? "bg-emerald-500" : score >= 70 ? "bg-amber-500" : "bg-rose-500";

  const handleToggle = (item) => {
    setCheckedItems(prev => ({ ...prev, [item]: !prev[item] }));
  };

  const handleSelectAll = (catItems, val) => {
    const update = {};
    catItems.forEach(i => { update[i] = val; });
    setCheckedItems(prev => ({ ...prev, ...update }));
  };

  const handleSubmit = async () => {
    if (!selectedRoom) return;
    setSaving(true);
    try {
      await API.post("/housekeeping/inspections", {
        roomId: selectedRoom,
        roomNo: rooms.find(r => String(r.id) === selectedRoom)?.roomNo,
        inspectorName,
        priority,
        checklist: checkedItems,
        score,
        notes: overallNotes,
      });
      setSubmitted(true);
      setTimeout(() => { setSubmitted(false); setTab("history"); fetchHistory(); }, 1500);
    } catch { /* ignore */ }
    setSaving(false);
  };

  const exportCSV = () => {
    const rows = [["Room", "Inspector", "Score", "Priority", "Date", "Notes"]];
    history.forEach(h => rows.push([h.room_no, h.inspector_name, h.score + "%", h.priority, h.created_at?.slice(0, 10), h.notes]));
    const csv = rows.map(r => r.join(",")).join("\n");
    const a = document.createElement("a"); a.href = "data:text/csv," + encodeURIComponent(csv); a.download = "inspections.csv"; a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-3xl bg-white px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
              <FaClipboardList className="text-emerald-600" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900">Room Inspection Checklist</h3>
              <p className="text-xl text-slate-500">Quality check before marking room as Inspected</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100"><FaTimes /></button>
        </div>

        <div className="p-6">
          <div className="mb-5 flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 w-fit">
            {[{ key: "new", label: "New Inspection" }, { key: "history", label: "Inspection History" }].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`rounded-lg px-4 py-1.5 text-xl font-semibold transition ${tab === t.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === "new" && (
            <>
              {submitted ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                    <FaCheck className="text-3xl text-emerald-600" />
                  </div>
                  <div className="text-xl font-black text-slate-900">Inspection Submitted!</div>
                  <div className={`text-6xl font-black ${scoreColor}`}>{score}% Pass</div>
                </div>
              ) : (
                <>
                  {/* Form Header */}
                  <div className="mb-5 grid grid-cols-3 gap-4">
                    <div>
                      <label className="mb-1.5 block text-xl font-semibold text-slate-600">Room *</label>
                      <select value={selectedRoom} onChange={e => setSelectedRoom(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none">
                        <option value="">Select Room</option>
                        {rooms.map(r => <option key={r.id} value={r.id}>Room {r.roomNo}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xl font-semibold text-slate-600">Inspector Name</label>
                      <input value={inspectorName} onChange={e => setInspectorName(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xl font-semibold text-slate-600">Priority</label>
                      <select value={priority} onChange={e => setPriority(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none">
                        {Object.keys(PRIORITY_COLORS).map(p => <option key={p}>{p}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Score Bar */}
                  <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xl font-semibold text-slate-700">Inspection Score</span>
                      <span className={`text-4xl font-black ${scoreColor}`}>{score}%</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                      <div className={`h-full rounded-full transition-all duration-500 ${scoreBg}`} style={{ width: `${score}%` }} />
                    </div>
                    <div className="mt-2 text-xl text-slate-500">{checkedCount} / {totalItems} items checked</div>
                  </div>

                  {/* Checklist Categories */}
                  <div className="space-y-4 text-xl">
                    {INSPECTION_CHECKLIST.map(cat => {
                      const catChecked = cat.items.filter(i => checkedItems[i]).length;
                      const allChecked = catChecked === cat.items.length;
                      return (
                        <div key={cat.category} className="rounded-2xl text-xl border border-slate-200 overflow-hidden">
                          <div className="flex items-center text-xl justify-between bg-slate-50 px-4 py-3">
                            <div className="flex items-center gap-3">
                              <span className="font-semibold text-xl text-slate-800">{cat.category}</span>
                              <span className="text-xl text-slate-400">{catChecked}/{cat.items.length}</span>
                            </div>
                            <button
                              onClick={() => handleSelectAll(cat.items, !allChecked)}
                              className="text-xl font-semibold text-slate-500 hover:text-slate-800 transition"
                            >
                              {allChecked ? "Uncheck All" : "Check All"}
                            </button>
                          </div>
                          <div className="divide-y divide-slate-100">
                            {cat.items.map(item => (
                              <label key={item} className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-slate-50 transition">
                                <div className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2 transition ${checkedItems[item] ? "border-emerald-500 bg-emerald-500" : "border-slate-300 bg-white"}`}>
                                  {checkedItems[item] && <FaCheck className="text-[16px] text-white" />}
                                </div>
                                <input type="checkbox" className="sr-only" checked={!!checkedItems[item]} onChange={() => handleToggle(item)} />
                                <span className="text-xl text-slate-700">{item}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-5">
                    <label className="mb-1.5 block text-xl font-semibold text-slate-600">Overall Notes / Issues Found</label>
                    <textarea value={overallNotes} onChange={e => setOverallNotes(e.target.value)} rows={3} placeholder="Describe any issues, damage, or special notes..." className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none" />
                  </div>

                  <div className="mt-5 flex items-center justify-between">
                    {score < 70 && (
                      <div className="flex items-center gap-2 text-xl text-amber-700">
                        <FaExclamationTriangle /> Score below 70% - room may not meet standards
                      </div>
                    )}
                    <div className="ml-auto flex gap-3">
                      <button onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-xl font-semibold text-slate-700">Cancel</button>
                      <button onClick={handleSubmit} disabled={!selectedRoom || saving}
                        className="rounded-xl bg-emerald-600 px-5 py-2 text-xl font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                        {saving ? "Saving..." : "Submit Inspection"}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {tab === "history" && (
            <>
              <div className="mb-4 flex gap-2">
                <button onClick={fetchHistory} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  <FaSyncAlt className="text-xl" /> Refresh
                </button>
                <button onClick={exportCSV} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  <FaDownload className="text-xl" /> Export CSV
                </button>
              </div>
              {loading ? (
                <div className="py-8 text-center text-slate-400"><FaSyncAlt className="animate-spin inline mr-2" />Loading...</div>
              ) : history.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 py-10 text-center text-slate-400 text-xl">No inspection records yet.</div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-xl">
                    <thead className="bg-slate-50">
                      <tr>{["Room", "Inspector", "Score", "Priority", "Date", "Notes"].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {history.map((h, i) => (
                        <tr key={h.id || i} className="border-t border-slate-100 hover:bg-slate-50">
                          <td className="px-4 py-3 font-semibold">{h.room_no}</td>
                          <td className="px-4 py-3">{h.inspector_name}</td>
                          <td className="px-4 py-3">
                            <span className={`font-black ${parseInt(h.score) >= 90 ? "text-emerald-600" : parseInt(h.score) >= 70 ? "text-amber-600" : "text-rose-600"}`}>{h.score}%</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full border px-2 py-0.5 text-xl font-semibold ${PRIORITY_COLORS[h.priority] || ""}`}>{h.priority}</span>
                          </td>
                          <td className="px-4 py-3 text-slate-400">{h.created_at?.slice(0, 10)}</td>
                          <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{h.notes || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
