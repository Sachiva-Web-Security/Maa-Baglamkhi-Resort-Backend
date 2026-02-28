const BanquetHallCard = ({ hall, selected, onSelect }) => {
  return (
    <button
      type="button"
      className={`border rounded-xl p-3.5 text-left cursor-pointer transition-all ${
        selected
          ? 'border-blue-600 shadow-[0_0_0_4px_rgba(37,99,235,0.12)]'
          : 'border-gray-200 bg-white hover:-translate-y-0.5 hover:shadow-md'
      }`}
      onClick={onSelect}
    >
      <div className="text-sm font-black text-gray-900 mb-2">{hall.name}</div>
      <div className="grid gap-1.5 text-gray-700 text-xs font-bold mb-2.5">
        <span>
          <strong>Capacity:</strong> {hall.capacity}
        </span>
        <span>
          <strong>Rate:</strong> ₹{hall.ratePerHour}/hr
        </span>
      </div>
      <div
        className={`inline-flex px-2.5 py-1.5 rounded-full text-xs font-black border ${
          hall.status === 'Available'
            ? 'bg-green-100 text-green-800 border-green-300'
            : 'bg-red-100 text-red-800 border-red-300'
        }`}
      >
        {hall.status}
      </div>
    </button>
  );
};

export default BanquetHallCard;


