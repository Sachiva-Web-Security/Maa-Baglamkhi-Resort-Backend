const dashboardFooterHighlights = [];

const DashboardFooter = ({ contentOffset = 0 }) => {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      id="dashboard-footer"
      className="relative z-50 mt-8 overflow-hidden border-t border-white/10 bg-[linear-gradient(180deg,#020617_0%,#07101f_48%,#030712_100%)] px-5 py-4 shadow-[0_-20px_60px_rgba(2,6,23,0.4)] sm:px-6"
      style={{
        marginLeft: contentOffset ? `${contentOffset}px` : 0,
        width: contentOffset ? `calc(100% - ${contentOffset}px)` : "100%",
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.18),transparent_26%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_24%)]" />
      <div className="relative mx-auto flex min-h-[74px] w-full max-w-7xl items-center justify-between gap-4">
        <div>
          <p className=" ml-14 text-xl font-semibold text-slate-200">
           This software  secured and maintained by Sachiva Web & Security
            <br />
            &copy; {currentYear} All rights reserved for Sachiva Web & Security
          </p>
        </div>

        <div className="flex items-center gap-2">
          {dashboardFooterHighlights.map((item) => (
            <span
              key={item}
              className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-200 shadow-[0_10px_25px_rgba(0,0,0,0.22)] backdrop-blur-sm"
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </footer>
  );
};

export default DashboardFooter;
