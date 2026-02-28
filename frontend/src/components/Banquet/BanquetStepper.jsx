const BanquetStepper = ({ steps, activeStep }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 p-3.5 px-4 border-b border-gray-200 bg-white">
      {steps.map((label, idx) => {
        const isActive = idx === activeStep;
        const isDone = idx < activeStep;
        return (
          <div
            key={label}
            className={`border rounded-xl p-2.5 flex gap-2.5 items-center min-h-[54px] ${
              isActive
                ? 'border-blue-400 bg-blue-50'
                : isDone
                  ? 'border-green-400 bg-green-50'
                  : 'border-gray-200 bg-gray-50'
            }`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs flex-shrink-0 ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : isDone
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-900'
              }`}
            >
              {idx + 1}
            </div>
            <div className="text-xs font-black text-gray-700 leading-tight">{label}</div>
          </div>
        );
      })}
    </div>
  );
};

export default BanquetStepper;


