const TONE_RING = {
  "bg-slate-700": "ring-slate-200/60",
  "bg-blue-600": "ring-blue-200/60",
  "bg-amber-500": "ring-amber-200/60",
  "bg-emerald-500": "ring-emerald-200/60",
  "bg-blue-500": "ring-sky-200/60",
  "bg-amber-400": "ring-orange-200/60",
  "bg-slate-900": "ring-slate-300/60",
};

const TONE_ACCENT = {
  "bg-slate-700": "from-slate-500/15 via-slate-400/10 to-transparent",
  "bg-blue-600": "from-blue-500/15 via-blue-400/10 to-transparent",
  "bg-amber-500": "from-amber-500/20 via-amber-400/10 to-transparent",
  "bg-emerald-500": "from-emerald-500/15 via-emerald-400/10 to-transparent",
  "bg-blue-500": "from-sky-500/15 via-sky-400/10 to-transparent",
  "bg-amber-400": "from-orange-500/20 via-orange-400/10 to-transparent",
  "bg-slate-900": "from-slate-700/15 via-slate-500/10 to-transparent",
};

const TONE_TEXT = {
  "bg-slate-700": "text-slate-700",
  "bg-blue-600": "text-blue-700",
  "bg-amber-500": "text-amber-700",
  "bg-emerald-500": "text-emerald-700",
  "bg-blue-500": "text-sky-700",
  "bg-amber-400": "text-orange-700",
  "bg-slate-900": "text-slate-800",
};

const MetricCard = ({ title, value, subtitle, icon: Icon, gradient, onClick }) => {
  const iconEl = Icon ? <Icon className="text-[15px] sm:text-[18px]" /> : null;
  const ring = TONE_RING[gradient] || "ring-slate-200/60";
  const accent = TONE_ACCENT[gradient] || "from-slate-500/10 via-slate-400/5 to-transparent";
  const toneText = TONE_TEXT[gradient] || "text-slate-700";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        group relative h-full min-h-[118px] w-full cursor-pointer overflow-hidden
        rounded-2xl bg-white p-3 text-left ring-1 ${ring}
        shadow-[0_10px_30px_rgba(15,23,42,0.06)]
        transition-all duration-300 ease-out
        hover:-translate-y-1 hover:shadow-[0_22px_48px_rgba(15,23,42,0.12)]
        focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-2
        sm:min-h-[134px] sm:p-4 xl:p-5
      `}
    >
      {/* Gradient accent corner */}
      <div
        className={`pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-gradient-to-br ${accent} blur-2xl transition-all duration-500 group-hover:scale-125 group-hover:opacity-90`}
      />

      {/* Subtle bottom glow on hover */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <div className="relative flex h-full flex-col justify-between gap-2 sm:gap-3">
        <div className="flex items-start justify-between gap-2 sm:gap-3">
          <div className="min-w-0 flex-1">
            <div className={`inline-flex w-fit max-w-full items-center gap-1.5 rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] sm:px-2.5 sm:py-1 sm:text-[11px] sm:tracking-[0.14em] ${toneText}`}>
              <span className={`block h-1.5 w-1.5 shrink-0 rounded-full ${gradient} shadow-[0_0_0_3px_rgba(255,255,255,0.85)]`} />
              <span className="min-w-0 whitespace-normal break-words leading-tight">{title}</span>
            </div>
          </div>

          <div
            className={`
              flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white
              shadow-[0_8px_18px_rgba(15,23,42,0.18)] transition-transform duration-300
              group-hover:scale-110 group-hover:rotate-[-4deg]
              sm:h-11 sm:w-11 sm:rounded-2xl xl:h-12 xl:w-12 ${gradient}
            `}
          >
            {iconEl}
          </div>
        </div>

        <div className="min-w-0">
          <h2 className="dash-metric-value break-words text-[22px] leading-tight sm:text-[26px] xl:text-[28px]">
            {value}
          </h2>
          <p className="dash-metric-copy mt-1 line-clamp-2 text-[12px] sm:mt-1.5 sm:text-[13px]">
            {subtitle}
          </p>
        </div>
      </div>
    </button>
  );
};

export default MetricCard;