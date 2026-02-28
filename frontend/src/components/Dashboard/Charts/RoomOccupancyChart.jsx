import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

const RoomOccupancyChart = () => {
  const data = [
    { name: "Occupied", value: 85 },
    { name: "Available", value: 28 },
    { name: "Cleaning", value: 7 },
  ];

  const COLORS = ["#6366f1", "#22c55e", "#f59e0b"];

  const total = data.reduce((acc, item) => acc + item.value, 0);
  const percentage = Math.round((data[0].value / total) * 100);

  return (
    <div className="bg-white  shadow-lg  flex items-center justify-between">

      {/* Chart */}
      <div className="w-screen h-48 relative">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              innerRadius={70}
              outerRadius={100}
              paddingAngle={3}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={index} fill={COLORS[index]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <h2 className="text-xl font-bold text-gray-700">
            {percentage}%
          </h2>
          <p className="text-xs text-gray-400 ">Occupied</p>
        </div>
      </div>

      {/* Legend Right Side */}
      <div className="space-y-4">
        {data.map((item, index) => (
          <div key={index} className="flex items-center gap-3">
            <div
              className="w-3 h-3 rounded-full"
              style={{ background: COLORS[index] }}
            ></div>
            <span className="text-gray-600 text-sm">{item.name}</span>
          </div>
        ))}
      </div>

    </div>
  );
};

export default RoomOccupancyChart;