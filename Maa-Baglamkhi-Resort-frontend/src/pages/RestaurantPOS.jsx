import React from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  FaClipboardList,
  FaExternalLinkAlt,
  FaPlusCircle,
  FaReceipt,
  FaRegCreditCard,
  FaStar,
  FaThLarge,
  FaUtensils,
} from "react-icons/fa";
import { getCurrentActor } from "../utils/currentActor";

const RestaurantPOS = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const actor = getCurrentActor();

  const links = actor.isWaiter
    ? [
        { label: "My Tables", path: "/restaurant", icon: FaThLarge },
        { label: "Payment", path: "/restaurant/payment", icon: FaRegCreditCard },
        { label: "Bills", path: "/restaurant/payment-bills", icon: FaClipboardList },
        { label: "Room Orders", path: "/restaurant/room-items", icon: FaStar },
      ]
    : [
        { label: "Tables", path: "/restaurant", icon: FaThLarge },
        { label: "Payment", path: "/restaurant/payment", icon: FaRegCreditCard },
        { label: "Bills", path: "/restaurant/payment-bills", icon: FaClipboardList },
        { label: "Room Orders", path: "/restaurant/room-items", icon: FaStar },
        // { label: "Add Menu", path: "/restaurant/add-menu-item", icon: FaPlusCircle },
      ];

  const isLinkActive = (path) =>
    location.pathname === path ||
    (path !== "/restaurant" && location.pathname.startsWith(`${path}/`));

  const activeLink =
    links.find((link) => isLinkActive(link.path)) ||
    links[0];

  const heroTitle = actor.isWaiter
    ? "Operational snapshot for Waiter"
    : "Operational snapshot for Restaurant";

  const heroCopy = actor.isWaiter      
    ? "Manage live table activity, kitchen sync, and point-of-sale handoff from one unified waiter workspace."
    : "Manage live floor activity, kitchen sync, and point-of-sale transactions from one unified resort sanctuary.";

  const activeSectionLabel = activeLink?.label || (actor.isWaiter ? "My Tables" : "Tables");

  return (
    <div className="relative isolate w-full max-w-full overflow-x-hidden bg-[#f4f7fc] p-2.5 xs:p-3 sm:p-5 lg:p-6">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[-8%] top-[-10%] h-72 w-72 rounded-full bg-blue-200/40 blur-3xl sm:h-96 sm:w-96" />
        <div className="absolute right-[-12%] top-[3%] h-80 w-80 rounded-full bg-sky-200/40 blur-3xl sm:h-[28rem] sm:w-[28rem]" />
        <div className="absolute bottom-[10%] left-[22%] h-60 w-60 rounded-full bg-blue-100/50 blur-3xl sm:h-80 sm:w-80" />
      </div>

      <div className="w-full max-w-full space-y-4 sm:space-y-6">
        {/* HERO
        <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-blue-950 via-blue-900 via-blue-700 to-sky-500 px-6 py-8 shadow-[0_25px_50px_-12px_rgba(23,54,120,0.35)] sm:px-9 sm:py-9">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
              backgroundSize: "26px 26px",
            }}
          />
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-sky-300/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-blue-400/20 blur-3xl" />

          <div className="relative space-y-6">
            <div className="max-w-3xl space-y-3">
              <div className="space-y-2.5">
                <h1 className="text-[32px] font-bold leading-tight tracking-[-0.03em] text-white sm:text-[46px]">
                  {heroTitle}
                </h1>
                <p className="max-w-3xl text-[18px] font-medium leading-8 text-blue-50/90 sm:text-[20px] sm:leading-8">
                  {heroCopy}
                </p>
              </div>

              <div className="flex flex-wrap gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => navigate(activeLink.path)}
                  className="inline-flex h-[52px] items-center gap-2.5 rounded-2xl bg-white px-6 text-[17px] font-bold text-[#1155b6] shadow-[0_12px_28px_rgba(7,23,65,0.20)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(7,23,65,0.26)] active:translate-y-0"
                >
                  <FaExternalLinkAlt className="text-[16px]" />
                  Open Active Section
                </button>

                {!actor.isWaiter ? (
                  <button
                    type="button"
                    onClick={() => navigate("/kitchen")}
                    className="inline-flex h-[52px] items-center gap-2.5 rounded-2xl border border-white/25 bg-white/10 px-6 text-[17px] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-md transition duration-200 hover:-translate-y-0.5 hover:bg-white/18"
                  >
                    <FaUtensils className="text-[16px]" />
                    Go To Kitchen
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </section>
        */}

        {/* NAV TABS */}
        <section className="rounded-2xl bg-white/90 p-2 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-blue-100/70 backdrop-blur-sm sm:rounded-[24px] sm:p-2.5">
          <div className="flex flex-nowrap gap-2 overflow-x-auto scrollbar-none sm:flex-wrap sm:gap-2.5 sm:overflow-visible">
            {links.map((link) => {
              const Icon = link.icon || FaUtensils;
              const active = isLinkActive(link.path);

              return (
                <button
                  key={`${link.path}-${link.label}`}
                  type="button"
                  onClick={() => navigate(link.path)}
                  className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2.5 text-[13px] font-bold transition duration-200 xs:px-4 xs:text-[14px] sm:gap-2.5 sm:px-5 sm:py-3 sm:text-[16px] lg:text-[17px] ${
                    active
                      ? "bg-gradient-to-r from-blue-700 to-sky-500 text-white shadow-[0_10px_22px_rgba(31,103,223,0.28)]"
                      : "bg-[#eef3fb] text-[#3c4a68] hover:bg-[#e2ebfa] hover:text-[#1f2a44]"
                  }`}
                >
                  <Icon className={`text-[13px] sm:text-[16px] ${active ? "text-white" : "text-[#3f6099]"}`} />
                  {link.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* COMMAND CENTER / OUTLET */}
        <section className="w-full max-w-full">
          <div className="w-full max-w-full rounded-2xl border border-blue-100/60 bg-white/90 p-2.5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl xs:p-3 sm:rounded-[26px] sm:p-4">
            <div className="mb-3 flex flex-col gap-3 rounded-2xl bg-gradient-to-b from-[#f8fbff] to-[#eef4ff] px-4 py-4 ring-1 ring-blue-100/70 sm:mb-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3 sm:rounded-[20px] sm:px-5">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#6a7a96] sm:text-[13px]">
                  Restaurant Command Center
                </p>
                <h2 className="mt-1 text-[22px] font-bold leading-tight text-[#1f2a44] xs:text-[24px] sm:text-[30px] lg:text-[32px]">
                  {activeSectionLabel}
                </h2>
              </div>
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[#eaf2ff] px-3.5 py-1.5 text-[12px] font-bold uppercase tracking-[0.08em] text-[#1f67df] ring-1 ring-blue-100 sm:px-4 sm:py-2 sm:text-[15px] lg:text-[16px]">
                <FaReceipt className="text-[11px] sm:text-[13px]" />
                Live workspace
              </span>
            </div>
            <div className="w-full max-w-full overflow-x-hidden">
              <Outlet />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default RestaurantPOS;