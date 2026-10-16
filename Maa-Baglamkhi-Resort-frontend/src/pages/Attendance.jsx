import React, { useEffect, useMemo, useState } from "react";
import {
  FaCalendarAlt,
  FaClipboardCheck,
  FaClock,
  FaUserCheck,
  FaUserPlus,
  FaUsers,
} from "react-icons/fa";

import AttendanceForm from "../components/Attendance/AttendanceForm";
import AttendanceRow from "../components/Attendance/AttendanceRow";
import FiltersSection from "../components/Attendance/FiltersSection";
import SummaryCard from "../components/Attendance/SummaryCard";
import API from "../api";

const Attendance = () => {
  /* ================= ROLE ================= */

  const role = (localStorage.getItem("role") || "").toLowerCase();
  const isAdmin = role === "admin";

  /* ================= STATE ================= */

  const [date, setDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const [department, setDepartment] = useState("All Departments");
  const [roleFilter, setRoleFilter] = useState("All Roles");
  const [searchQuery, setSearchQuery] = useState("");
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [employees, setEmployees] = useState([]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 5;

  /* ================= FETCH ================= */

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        const res = await API.get("/attendance", { params: { date } });
        const data = Array.isArray(res.data) ? res.data : [];
        setEmployees(data);
      } catch (err) {
        console.error("Error loading attendance", err);
      }
    };

    fetchAttendance();
  }, [date]);

  /* ================= FILTER ================= */

  const filteredEmployees = useMemo(() => {
    const list = Array.isArray(employees) ? employees : [];
    return list.filter((employee) => {
      const matchesDepartment =
        department === "All Departments" ||
        employee.department === department;

      const matchesRole =
        roleFilter === "All Roles" || employee.role === roleFilter;

      const matchesSearch =
        searchQuery === "" ||
        (employee.name || "")
          .toLowerCase()
          .includes(searchQuery.toLowerCase());

      return matchesDepartment && matchesRole && matchesSearch;
    });
  }, [department, employees, roleFilter, searchQuery]);

  /* ================= PAGINATION ================= */

  const indexOfLast = currentPage * recordsPerPage;
  const indexOfFirst = indexOfLast - recordsPerPage;

  const currentRecords = filteredEmployees.slice(
    indexOfFirst,
    indexOfLast
  );

  const totalPages = Math.ceil(
    filteredEmployees.length / recordsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [filteredEmployees]);

  /* ================= STATS ================= */

  const totalStaff = employees.length;
  const presentStaff = employees.filter((e) => e.status === "Present").length;
  const absentStaff = employees.filter((e) => e.status === "Absent").length;
  const lateStaff = employees.filter((e) => e.status === "Late").length;
  const onLeaveStaff = employees.filter((e) => e.status === "On Leave").length;
  const totalSalary = employees.reduce(
    (sum, e) => sum + parseFloat(e.salary_amount || 0),
    0
  );

  /* ================= ADD (admin only) ================= */

  const handleManualSubmit = async (data) => {
    if (!isAdmin) {
      window.alert("Only admin can add attendance");
      return;
    }
    try {
      const payload = {
        ...data,
        name: data.employeeName,
        date,
      };

      const res = await API.post("/attendance", payload);
      const newId = res.data?.id || Date.now();
      setEmployees((prev) => [
        {
          id: newId,
          ...payload,
          salary_amount: res.data?.salary_amount || 0,
          user_salary: res.data?.user_salary || 0,
        },
        ...prev,
      ]);
      setShowManualEntry(false);
      window.alert("Attendance saved");
    } catch (err) {
      console.error("Error saving attendance", err);
      window.alert("Error saving attendance");
    }
  };

  /* ================= UI ================= */

  return (
    <div className="p-6 space-y-6">

      <FiltersSection
        date={date}
        department={department}
        role={roleFilter}
        searchQuery={searchQuery}
        onDateChange={setDate}
        onDepartmentChange={setDepartment}
        onRoleChange={setRoleFilter}
        onSearchChange={setSearchQuery}
        onAddManualEntry={() => setShowManualEntry(true)}
        showAddButton={isAdmin}
      />

      {/* Summary cards */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <SummaryCard label="Total" value={totalStaff} icon={FaUsers} />
        <SummaryCard label="Present" value={presentStaff} color="green" icon={FaUserCheck} />
        <SummaryCard label="Absent" value={absentStaff} color="red" icon={FaClipboardCheck} />
        <SummaryCard label="Late" value={lateStaff} color="yellow" icon={FaClock} />
        <SummaryCard label="Leave" value={onLeaveStaff} color="blue" icon={FaCalendarAlt} />
        <SummaryCard
          label="Total Salary"
          value={`₹ ${totalSalary.toFixed(0)}`}
          color="emerald"
          icon={FaUsers}
        />
      </section>

      {/* TABLE */}
      <div className="rounded-[24px] border border-blue-100 bg-white shadow-[0_6px_16px_rgba(30,64,175,0.04)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[17px]">
            <thead className="bg-[linear-gradient(180deg,#f4f9ff_0%,#e8f2ff_100%)] text-[16px] font-bold uppercase tracking-[0.16em] text-slate-500">
            <tr>
              <th className="px-4 py-4 text-left">Employee</th>
              <th className="px-4 py-4">Check In</th>
              <th className="px-4 py-4">Check Out</th>
              <th className="px-4 py-4">Status</th>
              <th className="px-4 py-4">Method</th>
              <th className="px-4 py-4">Daily Salary</th>
              {isAdmin && <th className="px-4 py-4">Action</th>}
            </tr>
          </thead>

          <tbody>
            {currentRecords.map((employee) => (
              <AttendanceRow
                key={employee.id}
                employee={employee}
                isAdmin={isAdmin}
              />
            ))}

            {currentRecords.length === 0 && (
              <tr>
                <td
                  colSpan={isAdmin ? 7 : 6}
                  className="text-center p-6"
                >
                  No data found
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* PAGINATION */}
        {totalPages > 1 && (
          <div className="flex flex-col gap-3 rounded-[22px] border border-blue-100 bg-white px-4 py-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
            <div className="text-[17px] font-bold text-slate-600">
              Page {currentPage} of {totalPages} • Showing {(currentPage - 1) * recordsPerPage + 1}-{Math.min(currentPage * recordsPerPage, filteredEmployees.length)} of {filteredEmployees.length}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => prev - 1)}
                disabled={currentPage === 1}
                className="rounded-full border border-blue-100 px-4 py-2.5 text-[17px] font-bold text-slate-700 transition hover:border-blue-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>

              {[...Array(totalPages)].map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`h-10 min-w-[40px] rounded-full px-3 text-[17px] font-bold transition ${
                    currentPage === i + 1
                      ? "bg-gradient-to-r from-blue-800 to-sky-500 text-white shadow-[0_10px_25px_rgba(37,99,235,0.28)]"
                      : "border border-blue-100 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-700"
                  }`}
                >
                  {i + 1}
                </button>
              ))}

              <button
                onClick={() => setCurrentPage((prev) => prev + 1)}
                disabled={currentPage >= totalPages}
                className="rounded-full border border-blue-100 px-4 py-2.5 text-[17px] font-bold text-slate-700 transition hover:border-blue-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
      </div>

      {/* MODAL - admin only */}
      {isAdmin && showManualEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-blue-950/50 p-3 backdrop-blur-sm sm:p-4">
          <div className="w-[calc(100%-1.5rem)] max-w-[760px] max-h-[calc(100vh-1.5rem)] sm:max-h-[90vh] overflow-y-auto overscroll-contain">
            <div className="mx-auto flex w-full flex-col overflow-hidden rounded-[32px] border border-white/60 bg-[linear-gradient(180deg,#ffffff_0%,#f5f9ff_100%)] p-5 shadow-[0_30px_90px_rgba(15,40,90,0.28)] sm:p-7">
              <AttendanceForm
                onSubmit={handleManualSubmit}
                onCancel={() => setShowManualEntry(false)}
                initialData={{ date }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Attendance;
