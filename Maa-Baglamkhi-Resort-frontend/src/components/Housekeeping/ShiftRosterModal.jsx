import { useState, useEffect, useCallback } from "react";
import { FaTimes, FaBroom, FaPlus, FaSyncAlt, FaDownload, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import API from "../../api";

const SHIFTS = ["Morning (6am-2pm)", "Afternoon (2pm-10pm)", "Night (10pm-6am)", "Day (8am-8pm)", "Off"];
const SHIFT_COLORS = {
  "Morning (6am-2pm)":   "bg-amber-100 text-amber-800 border-amber-300",
 "Afternoon (2pm-10pm)":"bg-blue-100 text-blue-800 border-blue-300",
 "Night (10pm-6am)":    "bg-indigo-100 text-indigo-800 border-indigo-300",
 "Day (8am-8pm)":       "bg-emerald-100 text-emerald-800 border-emerald-300",
 "Off":                 "bg-slate-100 text-slate-400 border-slate-200",
 };

function getWeekDates(weekOffset = 0) {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7) + weekOffset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function ShiftRosterModal({ housekeepers, onClose, apiBase }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [roster, setRoster] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const weekDates = getWeekDates(weekOffset);
  const weekStart = weekDates[0].toISOString().slice(0, 10);

  const fetchRoster = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get("/housekeeping/roster", { params: { weekStart } });
      // Build map: { staffName: { "YYYY-MM-DD": shift } }
      const map = {};
      (res.data || []).forEach(row => {
        if (!map[row.staff_name]) map[row.staff_name] = {};
        map[row.staff_name][row.shift_date?.slice(0, 10)] = row.shift;
      });
      setRoster(map);
    } catch {
      // Init empty roster
      const map = {};
      housekeepers.forEach(h => { map[h] = {}; });
      setRoster(map);
    } finally { setLoading(false); }
  }, [apiBase, weekStart, housekeepers]);

  useEffect(() => { fetchRoster(); }, [fetchRoster]);

  const handleShiftChange = (staff, dateStr, shift) => {
    setRoster(prev => ({
      ...prev,
      [staff]: { ...(prev[staff] || {}), [dateStr]: shift },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const entries = [];
      Object.entries(roster).forEach(([staff, days]) => {
        Object.entries(days).forEach(([date, shift]) => {
          entries.push({ staffName: staff, shiftDate: date, shift });
        });
      });
      await API.post("/housekeeping/roster", { entries });
      alert("Roster saved successfully!");
    } catch { alert("Failed to save roster."); }
    setSaving(false);
  };

  const exportCSV = () => {
    const rows = [["Staff", ...weekDates.map(d => d.toISOString().slice(0, 10))]];
    housekeepers.forEach(h => {
      rows.push([h, ...weekDates.map(d => roster[h]?.[d.toISOString().slice(0, 10)] || "Off")]);
    });
    const csv = rows.map(r => r.join(",")).join("\n");
    const a = document.createElement("a"); a.href = "data:text/csv," + encodeURIComponent(csv); a.download = `roster_${weekStart}.csv`; a.click();
  };

  // Stats
  const workingToday = weekDates[0] ? housekeepers.filter(h => roster[h]?.[new Date().toISOString().slice(0, 10)] && roster[h][new Date().toISOString().slice(0, 10)] !== "Off").length : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-3xl bg-white px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100">
              <FaBroom className="text-orange-600" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900">Shift / Duty Roster</h3>
              <p className="text-xl text-slate-500">Weekly schedule for housekeeping staff</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100"><FaTimes /></button>
        </div>

        <div className="p-6">
          {/* Week Navigation */}
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setWeekOffset(w => w - 1)} className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50">
                <FaChevronLeft />
              </button>
              <div className="text-xl font-semibold text-slate-800">
                {weekDates[0]?.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} – {weekDates[6]?.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
              </div>
              <button onClick={() => setWeekOffset(w => w + 1)} className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50">
                <FaChevronRight />
              </button>
              {weekOffset !== 0 && (
                <button onClick={() => setWeekOffset(0)} className="text-xl text-slate-400 hover:text-slate-700 underline">Today's Week</button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xl font-semibold text-emerald-700">
                {workingToday} working today
              </div>
              <button onClick={fetchRoster} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xl font-semibold text-slate-700 hover:bg-slate-50">
                <FaSyncAlt className="text-xl" />
              </button>
              <button onClick={exportCSV} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xl font-semibold text-slate-700 hover:bg-slate-50">
                <FaDownload className="text-xl" /> CSV
              </button>
            </div>
          </div>

          {/* Shift Legend */}
          <div className="mb-4 flex flex-wrap gap-2">
            {Object.entries(SHIFT_COLORS).map(([shift, color]) => (
              <span key={shift} className={`rounded-full border px-2 py-0.5 text-sm font-semibold ${color}`}>{shift}</span>
            ))}
          </div>

          {loading ? (
            <div className="py-10 text-center text-slate-400"><FaSyncAlt className="animate-spin inline mr-2" />Loading roster...</div>
          ) : housekeepers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 py-10 text-center text-slate-400">
              No housekeeping staff found. Add staff with the "housekeeping" role to manage the roster.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xl font-semibold text-slate-500 uppercase sticky left-0 bg-slate-50 min-w-36">Staff</th>
                    {weekDates.map((d, i) => {
                      const isToday = d.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);
                      return (
                        <th key={i} className={`px-2 py-3 text-center text-xl font-semibold uppercase min-w-36 ${isToday ? "text-indigo-600 bg-indigo-50" : "text-slate-500"}`}>
                          <div>{DAY_NAMES[i]}</div>
                          <div className="font-normal text-[10px] text-slate-400">{d.getDate()}/{d.getMonth() + 1}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {housekeepers.map((staff, staffIndex) => (
                    <tr key={`${staff}-${staffIndex}`} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-800 sticky left-0 bg-white">{staff}</td>
                      {weekDates.map((d, i) => {
                        const dateStr = d.toISOString().slice(0, 10);
                        const shift = roster[staff]?.[dateStr] || "Off";
                        return (
                          <td key={i} className="px-2 py-2 text-center">
                            <select
                              value={shift}
                              onChange={e => handleShiftChange(staff, dateStr, e.target.value)}
                              className={`w-full rounded-xl border px-2 py-1.5 text-xs font-semibold outline-none cursor-pointer ${SHIFT_COLORS[shift] || "bg-slate-50 text-slate-500 border-slate-200"}`}
                            >
                              {SHIFTS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-5 flex justify-end gap-3">
            <button onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-xl font-semibold text-slate-700">Close</button>
            <button onClick={handleSave} disabled={saving || housekeepers.length === 0} className="rounded-xl bg-orange-600 px-5 py-2 text-xl font-semibold text-white hover:bg-orange-700 disabled:opacity-50">
              {saving ? "Saving..." : "Save Roster"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
