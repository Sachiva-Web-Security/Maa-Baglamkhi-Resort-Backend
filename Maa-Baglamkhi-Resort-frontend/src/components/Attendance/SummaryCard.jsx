const SummaryCard = ({ label, value, color, icon: Icon }) => {
  const colors = {
    green: "bg-emerald-500",
    red: "bg-rose-500",
    yellow: "bg-amber-500",
    amber: "bg-amber-500",
    blue: "bg-blue-600",
    emerald: "bg-emerald-500",
  };

  return (
    <div
      className="
      rounded-[16px]
      sm:rounded-[18px]
      border
      border-blue-100

      bg-white

      p-3.5
      sm:p-4

      shadow-[0_4px_12px_rgba(30,64,175,0.04)]
      xl:shadow-[0_6px_16px_rgba(30,64,175,0.04)]

      min-w-0
    "
    >
      {/* Colored Icon */}
      {Icon && (
        <div
          className={`
            inline-flex
            h-8
            w-8
            md:h-9
            md:w-9
            items-center
            justify-center

            rounded-[9px]
            md:rounded-[10px]

            text-white

            ${colors[color] || "bg-blue-600"}
          `}
        >
          <Icon size={14} className="md:hidden" />
          <Icon size={15} className="hidden md:block" />
        </div>
      )}

      {/* Label */}
      <div className="mt-2.5 sm:mt-3 text-[13px] md:text-[14px] xl:text-[16px] font-bold uppercase tracking-[0.06em] xl:tracking-[0.1em] text-slate-600 truncate">
        {label}
      </div>

      {/* Large Value */}
      <div className="mt-1 text-[28px] sm:text-[32px] md:text-[36px] xl:text-[42px] font-extrabold text-slate-900 leading-tight truncate">
        {value}
      </div>
    </div>
  );
};

export default SummaryCard;