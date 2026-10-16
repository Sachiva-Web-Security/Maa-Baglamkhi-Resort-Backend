const fieldCls =
  "w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-[13px] font-semibold text-black outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100";

const Field = ({ label, children }) => (
  <div className="flex flex-col gap-2">
    <div className="text-[13px] font-semibold uppercase tracking-[0.18em] text-slate-800">
      {label}
    </div>
    {children}
  </div>
);

const Select = ({ value, onChange, options }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className={fieldCls}
  >
    {options.map((option) => (
      <option key={option} value={option}>
        {option}
      </option>
    ))}
  </select>
);

const ReportFilters = ({ value, onChange, visible, options }) => {
  const set = (patch) => onChange((prev) => ({ ...prev, ...patch }));

  return (
    <div className="rounded-[26px] border border-white/60 bg-white/82 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-5">
      <div className="mb-4">
        <p className="text-[13px] font-semibold uppercase tracking-[0.24em] text-emerald-500">
          Smart Filters
        </p>
        <h2 className="mt-1 text-2xl font-bold text-black">
          Narrow down report results
        </h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <Field label="Date From">
          <input
            type="date"
            value={value.dateFrom}
            onChange={(e) => set({ dateFrom: e.target.value })}
            className={fieldCls}
          />
        </Field>

        <Field label="Date To">
          <input
            type="date"
            value={value.dateTo}
            onChange={(e) => set({ dateTo: e.target.value })}
            className={fieldCls}
          />
        </Field>

        {visible.status ? (
          <Field label="Status">
            <Select
              value={value.status}
              onChange={(selected) => set({ status: selected })}
              options={options.statuses}
            />
          </Field>
        ) : null}

        {visible.hall ? (
          <Field label="Hall">
            <Select
              value={value.hall}
              onChange={(selected) => set({ hall: selected })}
              options={options.halls}
            />
          </Field>
        ) : null}

        {visible.roomType ? (
          <Field label="Room Type">
            <Select
              value={value.roomType}
              onChange={(selected) => set({ roomType: selected })}
              options={options.roomTypes}
            />
          </Field>
        ) : null}

        {visible.paymentMode ? (
          <Field label="Payment Mode">
            <Select
              value={value.paymentMode}
              onChange={(selected) => set({ paymentMode: selected })}
              options={options.paymentModes}
            />
          </Field>
        ) : null}

        {visible.department ? (
          <Field label="Department">
            <Select
              value={value.department || "All"}
              onChange={(selected) => set({ department: selected })}
              options={options.departments || ["All"]}
            />
          </Field>
        ) : null}
      </div>
    </div>
  );
};

export default ReportFilters;
