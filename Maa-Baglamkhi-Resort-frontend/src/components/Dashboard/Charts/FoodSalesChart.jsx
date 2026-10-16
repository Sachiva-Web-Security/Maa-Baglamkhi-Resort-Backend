import { useCallback, useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import API from '../../../api';

const FoodSalesChart = () => {
  const [data, setData] = useState([]);

  const fetchCharts = useCallback(async () => {
    try {
      const res = await API.get("/dashboard/charts");
      if (res.data && res.data.foodSales) {
        const mappedData = res.data.foodSales.map((item) => ({
          day: item.name,
          sales: Number(item.value || 0),
        }));
        setData(mappedData);
      }
    } catch (err) {
      console.error("Error fetching food sales chart data:", err);
    }
  }, []);

  useEffect(() => {
    fetchCharts();
  }, [fetchCharts]);

  useEffect(() => {
    const refresh = () => fetchCharts();
    const handleVisibilityChange = () => {
      if (!document.hidden) refresh();
    };

    const intervalId = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchCharts]);

  return (
    <div className="flex h-full w-full min-w-0 flex-col">
      <p className="text-[12px] font-bold uppercase tracking-[0.28em] text-emerald-300 sm:text-[14px]">
        Dining Trend
      </p>
      <h3 className="mt-1.5 text-xl font-black text-slate-900 sm:mt-2 sm:text-2xl">
        Food sales this week
      </h3>
      <div className="mt-3 min-h-0 flex-1 w-full sm:mt-4">
        <div className="h-full min-h-[200px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%" minHeight={200}>
            <LineChart data={data}>
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#64748b" }} />
              <YAxis tick={{ fontSize: 10, fill: "#64748b" }} />
              <Tooltip />

              <Line
                type="monotone"
                dataKey="sales"
                stroke="#06b6d4"
                strokeWidth={3}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default FoodSalesChart;

