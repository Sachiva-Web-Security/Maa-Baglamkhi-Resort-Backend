import React, { useEffect, useState } from "react";
import {
  FaCalendarAlt,
  FaClipboardCheck,
  FaClock,
  FaMoneyBillWave,
  FaUserCheck,
  FaUserPlus,
  FaUsers,
} from "react-icons/fa";
import API from "../api";

const MyAttendance = () => {
  const [date, setDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [month, setMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );
  const [loading, setLoading] = useState(false);

  /* ================= FETCH TODAY'S ATTENDANCE ================= */

  const fetchToday = async () => {
    setLoading(true);
    try {
      const res = await API.get("/attendance", { params: { date } });
      setRecords(res.data || []);
    } catch (err) {
      console.error("Error loading attendance:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchToday();
  }, [date]);

  /* ================= FETCH MONTHLY SUMMARY ================= */

  const fetchMonthly = async () => {
    setLoading(true);
    try {
      const res = await API.get("/salary/me/attendance", {
        params: { month },
      });
      setSummary(res.data);
    } catch (err) {
      console.error("Error loading monthly summary:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonthly();
  }, [month]);

  /* ================= CALCULATIONS ================= */

  const presentCount = records.filter((r) => r.status === "Present").length;
  const absentCount = records.filter((r) => r.status === "Absent").length;
  const lateCount = records.filter((r) => r.status === "Late").length;
  const leaveCount = records.filter((r) => r.status === "On Leave").length;
  const halfDayCount = records.filter((r) => r.status === "Half Day").length;

  const monthlyTotal = summary?.summary?.totalAmountEarned || 0;
  const monthlySalary = summary?.summary?.monthlySalary || 0;
  const userName = summary?.user?.name || "You";

  const formatCurrency = (amount) => {
    const n = parseFloat(amount || 0);
    return `₹ ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  /* ================= UI ================= */

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-3 rounded-full bg-cyan-100/80 px-4 py-2">
          <span className="h-3 w-3 rounded-full bg-cyan-600"></span>
          <span className="text-[13px] font-bold uppercase tracking-[0.18em] text-cyan-700">
            My Attendance
          </span>
        </div>
        <h2 className="mt-4 text-[34px] font-extrabold text-slate-900">
          {userName}'s Attendance & Salary
        </h2>
        <p className="mt-2 text-[16px] text-slate-600">
          View your attendance records and calculated salary.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
        <SummaryCard label="Present" value={presentCount} color="green" icon={FaUserCheck} />
        <SummaryCard label="Absent" value={absentCount} color="red" icon={FaClipboardCheck} />
        <SummaryCard label="Late" value={lateCount} color="yellow" icon={FaClock} />
        <SummaryCard label="Half Day" value={halfDayCount} color="amber" icon={FaClock} />
        <SummaryCard label="Leave" value={leaveCount} color="blue" icon={FaCalendarAlt} />
        <SummaryCard
          label="Monthly Pay"
          value={formatCurrency(monthlySalary)}
          color="emerald"
          icon={FaMoneyBillWave}
        />
        <SummaryCard
          label="Earned"
          value={formatCurrency(monthlyTotal)}
          color="emerald"
          icon={FaMoneyBillWave}
        />
      </div>

      {/* Date filter + fetch */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        <div>
          <label className="mb-2 block text-[13px] font-bold uppercase tracking-wider text-slate-600">
            View Attendance For Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-2xl border border-blue-100 bg-white px-5 py-3.5 text-[15px] font-semibold text-slate-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          />
        </div>

        <div>
          <label className="mb-2 block text-[13px] font-bold uppercase tracking-wider text-slate-600">
            Monthly Summary
          </label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-2xl border border-blue-100 bg-white px-5 py-3.5 text-[15px] font-semibold text-slate-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          />
        </div>
      </div>

      {/* Today's Attendance Table */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="border-b border-blue-50 px-6 py-4">
          <h3 className="text-lg font-bold text-slate-900">
            Today's Attendance ({date})
          </h3>
        </div>

        {records.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3 text-left">#</th>
                <th className="p-3 text-left">Name</th>
                <th className="p-3 text-left">Role</th>
                <th className="p-3 text-left">Check In</th>
                <th className="p-3 text-left">Check Out</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Daily Salary</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r, idx) => (
                <tr key={r.id} className="border-b hover:bg-blue-50/30">
                  <td className="p-3 font-semibold text-slate-500">{idx + 1}</td>
                  <td className="p-3 font-bold text-slate-900">{r.name}</td>
                  <td className="p-3">{r.role}</td>
                  <td className="p-3">
                    <span className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-3 py-1 font-semibold text-blue-700">
                      {r.checkIn || "--"}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-semibold text-slate-700">
                      {r.checkOut || "--"}
                    </span>
                  </td>
                  <td className="p-3">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-sm font-bold ${
                        r.status === "Present"
                          ? "bg-green-100 text-green-700"
                          : r.status === "Absent"
                          ? "bg-red-100 text-red-700"
                          : r.status === "Late"
                          ? "bg-yellow-100 text-yellow-700"
                          : r.status === "Half Day"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-bold text-emerald-700">
                      {formatCurrency(r.salary_amount)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center text-slate-500">
            {loading ? "Loading..." : "No attendance records found for this date."}
          </div>
        )}
      </div>

      {/* Monthly Summary Section */}
      {summary && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-emerald-50 to-green-50 p-6 shadow">
            <h3 className="text-xl font-extrabold text-slate-900 mb-2">
              Monthly Salary Summary — {summary.summary?.month}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Monthly Salary
                </p>
                <p className="text-2xl font-extrabold text-green-700">
                  {formatCurrency(monthlySalary)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Total Days
                </p>
                <p className="text-2xl font-extrabold text-slate-900">
                  {summary.summary?.totalWorkingDays}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Total Earned
                </p>
                <p className="text-2xl font-extrabold text-emerald-700">
                  {formatCurrency(monthlyTotal)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Attendance %
                </p>
                <p className="text-2xl font-extrabold text-slate-900">
                  {summary.summary?.totalWorkingDays > 0
                    ? `${Math.round((monthlyTotal / monthlySalary) * 100)}%`
                    : "0%"}
                </p>
              </div>
            </div>
          </div>

          {/* Monthly records table */}
          {summary.records?.length > 0 && (
            <div className="bg-white rounded-xl shadow overflow-hidden">
              <div className="border-b border-blue-50 px-6 py-4">
                <h3 className="text-lg font-bold text-slate-900">
                  Daily Breakdown
                </h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-3 text-left">#</th>
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-left">Check In</th>
                    <th className="p-3 text-left">Check Out</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-left">Salary Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.records.map((r, idx) => (
                    <tr key={r.id} className="border-b hover:bg-blue-50/30">
                      <td className="p-3 font-semibold text-slate-500">{idx + 1}</td>
                      <td className="p-3 font-semibold text-slate-900">{r.date}</td>
                      <td className="p-3">{r.in_time || "--"}</td>
                      <td className="p-3">{r.out_time || "--"}</td>
                      <td className="p-3">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-sm font-bold ${
                            r.status === "Present"
                              ? "bg-green-100 text-green-700"
                              : r.status === "Absent"
                              ? "bg-red-100 text-red-700"
                              : r.status === "Late"
                              ? "bg-yellow-100 text-yellow-700"
                              : r.status === "Half Day"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="font-bold text-emerald-700">
                          {formatCurrency(r.salary_amount)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MyAttendance;
