import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import API from "../../../api";

const formatCompactValue = (value) => {
  const amount = Number(value || 0);
  if (amount >= 1000000) return `Rs.${(amount / 1000000).toFixed(2)}M`;
  if (amount >= 100000) return `Rs.${(amount / 1000).toFixed(0)}K`;
  return `Rs.${amount.toLocaleString("en-US")}`;
};

const formatTooltipValue = (value) => Number(value || 0).toLocaleString("en-US");

const RevenueTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl bg-[#0b223d] px-4 py-2 text-xs font-semibold text-white shadow-[0_16px_40px_rgba(11,34,61,0.28)]">
      {`${label}: Rs.${formatTooltipValue(payload[0].value)}`}
    </div>
  );
};

const MonthlyRevenueChart = () => {
  const [data, setData] = useState([]);

  useEffect(() => {
    const fetchCharts = async () => {
      try {
        const res = await API.get("/dashboard/charts");
        if (res.data && res.data.monthlyRevenue) {
          const mappedData = res.data.monthlyRevenue.map((item) => ({
            month: String(item.name || "").toUpperCase(),
            revenue: (item.Online || 0) + (item.Offline || 0),
          }));
          setData(mappedData);
        }
      } catch (err) {
        if (err.message === "Network Error") {
          console.error("Network Error: Could not connect to backend. Please ensure the backend server is running and API base URL is configured.", err);
        } else {
          console.error("Error fetching monthly revenue chart data:", err);
        }
      }
    };
    fetchCharts();
  }, []);

  const summary = useMemo(() => {
    const current = Number(data[data.length - 1]?.revenue || 0);
    const previous = Number(data[data.length - 2]?.revenue || 0);
    const delta = previous > 0 ? ((current - previous) / previous) * 100 : 0;

    return {
      current,
      delta,
    };
  }, [data]);

  const activePoint = data[data.length - 1] || null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-col gap-3 border-b border-sky-200/80 pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:pb-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-slate-500 sm:text-[11px]">
            Revenue Trend
          </p>
          <h3 className="mt-1.5 text-[1rem] font-bold text-[#0a2340] sm:mt-2 sm:text-[1.28rem]">
            Reservation statistics
          </h3>
        </div>

        <div className="text-left sm:text-right">
          <div className="text-[1.65rem] font-bold leading-none text-[#0a2340] sm:text-[2.3rem]">
            {formatCompactValue(summary.current)}
          </div>
          <div className="mt-1 text-[12px] font-semibold text-[#f0a94d] sm:text-sm">
            {`${summary.delta >= 0 ? "+" : ""}${summary.delta.toFixed(1)}% vs last month`}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 pt-4 sm:pt-5">
        <div className="h-full min-h-[200px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%" minHeight={200}>
            <AreaChart
              data={data}
              margin={{ top: 14, right: 8, left: 0, bottom: 4 }}
            >
            <defs>
              <linearGradient id="reservationCurveFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#d7dbe2" stopOpacity={0.7} />
                <stop offset="100%" stopColor="#edf1f5" stopOpacity={0.15} />
              </linearGradient>
            </defs>

            <CartesianGrid vertical={false} stroke="#e8edf3" strokeDasharray="0" />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#7a8696", fontSize: 10, fontWeight: 700 }}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={false}
              width={0}
            />
            <Tooltip
              cursor={false}
              content={<RevenueTooltip />}
              position={activePoint ? { y: 16 } : undefined}
            />

            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#17324f"
              strokeWidth={3}
              fill="url(#reservationCurveFill)"
              activeDot={{ r: 6, stroke: "#17324f", strokeWidth: 4, fill: "#f8fafc" }}
            />

            {activePoint ? (
              <ReferenceDot
                x={activePoint.month}
                y={activePoint.revenue}
                r={6}
                fill="#f8fafc"
                stroke="#17324f"
                strokeWidth={4}
              />
            ) : null}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
    </div>
  );
};

export default MonthlyRevenueChart;

