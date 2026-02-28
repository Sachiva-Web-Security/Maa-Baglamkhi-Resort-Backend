
import React from "react";

const Circle = ({ percent, color, label }) => {
  const radius = 45;
  const stroke = 10;
  const normalizedRadius = radius - stroke * 0.5;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset =
    circumference - (percent / 100) * circumference;

  return (
    <div className="flex items-center gap-4">
      <svg height={radius * 2} width={radius * 2}>
        <circle
          stroke="#e5e7eb"
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        <circle
          stroke={color}
          fill="transparent"
          strokeWidth={stroke}
          strokeDasharray={`${circumference} ${circumference}`}
          style={{ strokeDashoffset }}
          strokeLinecap="round"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          className="transition-all duration-500"
        />
      </svg>

      <div>
        <p className="text-2xl font-bold text-white">{percent}%</p>
        <p className="text-gray-400 text-sm">{label}</p>
      </div>
    </div>
  );
};

const States = () => {
  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6">
      <div className="bg-[#1e1b2e] rounded-2xl shadow-xl p-8 w-full max-w-2xl flex flex-col md:flex-row justify-around items-center gap-8">

        <Circle percent={70} color="#3b82f6" label="Check In" />
        <Circle percent={30} color="#f59e0b" label="Check Out" />

      </div>
    </div>
  );
};

export default States;
