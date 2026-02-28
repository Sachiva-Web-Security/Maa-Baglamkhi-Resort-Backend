import './SummaryCard.css';

const SummaryCard = ({ label, value, onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`
        bg-gradient-to-r from-purple-600 to-pink-500
        text-white
        rounded-xl
        shadow-lg
        p-6
        hover:scale-105
        transition
        duration-300
        ${onClick ? "cursor-pointer" : ""}
      `}
    >
      <p className="text-sm opacity-80">{label}</p>
      <h2 className="text-3xl font-bold mt-2">
        {value}
      </h2>
    </div>
  );
};

export default SummaryCard;