import { useEffect, useMemo, useState } from "react";

const PAGE_SIZE = 10;

const getColumns = (reportType) => {
  if (reportType === "room") {
    return [
      { key: "date", label: "Date" },
      { key: "guest", label: "Guest" },
      { key: "roomNumber", label: "Room No" },
      { key: "roomType", label: "Room Type" },
      { key: "status", label: "Status" },
      { key: "paymentMode", label: "Payment Mode" },
      { key: "revenue", label: "Revenue" },
    ];
  }

  if (reportType === "all-bills") {
    return [
      { key: "date", label: "Date" },
      { key: "source", label: "Source" },
      { key: "billNo", label: "Bill No" },
      { key: "description", label: "Description" },
      { key: "type", label: "Type" },
      { key: "status", label: "Status" },
      { key: "paymentMode", label: "Payment Mode" },
      { key: "amount", label: "Amount" },
    ];
  }

  if (reportType === "banquet") {
    return [
      { key: "date", label: "Date" },
      { key: "hall", label: "Hall" },
      { key: "eventType", label: "Event" },
      { key: "guests", label: "Guests" },
      { key: "status", label: "Status" },
      { key: "paymentMode", label: "Payment Mode" },
      { key: "amount", label: "Amount" },
    ];
  }

  if (reportType === "restaurant") {
    return [
      { key: "date", label: "Date" },
      { key: "table_number", label: "Table" },
      { key: "status", label: "Status" },
      { key: "paymentMode", label: "Payment Mode" },
      { key: "amount", label: "Amount" },
    ];
  }

  if (reportType === "housekeeping") {
    return [
      { key: "date", label: "Date" },
      { key: "roomType", label: "Room" },
      { key: "status", label: "Status" },
      { key: "assignee", label: "Assignee" },
      { key: "rooms", label: "Rooms" },
    ];
  }

  if (reportType === "accounts") {
    return [
      { key: "date", label: "Date" },
      { key: "type", label: "Type" },
      { key: "description", label: "Description" },
      { key: "paymentMode", label: "Payment Mode" },
      { key: "amount", label: "Amount" },
      { key: "status", label: "Status" },
    ];
  }

  if (reportType === "expense") {
    return [
      { key: "date", label: "Date" },
      { key: "department", label: "Department" },
      { key: "description", label: "Description" },
      { key: "paymentMode", label: "Payment Mode" },
      { key: "amount", label: "Amount" },
      { key: "sourceModule", label: "Source" },
    ];
  }

  return [];
};

const formatCell = (key, value) => {
  if (key === "amount" || key === "revenue") {
    return `Rs. ${Number(value || 0).toLocaleString("en-IN")}`;
  }

  return value ?? "-";
};

/* Blue-and-white premium status badges — same three semantic groups as
   before (informational, positive, attention), restyled to the brand palette. */
const getStatusClass = (value) => {
  const normalized = String(value || "").toLowerCase();

  if (["confirmed", "occupied", "paid", "posted"].includes(normalized)) {
    return "border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]";
  }
  if (["completed", "billed", "vacant clean"].includes(normalized)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (["pending", "vacant dirty"].includes(normalized)) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-100 text-slate-600";
};

const ReportTable = ({ reportType, rows, loading }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const columns = getColumns(reportType);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  useEffect(() => {
    setCurrentPage(1);
  }, [reportType, rows.length]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return rows.slice(startIndex, startIndex + PAGE_SIZE);
  }, [currentPage, rows]);

  const visibleStart = rows.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const visibleEnd = Math.min(currentPage * PAGE_SIZE, rows.length);

  const paginationItems = useMemo(() => {
    if (totalPages <= 1) return [1];

    const items = [1];
    const windowStart = Math.max(2, currentPage - 1);
    const windowEnd = Math.min(totalPages - 1, currentPage + 1);

    if (windowStart > 2) {
      items.push("start-ellipsis");
    }

    for (let page = windowStart; page <= windowEnd; page += 1) {
      items.push(page);
    }

    if (windowEnd < totalPages - 1) {
      items.push("end-ellipsis");
    }

    items.push(totalPages);
    return items;
  }, [currentPage, totalPages]);

  const showPagination = rows.length > 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl sm:rounded-[24px]">
      <div className="flex flex-col gap-2 border-b border-slate-200/80 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 md:px-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[#1D4ED8] sm:text-sm md:text-[16px]">
            Report Table
          </p>
          <h2 className="mt-1 text-xl font-black text-slate-900 sm:text-2xl md:text-[28px] lg:text-[34px]">
            Detailed report rows
          </h2>
        </div>
        <div className="text-sm font-semibold text-slate-500 sm:text-[16px]">
          {loading ? "Loading..." : `${rows.length} row(s) found`}
        </div>
      </div>

      <div className="max-h-[560px] overflow-auto">
        <table className="min-w-full text-left">
          <thead className="sticky top-0 z-10 bg-[#F8FAFC]/95 backdrop-blur">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="whitespace-nowrap border-b border-slate-200 px-4 py-3.5 text-[15px] font-bold uppercase tracking-wide text-slate-600 sm:px-5 md:px-6"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((row, index) => (
              <tr
                key={row.id || `${reportType}-${index}`}
                className={`border-b border-slate-100 transition-colors duration-200 last:border-b-0 hover:bg-[#EFF6FF]/60 ${
                  index % 2 === 0 ? "bg-white" : "bg-slate-50/60"
                }`}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className="whitespace-nowrap px-4 py-3.5 text-[16px] text-slate-700 sm:px-5 md:px-6"
                  >
                    {column.key === "status" ? (
                      <span
                        className={`inline-flex rounded-full border px-3 py-1.5 text-[15px] font-bold ${getStatusClass(
                          row[column.key]
                        )}`}
                      >
                        {formatCell(column.key, row[column.key])}
                      </span>
                    ) : (
                      <span
                        className={
                          column.key === "amount" || column.key === "revenue"
                            ? "font-bold text-slate-900"
                            : ""
                        }
                      >
                        {formatCell(column.key, row[column.key])}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}

            {!rows.length && !loading ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-[16px] font-medium text-slate-500 sm:px-5"
                >
                  No data found for current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {showPagination ? (
        <div className="flex flex-col gap-3 border-t border-slate-200/80 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 md:px-6">
          <div className="text-sm font-medium text-slate-500 sm:text-[16px]">
            Showing <span className="font-bold text-slate-900">{visibleStart}</span> to{" "}
            <span className="font-bold text-slate-900">{visibleEnd}</span> of{" "}
            <span className="font-bold text-slate-900">{rows.length}</span> rows
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}
              className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[#2563EB]/40 hover:text-[#1D4ED8] hover:shadow-[0_10px_22px_rgba(29,78,216,0.12)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:border-slate-200 disabled:hover:text-slate-700 sm:text-[16px]"
            >
              Previous
            </button>

            {paginationItems.map((item) =>
              typeof item === "number" ? (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCurrentPage(item)}
                  className={`h-11 min-w-11 rounded-full px-4 text-sm font-bold transition-all duration-300 sm:text-[16px] ${
                    currentPage === item
                      ? "bg-[linear-gradient(90deg,#1D4ED8_0%,#2563EB_100%)] text-white shadow-[0_10px_25px_rgba(29,78,216,0.28)]"
                      : "border border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-[#2563EB]/40 hover:text-[#1D4ED8] hover:shadow-[0_10px_22px_rgba(29,78,216,0.12)]"
                  }`}
                >
                  {item}
                </button>
              ) : (
                <span
                  key={item}
                  className="px-1 text-sm font-bold tracking-wide text-slate-400 sm:text-[16px]"
                >
                  ...
                </span>
              )
            )}

            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={currentPage === totalPages}
              className="rounded-full bg-[linear-gradient(90deg,#1D4ED8_0%,#2563EB_100%)] px-5 py-2.5 text-sm font-bold text-white shadow-[0_14px_28px_rgba(29,78,216,0.24)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(29,78,216,0.32)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-[0_14px_28px_rgba(29,78,216,0.24)] sm:text-[16px]"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ReportTable;