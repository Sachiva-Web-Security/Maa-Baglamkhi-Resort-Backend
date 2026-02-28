import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

const FoodSalesChart = () => {

  const data = [
    { day: 'Mon', sales: 12000 },
    { day: 'Tue', sales: 15000 },
    { day: 'Wed', sales: 18000 },
    { day: 'Thu', sales: 22000 },
    { day: 'Fri', sales: 28000 },
  ];

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data}>
        <XAxis dataKey="day" />
        <YAxis />
        <Tooltip />

        <Line
          type="monotone"
          dataKey="sales"
          stroke="#06b6d4"
          strokeWidth={3}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default FoodSalesChart;