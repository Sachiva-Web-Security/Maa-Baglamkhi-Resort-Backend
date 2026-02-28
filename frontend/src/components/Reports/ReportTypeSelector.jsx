const ReportTypeSelector = ({ value, onChange, types }) => {
  return (
    <div className="flex flex-wrap gap-2">
      {types.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`px-4 py-2 rounded-lg font-extrabold text-sm border transition-colors ${
              active
                ? 'bg-teal-500 text-white border-teal-600'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
};

export default ReportTypeSelector;


