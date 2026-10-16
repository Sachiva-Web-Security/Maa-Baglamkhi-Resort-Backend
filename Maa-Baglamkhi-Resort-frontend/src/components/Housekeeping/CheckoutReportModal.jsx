import { useState, useEffect, useCallback } from "react";
import { FaTimes, FaSignOutAlt, FaSyncAlt, FaDownload, FaCheck, FaExclamationTriangle } from "react-icons/fa";
import API from "../../api";

export default function CheckoutReportModal({ onClose, apiBase }) {
  const [checkouts, setCheckouts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().slice(0, 10));

  const fetchCheckouts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get("/housekeeping/checkout-report", { params: { date: dateFilter } });
      setCheckouts(res.data);
    } catch { setCheckouts([]); }
    finally { setLoading(false); }
  }, [apiBase, dateFilter]);

  useEffect(() => { fetchCheckouts(); }, [fetchCheckouts]);

  const handleMarkDirty = async (roomId) => {
    try {
      await API.put(`/housekeeping/status/${roomId}`, { status: "Vacant Dirty" });
      fetchCheckouts();
    } catch (err) {
     console.error("Failed to mark room dirty:", err);
     // Consider: toast.error("Failed to update room status");
   }
  };

  const exportCSV = () => {
    const rows = [["Room", "Guest", "Check-Out", "HK Status", "Assignee"]];
    checkouts.forEach(r => rows.push([r.room_no || r.roomNo, r.guest_name, r.checkout_date?.slice(0, 10), r.hk_status, r.assignee]));
    const csv = rows.map(r => r.join(",")).join("\n");
    const a = document.createElement("a"); a.href = "data:text/csv," + encodeURIComponent(csv); a.download = `checkout_report_${dateFilter}.csv`; a.click();
  };

  const pendingClean = checkouts.filter(c => c.hk_status === "Vacant Dirty" || !c.hk_status);
  const cleaned = checkouts.filter(c => c.hk_status === "Vacant Clean" || c.hk_status === "Vacant Clean Inspected");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-[980px] max-h-[92vh] overflow-y-auto rounded-[34px] bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-[34px] border-b border-slate-100 bg-white px-7 py-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100">
              <FaSignOutAlt className="text-xl text-rose-600" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900">Checkout Report</h3>
              <p className="text-base text-slate-500">Rooms with checkouts — track cleaning status</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-3 text-slate-400 hover:bg-slate-100"><FaTimes size={20} /></button>
        </div>

        <div className="p-7">
          {/* Date filter */}
          <div className="mb-6 flex flex-wrap gap-3 items-center">
            <input
              type="date" value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-xl text-slate-700 outline-none"
            />
            <button onClick={fetchCheckouts} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-xl font-semibold text-slate-700 hover:bg-slate-50">
              <FaSyncAlt className="text-sm" /> Refresh
            </button>
            <button onClick={exportCSV} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-xl font-semibold text-slate-700 hover:bg-slate-50">
              <FaDownload className="text-sm" /> Export
            </button>
          </div>

          {/* Summary */}
          <div className="mb-6 grid grid-cols-3 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
              <div className="text-sm font-semibold text-slate-500">Total Checkouts</div>
              <div className="text-3xl font-black text-slate-900">{checkouts.length}</div>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-600"><FaExclamationTriangle />Pending Clean</div>
              <div className="text-3xl font-black text-amber-700">{pendingClean.length}</div>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600"><FaCheck />Cleaned</div>
              <div className="text-3xl font-black text-emerald-700">{cleaned.length}</div>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xl text-slate-400"><FaSyncAlt className="animate-spin inline mr-2" />Loading...</div>
          ) : checkouts.length === 0 ? (
            <div className="rounded-[26px] border border-dashed border-slate-300 py-14 text-center text-xl text-slate-400">
              No checkouts found for {dateFilter}.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-xl">
                <thead className="bg-slate-50">
                  <tr>{["Room", "Guest", "Check-Out Time", "HK Status", "Assignee", "Action"].map(h => <th key={h} className="px-4 py-4 text-left text-sm font-semibold text-slate-500 uppercase">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {checkouts.map((row, i) => {
                    const isClean = row.hk_status === "Vacant Clean" || row.hk_status === "Vacant Clean Inspected";
                    return (
                      <tr key={row.booking_id || i} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3 font-semibold">{row.room_no || row.roomNo}</td>
                        <td className="px-4 py-3">{row.guest_name || "-"}</td>
                        <td className="px-4 py-3 text-slate-400">{row.checkout_time ? new Date(row.checkout_time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "-"}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${isClean ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                            {row.hk_status || "Vacant Dirty"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500">{row.assignee || "No Housekeeper"}</td>
                        <td className="px-4 py-3">
                          {!isClean && (
                            <button
                              onClick={() => handleMarkDirty(row.hk_room_id)}
                              className="rounded-2xl bg-amber-600 px-4 py-2 text-base font-semibold text-white hover:bg-amber-700 transition"
                            >
                              Mark Dirty → Assign
                            </button>
                          )}
                          {isClean && <span className="text-base font-semibold text-emerald-600">✓ Ready</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

