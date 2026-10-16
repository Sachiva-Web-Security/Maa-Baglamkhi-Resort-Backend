const BanquetBill = ({
  booking,
  halls,
  menuPackages,
  lightingOptions,
  formatINR,
}) => {
  const hall = halls.find((h) => String(h.id) === String(booking.hallId));
  const menuPackage = menuPackages.find((p) => p.id === booking.menuPackageId);
  const lighting = lightingOptions.find((item) => item.id === booking.lightingSystem);

  const calculateTotals = () => {
    const startTime = booking.startTime || "18:00";
    const endTime = booking.endTime || "22:00";

    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);

    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;

    const diff = endMin - startMin;
    const hours = Math.max(1, Math.ceil(diff / 60));

    const hallCharge =
      Number(booking.hallCharge || booking.hall_charge) ||
      (hall ? Number(hall.ratePerHour || 0) * hours : 0);
    const foodCharge =
      Number(booking.mealCharge || booking.meal_charge) ||
      (Number(booking.guests || 0) * Number(menuPackage?.perGuest || 0));
    const customMenuCharge = Number(booking.customMenuCharge || booking.custom_menu_charge || 0);
    const lightingCharge =
      Number(booking.lightingCharge || booking.lighting_charge) ||
      Number(lighting?.price || 0);
    const eventSupportCharge = Number(
      booking.eventSupportFee || booking.event_support_fee || 0,
    );
    const decoration = Number(booking.decorationFee || booking.decoration_fee || 0);
    const discount = Number(booking.discount || 0);

    const subTotal =
      Number(booking.subtotalAmount || booking.subtotal_amount) ||
      hallCharge +
        foodCharge +
        customMenuCharge +
        lightingCharge +
        eventSupportCharge +
        decoration;
    const taxableAmount = Math.max(0, subTotal - discount);
    const gst =
      Number(booking.gstAmount || booking.gst_amount) ||
      Math.round(taxableAmount * ((booking.gstPercent ?? booking.gst_percent ?? 5) / 100));

    const grandTotal =
      Number(booking.grandTotal || booking.grand_total || booking.totalAmount || booking.total_amount) ||
      taxableAmount + gst;
    const advance = Number(booking.advance || 0);
    const refundAmount = Number(booking.refundAmount || booking.refund_amount || 0);
    const netReceived =
      Number(booking.netReceived || booking.net_received) || Math.max(0, advance - refundAmount);
    const balance =
      Number(booking.balanceDue || booking.balance_due) || Math.max(0, grandTotal - netReceived);
    const paymentMode = booking.paymentMode || booking.payment_mode || "Pending";
    const paymentStatus = booking.paymentStatus || booking.payment_status || "Pending";
    const paymentReference =
      booking.paymentReferenceNo || booking.payment_reference_no || booking.paymentReferenceId || "";

    return {
      hallCharge,
      foodCharge,
      customMenuCharge,
      lightingCharge,
      eventSupportCharge,
      decoration,
      discount,
      subTotal,
      taxableAmount,
      gst,
      grandTotal,
      advance,
      refundAmount,
      netReceived,
      balance,
      hours,
      paymentMode,
      paymentStatus,
      paymentReference,
    };
  };

  const totals = calculateTotals();

  return (
    <div className="rounded-3xl bg-white">

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-2xl font-bold">Banquet Invoice</div>
          <div className="text-sm text-gray-500">
            Invoice No: {booking.invoiceNo || "Pending"}
          </div>
        </div>

        <div className="text-sm text-gray-500">
          Date: {booking.billedAt || booking.date || new Date().toLocaleDateString()}
        </div>
      </div>

      <div className="mb-6 grid gap-6 md:grid-cols-2">

        <div>
          <div className="font-bold mb-2">Customer</div>
          <div>{booking.customerName}</div>
          <div>{booking.phone}</div>
          <div>{booking.eventType}</div>
        </div>

        <div>
          <div className="font-bold mb-2">Event</div>
          <div>{booking.hallName}</div>
          <div>{booking.date}</div>
          <div>
            {booking.startTime} - {booking.endTime}
          </div>
          <div className="mt-2 text-sm text-gray-500">
            Payment: {totals.paymentMode} | Status: {totals.paymentStatus}
          </div>
          {totals.paymentReference ? (
            <div className="text-sm text-gray-500">
              Ref: {totals.paymentReference}
            </div>
          ) : null}
        </div>

      </div>

      <table className="w-full">

        <thead className="bg-gray-100">
          <tr>
            <th className="text-left p-2">Description</th>
            <th className="text-right p-2">Amount</th>
          </tr>
        </thead>

        <tbody>

          <tr>
            <td className="p-2">Hall Charges ({totals.hours} hrs)</td>
            <td className="text-right p-2">
              {formatINR(totals.hallCharge)}
            </td>
          </tr>

          <tr>
            <td className="p-2">Food Charges</td>
            <td className="text-right p-2">
              {formatINR(totals.foodCharge)}
            </td>
          </tr>

          <tr>
            <td className="p-2">Custom Menu Charges</td>
            <td className="text-right p-2">
              {formatINR(totals.customMenuCharge)}
            </td>
          </tr>

          <tr>
            <td className="p-2">Lighting</td>
            <td className="text-right p-2">
              {formatINR(totals.lightingCharge)}
            </td>
          </tr>

          <tr>
            <td className="p-2">Event Support</td>
            <td className="text-right p-2">
              {formatINR(totals.eventSupportCharge)}
            </td>
          </tr>

          <tr>
            <td className="p-2">Decoration</td>
            <td className="text-right p-2">
              {formatINR(totals.decoration)}
            </td>
          </tr>

          <tr>
            <td className="p-2">Subtotal</td>
            <td className="text-right p-2">
              {formatINR(totals.subTotal)}
            </td>
          </tr>

          <tr>
            <td className="p-2">Discount</td>
            <td className="text-right p-2 text-amber-600">
              - {formatINR(totals.discount)}
            </td>
          </tr>

          <tr>
            <td className="p-2">Taxable Amount</td>
            <td className="text-right p-2">
              {formatINR(totals.taxableAmount)}
            </td>
          </tr>

          <tr>
            <td className="p-2">GST ({booking.gstPercent || 5}%)</td>
            <td className="text-right p-2">
              {formatINR(totals.gst)}
            </td>
          </tr>

          <tr>
            <td className="p-2 font-bold">Grand Total</td>
            <td className="text-right p-2 font-bold">
              {formatINR(totals.grandTotal)}
            </td>
          </tr>

          <tr>
            <td className="p-2">Advance Paid</td>
            <td className="text-right p-2 text-green-600">
              {formatINR(totals.advance)}
            </td>
          </tr>

          <tr>
            <td className="p-2">Refunded</td>
            <td className="text-right p-2 text-amber-600">
              {formatINR(totals.refundAmount)}
            </td>
          </tr>

          <tr>
            <td className="p-2">Net Received</td>
            <td className="text-right p-2 text-emerald-700">
              {formatINR(totals.netReceived)}
            </td>
          </tr>

          <tr className="bg-gray-100">
            <td className="p-2 font-bold">Balance</td>
            <td className="text-right p-2 font-bold text-red-600">
              {formatINR(totals.balance)}
            </td>
          </tr>

        </tbody>

      </table>

    </div>
  );
};

export default BanquetBill;
