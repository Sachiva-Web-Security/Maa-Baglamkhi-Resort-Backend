import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";

const BACK_ROUTES = [
  "/inventory",
  "/inventory/items",
  "/inventory/categories",
  "/inventory/stock-categories",
  "/inventory/units",
  "/inventory/vendors",
  "/inventory/menu-items",
  "/inventory/menu-list",
  "/inventory/purchases",
  "/inventory/reports",
  "/inventory/masters",
  "/inventory/recipes",
];

function findPrevRoute(pathname, state) {
  if (state?.from && BACK_ROUTES.includes(state.from)) {
    return state.from;
  }

  const sorted = [...BACK_ROUTES].sort((a, b) => {
    const idxA = pathname.lastIndexOf(a);
    const idxB = pathname.lastIndexOf(b);
    if (idxA === -1 && idxB === -1) return 0;
    if (idxA === -1) return 1;
    if (idxB === -1) return -1;
    return idxB - idxA;
  });

  const best = sorted.find((route) => route !== pathname && pathname.startsWith(route));
  return best || "/inventory";
}

const BackButton = ({
  to,
  className = "",
  fallbackTo = "/inventory",
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const target = to || findPrevRoute(location.pathname, location.state) || fallbackTo;

  return (
    <button
      type="button"
      onClick={() => navigate(target)}
      title="Back"
      className={`inline-flex items-center justify-center rounded-full border border-blue-100 bg-white w-[40px] h-[40px] text-blue-600 shadow-[0_2px_10px_rgba(15,40,90,0.05)] transition-all duration-300 hover:border-blue-300 hover:bg-blue-50/60 active:scale-95 ${className}`}
    >
      <FaArrowLeft className="text-[15px]" />
    </button>
  );
};

export default BackButton;
