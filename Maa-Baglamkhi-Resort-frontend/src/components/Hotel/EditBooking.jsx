import React, { useEffect, useState } from "react";
import { FaCalendarAlt } from "react-icons/fa";
import { useLocation, useNavigate } from "react-router-dom";
import API from "../../api";
import { getStoredBookingCode, getStoredBookingId, setStoredBookingId } from "./bookingSession";

const inputCls =
  "w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:ring-2 focus:ring-cyan-400 outline-none";

const normalizeDateInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
};

const todayISO = () => new Date().toISOString().slice(0, 10);

const getRoomKey = (room) => String(room?.room_number || room?.roomNumber || room?.roomNo || room?.id || "").trim();

const dedupeRooms = (rooms, focusRoomNo = "") => {
  const seen = new Set();
  const focus = String(focusRoomNo || "").trim();

  return (Array.isArray(rooms) ? rooms : [])
    .filter((room) => {
      const key = getRoomKey(room);
      if (!key) return false;
      if (focus && key !== focus) return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const normalizeRoomView = (room) => ({
  ...room,
  roomNumber: room?.room_number || room?.roomNumber || room?.roomNo || "",
  roomId: room?.roomId || room?.id || room?.room_id || room?.room_number || "",
  roomType: room?.roomType || room?.categoryName || room?.name || "Room",
});

const EditBooking = ({
  embedded = false,
  onClose = null,
  onSaved = null,
  bookingId: propBookingId = "",
  bookingCode: propBookingCode = "",
  focusRoomNo: propFocusRoomNo = "",
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const bookingId = propBookingId || location.state?.bookingId || getStoredBookingId();
  const bookingCode = propBookingCode || location.state?.bookingCode || getStoredBookingCode();
  const focusRoomNo = propFocusRoomNo || location.state?.focusRoomNo || "";

  const [data, setData] = useState({
    guest_name: "",
    mobile: "",
    company_name: "",
    paidAmount: 0,
    checkIn: "",
    checkOut: "",
  });
  const [originalDates, setOriginalDates] = useState({ checkIn: "", checkOut: "" });
  const bookingRef = data.booking_code || bookingCode || bookingId;
  const today = todayISO();

  const [rooms, setRooms] = useState([]);

  useEffect(() => {
    if (!bookingId) return;

    setStoredBookingId(bookingId);

    API.get(`/hotel/full-booking/${bookingId}`)
      .then((res) => {
        setData({
          guest_name: res.data.guest_name || res.data.guestName || "",
          mobile: res.data.mobile || "",
          company_name: res.data.company_name || res.data.companyName || "",
          paidAmount: res.data.paidAmount || 0,
          checkIn: normalizeDateInput(res.data.check_in || res.data.checkIn || ""),
          checkOut: normalizeDateInput(res.data.check_out || res.data.checkOut || ""),
          booking_code: res.data.booking_code || res.data.bookingCode || bookingCode || "",
        });
        setOriginalDates({
          checkIn: normalizeDateInput(res.data.check_in || res.data.checkIn || ""),
          checkOut: normalizeDateInput(res.data.check_out || res.data.checkOut || ""),
        });
        const nextRooms = dedupeRooms(res.data.rooms, focusRoomNo).map(normalizeRoomView);
        setRooms(nextRooms);
      })
      .catch((err) => console.log(err));
  }, [bookingId, focusRoomNo]);

  const handleRoomChange = (index, field, value) => {
    const updated = [...rooms];
    updated[index][field] = value;
    setRooms(updated);
  };

  const calculateTotal = (room) => {
    const base =
      Number(room.tariff || 0) *
      (Number(room.adults || 0) + Number(room.children || 0));
    const gstAmount = (base * Number(room.gst || 0)) / 100;
    return base + gstAmount;
  };

  const handleUpdate = async () => {
    try {
      const minCheckIn = [today, originalDates.checkIn].filter(Boolean).sort().slice(-1)[0] || today;
      const minCheckOut = [today, data.checkIn || minCheckIn, originalDates.checkOut]
        .filter(Boolean)
        .sort()
        .slice(-1)[0] || minCheckIn;

      if (!data.checkIn || data.checkIn < minCheckIn) {
        alert("Check-in date cannot be before existing booking date or today.");
        return;
      }

      if (!data.checkOut || data.checkOut < minCheckOut) {
        alert("Check-out date cannot be before existing booking date or selected check-in.");
        return;
      }

      const updatedRooms = rooms.map((room) => ({
        ...room,
        total: calculateTotal(room),
      }));

      await API.put(`/hotel/full-booking/${bookingId}`, {
        ...data,
        rooms: updatedRooms,
      });

      if (typeof onSaved === "function") {
        onSaved({
          ...data,
          rooms: updatedRooms,
          bookingId,
          bookingCode: data.booking_code || bookingCode || bookingId,
        });
      }

      alert("Updated Successfully");
      if (embedded) {
        if (typeof onClose === "function") onClose();
      } else {
        navigate("/hotel/all-bookings");
      }
    } catch (err) {
      console.error(err);
      alert("Update Failed");
    }
  };

  const content = (
    <div className={embedded ? "max-h-[85vh] overflow-y-auto bg-gradient-to-br from-slate-50 to-cyan-50 p-4 sm:p-6" : "min-h-screen bg-gradient-to-br from-slate-50 to-cyan-50 p-6"}>
      <div className={embedded ? "mx-auto max-w-6xl space-y-6" : "mx-auto max-w-6xl space-y-6"}>

        {/* HEADER */}
        <div className="bg-gradient-to-r from-cyan-600 to-blue-500 text-white p-6 rounded-2xl shadow-lg">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">Edit Booking</h2>
              <p className="text-sm opacity-90 mt-1">
                Booking ID: {bookingRef}
              </p>
              {focusRoomNo ? (
                <p className="mt-2 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
                  Focus Room: {focusRoomNo}
                </p>
              ) : null}
            </div>
            {embedded ? (
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/15"
              >
                Close
              </button>
            ) : null}
          </div>
        </div>

        {/* GUEST DETAILS */}
        <div className="bg-white p-6 rounded-2xl shadow">
          <h3 className="text-lg font-bold mb-4 text-slate-800">
            Guest Details
          </h3>

        <div className="grid md:grid-cols-2 gap-4">
            <input
              className={inputCls}
              placeholder="Guest Name"
              value={data.guest_name}
              onChange={(e) =>
                setData({ ...data, guest_name: e.target.value })
              }
            />

            <input
              className={inputCls}
              placeholder="Mobile"
              value={data.mobile}
              onChange={(e) =>
                setData({ ...data, mobile: e.target.value })
              }
            />

            <label className="space-y-2">
              <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                <FaCalendarAlt className="text-cyan-600" />
                Check In
              </span>
              <input
                type="date"
                className={inputCls}
                min={[today, originalDates.checkIn].filter(Boolean).sort().slice(-1)[0] || today}
                value={data.checkIn}
                onChange={(e) =>
                  setData((prev) => {
                    const nextCheckIn = e.target.value;
                    const minCheckOut = [today, nextCheckIn, originalDates.checkOut]
                      .filter(Boolean)
                      .sort()
                      .slice(-1)[0] || nextCheckIn || today;

                    return {
                      ...prev,
                      checkIn: nextCheckIn,
                      checkOut: prev.checkOut && prev.checkOut < minCheckOut ? minCheckOut : prev.checkOut,
                    };
                  })
                }
              />
            </label>

            <label className="space-y-2">
              <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                <FaCalendarAlt className="text-cyan-600" />
                Check Out
              </span>
              <input
                type="date"
                className={inputCls}
                min={[today, data.checkIn || "", originalDates.checkOut].filter(Boolean).sort().slice(-1)[0] || today}
                value={data.checkOut}
                onChange={(e) => setData({ ...data, checkOut: e.target.value })}
              />
            </label>
          </div>
        </div>

        {/* ROOMS */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-slate-800">
            Room Details
          </h3>

          {rooms.map((room, index) => (
            <div
              key={`${getRoomKey(room) || index}-${index}`}
              className={`bg-white rounded-2xl p-5 shadow border ${
                getRoomKey(room) === String(focusRoomNo)
                  ? "border-cyan-300 ring-2 ring-cyan-100"
                  : "border-slate-100"
              }`}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Room Details
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <h4 className="text-lg font-black text-slate-800">
                      {getRoomKey(room)}
                    </h4>
                    {getRoomKey(room) === String(focusRoomNo) ? (
                      <span className="rounded-full bg-cyan-100 px-3 py-1 text-[11px] font-semibold text-cyan-700">
                        Selected
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {room.roomType} | ID {room.roomId || room.id || "--"}
                  </div>
                </div>

                <span className="text-sm bg-cyan-100 text-cyan-700 px-3 py-1 rounded-full">
                  Total ₹{calculateTotal(room).toFixed(0)}
                </span>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <input
                  type="number"
                  className={inputCls}
                  value={room.adults}
                  onChange={(e) =>
                    handleRoomChange(index, "adults", e.target.value)
                  }
                  placeholder="Adults"
                />

                <input
                  type="number"
                  className={inputCls}
                  value={room.children}
                  onChange={(e) =>
                    handleRoomChange(index, "children", e.target.value)
                  }
                  placeholder="Children"
                />

                <input
                  type="number"
                  className={inputCls}
                  value={room.tariff}
                  onChange={(e) =>
                    handleRoomChange(index, "tariff", e.target.value)
                  }
                  placeholder="Tariff"
                />

                <select
                  className={inputCls}
                  value={room.gst}
                  onChange={(e) =>
                    handleRoomChange(index, "gst", e.target.value)
                  }
                >
                  <option value={0}>GST 0%</option>
                  <option value={5}>GST 5%</option>
                  <option value={12}>GST 12%</option>
                  <option value={18}>GST 18%</option>
                </select>
              </div>
            </div>
          ))}
        </div>

        {/* ACTION BUTTON */}
        <div className="flex justify-end">
          <button
            onClick={handleUpdate}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-500 text-white font-bold shadow hover:scale-105 transition"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );

  if (!embedded) return content;

  return (
    <div
      className="fixed inset-0 z-[1105] flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-6xl overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.3)]"
        onClick={(event) => event.stopPropagation()}
      >
        {content}
      </div>
    </div>
  );
};

export default EditBooking;
