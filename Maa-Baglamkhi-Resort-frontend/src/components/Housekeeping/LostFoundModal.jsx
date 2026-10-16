import { useState, useEffect, useCallback } from "react";
import { FaTimes, FaSearch, FaPlus, FaSyncAlt, FaDownload, FaCheckCircle, FaBoxOpen } from "react-icons/fa";
import API from "../../api";

const CATEGORIES = ["Electronics", "Clothing", "Jewellery", "Documents", "Accessories", "Keys", "Cash / Wallet", "Books / Stationery", "Other"];
const STATUSES = ["Found", "Stored", "Claimed", "Disposed"];

const STATUS_COLORS = {
  Found:    "bg-blue-50 text-blue-700 border-blue-200",
  Stored:   "bg-amber-50 text-amber-700 border-amber-200",
  Claimed:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  Disposed: "bg-slate-50 text-slate-500 border-slate-200",
};

export default function LostFoundModal({ rooms, onClose, apiBase }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("list");
  const [error, setError] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  // New item form
  const [form, setForm] = useState({
    foundDate: new Date().toISOString().slice(0, 10),
    foundRoom: "",
    foundBy: localStorage.getItem("username") || "",
    category: "Electronics",
    description: "",
    guestName: "",
    storageLocation: "",
    status: "Found",
    claimedBy: "",
    claimedDate: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      setError("");
      const res = await API.get("/housekeeping/lost-found");
      setItems(res.data);
    } catch (err) {
      setItems([]);
      setError("Failed to load lost and found items. Please try again.");
    }
    finally { setLoading(false); }
  }, [apiBase]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const filtered = items.filter(i => {
    const matchSearch = !search || i.description?.toLowerCase().includes(search.toLowerCase()) || i.guest_name?.toLowerCase().includes(search.toLowerCase()) || i.found_room?.includes(search);
    const matchStatus = !filterStatus || i.status === filterStatus;
    const matchCat = !filterCategory || i.category === filterCategory;
    return matchSearch && matchStatus && matchCat;
  });

  const handleStatusUpdate = async (id, status, extra = {}) => {
    try {
      setError("");
      await API.put(`/housekeeping/lost-found/${id}`, { status, ...extra });
      await fetchItems();
    } catch (err) {
      setError("Failed to update status. Please try again.");
    }
  };

  const handleSubmit = async () => {
    if (!form.description) {
      setError("Please enter an item description before submitting.");
      return;
    }
    setSaving(true);
    try {
      setError("");
      await API.post("/housekeeping/lost-found", {
        foundDate: form.foundDate,
        roomNo: form.foundRoom,
        roomId: rooms.find(r => r.roomNo === form.foundRoom)?.id,
        foundBy: form.foundBy,
        category: form.category,
        description: form.description,
        guestName: form.guestName,
        storageLocation: form.storageLocation,
        status: form.status,
        notes: form.notes,
      });
      setForm(prev => ({ ...prev, description: "", guestName: "", storageLocation: "", notes: "" }));
      await fetchItems();
      setTab("list");
    } catch (err) {
      setError("Failed to report item. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const exportCSV = () => {
    const rows = [["#", "Date", "Room", "Category", "Description", "Found By", "Guest", "Status", "Storage", "Notes"]];
    items.forEach((it, i) => rows.push([i + 1, it.found_date?.slice(0, 10), it.found_room, it.category, it.description, it.found_by, it.guest_name, it.status, it.storage_location, it.notes]));
    const csv = rows.map(r => r.join(",")).join("\n");
    const a = document.createElement("a"); a.href = "data:text/csv," + encodeURIComponent(csv); a.download = "lost_found.csv"; a.click();
  };

  const stats = {
    total: items.length,
    stored: items.filter(i => i.status === "Stored" || i.status === "Found").length,
    claimed: items.filter(i => i.status === "Claimed").length,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-3xl bg-white px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100">
              <FaSearch className="text-violet-600" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900">Lost & Found</h3>
              <p className="text-xl text-slate-500">Track items found in rooms, manage storage & claims</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100"><FaTimes /></button>
        </div>

        <div className="p-6">
          {error ? (
            <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {error}
            </div>
          ) : null}

          {/* Stats */}
          <div className="mb-5 grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xl font-semibold text-slate-500">Total Items</div>
              <div className="text-2xl font-black text-slate-900">{stats.total}</div>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="text-xl font-semibold text-amber-600">Awaiting Claim</div>
              <div className="text-2xl font-black text-amber-700">{stats.stored}</div>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <div className="text-xl font-semibold text-emerald-600">Claimed</div>
              <div className="text-2xl font-black text-emerald-700">{stats.claimed}</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mb-5 flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 w-fit">
            {[{ key: "list", label: "All Items" }, { key: "new", label: "Report Found Item" }].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`rounded-lg px-4 py-1.5 text-xl font-semibold transition ${tab === t.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === "list" && (
            <>
              {/* Filters */}
              <div className="mb-4 flex flex-wrap gap-3">
                <label className="flex flex-1 min-w-48 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <FaSearch className="text-slate-400 text-xl" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search description, room, guest..." className="w-full bg-transparent text-xl outline-none" />
                </label>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-xl text-slate-700 outline-none">
                  <option value="">All Status</option>
                  {STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
                <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-xl text-slate-700 outline-none">
                  <option value="">All Categories</option>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
                <button onClick={fetchItems} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xl font-semibold text-slate-700 hover:bg-slate-50">
                  <FaSyncAlt className="text-xl" />
                </button>
                <button onClick={exportCSV} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xl font-semibold text-slate-700 hover:bg-slate-50">
                  <FaDownload className="text-xl" />
                </button>
              </div>

              {loading ? (
                <div className="py-10 text-center text-slate-400"><FaSyncAlt className="animate-spin inline mr-2" />Loading...</div>
              ) : filtered.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 py-10 text-center">
                  <FaBoxOpen className="mx-auto text-4xl text-slate-300 mb-3" />
                  <div className="text-slate-400">No items found. Report a found item to get started.</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {filtered.map((item, i) => (
                    <div key={item.id || i} className="rounded-2xl border border-slate-200 bg-white p-4 hover:shadow-md transition">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-bold text-slate-900">{item.description}</span>
                            <span className="rounded-full border bg-slate-100 text-slate-600 px-2 py-0.5 text-xs">{item.category}</span>
                          </div>
                          <div className="text-xs text-slate-500 space-y-0.5">
                            <div>Room: <span className="font-semibold text-slate-700">{item.found_room || "-"}</span> · Found by: <span className="font-semibold">{item.found_by}</span> · Date: {item.found_date?.slice(0, 10)}</div>
                            {item.guest_name && <div>Guest: <span className="font-semibold">{item.guest_name}</span></div>}
                            {item.storage_location && <div>Storage: {item.storage_location}</div>}
                            {item.notes && <div className="text-slate-400 italic">{item.notes}</div>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_COLORS[item.status] || ""}`}>{item.status}</span>
                          {item.status !== "Claimed" && item.status !== "Disposed" && (
                            <button onClick={() => {
                              const claimedBy = window.prompt("Claimed by (name / contact):");
                              if (claimedBy) handleStatusUpdate(item.id, "Claimed", { claimedBy, claimedDate: new Date().toISOString().slice(0, 10) });
                            }} className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition">
                              Mark Claimed
                            </button>
                          )}
                          {item.status === "Found" && (
                            <button onClick={() => handleStatusUpdate(item.id, "Stored")} className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition">
                              Move to Storage
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === "new" && (
            <div className="max-w-lg space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">Date Found *</label>
                  <input type="date" value={form.foundDate} onChange={e => setForm(p => ({ ...p, foundDate: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">Room Number</label>
                  <select value={form.foundRoom} onChange={e => setForm(p => ({ ...p, foundRoom: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none">
                    <option value="">Select Room</option>
                    {rooms.map(r => <option key={r.id} value={r.roomNo}>Room {r.roomNo}</option>)}
                    <option value="Lobby">Lobby</option>
                    <option value="Restaurant">Restaurant</option>
                    <option value="Pool Area">Pool Area</option>
                    <option value="Corridor">Corridor</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">Category *</label>
                  <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none">
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">Found By</label>
                  <input value={form.foundBy} onChange={e => setForm(p => ({ ...p, foundBy: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none" />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Item Description *</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} placeholder="Describe the item in detail..." className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">Guest Name (if known)</label>
                  <input value={form.guestName} onChange={e => setForm(p => ({ ...p, guestName: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">Storage Location</label>
                  <input value={form.storageLocation} onChange={e => setForm(p => ({ ...p, storageLocation: e.target.value }))} placeholder="e.g. Front Desk Locker 3" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none" />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Additional remarks..." className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none" />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setTab("list")} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>
                <button onClick={handleSubmit} disabled={!form.description || saving} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50">
                  <FaPlus className="text-xs" /> {saving ? "Saving..." : "Report Item"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
