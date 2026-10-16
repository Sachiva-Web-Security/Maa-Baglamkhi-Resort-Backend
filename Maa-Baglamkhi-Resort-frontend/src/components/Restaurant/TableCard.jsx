// src/components/Restaurant/TableCard.jsx
import React, { useContext } from "react";
import { useNavigate } from "react-router-dom";
import RestaurantContext from "../../Context/restaurantContext";

const TableCard = ({ table }) => {
  const navigate = useNavigate();
  const { getTableStatus, setSelectedTable } = useContext(RestaurantContext);

  const status = getTableStatus(table.name);
  const isOccupied = status === "Occupied";

  const handleClick = () => {
    setSelectedTable(table.name);
    navigate(`/restaurant/token/${table.name}`);
  };

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && handleClick()}
      className={`group relative cursor-pointer overflow-hidden rounded-2xl border transition-all duration-200 hover:-translate-y-1 hover:shadow-lg
        ${
          isOccupied
            ? "border-rose-200 bg-rose-50 hover:border-rose-300 hover:shadow-rose-100"
            : "border-emerald-200 bg-emerald-50 hover:border-emerald-300 hover:shadow-emerald-100"
        }`}
    >
      <div className={`h-1 w-full ${isOccupied ? "bg-rose-400" : "bg-emerald-400"}`} />

      <div className="p-4 sm:p-5">
        <div
          className={`mb-3 flex h-12 w-12 items-center justify-center rounded-xl text-xl font-black
          ${isOccupied ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}
        >
          T
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Table</p>
          <h3 className="mt-0.5 text-2xl font-black text-slate-900">{table.name}</h3>
          {table.floorName && <p className="mt-0.5 text-xs text-slate-400">{table.floorName}</p>}
          {table.seatCount > 0 && <p className="mt-0.5 text-xs text-slate-400">{table.seatCount} seats</p>}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold
            ${isOccupied ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${isOccupied ? "bg-rose-500" : "bg-emerald-500"}`} />
            {status}
          </span>
          <span className="text-xs font-semibold text-slate-400 transition-colors group-hover:text-slate-600">
            Open
          </span>
        </div>
      </div>
    </div>
  );
};

export default TableCard;
