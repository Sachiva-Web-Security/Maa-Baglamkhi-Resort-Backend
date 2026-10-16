import { useState, useEffect, useCallback } from "react";
import { FaTimes, FaPlus, FaBoxOpen, FaSyncAlt, FaDownload, FaTrash } from "react-icons/fa";
import API from "../../api";

const AMENITY_CATEGORIES = [
  { label: "Linen & Towels",   items: ["Bath Towel", "Hand Towel", "Face Towel", "Bed Sheet", "Pillow Cover", "Blanket", "Bath Mat"] },
  { label: "Toiletries",       items: ["Shampoo", "Conditioner", "Body Wash", "Soap Bar", "Toothbrush", "Toothpaste", "Shaving Kit", "Cotton Buds"] },
  { label: "Minibar",          items: ["Water Bottle (500ml)", "Water Bottle (1L)", "Soft Drink", "Juice", "Chips", "Biscuits", "Chocolate"] },
  { label: "Stationery",       items: ["Notepad", "Pen", "Envelope", "Welcome Letter"] },
  { label: "Misc Supplies",    items: ["Slippers", "Bathrobe", "Laundry Bag", "Iron Board Cover", "Plastic Bag"] },
];

export default function AmenitiesConsumptionModal({ rooms, onClose, apiBase }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form state
  const [selectedRoom, setSelectedRoom] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(AMENITY_CATEGORIES[0].label);
  const [selectedItem, setSelectedItem] = useState(AMENITY_CATEGORIES[0].items[0]);
  const [qty, setQty] = useState(1);
  const [unitCost, setUnitCost] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Tab
  const [tab, setTab] = useState("log"); // "log" | "entry"

  // Filter
  const [filterRoom, setFilterRoom] = useState("");
  const [filterDate, setFilterDate] = useState("");

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterRoom) params.roomId = filterRoom;
      if (filterDate) params.date = filterDate;
      const res = await API.get("/housekeeping/amenities", { params });
      setRecords(res.data);
    } catch {
      // Fallback mock data for development
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [apiBase, filterRoom, filterDate]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const handleCategoryChange = (cat) => {
    setSelectedCategory(cat);
    const catObj = AMENITY_CATEGORIES.find(c => c.label === cat);
    setSelectedItem(catObj?.items[0] || "");
  };

  const handleSubmit = async () => {
    if (!selectedRoom || !selectedItem || qty < 1) return;
    setSaving(true);
    try {
      await API.post("/housekeeping/amenities", {
        roomId: selectedRoom,
        roomNo: rooms.find(r => String(r.id) === selectedRoom)?.roomNo,
        category: selectedCategory,
        itemName: selectedItem,
        quantity: qty,
        unitCost: unitCost ? parseFloat(unitCost) : 0,
        notes,
        loggedBy: localStorage.getItem("username") || "Staff",
      });
      setQty(1);
      setUnitCost("");
      setNotes("");
      fetchRecords();
      setTab("log");
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this record?")) return;
    try {
      await API.delete(`/housekeeping/amenities/${id}`);
      fetchRecords();
    } catch { /* ignore */ }
  };

  const totalCost = records.reduce((sum, r) => sum + (parseFloat(r.total_cost) || 0), 0);

  const exportCSV = () => {
    const rows = [["Room", "Category", "Item", "Qty", "Unit Cost", "Total", "Date", "By"]];
    records.forEach(r => rows.push([r.room_no, r.category, r.item_name, r.quantity, r.unit_cost, r.total_cost, r.created_at?.slice(0, 10), r.logged_by]));
    const csv = rows.map(r => r.join(",")).join("\n");
    const a = document.createElement("a"); a.href = "data:text/csv," + encodeURIComponent(csv); a.download = "amenities.csv"; a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-[940px] max-h-[92vh] overflow-y-auto rounded-[34px] bg-white shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-[34px] border-b border-slate-100 bg-white px-7 py-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100">
              <FaBoxOpen className="text-xl text-amber-600" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900">Amenities Consumption</h3>
              <p className="text-base text-slate-500">Track linen, toiletries, minibar usage per room</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-3 text-slate-400 hover:bg-slate-100"><FaTimes size={20} /></button>
        </div>

        <div className="p-7">
          {/* Tabs */}
          <div className="mb-6 flex w-fit gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1.5">
            {[{ key: "log", label: "Consumption Log" }, { key: "entry", label: "New Entry" }].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`rounded-xl px-5 py-2.5 text-xl font-semibold transition ${tab === t.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === "log" && (
            <>
              {/* Filters */}
              <div className="mb-5 flex flex-wrap gap-3">
                <select value={filterRoom} onChange={e => setFilterRoom(e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-xl text-slate-700 outline-none">
                  <option value="">All Rooms</option>
                  {rooms.map(r => <option key={r.id} value={r.id}>Room {r.roomNo}</option>)}
                </select>
                <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-xl text-slate-700 outline-none" />
                <button onClick={fetchRecords} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-xl font-semibold text-slate-700 hover:bg-slate-50">
                  <FaSyncAlt className="text-sm" /> Refresh
                </button>
                <button onClick={exportCSV} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-xl font-semibold text-slate-700 hover:bg-slate-50">
                  <FaDownload className="text-sm" /> Export
                </button>
              </div>

              {/* Summary */}
              <div className="mb-5 flex gap-4">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
                  <div className="text-sm font-semibold text-amber-700">Total Records</div>
                  <div className="text-3xl font-black text-amber-900">{records.length}</div>
                </div>
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4">
                  <div className="text-sm font-semibold text-rose-700">Total Cost</div>
                  <div className="text-2xl font-black text-rose-900">₹{totalCost.toFixed(0)}</div>
                </div>
              </div>

              {loading ? (
                <div className="py-10 text-center text-xl text-slate-400"><FaSyncAlt className="animate-spin inline mr-2" />Loading...</div>
              ) : records.length === 0 ? (
                <div className="rounded-[26px] border border-dashed border-slate-300 py-14 text-center text-xl text-slate-400">
                  No amenities records found. Add a new entry to get started.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-xl">
                    <thead className="bg-slate-50">
                      <tr>
                        {["Room", "Category", "Item", "Qty", "Unit Cost", "Total", "Date", "By", ""].map(h => (
                          <th key={h} className="px-4 py-4 text-left text-sm font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((r, i) => (
                        <tr key={r.id || i} className="border-t border-slate-100 hover:bg-slate-50">
                          <td className="px-4 py-3 font-semibold">{r.room_no || r.roomNo}</td>
                          <td className="px-4 py-3 text-slate-500">{r.category}</td>
                          <td className="px-4 py-3 font-medium">{r.item_name}</td>
                          <td className="px-4 py-3">{r.quantity}</td>
                          <td className="px-4 py-3">₹{parseFloat(r.unit_cost || 0).toFixed(2)}</td>
                          <td className="px-4 py-3 font-semibold text-rose-600">₹{parseFloat(r.total_cost || 0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-slate-400">{r.created_at?.slice(0, 10)}</td>
                          <td className="px-4 py-3 text-slate-400">{r.logged_by}</td>
                          <td className="px-4 py-3">
                            <button onClick={() => handleDelete(r.id)} className="text-rose-400 hover:text-rose-600 transition"><FaTrash className="text-xs" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {tab === "entry" && (
            <div className="max-w-2xl space-y-6">
              <div>
                <label className="mb-2 block text-xl font-semibold text-slate-600">Room *</label>
                <select value={selectedRoom} onChange={e => setSelectedRoom(e.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-xl outline-none">
                  <option value="">Select Room</option>
                  {rooms.map(r => <option key={r.id} value={r.id}>Room {r.roomNo} - {r.roomType || "N/A"}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-xl font-semibold text-slate-600">Category *</label>
                  <select value={selectedCategory} onChange={e => handleCategoryChange(e.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-xl outline-none">
                    {AMENITY_CATEGORIES.map(c => <option key={c.label}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-xl font-semibold text-slate-600">Item *</label>
                  <select value={selectedItem} onChange={e => setSelectedItem(e.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-xl outline-none">
                    {(AMENITY_CATEGORIES.find(c => c.label === selectedCategory)?.items || []).map(i => <option key={i}>{i}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-xl font-semibold text-slate-600">Quantity *</label>
                  <input type="number" min="1" value={qty} onChange={e => setQty(+e.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-xl outline-none" />
                </div>
                <div>
                  <label className="mb-2 block text-xl font-semibold text-slate-600">Unit Cost (₹)</label>
                  <input type="number" min="0" step="0.01" value={unitCost} onChange={e => setUnitCost(e.target.value)} placeholder="0.00" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-xl outline-none" />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xl font-semibold text-slate-600">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Additional notes..." className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-xl outline-none" />
              </div>

              {unitCost && qty && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
                  <span className="text-xl font-semibold text-amber-800">Estimated Cost: ₹{(parseFloat(unitCost) * qty).toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button onClick={() => setTab("log")} className="rounded-2xl border border-slate-200 px-5 py-3 text-xl font-semibold text-slate-700">Cancel</button>
                <button onClick={handleSubmit} disabled={!selectedRoom || !selectedItem || saving} className="inline-flex items-center gap-2 rounded-2xl bg-amber-600 px-6 py-3 text-xl font-semibold text-white hover:bg-amber-700 disabled:opacity-50">
                  <FaPlus className="text-sm" /> {saving ? "Saving..." : "Log Consumption"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

