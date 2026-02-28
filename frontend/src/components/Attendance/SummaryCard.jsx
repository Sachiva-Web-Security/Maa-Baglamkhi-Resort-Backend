const SummaryCard = ({ label, value, color }) => {
  const colors = {
    green: "from-green-500/30 to-green-600/10 border-green-500/40",
    red: "from-red-500/30 to-red-600/10 border-red-500/40",
    yellow: "from-yellow-500/30 to-yellow-600/10 border-yellow-500/40",
    blue: "from-blue-500/30 to-blue-600/10 border-blue-500/40",
  };

  return (
    <div
      className={`rounded-2xl p-4 bg-gradient-to-br ${
        colors[color] || "from-white/10 to-white/5 border-white/20"
      } border backdrop-blur-xl shadow-lg`}
    >
      <p className="text-gray-300 text-sm">{label}</p>
      <h2 className="text-2xl font-bold mt-2">{value}</h2>
    </div>
  );
};

export default SummaryCard;