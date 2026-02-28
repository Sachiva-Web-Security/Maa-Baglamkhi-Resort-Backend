const MetricCard = ({ title, value, icon: Icon, gradient, onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`
        cursor-pointer rounded-2xl p-5 text-white shadow-lg
        transition-all duration-300 hover:scale-[1.03] hover:shadow-xl
        ${gradient}
      `}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm opacity-90">{title}</p>
          <h2 className="text-2xl md:text-3xl font-bold mt-1">
            {value}
          </h2>
        </div>

        <div className="bg-white/20 p-3 rounded-xl">
          <Icon size={26} />
        </div>
      </div>
    </div>
  );
};

export default MetricCard;