import { FaSearch } from "react-icons/fa";

export default function FiltersSection(props) {
  if (props.filters && props.onFilterChange) {
    const { filters, onFilterChange } = props;

    return (
      <div className="rounded-[28px] border border-white/70 bg-white/85 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-700">Filters</p>
            <h3 className="mt-2 text-xl font-black text-slate-900">Refine housekeeping board</h3>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition focus-within:border-sky-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-sky-100">
            <FaSearch className="text-slate-400" />
            <input
              type="text"
              placeholder="Room no"
              value={filters.room || ""}
              onChange={(e) => onFilterChange("room", e.target.value)}
              className="w-full bg-transparent text-slate-900 outline-none placeholder:text-slate-400"
            />
          </div>

          <input
            type="text"
            placeholder="Room type"
            value={filters.type || ""}
            onChange={(e) => onFilterChange("type", e.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
          />

          <select
             value={filters.status || "All Status"}
            onChange={(e) => onFilterChange("status", e.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"

          >
            <option value="All Status">All Status</option>
            <option value="Vacant Dirty">Vacant Dirty</option>
            <option value="Vacant Clean">Vacant Clean</option>
            <option value="Vacant Clean Inspected">Vacant Clean Inspected</option>
            <option value="Occupied Dirty">Occupied Dirty</option>
            <option value="Cleaning In Progress">Cleaning In Progress</option>
            <option value="Out of Service">Out of Service</option>
          </select>

          <input
            type="text"
            placeholder="Floor"
            value={filters.floor || ""}
            onChange={(e) => onFilterChange("floor", e.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
          />
        </div>
      </div>
    );
  }

  const {
    search,
    setSearch,
    status,
    setStatus,
    assignee,
    setAssignee,
    housekeepers = [],
  } = props;

  return (
    <div className="rounded-[28px] border border-white/70 bg-white/85 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-700">Filters</p>
          <h3 className="mt-2 text-xl font-black text-slate-900">Search and narrow the queue</h3>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition focus-within:border-sky-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-sky-100">
          <FaSearch className="text-slate-400" />
          <input
            type="text"
            placeholder="Search room or guest"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-slate-900 outline-none placeholder:text-slate-400"
          />
        </div>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
        >
          <option value="All">All Status</option>
          <option value="Vacant Dirty">Vacant Dirty</option>
          <option value="Vacant Clean">Vacant Clean</option>
          <option value="Occupied Dirty">Occupied Dirty</option>
          <option value="Cleaning In Progress">Cleaning In Progress</option>
          <option value="Out of Service">Out of Service</option>
        </select>

        <select
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
        >
          <option value="All">All Assignees</option>
          <option value="No Housekeeper">No Housekeeper</option>
          {housekeepers.map((hk, index) => (
            <option key={index} value={hk.name || hk}>
              {hk.name || hk}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
