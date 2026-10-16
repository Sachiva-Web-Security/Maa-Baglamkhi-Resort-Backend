import { Link } from "react-router-dom";

/* ─── Shared tokens ─────────────────────────────────────────────────── */
const fallback = "--";

/* ─── Hero stat card (inside hero header) ──────────────────────────── */
const HeroStatCard = ({ card }) => {
  const Icon = card.icon;
  return (
    <div className="group relative overflow-hidden rounded-2xl sm:rounded-[22px] border border-white/25 bg-white/10 p-3.5 sm:p-4 lg:p-5 backdrop-blur-md transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:bg-white/15 hover:shadow-[0_18px_40px_rgba(2,6,23,0.35)]">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-white/10 via-white/5 to-transparent opacity-70" />
      <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.12em] sm:tracking-[0.18em] text-sky-100/85">
        {Icon ? (
          <span className="inline-flex h-5 w-5 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded-md sm:rounded-lg border border-white/25 bg-white/15 text-[10px] sm:text-xs text-white">
            <Icon />
          </span>
        ) : null}
        <span className="leading-tight truncate">{card.label}</span>
      </div>
      <div className="mt-1.5 sm:mt-3 text-lg sm:text-2xl lg:text-3xl font-extrabold leading-none text-white">
        {card.value ?? fallback}
      </div>
    </div>
  );
};

/* ─── Stat card (below hero) ─────────────────────────────────────────── */
const StatCard = ({ card }) => {
  const Icon = card.icon;
  const tone = {
    cyan: {
      border: "border-l-cyan-500",
      icon: "bg-cyan-100 text-cyan-600",
      label: "text-cyan-600",
      glow: "from-cyan-500/15 to-sky-500/10",
    },
    amber: {
      border: "border-l-amber-500",
      icon: "bg-amber-100 text-amber-600",
      label: "text-amber-600",
      glow: "from-amber-500/15 to-orange-500/10",
    },
    emerald: {
      border: "border-l-emerald-500",
      icon: "bg-emerald-100 text-emerald-600",
      label: "text-emerald-600",
      glow: "from-emerald-500/15 to-teal-500/10",
    },
    violet: {
      border: "border-l-violet-500",
      icon: "bg-violet-100 text-violet-600",
      label: "text-violet-600",
      glow: "from-violet-500/15 to-fuchsia-500/10",
    },
  }[card.tone] || {
    border: "border-l-slate-500",
    icon: "bg-slate-100 text-slate-600",
    label: "text-slate-600",
    glow: "from-slate-500/10 to-slate-400/5",
  };

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl sm:rounded-[22px] lg:rounded-[26px] border border-[#E6EEF8] bg-white p-4 sm:p-6 lg:p-7 shadow-[0_10px_30px_rgba(15,23,42,0.06)] transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-[0_20px_45px_rgba(15,23,42,0.10)] ${tone.border} border-l-[5px] sm:border-l-[6px]`}
    >
      <div
        className={`pointer-events-none absolute -right-6 sm:-right-10 -top-6 sm:-top-10 h-20 sm:h-24 md:h-32 w-20 sm:w-24 md:w-32 rounded-full bg-gradient-to-br ${tone.glow} blur-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
      />
      <div className="relative flex items-start gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className={`text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.12em] sm:tracking-[0.2em] ${tone.label}`}>
            <span className="block truncate">{card.label}</span>
          </div>
          <div className="mt-1.5 sm:mt-3 text-[26px] sm:text-[34px] lg:text-[40px] font-extrabold leading-none text-[#0F172A]">
            {card.value ?? fallback}
          </div>
          <div className="mt-1.5 sm:mt-3 text-[12px] sm:text-[13px] lg:text-[15px] leading-5 sm:leading-6 text-[#64748B] line-clamp-2">{card.note}</div>
        </div>
        {Icon ? (
          <span
            className={`inline-flex h-9 w-9 sm:h-12 sm:w-12 lg:h-14 lg:w-14 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl text-sm sm:text-lg lg:text-xl ${tone.icon} transition-transform duration-300 ease-in-out group-hover:scale-105`}
          >
            <Icon />
          </span>
        ) : null}
      </div>
    </div>
  );
};

/* ─── Quick Action card ─────────────────────────────────────────────── */
const QuickAction = ({ action }) => {
  const Icon = action.icon;
  const tone = {
    cyan: "from-blue-500 to-sky-500",
    emerald: "from-emerald-500 to-teal-500",
    amber: "from-amber-500 to-orange-500",
    rose: "from-rose-500 to-pink-500",
    violet: "from-violet-500 to-fuchsia-500",
  }[action.tone] || "from-blue-500 to-sky-500";

  return (
    <Link
      to={action.route}
      className="group relative flex h-full flex-col rounded-2xl sm:rounded-[22px] lg:rounded-[26px] border border-[#E6EEF8] bg-white p-4 sm:p-5 md:p-6 shadow-[0_10px_30px_rgba(15,23,42,0.06)] transition-all duration-300 ease-in-out hover:-translate-y-1 hover:border-[#cfe0f5] hover:shadow-[0_20px_45px_rgba(37,99,235,0.16)]"
    >
      <div className="flex items-start justify-between">
        <div
          className={`inline-flex h-9 w-9 sm:h-12 sm:w-12 lg:h-14 lg:w-14 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-br ${tone} text-sm sm:text-base md:text-lg lg:text-xl text-white shadow-[0_8px_20px_rgba(37,99,235,0.25)] transition-transform duration-300 ease-in-out group-hover:scale-105`}
        >
          {Icon ? <Icon /> : null}
        </div>
        <span className="inline-flex h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 lg:h-10 lg:w-10 items-center justify-center rounded-full border border-[#E6EEF8] text-xs sm:text-sm md:text-base text-[#2563EB] transition-all duration-300 ease-in-out group-hover:translate-x-1 group-hover:border-[#2563EB] group-hover:bg-blue-50">
          →
        </span>
      </div>
      <div className="mt-2.5 sm:mt-3 md:mt-5 text-[15px] sm:text-[17px] md:text-[18px] lg:text-[20px] font-bold text-[#0F172A]">{action.label}</div>
      <div className="mt-1 text-[12px] sm:text-[13px] md:text-[15px] leading-5 sm:leading-6 text-[#64748B]">{action.helper}</div>
    </Link>
  );
};

/* ─── Insight row (Operational Highlights) ─────────────────────────── */
const InsightCard = ({ item, tone }) => {
  const accent = {
    cyan: {
      soft: "bg-cyan-50",
      icon: "bg-cyan-100 text-cyan-600",
    },
    amber: {
      soft: "bg-amber-50",
      icon: "bg-amber-100 text-amber-600",
    },
    emerald: {
      soft: "bg-emerald-50",
      icon: "bg-emerald-100 text-emerald-600",
    },
    violet: {
      soft: "bg-violet-50",
      icon: "bg-violet-100 text-violet-600",
    },
  }[tone] || {
    soft: "bg-slate-50",
    icon: "bg-slate-100 text-slate-600",
  };
  const Icon = item.icon;
  return (
    <div className="group flex items-center gap-2.5 sm:gap-4 rounded-2xl sm:rounded-[18px] lg:rounded-[20px] border border-[#E6EEF8] bg-white px-3.5 py-3 sm:px-4 sm:py-4 transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-[0_10px_25px_rgba(15,23,42,0.08)]">
      {Icon ? (
        <span className={`inline-flex h-9 w-9 sm:h-11 sm:w-11 lg:h-12 lg:w-12 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl text-sm sm:text-lg ${accent.icon}`}>
          <Icon />
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] sm:tracking-[0.2em] text-[#64748B]">
          <span className="block truncate">{item.label}</span>
        </div>
        <div className="mt-0.5 flex items-baseline gap-1.5 sm:gap-2">
          <div className="text-[18px] sm:text-[20px] md:text-[22px] lg:text-[26px] font-extrabold leading-none text-[#0F172A]">
            {item.value ?? fallback}
          </div>
          <div className="truncate text-[12px] sm:text-[13px] lg:text-[14px] text-[#64748B]">{item.note}</div>
        </div>
      </div>
    </div>
  );
};

/* ─── Data Table ───────────────────────────────────────────────────── */
const DataTable = ({ table }) => {
  if (!table) return null;

  return (
    <section className="overflow-hidden rounded-[20px] sm:rounded-[24px] lg:rounded-[28px] border border-[#E6EEF8] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4 border-b border-[#E6EEF8] bg-gradient-to-r from-[#F1F6FF] via-[#F4F8FF] to-white px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <div>
          <div className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.2em] sm:tracking-[0.24em] text-[#2563EB]">
            {table.eyebrow || "Detail View"}
          </div>
          <h2 className="mt-1 sm:mt-2 text-[22px] sm:text-[26px] lg:text-[28px] font-bold leading-tight text-[#0F172A]">
            {table.title}
          </h2>
        </div>
        {table.meta ? (
          <div className="inline-flex items-center rounded-full border border-[#E6EEF8] bg-white px-3 py-1.5 text-[12px] sm:text-[13px] font-semibold text-[#2563EB] shadow-sm">
            {table.meta}
          </div>
        ) : null}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full text-left">
          <thead className="bg-gradient-to-r from-[#F8FAFF] to-[#F1F6FF] text-[11px] sm:text-[12px] uppercase tracking-[0.14em] sm:tracking-[0.16em] text-[#64748B]">
            <tr>
              {table.columns.map((column) => (
                <th key={column.key} className="px-4 py-3.5 sm:px-6 sm:py-4 lg:px-8 font-bold">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.length ? (
              table.rows.map((row, index) => (
                <tr
                  key={row.id || row.key || index}
                  className="group border-t border-[#E6EEF8] transition-colors duration-300 ease-in-out hover:bg-[#F4F8FF]"
                >
                  {table.columns.map((column) => (
                    <td
                      key={column.key}
                      className="px-4 py-4 sm:px-6 sm:py-5 text-[13px] sm:text-[15px] font-medium text-[#0F172A] lg:px-8"
                    >
                      {column.render ? column.render(row, index) : row[column.key] ?? fallback}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={table.columns.length} className="px-4 py-14 text-center sm:py-16 lg:py-20">
                  <div className="mx-auto flex max-w-md flex-col items-center gap-3">
                    <span className="inline-flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-xl sm:rounded-2xl bg-blue-50 text-xl sm:text-2xl text-[#2563EB]">
                      📭
                    </span>
                    <div className="text-[18px] sm:text-[20px] font-bold text-[#0F172A]">No records available</div>
                    <div className="text-[13px] sm:text-[15px] text-[#64748B]">
                      {table.emptyText || "Once data arrives, it will appear here in a clean list."}
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden divide-y divide-[#E6EEF8]">
        {table.rows.length ? (
          table.rows.map((row, index) => (
            <div
              key={row.id || row.key || index}
              className="p-4 transition-colors duration-200 hover:bg-[#F8FAFF]"
            >
              <div className="flex flex-col gap-2.5">
                {table.columns.map((column) => {
                  const rawValue = column.render ? column.render(row, index) : row[column.key] ?? fallback;
                  const value = typeof rawValue === "string" ? rawValue : String(rawValue ?? fallback);
                  if (value === "--" && column.key !== "status") return null;
                  return (
                    <div key={column.key} className="flex items-start justify-between gap-3">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#64748B] shrink-0 pt-0.5">
                        {column.label}
                      </span>
                      <span className={`text-[13px] sm:text-[14px] font-medium text-[#0F172A] text-right break-all ${
                        column.key === "status"
                          ? "inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-[11px] sm:text-[12px] font-semibold text-[#2563EB]"
                          : ""
                      }`}>
                        {column.key === "status" ? value : value}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center gap-3 px-4 py-14 text-center">
            <span className="inline-flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-xl sm:rounded-2xl bg-blue-50 text-xl sm:text-2xl text-[#2563EB]">
              📭
            </span>
            <div className="text-[18px] sm:text-[20px] font-bold text-[#0F172A]">No records available</div>
            <div className="text-[13px] sm:text-[15px] text-[#64748B]">
              {table.emptyText || "Once data arrives, it will appear here in a clean list."}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

/* ─── Premium Reception Dashboard Layout ────────────────────────────── */
const ReceptionDashboardLayout = ({
  badge,
  title,
  description,
  stats = [],
  quickActions = [],
  insights = [],
  table,
  loading = false,
  error = "",
}) => {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#F8FAFC] px-3 py-5 sm:px-4 sm:py-6 md:px-6 md:py-8 lg:px-10 lg:py-10 xl:px-10 xl:py-10">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-16 -top-16 h-64 w-64 rounded-full bg-blue-200/35 blur-3xl sm:h-72 sm:w-72 md:h-96 md:w-96" />
        <div className="absolute -right-8 -top-8 h-64 w-64 rounded-full bg-sky-200/30 blur-3xl sm:h-72 sm:w-72 md:h-[28rem] md:w-[28rem] md:right-[-12%] md:top-[10%]" />
        <div className="absolute bottom-[5%] right-[10%] h-48 w-48 rounded-full bg-indigo-200/20 blur-3xl sm:h-56 sm:w-56 sm:bottom-[8%] md:h-80 md:w-80 md:bottom-[10%] md:left-[20%] md:right-auto" />
      </div>

      <div className="relative w-full space-y-6 sm:space-y-8 lg:space-y-10">
        {/* ─── Hero ─── */}
        <section className="relative overflow-hidden rounded-[20px] sm:rounded-[24px] lg:rounded-[30px] border border-white/10 bg-gradient-to-br from-blue-950 via-blue-800 to-sky-500 px-5 py-7 text-white shadow-[0_22px_50px_rgba(2,6,23,0.35)] sm:px-8 sm:py-10 lg:px-10 lg:py-12">
          <div className="pointer-events-none absolute inset-0 -z-0 overflow-hidden">
            <div className="absolute -left-20 -top-24 h-72 w-72 rounded-full bg-sky-400/30 blur-3xl" />
            <div className="absolute right-[-10%] top-[10%] h-80 w-80 rounded-full bg-blue-500/25 blur-3xl" />
            <div className="absolute bottom-[-40%] left-[30%] h-[26rem] w-[26rem] rounded-full bg-indigo-500/20 blur-3xl" />
            <svg
              className="absolute inset-x-0 bottom-[-1px] h-24 w-full text-white/10"
              viewBox="0 0 1440 320"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                fill="currentColor"
                d="M0,160L60,176C120,192,240,224,360,213.3C480,203,600,149,720,138.7C840,128,960,160,1080,176C1200,192,1320,192,1380,192L1440,192L1440,320L1380,320C1320,320,1200,320,1080,320C960,320,840,320,720,320C600,320,480,320,360,320C240,320,120,320,60,320L0,320Z"
              />
            </svg>
            <svg
              className="absolute inset-x-0 top-1/2 h-32 w-full -translate-y-1/2 text-white/5"
              viewBox="0 0 1440 200"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                d="M0,100 C240,40 480,160 720,100 C960,40 1200,160 1440,100"
              />
            </svg>
          </div>

          <div className="relative grid items-stretch gap-6 sm:gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.95fr)] lg:gap-10">
            <div className="flex flex-col justify-center">
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.18em] sm:tracking-[0.24em] text-sky-100 backdrop-blur-md">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-200" />
                {badge}
              </span>
              <h1 className="mt-3 sm:mt-5 text-[28px] font-extrabold leading-[1.1] tracking-tight text-white sm:text-[36px] md:text-[40px] lg:text-[46px]">
                {title}
              </h1>
              <p className="mt-3 sm:mt-4 max-w-2xl text-[15px] sm:text-[17px] md:text-[18px] font-medium leading-6 sm:leading-7 text-sky-100/85">
                {description}
              </p>
              <div className="mt-4 sm:mt-5 flex flex-wrap items-center gap-2 text-[12px] sm:text-[13px] text-sky-100/80">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 backdrop-blur-md">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Live · Auto refreshed
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 backdrop-blur-md">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-200" /> {stats.length} key metrics
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:gap-4">
              {stats.slice(0, 4).map((card) => (
                <HeroStatCard key={card.label} card={card} />
              ))}
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-[18px] sm:rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3.5 text-[13px] sm:text-[15px] font-semibold text-rose-700 shadow-sm">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="inline-flex w-full items-center justify-center gap-3 rounded-[18px] sm:rounded-[22px] border border-sky-200 bg-sky-50 px-4 py-3.5 text-[13px] sm:text-[15px] font-semibold text-sky-700 shadow-sm">
            <span className="inline-block h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
            Dashboard data loading...
          </div>
        ) : null}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((card) => (
            <StatCard key={card.label} card={card} />
          ))}
        </section>

      <section className="grid grid-cols-1 gap-5 md:gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
  {/* Quick Actions */}
  <div className="rounded-2xl sm:rounded-3xl border border-[#E6EEF8] bg-white p-4 sm:p-6 lg:p-8 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
    <div className="mb-5 flex items-start justify-between">
      <div className="min-w-0">
        <div className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.2em] text-[#2563EB]">
          Quick Actions
        </div>

        <h2 className="mt-2 text-xl sm:text-2xl lg:text-[26px] font-bold leading-tight text-[#0F172A]">
          Jump to active workflow
        </h2>
      </div>

      <span className="hidden sm:flex h-11 w-11 lg:h-12 lg:w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#2563EB]">
        ⚡
      </span>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
      {quickActions.map((action) => (
        <QuickAction key={action.label} action={action} />
      ))}
    </div>
  </div>

  {/* Snapshot */}
  <div className="rounded-2xl sm:rounded-3xl border border-[#E6EEF8] bg-white p-4 sm:p-6 lg:p-8 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
    <div className="mb-5 flex items-start justify-between">
      <div className="min-w-0">
        <div className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.2em] text-[#2563EB]">
          Snapshot
        </div>

        <h2 className="mt-2 text-xl sm:text-2xl lg:text-[26px] font-bold leading-tight text-[#0F172A]">
          Operational highlights
        </h2>
      </div>

      <span className="hidden sm:flex h-11 w-11 lg:h-12 lg:w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#2563EB]">
        📊
      </span>
    </div>

    <div className="space-y-3 sm:space-y-4">
      {insights.map((item, index) => (
        <InsightCard
          key={item.label}
          item={item}
          tone={["cyan", "amber", "emerald", "violet"][index % 4]}
        />
      ))}
    </div>
  </div>
</section>
        <DataTable table={table} />
      </div>
    </div>
  );
};

export { ReceptionDashboardLayout };
export default ReceptionDashboardLayout;
