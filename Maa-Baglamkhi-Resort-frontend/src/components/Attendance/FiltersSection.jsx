import { FaCalendarAlt, FaSearch, FaUserPlus } from "react-icons/fa";

/* Premium field styles for filter inputs
   Mobile-first sizing, scaling up through tablet/iPad, landing on the
   EXACT original values at xl (≥1280px = Desktop) */
const fieldCls = `
w-full
h-[52px]
md:h-[56px]
xl:h-[60px]

rounded-[16px]
md:rounded-[18px]
xl:rounded-[20px]

border
border-blue-100

bg-white

px-4
pl-12
md:px-5
md:pl-14

text-[15px]
md:text-[16px]
xl:text-[17px]
font-medium
text-slate-700

shadow-[0_2px_16px_rgba(30,64,175,0.04)]

outline-none

transition-all
duration-300

focus:border-blue-500
focus:ring-[6px]
focus:ring-blue-100/80
focus:shadow-[0_4px_24px_rgba(37,99,235,0.12)]

hover:border-blue-300
hover:shadow-[0_4px_20px_rgba(37,99,235,0.08)]
`;

const FiltersSection = ({
  date,
  department,
  role,
  searchQuery,
  onDateChange,
  onDepartmentChange,
  onRoleChange,
  onSearchChange,
  onAddManualEntry,
  showAddButton = true,
}) => {
  return (
    <section
      className="
      relative
      overflow-hidden

      rounded-[20px]
      sm:rounded-[24px]
      md:rounded-[28px]
      xl:rounded-[32px]

      bg-gradient-to-br
      from-blue-950
      via-blue-800
      to-sky-500

      p-5
      sm:p-6
      md:p-8
      xl:p-10

      shadow-[0_16px_40px_rgba(30,64,175,0.2)]
      xl:shadow-[0_30px_80px_rgba(30,64,175,0.25)]
    "
    >
      {/* Wave Background Decoration */}
      <div className="absolute inset-0 opacity-[0.06]">
        <svg
          viewBox="0 0 1440 320"
          className="absolute -bottom-4 left-0 h-full w-full"
          preserveAspectRatio="none"
        >
          <path
            fill="white"
            d="M0,224L48,213.3C96,203,192,181,288,181.3C384,181,480,203,576,224C672,245,768,267,864,261.3C960,256,1056,224,1152,197.3C1248,171,1344,149,1392,138.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
          />
        </svg>
      </div>

      {/* Content */}
      <div className="relative min-w-0">
        {/* Header Row */}
        <div className="flex flex-col gap-4 md:gap-5 xl:flex-row xl:items-center xl:justify-between mb-6 md:mb-8">
          {/* Left Side */}
          <div className="min-w-0">
            {/* Attendance Badge */}
            <div className="inline-flex items-center gap-2.5 md:gap-3 rounded-full bg-white/15 px-4 py-2 md:px-5 md:py-2.5">
              <span className="h-2.5 w-2.5 md:h-3 md:w-3 rounded-full bg-sky-400 shrink-0"></span>
              <span className="text-[12px] md:text-[13px] xl:text-[14px] font-bold uppercase tracking-[0.15em] xl:tracking-[0.2em] text-white/90">
                Attendance
              </span>
            </div>

            {/* Title */}
            <h2 className="mt-4 md:mt-5 text-[24px] sm:text-[28px] md:text-[32px] xl:text-[36px] font-extrabold text-white leading-tight break-words">
              Attendance Dashboard
            </h2>

            {/* Subtitle */}
            <p className="mt-2.5 md:mt-3 text-[15px] md:text-[16px] xl:text-[18px] font-medium text-blue-100/90">
              Filter employees by date, role, department and search.
            </p>
          </div>

          {/* Right Side - Add Button */}
          {showAddButton && (
            <button
              onClick={onAddManualEntry}
              className="
              inline-flex
              items-center
              justify-center
              gap-2.5
              md:gap-3

              w-full
              xl:w-auto

              rounded-[16px]
              md:rounded-[18px]
              xl:rounded-[20px]

              bg-gradient-to-r
              from-blue-600
              via-blue-500
              to-sky-500

              px-6
              md:px-7
              xl:px-8

              h-[50px]
              md:h-[54px]
              xl:h-[58px]

              text-[14px]
              md:text-[16px]
              xl:text-[18px]
              font-bold
              text-white

              shadow-[0_10px_28px_rgba(37,99,235,0.3)]
              xl:shadow-[0_20px_45px_rgba(37,99,235,0.35)]

              transition-all
              duration-300

              hover:-translate-y-1
              hover:scale-[1.03]
            "
            >
              <FaUserPlus className="text-lg md:text-xl shrink-0" />
              Add Manual Entry
            </button>
          )}
        </div>

        {/* Filters Grid */}
        <div className="relative grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-5">
          {/* Date */}
          <div className="min-w-0">
            <label className="mb-2 md:mb-3 block text-[13px] md:text-[14px] xl:text-[16px] font-bold uppercase tracking-[0.08em] xl:tracking-[0.1em] text-blue-100/80">
              Date
            </label>
            <div className="relative">
              <FaCalendarAlt className="absolute left-4 md:left-5 top-1/2 -translate-y-1/2 text-blue-300 text-base md:text-lg pointer-events-none" />
              <input
                type="date"
                value={date}
                onChange={(e) => onDateChange(e.target.value)}
                className={`${fieldCls} !pl-12 md:!pl-14`}
              />
            </div>
          </div>

          {/* Department */}
          <div className="min-w-0">
            <label className="mb-2 md:mb-3 block text-[13px] md:text-[14px] xl:text-[16px] font-bold uppercase tracking-[0.08em] xl:tracking-[0.1em] text-blue-100/80">
              Department
            </label>
            <select
              value={department}
              onChange={(e) => onDepartmentChange(e.target.value)}
              className={`${fieldCls} !pl-4 md:!pl-5`}
            >
              <option>All Departments</option>
              <option>Reception</option>
              <option>Kitchen</option>
              <option>Housekeeping</option>
              <option>Management</option>
              <option>Security</option>
            </select>
          </div>

          {/* Role */}
          <div className="min-w-0">
            <label className="mb-2 md:mb-3 block text-[13px] md:text-[14px] xl:text-[16px] font-bold uppercase tracking-[0.08em] xl:tracking-[0.1em] text-blue-100/80">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => onRoleChange(e.target.value)}
              className={`${fieldCls} !pl-4 md:!pl-5`}
            >
              <option>All Roles</option>
              <option>Manager</option>
              <option>Staff</option>
              <option>Receptionist</option>
              <option>Housekeeping</option>
              <option>Security</option>
            </select>
          </div>

          {/* Search Employee */}
          <div className="min-w-0">
            <label className="mb-2 md:mb-3 block text-[13px] md:text-[14px] xl:text-[16px] font-bold uppercase tracking-[0.08em] xl:tracking-[0.1em] text-blue-100/80">
              Search Employee
            </label>
            <div className="relative">
              <FaSearch className="absolute left-4 md:left-5 top-1/2 -translate-y-1/2 text-blue-300 text-base md:text-lg pointer-events-none" />
              <input
                type="text"
                placeholder="Search employee..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className={`${fieldCls} !pl-12 md:!pl-14`}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FiltersSection;