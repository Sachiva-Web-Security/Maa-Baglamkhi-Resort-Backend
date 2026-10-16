import { useState, useEffect, useCallback } from "react";
import {
  FaPlus, FaTimes, FaCheck, FaSyncAlt, FaExclamationTriangle,
  FaChevronDown, FaSearch, FaFilter, FaDownload,
} from "react-icons/fa";
import API from "../../api";

const PRIORITY_CONFIG = {
  Urgent: { badge: "bg-rose-100 text-rose-700 border-rose-300",   dot: "bg-rose-500",    icon: FaExclamationTriangle },
  High:   { badge: "bg-amber-100 text-amber-700 border-amber-300", dot: "bg-amber-500",   icon: FaExclamationTriangle },
  Normal: { badge: "bg-blue-100 text-blue-700 border-blue-300",    dot: "bg-blue-400",    icon: null },
  Low:    { badge: "bg-slate-100 text-slate-500 border-slate-200", dot: "bg-slate-300",   icon: null },
};

const STATUS_CONFIG = {
  Pending:    { badge: "bg-amber-50 text-amber-700 border-amber-200" },
  "In Progress": { badge: "bg-blue-50 text-blue-700 border-blue-200" },
  Completed:  { badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  Cancelled:  { badge: "bg-slate-50 text-slate-500 border-slate-200" },
};

export default function Assignments() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPriority, setFilterPriority] = useState("");

  // New assignment form
  const [form, setForm] = useState({
    staffName: "",
    roomNumber: "",
    task: "",
    priority: "Normal",
    assignedBy: localStorage.getItem("username") || "",
    dueTime: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get("/assignments");
      setAssignments(res.data);
    } catch { setAssignments([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

  const filtered = assignments.filter(a => {
    const matchSearch = !search || a.staff_name?.toLowerCase().includes(search.toLowerCase()) || a.room_number?.includes(search) || a.task?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filterStatus || a.status === filterStatus;
    const matchPriority = !filterPriority || a.priority === filterPriority;
    return matchSearch && matchStatus && matchPriority;
  });

  const handleCreate = async () => {
    if (!form.staffName || !form.task) return;
    setSaving(true);
    try {
      await API.post("/assignments", form);
      setForm({ staffName: "", roomNumber: "", task: "", priority: "Normal", assignedBy: localStorage.getItem("username") || "", dueTime: "", notes: "" });
      setShowForm(false);
      fetchAssignments();
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleStatusChange = async (id, status) => {
    try {
      await API.put(`/assignments/${id}`, { status });
      setAssignments(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    } catch { /* ignore */ }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this assignment?")) return;
    try {
      await API.delete(`/assignments/${id}`);
      fetchAssignments();
    } catch {
      alert("Failed to delete assignment. Please try again.");
    }
  };

  const exportCSV = () => {
    const rows = [["Staff", "Room", "Task", "Priority", "Status", "Assigned By", "Created"]];
    assignments.forEach(a => rows.push([a.staff_name, a.room_number, a.task, a.priority || "Normal", a.status, a.assigned_by, a.created_at?.slice(0, 10)]));
    const csv = rows.map(r => r.join(",")).join("\n");
    const a = document.createElement("a"); a.href = "data:text/csv," + encodeURIComponent(csv); a.download = "assignments.csv"; a.click();
  };

  const stats = {
    total: assignments.length,
    pending: assignments.filter(a => a.status === "Pending").length,
    inProgress: assignments.filter(a => a.status === "In Progress").length,
    urgent: assignments.filter(a => a.priority === "Urgent" && a.status !== "Completed").length,
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Assignments</h1>
          <p className="text-sm text-slate-500">Assign and track housekeeping tasks with priority</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchAssignments} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
            <FaSyncAlt className="text-xs" /> Refresh
          </button>
          <button onClick={exportCSV} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
            <FaDownload className="text-xs" /> Export
          </button>
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800">
            <FaPlus className="text-xs" /> New Assignment
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats.urgent > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
          <FaExclamationTriangle className="text-rose-500" />
          <span className="text-sm font-semibold text-rose-700">{stats.urgent} urgent assignment{stats.urgent > 1 ? "s" : ""} require immediate attention!</span>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total", value: stats.total, color: "text-slate-900" },
          { label: "Pending", value: stats.pending, color: "text-amber-600" },
          { label: "In Progress", value: stats.inProgress, color: "text-blue-600" },
          { label: "Urgent", value: stats.urgent, color: "text-rose-600" },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{s.label}</div>
            <div className={`mt-1 text-3xl font-black ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <label className="flex flex-1 min-w-48 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <FaSearch className="text-slate-400 text-xs" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search staff, room, task..." className="w-full bg-transparent text-sm outline-none" />
        </label>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none">
          <option value="">All Status</option>
          {Object.keys(STATUS_CONFIG).map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none">
          <option value="">All Priorities</option>
          {Object.keys(PRIORITY_CONFIG).map(p => <option key={p}>{p}</option>)}
        </select>
      </div>

      {/* Assignment Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <FaSyncAlt className="animate-spin mr-2" /> Loading assignments...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-center text-slate-400">
          No assignments found. Create a new one to get started.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map(a => {
            const pConfig = PRIORITY_CONFIG[a.priority || "Normal"] || PRIORITY_CONFIG.Normal;
            const sConfig = STATUS_CONFIG[a.status] || STATUS_CONFIG.Pending;
            const PriorityIcon = pConfig.icon;
            return (
              <div key={a.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold ${pConfig.badge}`}>
                        {PriorityIcon && <PriorityIcon className="text-[10px]" />}
                        {a.priority || "Normal"}
                      </span>
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${sConfig.badge}`}>{a.status}</span>
                    </div>
                    <h3 className="font-bold text-slate-900 leading-tight">{a.task}</h3>
                  </div>
                  <button onClick={() => handleDelete(a.id)} className="flex-shrink-0 rounded-full p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition">
                    <FaTimes className="text-xs" />
                  </button>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600">
                  <div><span className="font-semibold text-slate-800">👤 Staff:</span> {a.staff_name}</div>
                  {a.room_number && <div><span className="font-semibold text-slate-800">🛏️ Room:</span> {a.room_number}</div>}
                  {a.assigned_by && <div><span className="font-semibold text-slate-800">📋 By:</span> {a.assigned_by}</div>}
                  {a.due_time && <div><span className="font-semibold text-slate-800">⏰ Due:</span> {a.due_time}</div>}
                  {a.notes && <div className="text-slate-400 italic mt-1">{a.notes}</div>}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {a.status === "Pending" && (
                    <button onClick={() => handleStatusChange(a.id, "In Progress")} className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition">
                      Start
                    </button>
                  )}
                  {a.status === "In Progress" && (
                    <button onClick={() => handleStatusChange(a.id, "Completed")} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition">
                      <FaCheck className="text-[10px]" /> Mark Done
                    </button>
                  )}
                  {a.status !== "Completed" && a.status !== "Cancelled" && (
                    <button onClick={() => handleStatusChange(a.id, "Cancelled")} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 transition">
                      Cancel
                    </button>
                  )}
                </div>

                <div className="mt-3 text-[10px] text-slate-400">
                  {new Date(a.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Assignment Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">New Assignment</h3>
              <button onClick={() => setShowForm(false)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100"><FaTimes /></button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">Staff Name *</label>
                  <input value={form.staffName} onChange={e => setForm(p => ({ ...p, staffName: e.target.value }))} placeholder="Housekeeper name" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">Room Number</label>
                  <input value={form.roomNumber} onChange={e => setForm(p => ({ ...p, roomNumber: e.target.value }))} placeholder="e.g. 101" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none" />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Task Description *</label>
                <textarea value={form.task} onChange={e => setForm(p => ({ ...p, task: e.target.value }))} rows={2} placeholder="Describe the task..." className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">Priority</label>
                  <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none">
                    {Object.keys(PRIORITY_CONFIG).map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">Due Time (optional)</label>
                  <input type="time" value={form.dueTime} onChange={e => setForm(p => ({ ...p, dueTime: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none" />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Assigned By</label>
                <input value={form.assignedBy} onChange={e => setForm(p => ({ ...p, assignedBy: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none" />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Additional instructions..." className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none" />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>
              <button onClick={handleCreate} disabled={!form.staffName || !form.task || saving} className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
                {saving ? "Creating..." : "Create Assignment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
