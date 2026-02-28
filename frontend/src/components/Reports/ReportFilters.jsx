const Field = ({ label, children }) => {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-xs font-extrabold text-gray-700">{label}</div>
      {children}
    </div>
  );
};

const Select = ({ value, onChange, options }) => {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 border border-teal-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-200 bg-white font-semibold text-sm"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
};

const ReportFilters = ({ value, onChange, visible, options }) => {
  const set = (patch) => onChange((prev) => ({ ...prev, ...patch }));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3 items-end">
        <Field label="Date From">
          <input
            type="date"
            value={value.dateFrom}
            onChange={(e) => set({ dateFrom: e.target.value })}
            className="w-full px-3 py-2 border border-teal-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-200 bg-white font-semibold text-sm"
          />
        </Field>
        <Field label="Date To">
          <input
            type="date"
            value={value.dateTo}
            onChange={(e) => set({ dateTo: e.target.value })}
            className="w-full px-3 py-2 border border-teal-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-200 bg-white font-semibold text-sm"
          />
        </Field>

        {visible.status ? (
          <Field label="Status">
            <Select value={value.status} onChange={(v) => set({ status: v })} options={options.statuses} />
          </Field>
        ) : null}

        {visible.hall ? (
          <Field label="Hall">
            <Select value={value.hall} onChange={(v) => set({ hall: v })} options={options.halls} />
          </Field>
        ) : null}

        {visible.roomType ? (
          <Field label="Room Type">
            <Select value={value.roomType} onChange={(v) => set({ roomType: v })} options={options.roomTypes} />
          </Field>
        ) : null}

        {visible.paymentMode ? (
          <Field label="Payment Mode">
            <Select value={value.paymentMode} onChange={(v) => set({ paymentMode: v })} options={options.paymentModes} />
          </Field>
        ) : null}
      </div>
    </div>
  );
};

export default ReportFilters;


