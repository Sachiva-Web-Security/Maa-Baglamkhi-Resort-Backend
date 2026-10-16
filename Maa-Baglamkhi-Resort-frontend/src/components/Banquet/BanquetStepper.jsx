const BanquetStepper = ({ steps, activeStep }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 p-3.5 px-4 border-b border-white/5 bg-transparent">
      {steps.map((label, idx) => {
        const isActive = idx === activeStep;
        const isDone = idx < activeStep;
        return (
          <div
            key={label}
            className={`border rounded-xl p-2.5 flex gap-2.5 items-center min-h-[54px] ${isActive
                ? 'border-blue-500 bg-gradient-to-r from-[#052d54] to-[#06203a]'
                : isDone
                  ? 'border-green-600 bg-gradient-to-r from-[#052512] to-[#0b2510]'
                  : 'border-white/5 bg-transparent'
              }`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs flex-shrink-0 ${isActive
                  ? 'bg-blue-500 text-white'
                  : isDone
                    ? 'bg-green-500 text-white'
                    : 'bg-white/6 text-gray-200'
                }`}
            >
              {idx + 1}
            </div>
            <div className="text-xs font-black text-gray-200 leading-tight">{label}</div>
          </div>
        );
      })}
    </div>
  );
};

export default BanquetStepper;


