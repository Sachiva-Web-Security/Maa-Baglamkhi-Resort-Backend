const BanquetBill = ({ booking, halls, menuPackages, formatINR }) => {
  const hall = halls.find((h) => h.id === booking.hallId);
  const menuPackage = menuPackages.find((p) => p.id === booking.menuPackageId);

  const calculateTotals = () => {
    const startTime = booking.startTime || '18:00';
    const endTime = booking.endTime || '22:00';
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    const diff = endMin - startMin;
    const hours = Math.max(1, Math.ceil(diff / 60));

    const hallCharge = hall ? hall.ratePerHour * hours : 0;
    const foodCharge = (booking.guests || 0) * (menuPackage?.perGuest || 0);
    const decoration = booking.decorationFee || 0;
    const subTotal = hallCharge + foodCharge + decoration;
    const gst = Math.round((subTotal * 5) / 100);
    const grandTotal = subTotal + gst;

    return { hallCharge, foodCharge, decoration, subTotal, gst, grandTotal, hours };
  };

  const totals = calculateTotals();

  return (
    <div className="p-4">
      <div className="mb-6 pb-4 border-b border-gray-200">
        <div className="text-2xl font-bold text-gray-900 mb-2">Banquet Invoice</div>
        <div className="text-sm text-gray-600">
          Invoice No: <span className="font-bold">{booking.invoiceNo || 'Pending'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <div className="text-sm font-bold text-gray-700 mb-2">Customer Details</div>
          <div className="text-sm text-gray-600 space-y-1">
            <div>Name: {booking.customerName}</div>
            <div>Phone: {booking.phone}</div>
            <div>Event: {booking.eventType}</div>
          </div>
        </div>
        <div>
          <div className="text-sm font-bold text-gray-700 mb-2">Event Details</div>
          <div className="text-sm text-gray-600 space-y-1">
            <div>Hall: {booking.hallName}</div>
            <div>Date: {booking.date || '-'}</div>
            <div>
              Time: {booking.startTime} - {booking.endTime}
            </div>
            <div>Guests: {booking.guests}</div>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-4 py-2 text-left text-sm font-bold text-gray-700 border border-gray-200">Description</th>
              <th className="px-4 py-2 text-right text-sm font-bold text-gray-700 border border-gray-200">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-4 py-2 text-sm text-gray-700 border border-gray-200">
                Hall Charges ({totals.hours} hrs @ {formatINR(hall?.ratePerHour || 0)}/hr)
              </td>
              <td className="px-4 py-2 text-sm text-gray-900 font-semibold text-right border border-gray-200">
                {formatINR(totals.hallCharge)}
              </td>
            </tr>
            <tr>
              <td className="px-4 py-2 text-sm text-gray-700 border border-gray-200">
                Food Charges ({booking.guests} guests @ {formatINR(menuPackage?.perGuest || 0)}/guest)
              </td>
              <td className="px-4 py-2 text-sm text-gray-900 font-semibold text-right border border-gray-200">
                {formatINR(totals.foodCharge)}
              </td>
            </tr>
            <tr>
              <td className="px-4 py-2 text-sm text-gray-700 border border-gray-200">Decoration</td>
              <td className="px-4 py-2 text-sm text-gray-900 font-semibold text-right border border-gray-200">
                {formatINR(totals.decoration)}
              </td>
            </tr>
            <tr>
              <td className="px-4 py-2 text-sm text-gray-700 border border-gray-200">Subtotal</td>
              <td className="px-4 py-2 text-sm text-gray-900 font-semibold text-right border border-gray-200">
                {formatINR(totals.subTotal)}
              </td>
            </tr>
            <tr>
              <td className="px-4 py-2 text-sm text-gray-700 border border-gray-200">GST (5%)</td>
              <td className="px-4 py-2 text-sm text-gray-900 font-semibold text-right border border-gray-200">
                {formatINR(totals.gst)}
              </td>
            </tr>
            <tr className="bg-gray-50">
              <td className="px-4 py-3 text-sm font-bold text-gray-900 border border-gray-200">Grand Total</td>
              <td className="px-4 py-3 text-lg font-bold text-gray-900 text-right border border-gray-200">
                {formatINR(totals.grandTotal)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {booking.notes && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="text-sm font-bold text-gray-700 mb-1">Notes</div>
          <div className="text-sm text-gray-600">{booking.notes}</div>
        </div>
      )}
    </div>
  );
};

export default BanquetBill;

