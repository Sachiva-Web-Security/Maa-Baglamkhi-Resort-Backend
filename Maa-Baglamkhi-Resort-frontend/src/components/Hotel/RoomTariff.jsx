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

  const [bookingId, setBookingId] = useState(
    () => location.state?.bookingId || getStoredBookingId() || "",
  );
  const [bookingCode, setBookingCode] = useState(
    () => location.state?.bookingCode || getStoredBookingCode() || "",
  );
  const [rooms, setRooms] = useState(
    () => location.state?.rooms || getBookingDraft("pax")?.rooms || [],
  );
  const [paxData, setPaxData] = useState(
    () => location.state?.paxData || getBookingDraft("pax")?.paxData || {},
  );
  const [saveError, setSaveError] = useState("");
  const bookingRef = bookingCode || bookingId;
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

  // Deep links and "edit booking" open this step with a bookingId and no
  // wizard draft in session storage, so fetch the saved booking instead of
  // rendering the empty state.
  useEffect(() => {
    if (bookingId && !rooms.length && !rows.length) {
      let cancelled = false;
      API.get(`/hotel/wizard/${bookingId}`)
        .then((res) => {
          if (cancelled || !res.data) return;
          setBookingId(String(res.data.bookingId || bookingId));
          setBookingCode(res.data.bookingCode || bookingCode);
          setRooms(Array.isArray(res.data.pax?.rooms) ? res.data.pax.rooms : []);
          setPaxData(res.data.pax?.paxData || {});
          const draft = res.data.roomTariff?.rows || [];
          if (draft.length) setRows(draft);
          setBookingDraft("pax", { rooms: res.data.pax?.rooms || [], paxData: res.data.pax?.paxData || {} });
          if (draft.length) setBookingDraft("roomTariff", { rows: draft, totalAmount: res.data.roomTariff?.totalAmount || 0 });
        })
        .catch((error) => {
          console.error("Failed to load saved booking:", error);
        });
      return () => {
        cancelled = true;
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  // The wizard payload's roomTariff rows always carry quantity 1 (the backend
  // hard-codes it), while this screen prices quantity = adults + children.
  // So the quantity comes from the pax draft, which mirrors booking_rooms.
  useEffect(() => {
    if (!rows.length || !paxData) return;

    setRows((prev) =>
      prev.map((row) => {
        const key = String(row.roomNo || "").trim();
        const counts = paxData[key];
        const quantity = Math.max(
          (Number(counts?.adults || 0) + Number(counts?.children || 0)) || 1,
          1,
        );
        return quantity === Number(row.quantity || 1) ? row : { ...row, quantity };
      }),
    );
  }, [paxData, rows.length]);

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
  setSaveError("");

  if (!rows.length) {
    setSaveError("Room tariff data is missing. Go back and add rooms first.");
    return;
  }

  if (!bookingId) {
    setSaveError(
      "This booking is not saved yet. Complete the Guest details step first.",
    );
    return;
  }

  try {
    let failed = false;

    for (const row of rows) {
      try {
        await API.post(`/hotel/pax/${bookingId}`, {
          roomNumber: row.roomNo,
          room_number: row.roomNo,
          adults: paxData[String(row.roomNo)]?.adults ?? 1,
          children: paxData[String(row.roomNo)]?.children ?? 0,
          guestCapacity: Math.max(
            Number(paxData[String(row.roomNo)]?.adults || 0) +
              Number(paxData[String(row.roomNo)]?.children || 0),
            1,
          ),
        });
      } catch (error) {
        console.error("Pax save failed for room", row.roomNo, error);
        failed = true;
      }

      try {
        await API.post(`/hotel/room-tariff/${bookingId}`, {
          roomNumber: row.roomNo,
          room_number: row.roomNo,
          date: new Date().toISOString().slice(0, 19).replace("T", " "),
          quantity: row.quantity,
          tariff: row.price,
          gstPercent: row.gst,
          total: calculateTotal(row),
        });
      } catch (error) {
        console.error("Tariff save failed for room", row.roomNo, error);
        setSaveError(
          error.response?.data?.message ||
            `Could not save tariff for room ${row.roomNo}.`,
        );
        failed = true;
      }
    }

    if (failed) return;

    setBookingDraft("roomTariff", { rows, totalAmount: grandTotal });
    setStoredBookingId(bookingId);

    navigate("/hotel/advance", {
      state: {
        bookingId,
        bookingCode,
        rows,
        totalAmount: grandTotal,
      },
    });
  } catch (error) {
    console.error("Unable to save room tariff:", error);
    setSaveError(error.response?.data?.message || "Unable to save room tariff.");
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
                {saveError ? (
                  <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-base font-bold text-rose-700">
                    {saveError}
                  </p>
                ) : null}
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
