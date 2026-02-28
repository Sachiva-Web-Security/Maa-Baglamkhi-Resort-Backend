const BanquetBookingRow = ({ booking, onComplete, onGenerateBill, onView }) => {
  const getStatusBadge = (status) => {
    const baseClasses = 'px-3 py-1 rounded-full text-xs font-bold';
    switch (status) {
      case 'Confirmed':
        return `${baseClasses} bg-blue-100 text-blue-800 border border-blue-300`;
      case 'Completed':
        return `${baseClasses} bg-yellow-100 text-yellow-800 border border-yellow-300`;
      case 'Billed':
        return `${baseClasses} bg-green-100 text-green-800 border border-green-300`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800 border border-gray-300`;
    }
  };

  return (
    <tr className="border-t border-gray-200 hover:bg-gray-50">
      <td className="px-4 py-3 text-sm font-semibold text-gray-900">{booking.hallName}</td>
      <td className="px-4 py-3 text-sm text-gray-700">{booking.customerName}</td>
      <td className="px-4 py-3 text-sm text-gray-700">{booking.eventType}</td>
      <td className="px-4 py-3 text-sm text-gray-700">{booking.date || '-'}</td>
      <td className="px-4 py-3 text-sm text-gray-700">
        {booking.startTime} - {booking.endTime}
      </td>
      <td className="px-4 py-3">
        <span className={getStatusBadge(booking.status)}>{booking.status}</span>
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-2 flex-wrap">
          {booking.status === 'Confirmed' && (
            <button
              onClick={onComplete}
              className="px-3 py-1 bg-yellow-500 text-white text-xs font-bold rounded-lg hover:bg-yellow-600 transition-colors"
            >
              Mark Completed
            </button>
          )}
          {(booking.status === 'Completed' || booking.status === 'Confirmed') && (
            <button
              onClick={onGenerateBill}
              className="px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-lg hover:bg-green-600 transition-colors"
            >
              Generate Bill
            </button>
          )}
          {booking.invoiceNo && (
            <button
              onClick={onView}
              className="px-3 py-1 bg-blue-500 text-white text-xs font-bold rounded-lg hover:bg-blue-600 transition-colors"
            >
              View Bill
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};

export default BanquetBookingRow;

