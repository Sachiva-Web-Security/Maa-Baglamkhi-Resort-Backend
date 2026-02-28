import { useEffect, useMemo, useState } from 'react';
import { FaSearch, FaDownload, FaPrint, FaSyncAlt } from 'react-icons/fa';
import ReportTypeSelector from '../components/Reports/ReportTypeSelector';
import ReportFilters from '../components/Reports/ReportFilters';
import ReportTable from '../components/Reports/ReportTable';
import ReportCharts from '../components/Reports/ReportCharts';
import API from "../api";

const REPORT_TYPES = [
  { id: 'room', label: 'Room' },
  { id: 'banquet', label: 'Banquet' },
  { id: 'restaurant', label: 'Restaurant' },
  { id: 'housekeeping', label: 'Housekeeping' },
  { id: 'accounts', label: 'Accounts' },
];

const PAYMENT_MODES = ['Cash', 'Card', 'UPI', 'Bank Transfer'];
const ROOM_TYPES = ['Standard', 'Deluxe', 'Suite', 'Executive'];
const HALLS = ['Grand Ballroom', 'Garden Banquet', 'Crystal Hall', 'Board Room'];
const STATUSES = ['All', 'Pending', 'Confirmed', 'Completed', 'Billed', 'Vacant Dirty', 'Vacant Clean', 'Occupied'];

const todayISO = () => new Date().toISOString().slice(0, 10);

function inDateRange(dateISO, fromISO, toISO) {
  if (!dateISO) return false;
  if (fromISO && dateISO < fromISO) return false;
  if (toISO && dateISO > toISO) return false;
  return true;
}

function toCSV(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`;
  return [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n');
}

function downloadText(filename, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function makeMockData(type) {
  const baseDate = new Date();
  const daysAgo = (n) => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  };

  if (type === 'room') {
    return Array.from({ length: 24 }).map((_, idx) => ({
      id: idx + 1,
      date: daysAgo(idx % 10),
      roomType: ROOM_TYPES[idx % ROOM_TYPES.length],
      status: ['Occupied', 'Available', 'Cleaning'][idx % 3],
      rooms: 5 + (idx % 7),
      revenue: 4500 * (1 + (idx % 4)),
      paymentMode: PAYMENT_MODES[idx % PAYMENT_MODES.length],
    }));
  }

  if (type === 'banquet') {
    return Array.from({ length: 18 }).map((_, idx) => ({
      id: idx + 1,
      date: daysAgo(idx % 12),
      hall: HALLS[idx % HALLS.length],
      status: ['Confirmed', 'Completed', 'Billed'][idx % 3],
      eventType: ['Wedding', 'Reception', 'Corporate', 'Birthday'][idx % 4],
      guests: 100 + (idx % 8) * 25,
      amount: 45000 + (idx % 6) * 12000,
      paymentMode: PAYMENT_MODES[idx % PAYMENT_MODES.length],
    }));
  }

  if (type === 'restaurant') {
    return Array.from({ length: 21 }).map((_, idx) => ({
      id: idx + 1,
      date: daysAgo(idx % 7),
      status: ['Completed', 'Pending'][idx % 2],
      orders: 25 + (idx % 10),
      amount: 12000 + (idx % 9) * 2500,
      paymentMode: PAYMENT_MODES[idx % PAYMENT_MODES.length],
    }));
  }

  if (type === 'housekeeping') {
    return Array.from({ length: 20 }).map((_, idx) => ({
      id: idx + 1,
      date: daysAgo(idx % 10),
      roomType: ROOM_TYPES[idx % ROOM_TYPES.length],
      status: ['Vacant Dirty', 'Vacant Clean', 'Occupied Dirty', 'Occupied Clean'][idx % 4],
      assignee: ['John Doe', 'Jane Smith', 'No Housekeeper'][idx % 3],
      rooms: 3 + (idx % 6),
    }));
  }

  // accounts
  return Array.from({ length: 20 }).map((_, idx) => ({
    id: idx + 1,
    date: daysAgo(idx % 12),
    type: idx % 3 === 0 ? 'Expense' : 'Income',
    description: idx % 3 === 0 ? 'Purchase / Vendor Payment' : 'Sales / Booking Payment',
    amount: 2500 + (idx % 9) * 1800,
    paymentMode: PAYMENT_MODES[idx % PAYMENT_MODES.length],
    status: 'Completed',
  }));
}

const Reports = () => {
  const [reportType, setReportType] = useState('room');
  const [query, setQuery] = useState('');
  const [summary, setSummary] = useState(null);

  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: todayISO(),
    status: 'All',
    hall: 'All',
    roomType: 'All',
    paymentMode: 'All',
  });

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(() => makeMockData('room'));
  const [lastFetchedAt, setLastFetchedAt] = useState(null);

  const options = useMemo(() => {
    return {
      statuses: STATUSES,
      halls: ['All', ...HALLS],
      roomTypes: ['All', ...ROOM_TYPES],
      paymentModes: ['All', ...PAYMENT_MODES],
    };
  }, []);

  const visibleFilters = useMemo(() => {
    return {
      hall: reportType === 'banquet',
      roomType: reportType === 'room' || reportType === 'housekeeping',
      paymentMode: reportType === 'accounts' || reportType === 'restaurant' || reportType === 'banquet' || reportType === 'room',
      status: true,
    };
  }, [reportType]);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const res = await API.get("/reports/summary");
        setSummary(res.data);
      } catch (err) {
        console.error("Error loading report summary", err);
      }
    };
    fetchSummary();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.filter((row) => {
      if (!inDateRange(row.date, filters.dateFrom, filters.dateTo)) return false;
      if (filters.status !== 'All' && row.status && row.status !== filters.status) return false;
      if (filters.hall !== 'All' && row.hall && row.hall !== filters.hall) return false;
      if (filters.roomType !== 'All' && row.roomType && row.roomType !== filters.roomType) return false;
      if (filters.paymentMode !== 'All' && row.paymentMode && row.paymentMode !== filters.paymentMode) return false;
      if (!q) return true;
      const hay = Object.values(row).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [data, filters, query]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Demo fetch: simulate latency
      await new Promise((r) => setTimeout(r, 600));
      setData(makeMockData(reportType));
      setLastFetchedAt(new Date());
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    const csv = toCSV(filtered);
    if (!csv) return alert('No rows to export');
    downloadText(`report-${reportType}.csv`, csv);
  };

  const printReport = () => window.print();

  return (
    <div className="min-h-screen bg-gray-100 pt-[100px] px-[30px] pb-[30px]">
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Reports</h1>
        <div className="text-sm text-gray-500">Home / Reports</div>
        {summary && (
          <div className="mt-2 text-xs text-gray-600 font-semibold">
            Rooms: <span className="font-bold">{summary.totalRooms}</span> ·
            Hotel bookings: <span className="font-bold">{summary.hotelBookings}</span> ·
            Restaurant bills: <span className="font-bold">{summary.restaurantBills}</span> ·
            Accounts txns: <span className="font-bold">{summary.accountsTransactions}</span> ·
            Banquet bookings: <span className="font-bold">{summary.banquetBookings}</span> ·
            Attendance rows: <span className="font-bold">{summary.attendanceRecords}</span>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,1fr)_auto] gap-3 items-center">
          <ReportTypeSelector value={reportType} onChange={setReportType} types={REPORT_TYPES} />

          <div className="flex flex-wrap gap-2 justify-start lg:justify-end">
            <button
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-extrabold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
              onClick={fetchData}
              disabled={loading}
            >
              <FaSyncAlt />
              {loading ? 'Fetching...' : 'Fetch Data'}
            </button>
            <button
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-extrabold text-white bg-green-600 hover:bg-green-700 transition-colors"
              onClick={exportCSV}
            >
              <FaDownload />
              Export CSV
            </button>
            <button
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-extrabold text-white bg-gray-900 hover:bg-black transition-colors"
              onClick={printReport}
            >
              <FaPrint />
              Print
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 lg:grid-cols-[minmax(320px,1fr)_auto] gap-3 items-center">
          <div className="relative w-full">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search in report..."
              className="w-full pl-10 pr-4 py-2 border border-teal-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-200 bg-white font-semibold"
            />
          </div>

          <div className="text-xs text-gray-500 font-semibold">
            Rows: <span className="font-extrabold text-gray-700">{filtered.length}</span>
            {lastFetchedAt ? (
              <span className="ml-3">
                Last fetched:{' '}
                <span className="font-extrabold text-gray-700">{lastFetchedAt.toLocaleString()}</span>
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <ReportFilters
        value={filters}
        onChange={setFilters}
        visible={visibleFilters}
        options={options}
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        <ReportCharts reportType={reportType} rows={filtered} />
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <h2 className="text-base font-extrabold text-gray-900 mb-1">Report Summary</h2>
          <div className="text-xs text-gray-600 font-semibold mb-3">
            Quick totals based on current filters (demo).
          </div>
          <SummaryPanel reportType={reportType} rows={filtered} />
        </div>
      </div>

      <ReportTable reportType={reportType} rows={filtered} loading={loading} />
    </div>
  );
};

const SummaryPanel = ({ reportType, rows }) => {
  const sum = (key) => rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);

  const cards = useMemo(() => {
    if (reportType === 'banquet') {
      return [
        { label: 'Total Events', value: rows.length },
        { label: 'Total Guests', value: sum('guests') },
        { label: 'Total Amount', value: `₹${sum('amount').toLocaleString('en-IN')}` },
      ];
    }
    if (reportType === 'restaurant') {
      return [
        { label: 'Total Days', value: new Set(rows.map((r) => r.date)).size },
        { label: 'Total Orders', value: sum('orders') },
        { label: 'Total Sales', value: `₹${sum('amount').toLocaleString('en-IN')}` },
      ];
    }
    if (reportType === 'housekeeping') {
      return [
        { label: 'Total Rows', value: rows.length },
        { label: 'Rooms Count', value: sum('rooms') },
        { label: 'Assignees', value: new Set(rows.map((r) => r.assignee)).size },
      ];
    }
    if (reportType === 'accounts') {
      const income = rows.filter((r) => r.type === 'Income').reduce((a, r) => a + (Number(r.amount) || 0), 0);
      const expense = rows.filter((r) => r.type === 'Expense').reduce((a, r) => a + (Number(r.amount) || 0), 0);
      return [
        { label: 'Income', value: `₹${income.toLocaleString('en-IN')}` },
        { label: 'Expense', value: `₹${expense.toLocaleString('en-IN')}` },
        { label: 'Net', value: `₹${(income - expense).toLocaleString('en-IN')}` },
      ];
    }
    // room
    return [
      { label: 'Total Rows', value: rows.length },
      { label: 'Total Rooms', value: sum('rooms') },
      { label: 'Revenue', value: `₹${sum('revenue').toLocaleString('en-IN')}` },
    ];
  }, [reportType, rows]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="bg-gray-50 border border-gray-200 rounded-xl p-3">
          <div className="text-xs text-gray-600 font-extrabold">{c.label}</div>
          <div className="mt-1 text-lg text-gray-900 font-black">{c.value}</div>
        </div>
      ))}
    </div>
  );
};

export default Reports;


