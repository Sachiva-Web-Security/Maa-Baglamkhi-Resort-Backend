import React, { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RestaurantContext } from "../../Context/RestaurantContext";

const formatMoney = (value) => `Rs ${Number(value || 0).toFixed(2)}`;

const OrderSummaryPage = ({ tableNo }) => {
  const navigate = useNavigate();

  const {
    getOrderItemsForTable,
    createOrder,
  } = useContext(RestaurantContext);

  const [waiterName, setWaiterName] = useState("Waiter");
  const [sending, setSending] = useState(false);
  const [orderItems, setOrderItems] = useState([]);
  const [prepTimeMinutes, setPrepTimeMinutes] = useState(20);

  /* ================= LOAD ORDER ================= */

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const items = await getOrderItemsForTable(tableNo);
        if (active) setOrderItems(items);
      } catch (err) {
        console.error(err);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [getOrderItemsForTable, tableNo]);

  /* ================= TOTAL ================= */

  const totals = useMemo(() => {
    const subtotal = orderItems.reduce((acc, item) => {
      const qty = Math.max(1, Number(item.quantity) || 1);
      const price = Math.max(0, Number(item.unitPrice) || 0);
      return acc + qty * price;
    }, 0);

    const gst = subtotal * 0.05;
    const serviceCharge = subtotal * 0.02;
    const total = subtotal + gst + serviceCharge;

    return { subtotal, gst, serviceCharge, total };
  }, [orderItems]);

  /* ================= SEND ================= */

  const onSendToKitchen = async () => {
    try {
      setSending(true);

      await createOrder({ waiterName, tableNo, prepTimeMinutes, entityType: "Table" });

      alert("Order sent to kitchen successfully");
      navigate("/kitchen");

    } catch (err) {
      console.error(err);
      alert("Failed to send order");
    } finally {
      setSending(false);
    }
  };

  /* ================= EMPTY ================= */

  if (orderItems.length === 0) {
    return (
      <div className="bg-slate-900/80 border rounded-2xl p-6 text-center">
        <h3 className="text-lg font-bold text-white">
          No items added
        </h3>
        <p className="text-gray-400 text-sm mt-2">
          Add items from menu for table {tableNo}
        </p>
      </div>
    );
  }

  /* ================= UI ================= */

  return (
    <div className="bg-slate-900 text-white p-6 rounded-xl">

      <h2 className="text-xl font-bold mb-4">
        Order Summary (Table {tableNo})
      </h2>

      {/* ITEMS */}

      <div className="space-y-2 mb-4">

        {orderItems.map((item, i) => (
          <div
            key={i}
            className="flex justify-between border-b border-gray-700 pb-2"
          >
            <span>
              {item.name} × {item.quantity}
            </span>

            <span>
              {formatMoney(item.quantity * item.unitPrice)}
            </span>
          </div>
        ))}

      </div>

      {/* TOTALS */}

      <div className="space-y-1 text-sm mb-4">

        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatMoney(totals.subtotal)}</span>
        </div>

        <div className="flex justify-between">
          <span>SGST (2.5%)</span>
          <span>{formatMoney(totals.gst / 2)}</span>
        </div>

        <div className="flex justify-between">
          <span>CGST (2.5%)</span>
          <span>{formatMoney(totals.gst / 2)}</span>
        </div>

        <div className="flex justify-between">
          <span>Service (2%)</span>
          <span>{formatMoney(totals.serviceCharge)}</span>
        </div>

        <div className="flex justify-between font-bold text-lg mt-2">
          <span>Total</span>
          <span>{formatMoney(totals.total)}</span>
        </div>

      </div>

      <div className="mb-4">
        <label className="mb-2 block text-sm font-semibold text-white">
          Kitchen ETA
        </label>
        <select
          value={prepTimeMinutes}
          onChange={(event) => setPrepTimeMinutes(Number(event.target.value))}
          className="w-full rounded-lg border border-gray-700 bg-slate-800 px-3 py-2 text-white"
        >
          {[10, 15, 20, 30, 45, 60].map((minutes) => (
            <option key={minutes} value={minutes}>
              {minutes} minutes
            </option>
          ))}
        </select>
      </div>

      {/* ACTION */}

      <button
        onClick={onSendToKitchen}
        disabled={sending}
        className={`w-full py-2 rounded ${
          sending ? "bg-gray-500" : "bg-green-600"
        }`}
      >
        {sending ? "Sending..." : "Send to Kitchen"}
      </button>

    </div>
  );
};

export default OrderSummaryPage;
