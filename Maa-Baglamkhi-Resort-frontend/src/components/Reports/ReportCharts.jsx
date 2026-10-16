import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/* Blue-forward premium palette — kept multi-hue for pie/legend contrast,
   anchored to the brand blues (#1D4ED8 / #2563EB / #38BDF8). */
const palette = ["#1D4ED8", "#38BDF8", "#F59E0B", "#F43F5E", "#0F766E", "#8B5CF6"];

const formatCompactNumber = (value) => Number(value || 0).toLocaleString("en-IN");

const Card = ({ title, subtitle, children }) => (
  <div className="min-w-0 rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl sm:rounded-[24px] sm:p-5 md:p-6">
    <div className="mb-4">
      <p className="text-xs font-bold uppercase tracking-wide text-[#1D4ED8] sm:text-sm md:text-[16px]">
        Visual Summary
      </p>
      <h2 className="mt-1 text-xl font-black text-slate-900 sm:text-2xl md:text-[28px] lg:text-[34px]">
        {title}
      </h2>
      {subtitle ? (
        <div className="mt-1 text-sm leading-6 text-slate-500 sm:text-[16px]">{subtitle}</div>
      ) : null}
    </div>
    <div className="h-[260px] w-full min-w-0 sm:h-[300px] md:h-[320px]">{children}</div>
  </div>
);

const EmptyChartState = ({ title, subtitle }) => (
  <Card title={title} subtitle={subtitle}>
    <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center sm:rounded-[22px]">
      <div>
        <div className="text-base font-bold text-slate-900 sm:text-lg">
          No data available
        </div>
        <p className="mt-2 text-sm font-medium leading-6 text-slate-500 sm:text-[16px]">
          Try adjusting your filters to see chart data.
        </p>
      </div>
    </div>
  </Card>
);

const groupSum = (rows, key, valueKey) => {
  const map = new Map();

  rows.forEach((row) => {
    const name = row[key] ?? "Unknown";
    map.set(name, (map.get(name) || 0) + (Number(row[valueKey]) || 0));
  });

  return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
};

const groupCount = (rows, key) => {
  const map = new Map();

  rows.forEach((row) => {
    const name = row[key] ?? "Unknown";
    map.set(name, (map.get(name) || 0) + 1);
  });

  return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
};

const groupByDateSum = (rows, valueKey) => {
  const map = new Map();

  rows.forEach((row) => {
    const date = row.date ?? "Unknown";
    map.set(date, (map.get(date) || 0) + (Number(row[valueKey]) || 0));
  });

  return Array.from(map.entries())
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
};

const tooltipStyle = {
  borderRadius: 16,
  border: "1px solid rgba(226,232,240,0.9)",
  boxShadow: "0 18px 40px rgba(29,78,216,0.14)",
};

const CustomPieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;

  const item = payload[0]?.payload;
  if (!item) return null;

  return (
    <div
      className="rounded-2xl border border-slate-200/90 bg-white/95 px-4 py-3 shadow-[0_18px_40px_rgba(29,78,216,0.14)] backdrop-blur"
      style={{ minWidth: 170 }}
    >
      <div className="flex items-center gap-2">
        <span
          className="h-3 w-3 rounded-full"
          style={{ backgroundColor: item.fill || payload[0]?.color || "#1D4ED8" }}
        />
        <span className="text-sm font-bold text-slate-900">{item.name}</span>
      </div>
      <div className="mt-2 text-xs font-bold uppercase tracking-wide text-slate-500">Rooms</div>
      <div className="mt-1 text-lg font-black text-slate-900">{formatCompactNumber(item.value)}</div>
      <div className="mt-1 text-sm font-medium text-slate-500">{item.percentLabel || "--"} of visible mix</div>
    </div>
  );
};

const ReportCharts = ({ reportType, rows }) => {
  if (!rows.length) {
    return (
      <EmptyChartState
        title="Visual Summary"
        subtitle="Chart selected filters ke hisaab se populate hota hai"
      />
    );
  }

  if (reportType === "all-bills") {
    const data = groupSum(rows, "source", "amount");

    return (
      <Card title="All Bills by Source" subtitle="Combined amount grouped by billing module">
        <ResponsiveContainer width="100%" height="100%" minHeight={200}>
          <BarChart data={data} margin={{ top: 12, right: 16, left: 4, bottom: 12 }} barCategoryGap="32%">
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 12 }} />
            <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="value" fill="#1D4ED8" radius={[12, 12, 0, 0]} maxBarSize={140} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    );
  }

  if (reportType === "banquet") {
    const data = groupSum(rows, "hall", "amount");

    return (
      <Card title="Banquet Revenue by Hall" subtitle="See which hall is generating the highest revenue">
        <ResponsiveContainer width="100%" height="100%" minHeight={200}>
          <BarChart data={data} margin={{ top: 12, right: 16, left: 4, bottom: 12 }} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 12 }} />
            <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="value" fill="#38BDF8" radius={[12, 12, 0, 0]} maxBarSize={128} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    );
  }

  if (reportType === "restaurant") {
    const data = groupByDateSum(rows, "amount");

    return (
      <Card title="Restaurant Sales Trend" subtitle="Track selected date range food billing movement">
        <ResponsiveContainer width="100%" height="100%" minHeight={200}>
          {data.length <= 1 ? (
            <BarChart data={data} margin={{ top: 12, right: 16, left: 4, bottom: 12 }} barCategoryGap="35%">
              <CartesianGrid strokeDasharray="3 3" stroke="#dbe4f0" />
              <XAxis dataKey="date" stroke="#334155" tick={{ fontSize: 12, fill: "#334155", fontWeight: 600 }} />
              <YAxis stroke="#334155" tick={{ fontSize: 12, fill: "#334155", fontWeight: 600 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" fill="#2563EB" radius={[14, 14, 0, 0]} barSize={64} maxBarSize={72} />
            </BarChart>
          ) : (
            <LineChart data={data} margin={{ top: 12, right: 16, left: 4, bottom: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dbe4f0" />
              <XAxis dataKey="date" stroke="#334155" tick={{ fontSize: 12, fill: "#334155", fontWeight: 600 }} />
              <YAxis stroke="#334155" tick={{ fontSize: 12, fill: "#334155", fontWeight: 600 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#2563EB"
                strokeWidth={4}
                dot={{ r: 5, strokeWidth: 2, fill: "#ffffff" }}
                activeDot={{ r: 7, strokeWidth: 2, fill: "#ffffff" }}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </Card>
    );
  }

  if (reportType === "housekeeping") {
    const data = groupCount(rows, "status");

    return (
      <Card title="Housekeeping Status Mix" subtitle="Room condition distribution for selected rows">
        <ResponsiveContainer width="100%" height="100%" minHeight={200}>
          <BarChart data={data} margin={{ top: 12, right: 16, left: 4, bottom: 12 }} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 12 }} />
            <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="value" fill="#F59E0B" radius={[12, 12, 0, 0]} maxBarSize={128} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    );
  }

  if (reportType === "expense") {
    const data = groupSum(rows, "department", "amount");

    return (
      <Card title="Expense by Department" subtitle="Department-wise spending breakdown">
        <ResponsiveContainer width="100%" height="100%" minHeight={200}>
          <BarChart data={data} margin={{ top: 12, right: 16, left: 4, bottom: 12 }} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 12 }} />
            <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="value" fill="#F43F5E" radius={[12, 12, 0, 0]} maxBarSize={128} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    );
  }

  if (reportType === "accounts") {
    const income = rows
      .filter((row) => row.type === "Income")
      .reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
    const expense = rows
      .filter((row) => row.type === "Expense")
      .reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
    const data = [
      { name: "Income", value: income },
      { name: "Expense", value: expense },
      { name: "Net", value: income - expense },
    ];

    return (
      <Card title="Accounts Overview" subtitle="Income vs expense vs net impact">
        <ResponsiveContainer width="100%" height="100%" minHeight={200}>
          <BarChart data={data} margin={{ top: 12, right: 16, left: 4, bottom: 12 }} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 12 }} />
            <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="value" fill="#8B5CF6" radius={[12, 12, 0, 0]} maxBarSize={128} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    );
  }

  const data = groupCount(rows, "status");
  const total = data.reduce((sum, item) => sum + Number(item.value || 0), 0);
  const enrichedData = data.map((item, index) => ({
    ...item,
    fill: palette[index % palette.length],
    percent: total ? (Number(item.value || 0) / total) * 100 : 0,
    percentLabel: total ? `${((Number(item.value || 0) / total) * 100).toFixed(1)}%` : "0%",
  }));
  const topStatus = [...enrichedData].sort((a, b) => Number(b.value || 0) - Number(a.value || 0))[0];

  return (
    <Card title="Room Status Mix" subtitle="Occupancy and room state distribution">
      <div className="grid h-full gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1fr)_200px] xl:grid-cols-[minmax(0,1fr)_210px]">
        <div className="rounded-2xl border border-slate-100 bg-[radial-gradient(circle_at_top,rgba(29,78,216,0.08),transparent_38%),linear-gradient(180deg,rgba(248,250,252,0.95)_0%,rgba(255,255,255,0.92)_100%)] p-3 sm:rounded-[24px]">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1 pt-1 sm:px-2">
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500 sm:text-sm">
                Room Overview
              </div>
              <div className="mt-1 text-sm font-medium text-slate-600 sm:text-[16px]">
                Total visible rooms{" "}
                <span className="font-bold text-slate-900">{formatCompactNumber(total)}</span>
              </div>
            </div>
            {topStatus ? (
              <div className="rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm sm:text-sm">
                Top:{" "}
                <span className="text-[#1D4ED8]">{topStatus.name}</span> ({topStatus.percentLabel})
              </div>
            ) : null}
          </div>

          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={enrichedData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={64}
                outerRadius={96}
                paddingAngle={3}
                stroke="#ffffff"
                strokeWidth={3}
              >
                {enrichedData.map((entry, index) => (
                  <Cell key={`${entry.name}-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip content={<CustomPieTooltip />} />
              <text
                x="50%"
                y="46%"
                textAnchor="middle"
                dominantBaseline="central"
                className="fill-slate-400 text-[10px] font-bold uppercase tracking-[0.22em] sm:text-[11px]"
              >
                Rooms
              </text>
              <text
                x="50%"
                y="56%"
                textAnchor="middle"
                dominantBaseline="central"
                className="fill-slate-900 text-[22px] font-black sm:text-[26px]"
              >
                {formatCompactNumber(total)}
              </text>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="flex flex-col gap-2.5 sm:gap-3">
          {enrichedData.map((item) => (
            <div
              key={item.name}
              className="rounded-2xl border border-slate-200/80 bg-white/92 p-3 shadow-[0_10px_24px_rgba(15,23,42,0.05)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#BFDBFE] hover:shadow-[0_10px_24px_rgba(29,78,216,0.10)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span
                    className="h-3.5 w-3.5 shrink-0 rounded-full shadow-sm"
                    style={{ backgroundColor: item.fill }}
                  />
                  <div>
                    <div className="text-sm font-bold text-slate-900">{item.name}</div>
                    <div className="text-xs font-medium text-slate-500 sm:text-sm">{item.percentLabel} share</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-black text-slate-900">{formatCompactNumber(item.value)}</div>
                  <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">rooms</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};

export default ReportCharts;