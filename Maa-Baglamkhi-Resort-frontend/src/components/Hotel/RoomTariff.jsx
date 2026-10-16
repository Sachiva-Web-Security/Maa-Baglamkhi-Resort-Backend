import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import API from "../../api";
import {
  getBookingDraft,
  getStoredBookingCode,
  getStoredBookingId,
  setBookingDraft,
  setStoredBookingId,
} from "./bookingSession";

const RoomTariff = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const bookingId = location.state?.bookingId || getStoredBookingId();
  const bookingCode = location.state?.bookingCode || getStoredBookingCode();
  const bookingRef = bookingCode || bookingId;
  const rooms = useMemo(
    () => location.state?.rooms || getBookingDraft("pax")?.rooms || [],
    [location.state?.rooms],
  );
  const paxData = useMemo(
    () => location.state?.paxData || getBookingDraft("pax")?.paxData || {},
    [location.state?.paxData],
  );
  const roomDraft = getBookingDraft("room") || {};
  const [categorySetup, setCategorySetup] = useState([]);
  const [rows, setRows] = useState(getBookingDraft("roomTariff")?.rows || []);

  useEffect(() => {
    if (bookingId) {
      setStoredBookingId(bookingId);
    }
  }, [bookingId]);

  useEffect(() => {
    const loadSetup = async () => {
      try {
        const response = await API.get("/hotel/rooms/setup");
        setCategorySetup(Array.isArray(response.data) ? response.data : []);
      } catch (error) {
        console.error("Failed to load room setup:", error);
      }
    };

    loadSetup();
  }, []);

  const categoryMap = useMemo(() => {
    const map = {};

    categorySetup.forEach((category) => {
      map[String(category.id)] = {
        id: category.id,
        name: category.name,
        defaultPrice: Number(category.defaultPrice || 0),
        unitLabel: category.unitLabel || "PER NIGHT",
      };
    });

    return map;
  }, [categorySetup]);

  useEffect(() => {
    if (!rooms.length || rows.length) {
      return;
    }

    const priceInputs = roomDraft.priceInputs || {};

    const nextRows = rooms.map((room) => {
      const category = categoryMap[String(room.roomTypeId || room.roomType)] || {};
      const adults = Number(paxData[room.name]?.adults || 0);
      const children = Number(paxData[room.name]?.children || 0);
      const quantity = Math.max(adults + children, 1);
      const fallbackPrice = Number(priceInputs[room.roomTypeId || room.roomType] || 0);
      const tariff = Number(category.defaultPrice || fallbackPrice || 0);

      return {
        roomNo: room.name,
        roomType: room.roomTypeName || category.name || `Room Type ${room.roomTypeId || room.roomType}`,
        quantity,
        price: tariff,
        gst: 12,
        unitLabel: category.unitLabel || "PER NIGHT",
      };
    });

    setRows(nextRows);
  }, [categoryMap, paxData, roomDraft.priceInputs, rooms, rows.length]);

  useEffect(() => {
    setBookingDraft("roomTariff", { rows });
  }, [rows]);

  const handleChange = (index, field, value) => {
    setRows((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: Number(value) || 0,
      };
      return updated;
    });
  };

  const calculateBase = (row) => Number(row.price || 0) * Number(row.quantity || 0);

  const calculateTotal = (row) => {
    const base = calculateBase(row);
    const gstAmount = (base * Number(row.gst || 0)) / 100;
    return base + gstAmount;
  };

  const grandTotal = rows.reduce((sum, row) => sum + calculateTotal(row), 0);
const handleProceed = async () => {
  if (!bookingId) {
    alert("Booking ID is missing.");
    return;
  }

  if (!rows.length) {
    alert("Room tariff data is missing.");
    return;
  }

  try {
    for (const row of rows) {
      const payload = {
        roomNumber: row.roomNo,
        date: new Date().toISOString().slice(0, 19).replace("T", " "), // ✅ FIX
        quantity: row.quantity,
        tariff: row.price,
        gstPercent: row.gst,
        total: calculateTotal(row),
      };

      console.log("🚀 SENDING:", payload); // debug

      await API.post(`/hotel/room-tariff/${bookingId}`, payload);
    }

    navigate("/hotel/advance", {
      state: {
        bookingId,
        bookingCode,
        rows,
        totalAmount: grandTotal,
      },
    });
  } catch (error) {
    console.error("❌ ERROR:", error.response?.data || error);
    alert(error.response?.data?.message || "Unable to save room tariff.");
  }
};

  return (
    <div className="min-h-screen w-full bg-[linear-gradient(135deg,#f4fbff_0%,#f8fff9_42%,#fffaf1_100%)] p-4 sm:p-6">
      <div className="w-full rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
        <h2 className="border-b border-slate-200 pb-4 text-[34px] font-black text-slate-950">
          Room Tariff
        </h2>
        <div className="mt-3 text-lg font-semibold text-slate-600">
          Booking Ref: <span className="font-black text-slate-900">{bookingRef || "Pending"}</span>
        </div>

        {rows.length ? (
          <>
            <div className="mt-8 overflow-x-auto">
              <table className="min-w-full overflow-hidden rounded-[22px] border border-slate-200">
                <thead className="bg-slate-100 text-left text-[16px] font-black text-slate-800">
                  <tr>
                    <th className="px-4 py-4">Room No.</th>
                    <th className="px-4 py-4">Room Type</th>
                    <th className="px-4 py-4">Quantity</th>
                    <th className="px-4 py-4">Tariff</th>
                    <th className="px-4 py-4">GST %</th>
                    <th className="px-4 py-4">Total</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row, index) => (
                    <tr key={`${row.roomNo}-${index}`} className="border-t border-slate-200">
                      <td className="px-4 py-5 text-[26px] font-black text-slate-950">
                        {row.roomNo}
                      </td>
                      <td className="px-4 py-5 text-slate-700">
                        <div className="text-xl font-black text-slate-900">{row.roomType}</div>
                        <div className="mt-1 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                          {row.unitLabel}
                        </div>
                      </td>
                      <td className="px-4 py-5">
                        <input
                          type="number"
                          min="1"
                          value={row.quantity}
                          onChange={(event) =>
                            handleChange(index, "quantity", event.target.value)
                          }
                          className="w-28 rounded-xl border border-slate-300 px-4 py-3 text-lg font-semibold text-slate-950 outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                        />
                      </td>
                      <td className="px-4 py-5">
                        <input
                          type="number"
                          min="0"
                          value={row.price}
                          onChange={(event) =>
                            handleChange(index, "price", event.target.value)
                          }
                          className="w-36 rounded-xl border border-slate-300 px-4 py-3 text-lg font-semibold text-slate-950 outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                        />
                      </td>
                      <td className="px-4 py-5">
                        <select
                          value={row.gst}
                          onChange={(event) =>
                            handleChange(index, "gst", event.target.value)
                          }
                          className="w-28 rounded-xl border border-slate-300 px-4 py-3 text-lg font-semibold text-slate-950 outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                        >
                          <option value={0}>0%</option>
                          <option value={5}>5%</option>
                          <option value={12}>12%</option>
                          <option value={18}>18%</option>
                        </select>
                      </td>
                      <td className="px-4 py-5 text-xl font-black text-emerald-700">
                        Rs. {calculateTotal(row).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-8 flex flex-col gap-4 rounded-[24px] bg-slate-50 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-[15px] font-black uppercase tracking-[0.18em] text-slate-500">
                  Booking Total
                </div>
                <div className="mt-2 text-[42px] font-black leading-none text-slate-950">
                  Rs. {grandTotal.toFixed(2)}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => navigate("/hotel/pax")}
                  className="rounded-[18px] bg-gray-300 px-7 py-4 text-lg font-black text-slate-800"
                >
                  Go Back
                </button>
                <button
                  onClick={handleProceed}
                  className="rounded-[18px] bg-blue-500 px-8 py-4 text-lg font-black text-white"
                >
                  Save & Proceed
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="mt-8 rounded-[22px] border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-lg font-semibold text-slate-500">
            No room tariff data is available.
          </div>
        )}
      </div>
    </div>
  );
};

export default RoomTariff;
