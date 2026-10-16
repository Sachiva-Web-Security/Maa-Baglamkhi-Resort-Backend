import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import API from "../../../api";

const STATUS_CONFIG = {
  Occupied: { color: "#5B5CE2", label: "Occupied" },
  Available: { color: "#22C55E", label: "Available" },
  Cleaning: { color: "#F59E0B", label: "Cleaning" },
  Maintenance: { color: "#EF4444", label: "Maintenance" },
};

const STATUS_ORDER = ["Occupied", "Available", "Cleaning", "Maintenance"];
const CHART_MIN_HEIGHT = 200;

const RoomOccupancyChart = () => {
  const [data, setData] = useState([]);

  useEffect(() => {
    const fetchCharts = async () => {
      try {
        const res = await API.get("/dashboard/charts");
        if (res.data && res.data.roomOccupancy) {
          setData(res.data.roomOccupancy);
        }
      } catch (err) {
        console.error("Error fetching room occupancy chart data:", err);
      }
    };
    fetchCharts();
  }, []);

  const normalizedData = data
    .map((item) => {
      const normalizedName =
        STATUS_ORDER.find(
          (status) => status.toLowerCase() === String(item.name).toLowerCase()
        ) || item.name;

      return {
        name: normalizedName,
        label: STATUS_CONFIG[normalizedName]?.label || normalizedName,
        value: Number(item.value) || 0,
        color: STATUS_CONFIG[normalizedName]?.color || "#94A3B8",
      };
    })
    .sort((a, b) => {
      const aIndex = STATUS_ORDER.indexOf(a.name);
      const bIndex = STATUS_ORDER.indexOf(b.name);

      if (aIndex === -1 && bIndex === -1) return b.value - a.value;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });

  const total = normalizedData.reduce((acc, item) => acc + item.value, 0);
  const occupiedRooms =
    normalizedData.find((item) => item.name === "Occupied")?.value || 0;
  const percentage =
    total > 0
      ? Math.round((occupiedRooms / total) * 100)
      : 0;

  return (
    <div className="flex h-full w-full min-w-0 flex-col overflow-hidden">
      <div className="grid min-h-[240px] grid-cols-1 gap-5 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)] lg:items-center">
        <div className="flex min-w-0 flex-col items-center justify-center">
          <div
            className="relative mx-auto flex w-full max-w-[210px] items-center justify-center"
            style={{ minHeight: `${CHART_MIN_HEIGHT}px` }}
          >
            <ResponsiveContainer width="100%" height={CHART_MIN_HEIGHT} minHeight={CHART_MIN_HEIGHT}>
              <PieChart margin={{ top: 12, right: 12, bottom: 12, left: 12 }}>
                <Pie
                  data={normalizedData}
                  innerRadius="66%"
                  outerRadius="84%"
                  paddingAngle={4}
                  dataKey="value"
                  cx="50%"
                  cy="50%"
                  stroke="#F8FAFC"
                  strokeWidth={4}
                  isAnimationActive={false}
                >
                  {normalizedData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center px-5 text-center">
              <p className="text-[28px] font-black leading-none text-slate-900 sm:text-[32px]">
                {percentage}%
              </p>
              <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.22em] text-slate-400 sm:text-[10px]">
                Occupied
              </p>
              <p className="mt-2 max-w-[110px] text-[10px] leading-4 text-slate-500 sm:max-w-[120px] sm:text-[11px] sm:leading-4">
                {occupiedRooms} of {total} rooms in use
              </p>
            </div>
          </div>
        </div>

        <div className="grid min-w-0 content-start gap-3">
          {normalizedData.map((item) => {
            const itemPercentage =
              total > 0 ? Math.round((item.value / total) * 100) : 0;

            return (
              <div
                key={item.name}
                className="flex min-w-0 items-center justify-between gap-3 rounded-[18px] border border-sky-200/80 bg-transparent px-3.5 py-3 shadow-[0_10px_26px_rgba(15,23,42,0.04)]"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <div className="min-w-0">
                    <p className="break-words text-sm font-bold leading-5 text-slate-800 sm:text-[15px]">
                      {item.label}
                    </p>
                    <p className="text-[11px] leading-5 text-slate-400 sm:text-xs">
                      {itemPercentage}% of total
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[18px] font-black leading-none text-slate-900 sm:text-[20px]">
                    {item.value}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-slate-400">rooms</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default RoomOccupancyChart;
