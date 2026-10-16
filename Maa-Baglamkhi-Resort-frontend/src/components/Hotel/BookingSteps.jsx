import { NavLink, useLocation, useNavigate } from "react-router-dom";

const WIZARD_STEPS = [
  { name: "Guest", path: "/hotel/guest" },
  { name: "Booking Type", path: "/hotel/other-booking" },
  { name: "Reference", path: "/hotel/reference" },
  { name: "Company", path: "/hotel/company" },
  { name: "Room", path: "/hotel/room" },
  { name: "Pax", path: "/hotel/pax" },
  { name: "Tariff", path: "/hotel/room-tariff" },
  { name: "Advance", path: "/hotel/advance" },
  { name: "Invoice", path: "/hotel/communication" },
];

const MGMT_LINKS = [
  { name: "All Bookings", path: "/hotel/all-bookings" },
  { name: "Booking History", path: "/hotel/booking-history" },
  { name: "Group Booking", path: "/hotel/group-booking" },
  { name: "Guest Profile", path: "/hotel/guest-profile" },
  { name: "Folio / Audit", path: "/hotel/folio" },
  { name: "Room Maintenance", path: "/hotel/room-maintenance" },
  { name: "Occ Forecast", path: "/hotel/occupancy-forecast" },
];

const linkClassName = ({ isActive }) =>
  `text-[15px] font-bold leading-none transition xl:text-[16px] 2xl:text-[17px] ${
    isActive ? "text-sky-600" : "text-slate-700 hover:text-sky-600"
  }`;

const actionButtonClassName = (isActive) =>
  `rounded-full border border-sky-200/70 bg-[linear-gradient(135deg,rgba(219,234,254,0.72),rgba(191,219,254,0.38))] px-4 py-2 text-[15px] font-bold leading-none text-sky-950 shadow-[0_10px_28px_rgba(59,130,246,0.16)] backdrop-blur-md transition xl:px-4.5 xl:py-2.5 xl:text-[16px] 2xl:text-[17px] ${
    isActive
      ? "border-sky-300/80 bg-[linear-gradient(135deg,rgba(191,219,254,0.92),rgba(125,211,252,0.52))] text-blue-950 shadow-[0_14px_34px_rgba(37,99,235,0.22)]"
      : "hover:border-sky-300/80 hover:bg-[linear-gradient(135deg,rgba(219,234,254,0.84),rgba(186,230,253,0.46))] hover:text-blue-950"
  }`;

const BookingSteps = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const activeQuickAction =
    new URLSearchParams(location.search).get("mode") || location.state?.bookingAction || "";

  return (
    <div className="mx-auto flex w-full max-w-full flex-col gap-4 xl:flex-row xl:items-center xl:gap-4 2xl:gap-5">
      <div className="min-w-0 xl:flex-none">
         <div className="flex flex-nowrap items-center gap-3 overflow-x-auto whitespace-nowrap xl:gap-4 2xl:gap-5">
          {WIZARD_STEPS.map((step) => (
            <NavLink
              key={step.path}
              to={step.path}
              state={location.state}
              className={linkClassName}
            >
              {step.name}
            </NavLink>
          ))}
        </div>
      </div>

      <div className="flex flex-nowrap items-center justify-center gap-2 border-y border-slate-100 py-4 xl:mx-auto xl:border-y-0 xl:border-x xl:px-4 xl:py-0">
        <button
          type="button"
          onClick={() =>
            navigate(
              { pathname: "/hotel/communication", search: "?mode=check-in" },
              { state: { bookingAction: "check-in" } },
            )
          }
          className={actionButtonClassName(activeQuickAction === "check-in")}
        >
          Check In
        </button>
        <button
          type="button"
          onClick={() =>
            navigate(
              { pathname: "/hotel/communication", search: "?mode=check-out" },
              { state: { bookingAction: "check-out" } },
            )
          }
          className={actionButtonClassName(activeQuickAction === "check-out")}
        >
          Check Out
        </button>
      </div>

      <div className="min-w-0 xl:flex-none">
          <div className="flex flex-nowrap items-center gap-3 overflow-x-auto whitespace-nowrap xl:justify-end xl:gap-4 2xl:gap-5">
          {MGMT_LINKS.map((link) => (
           <NavLink key={link.path} to={link.path} state={location.state} className={linkClassName}>
              {link.name}
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BookingSteps;
