const STATUS_OPTIONS = [
  "Vacant Dirty",
  "Vacant Clean",
  "Vacant Clean Inspected",
  "Occupied Dirty",
  "Cleaning In Progress",
  "Out of Service",
];

const STATUS_TONE = {
  "Vacant Dirty": "bg-amber-100 text-amber-700 border-amber-200 text-xl",
  "Vacant Clean": "bg-emerald-100 text-emerald-700 border-emerald-200 text-xl",
  "Vacant Clean Inspected": "bg-emerald-200 text-emerald-800 border-emerald-300 text-xl",
  "Occupied Dirty": "bg-rose-100 text-rose-700 border-rose-200 text-xl",
  "Cleaning In Progress": "bg-violet-100 text-violet-700 border-violet-200 text-xl",
  "Out of Service": "bg-slate-200 text-slate-700 border-slate-300 text-xl",
};

const NOOP = () => {};

export default function HousekeepingRow(props) {
  if (props.item) {
    const {
      item,
      visibleColumns = [],
      onStatusChange = NOOP,
      onAssigneeChange = NOOP,
      assigneeOptions = [],
      housekeeperStatuses = {},
    } = props;

    const itemTone = STATUS_TONE[item.status] || "bg-slate-100 text-slate-700 border-slate-200";
    const assigneeValue = item.assignee ?? "No Housekeeper";
    const assigneeState = housekeeperStatuses[assigneeValue] || "";

    return (
      <tr className="border-b border-slate-100 text-sm text-slate-700 transition hover:bg-slate-50">
        {visibleColumns.includes("type") && (
          <td className="px-4 py-4">
            <div className="text-xl font-semibold text-slate-900">{item.type || "Accommodation"}</div>
            <div className="text-xl font-medium text-slate-700">Room {item.roomNo}</div>
          </td>
        )}
        {visibleColumns.includes("roomNo") && <td className="px-4 py-4 text-[14px] font-semibold text-slate-900">{item.roomNo}</td>}
        {visibleColumns.includes("building") && <td className="px-4 py-4 font-medium text-slate-700">{item.building || "-"}</td>}
        {visibleColumns.includes("floor") && <td className="px-4 py-4 font-medium text-slate-700">{item.floor || "-"}</td>}
        {visibleColumns.includes("section") && <td className="px-4 py-4 font-medium text-slate-700">{item.section || "-"}</td>}
        {visibleColumns.includes("guestStatus") && <td className="px-4 py-4 text-[14px] font-medium text-slate-700">{item.guestStatus || item.guest || "-"}</td>}
        {visibleColumns.includes("roomType") && <td className="px-4 py-4 font-medium text-slate-700">{item.roomType || "-"}</td>}
        {visibleColumns.includes("status") && (
          <td className="px-4 py-4">
            <select
              value={item.status || "Vacant Dirty"}
              onChange={(e) => onStatusChange(item.id, e.target.value)}
              className={`w-full rounded-xl border px-3 py-2 text-xl font-semibold outline-none ${itemTone}`}
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </td>
        )}
        {visibleColumns.includes("assignee") && (
          <td className="px-4 py-4">
            <div className="space-y-2">
              <select
                value={assigneeValue}
                onChange={(e) => onAssigneeChange(item.id, e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xl font-semibold text-slate-900 outline-none"
              >
                {assigneeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              {assigneeState ? (
                <span className="inline-flex rounded-full border border-slate-300 px-2 py-0.5 text-[16px] font-bold uppercase tracking-[0.14em] text-slate-600">
                  {assigneeState}
                </span>
              ) : null}
            </div>
          </td>
        )}
        {visibleColumns.includes("layout") && <td className="px-4 py-4 font-medium text-slate-700">{item.layout || "-"}</td>}
        {visibleColumns.includes("articles") && <td className="px-4 py-4 font-medium text-slate-700">{item.articles || "-"}</td>}
        {visibleColumns.includes("services") && <td className="px-4 py-4 font-medium text-slate-700">{item.services || "-"}</td>}
        {visibleColumns.includes("notes") && <td className="px-4 py-4 font-medium text-slate-700">{item.notes || "-"}</td>}
      </tr>
    );
  }

  const {
    room,
    housekeepers = [],
    onStatusChange = NOOP,
    onAssigneeChange = NOOP,
  } = props;

  const tone = STATUS_TONE[room.status] || "bg-slate-100 text-slate-700 border-slate-200";
  const assigneeValue = room.assignee ?? "No Housekeeper";

  return (
    <div className="rounded-[26px] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-5 shadow-[0_12px_35px_rgba(15,23,42,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <p className="text-[15px] font-semibold uppercase tracking-[0.24em] text-slate-500">Room</p>
          <h3 className="mt-2 text-4xl font-black text-slate-900">{room.roomNo}</h3>
          <p className="mt-1 text-xl text-slate-500">Guest: {room.guest || "No active guest"}</p>
        </div>
        <div className={`rounded-full border px-4 py-2 text-xl font-bold uppercase tracking-[0.16em] ${tone}`}>
          {room.status}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.15fr,1.15fr,0.9fr]">
        <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50/80 p-4">
          <p className="text-[15px] font-semibold uppercase tracking-[0.22em] text-slate-500">Status</p>
          <select
            value={room.status}
            onChange={(e) => onStatusChange(room.id, e.target.value)}
            className="mt-3 w-full text-xl rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
          >
            {STATUS_OPTIONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50/80 p-4">
          <p className="text-[15px] font-semibold uppercase tracking-[0.22em] text-slate-500">Assignee</p>
          <select
            value={assigneeValue}
            onChange={(e) => onAssigneeChange(room.id, e.target.value)}
            className="mt-3 w-full text-xl rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
          >
            <option value="No Housekeeper">No Housekeeper</option>
            {housekeepers.map((hk, index) => (
              <option key={index} value={hk.name || hk}>
                {hk.name || hk}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[15px] font-semibold uppercase tracking-[0.22em] text-slate-500">Details</p>
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            <div className="flex items-center text-xl justify-between rounded-xl bg-slate-50 px-3 py-2">
              <span>Priority</span>
              <span className="font-semibold text-slate-900">{room.priority || "Normal"}</span>
            </div>
            <div className="flex items-center text-xl justify-between rounded-xl bg-slate-50 px-3 py-2">
              <span>Hotel Status</span>
              <span className="font-semibold text-slate-900">{room.hotelStatus || "-"}</span>
            </div>
            <div className="flex items-center text-xl justify-between rounded-xl bg-slate-50 px-3 py-2">
              <span>Check In</span>
              <span className="font-semibold text-slate-900">{room.checkIn || "-"}</span>
            </div>
            <div className="flex items-center text-xl justify-between rounded-xl bg-slate-50 px-3 py-2">
              <span>Check Out</span>
              <span className="font-semibold text-slate-900">{room.checkOut || "-"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
