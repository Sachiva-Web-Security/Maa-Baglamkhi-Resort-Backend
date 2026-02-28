import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Area,
  AreaChart,
} from "recharts";

const MonthlyRevenueChart = () => {
  const data = [
    { month: "Jan", revenue: 85000 },
    { month: "Feb", revenue: 92000 },
    { month: "Mar", revenue: 105000 },
    { month: "Apr", revenue: 98000 },
    { month: "May", revenue: 115000 },
    { month: "Jun", revenue: 125000 },
  ];

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis dataKey="month" />
        <YAxis />
        <Tooltip />

        <Area
          type="monotone"
          dataKey="revenue"
          stroke="#6366f1"
          strokeWidth={3}
          fill="url(#colorRevenue)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default MonthlyRevenueChart;