const AttendanceRow = ({ employee }) => {
  const statusColors = {
    Present: "bg-green-500/20 text-green-400",
    Absent: "bg-red-500/20 text-red-400",
    Late: "bg-yellow-500/20 text-yellow-400",
    "On Leave": "bg-blue-500/20 text-blue-400",
  };

  const methodColors = {
    Biometric: "bg-purple-500/20 text-purple-300",
    Manual: "bg-blue-500/20 text-blue-300",
  };

  return (
    <tr className="border-b border-white/10 hover:bg-white/5 transition">
      <td className="p-3">{employee.name}</td>
      <td className="p-3">{employee.role}</td>
      <td className="p-3">{employee.checkIn || "—"}</td>
      <td className="p-3">{employee.checkOut || "—"}</td>

      <td className="p-3">
        <span
          className={`px-2 py-1 rounded-md text-xs ${
            statusColors[employee.status]
          }`}
        >
          {employee.status}
        </span>
      </td>

      <td className="p-3">
        <span
          className={`px-2 py-1 rounded-md text-xs ${
            methodColors[employee.method]
          }`}
        >
          {employee.method}
        </span>
      </td>

      <td className="p-3 flex gap-2">
        <button className="bg-green-600 px-3 py-1 rounded-md text-xs">
          Check In
        </button>
        <button className="bg-red-600 px-3 py-1 rounded-md text-xs">
          Check Out
        </button>
      </td>
    </tr>
  );
};

export default AttendanceRow;