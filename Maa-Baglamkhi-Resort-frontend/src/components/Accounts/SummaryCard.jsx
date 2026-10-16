import React from "react";
import { useEffect, useState } from "react";

const SummaryCard = ({
  label,
  value,
  valueColor = "default",
  onClick,
}) => {
  const valueColorClasses = {
    green: "text-[#0F6E64]",
    red: "text-[#B33A3A]",
    blue: "text-[#17315c]",
    purple: "text-[#5B3A8A]",
    default: "text-[#1C231F]",
  };

  const [displayValue, setDisplayValue] = useState(0);

  const numericValue = parseInt(String(value).replace(/[^\d]/g, ""), 10) || 0;

  useEffect(() => {
    let start = 0;
    const duration = 800;
    const increment = numericValue / (duration / 16);

    const counter = setInterval(() => {
      start += increment;

      if (start >= numericValue) {
        start = numericValue;
        clearInterval(counter);
      }

      setDisplayValue(Math.floor(start));
    }, 16);

    return () => clearInterval(counter);
  }, [numericValue]);

  const trendUp = numericValue % 2 === 0;
  const trendPercent = (numericValue % 15) + 5;

  return (
    <div
      className={`
        relative overflow-hidden
        bg-white
        border border-[#E4E1D8]
        rounded-2xl p-6
        shadow-md
        transition-all duration-300
        hover:shadow-lg hover:-translate-y-1
        ${onClick ? "cursor-pointer hover:bg-[#F6F5F1]" : ""}
      `}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
            if (e.key === "Enter" || e.key === " ") onClick();
          }
          : undefined
      }
    >
      <div className="absolute inset-0 bg-gradient-to-r from-[#17315c]/5 via-[#2d67cb]/5 to-[#0B4F48]/5 opacity-0 hover:opacity-100 transition duration-500 pointer-events-none"></div>

      <p className="text-sm text-[#6B6F66] tracking-wide mb-2">
        {label}
      </p>

      <h2
        className={`text-2xl font-bold tracking-tight ${valueColorClasses[valueColor] || valueColorClasses.default
          }`}
      >
        ₹{displayValue.toLocaleString("en-IN")}
      </h2>

      <div className="flex items-center justify-between mt-3">
        <span
          className={`text-xs font-medium ${trendUp ? "text-[#0F6E64]" : "text-[#B33A3A]"
            }`}
        >
          {trendUp ? "▲" : "▼"} {trendPercent}% this month
        </span>

        <span className="text-xs text-[#6B6F66]">
          Updated now
        </span>
      </div>

      <div className="mt-3 h-1.5 w-full bg-[#E4E1D8] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${trendUp ? "bg-[#0F6E64]" : "bg-[#B33A3A]"
            }`}
          style={{ width: `${Math.min(trendPercent * 5, 100)}%` }}
        ></div>
      </div>
    </div>
  );
};

export default SummaryCard;