import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';

const Card = ({ title, subtitle, children }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="mb-2">
        <div className="text-base font-extrabold text-gray-900">{title}</div>
        {subtitle ? <div className="text-xs text-gray-600 font-semibold mt-1">{subtitle}</div> : null}
      </div>
      <div className="h-[320px]">{children}</div>
    </div>
  );
};

const palette = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6'];

const groupSum = (rows, key, valueKey) => {
  const map = new Map();
  rows.forEach((r) => {
    const k = r[key] ?? 'Unknown';
    map.set(k, (map.get(k) || 0) + (Number(r[valueKey]) || 0));
  });
  return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
};

const groupCount = (rows, key) => {
  const map = new Map();
  rows.forEach((r) => {
    const k = r[key] ?? 'Unknown';
    map.set(k, (map.get(k) || 0) + 1);
  });
  return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
};

const groupByDateSum = (rows, valueKey) => {
  const map = new Map();
  rows.forEach((r) => {
    const k = r.date ?? 'Unknown';
    map.set(k, (map.get(k) || 0) + (Number(r[valueKey]) || 0));
  });
  return Array.from(map.entries())
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
};

const ReportCharts = ({ reportType, rows }) => {
  if (reportType === 'banquet') {
    const data = groupSum(rows, 'hall', 'amount');
    return (
      <Card title="Banquet Revenue by Hall" subtitle="Total amount grouped by hall (demo)">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" stroke="#6b7280" tick={{ fontSize: 12 }} />
            <YAxis stroke="#6b7280" tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="value" fill="#14b8a6" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    );
  }

  if (reportType === 'restaurant') {
    const data = groupByDateSum(rows, 'amount');
    return (
      <Card title="Restaurant Sales Trend" subtitle="Sales by date (demo)">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="date" stroke="#6b7280" tick={{ fontSize: 12 }} />
            <YAxis stroke="#6b7280" tick={{ fontSize: 12 }} />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    );
  }

  if (reportType === 'housekeeping') {
    const data = groupCount(rows, 'status');
    return (
      <Card title="Housekeeping Status" subtitle="Count by status (demo)">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" stroke="#6b7280" tick={{ fontSize: 12 }} />
            <YAxis stroke="#6b7280" tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="value" fill="#f59e0b" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    );
  }

  if (reportType === 'accounts') {
    const income = rows.filter((r) => r.type === 'Income').reduce((a, r) => a + (Number(r.amount) || 0), 0);
    const expense = rows.filter((r) => r.type === 'Expense').reduce((a, r) => a + (Number(r.amount) || 0), 0);
    const data = [
      { name: 'Income', value: income },
      { name: 'Expense', value: expense },
      { name: 'Net', value: income - expense },
    ];
    return (
      <Card title="Accounts Overview" subtitle="Income vs Expense (demo)">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" stroke="#6b7280" tick={{ fontSize: 12 }} />
            <YAxis stroke="#6b7280" tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="value" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    );
  }

  // room (default): occupancy by status (pie)
  const data = groupCount(rows, 'status');
  return (
    <Card title="Room Status Mix" subtitle="Count by status (demo)">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={110} paddingAngle={4}>
            {data.map((_, idx) => (
              <Cell key={idx} fill={palette[idx % palette.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  );
};

export default ReportCharts;


