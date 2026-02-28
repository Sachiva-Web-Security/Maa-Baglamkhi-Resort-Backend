const BookingRow = ({ booking, onExtend, onShiftRoom, onCheckOut }) => {
  return (
    <tr className="bg-white hover:bg-indigo-50 transition duration-200 shadow-sm rounded-xl">

      <td className="px-4 py-4 font-semibold text-gray-800">
        {booking.guestName}
      </td>

      <td className="px-4 py-4">
        <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-medium">
          Room {booking.room}
        </span>
      </td>

      <td className="px-4 py-4 text-gray-600">
        {booking.checkIn}
      </td>

      <td className="px-4 py-4 text-gray-600">
        {booking.checkOut}
      </td>

      <td className="px-4 py-4">
        <span className="bg-green-100 text-green-600 px-3 py-1 rounded-full text-sm font-semibold shadow-sm">
          {booking.status}
        </span>
      </td>

      <td className="px-4 py-4">
        <div className="flex gap-2 flex-wrap">

          <button
            className="px-3 py-1 text-sm rounded-full 
                       bg-gradient-to-r from-blue-500 to-indigo-500 
                       text-white shadow-md hover:scale-105 
                       transition transform duration-200"
            onClick={() => onExtend(booking)}
          >
            Extend
          </button>

          <button
            className="px-3 py-1 text-sm rounded-full 
                       bg-gradient-to-r from-yellow-400 to-orange-500 
                       text-white shadow-md hover:scale-105 
                       transition transform duration-200"
            onClick={() => onShiftRoom(booking)}
          >
            Shift
          </button>

          <button
            className="px-3 py-1 text-sm rounded-full 
                       bg-gradient-to-r from-red-500 to-pink-500 
                       text-white shadow-md hover:scale-105 
                       transition transform duration-200"
            onClick={() => onCheckOut(booking)}
          >
            Check-Out
          </button>

        </div>
      </td>

    </tr>
  );
};

export default BookingRow;