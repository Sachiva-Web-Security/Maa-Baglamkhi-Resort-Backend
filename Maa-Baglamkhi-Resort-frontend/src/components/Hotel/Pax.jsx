import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import API from "../../api";
import BookingCancelAction from "./BookingCancelAction";
import {
  getBookingDraft,
  getStoredBookingCode,
  getStoredBookingId,
  setBookingDraft,
  setStoredBookingId,
} from "./bookingSession";

const fieldCls =
  "w-full rounded-2xl border border-slate-200/80 bg-white px-5 py-4 text-xl font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100";

const Pax = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const bookingId = location.state?.bookingId || getStoredBookingId();
  const bookingCode = location.state?.bookingCode || getStoredBookingCode();
  const bookingRef = bookingCode || bookingId;
  const selectedRooms = useMemo(
    () => location.state?.selectedRooms || getBookingDraft("room")?.selectedRooms || {},
    [location.state?.selectedRooms],
  );
  const roomTypeMap = useMemo(
    () => {
      const stateMap = location.state?.roomTypeMap || {};
      if (Object.keys(stateMap).length) return stateMap;

      const draft = getBookingDraft("room") || {};
      if (draft.roomTypeMap && Object.keys(draft.roomTypeMap).length) {
        return draft.roomTypeMap;
      }

      const catalog = location.state?.roomCatalog || draft.roomCatalog || [];
      return catalog.reduce((acc, room) => {
        acc[String(room.id)] = room.name;
        return acc;
      }, {});
    },
    [location.state?.roomCatalog, location.state?.roomTypeMap],
  );

  const [paxData, setPaxData] = useState(getBookingDraft("pax")?.paxData || {});
  const [notice, setNotice] = useState({
    open: false,
    title: "",
    message: "",
    tone: "info",
  });

  const showNotice = (message, title = "Notice", tone = "info") => {
    setNotice({
      open: true,
      title,
      message,
      tone,
    });
  };

  useEffect(() => {
    if (bookingId) {
      setStoredBookingId(bookingId);
    }
  }, [bookingId]);

  const rooms = useMemo(() => {
    const finalRooms = [];

    Object.keys(selectedRooms || {}).forEach((roomId) => {
      (selectedRooms[roomId] || []).forEach((roomName) => {
          finalRooms.push({
            name: roomName,
            roomTypeId: roomId,
            roomTypeName: roomTypeMap[roomId] || `Room Type ${roomId}`,
          });
        });
      });

    return finalRooms;
  }, [roomTypeMap, selectedRooms]);

  useEffect(() => {
    setBookingDraft("pax", { rooms, paxData });
  }, [rooms, paxData]);

  const handleChange = (roomName, field, value) => {
    setPaxData((prev) => ({
      ...prev,
      [roomName]: {
        ...prev[roomName],
        [field]: Number(value) || 0,
      },
    }));
  };

  const getTotal = (roomName) => {
    const adults = paxData[roomName]?.adults || 0;
    const children = paxData[roomName]?.children || 0;
    return adults + children;
  };

  const handleProceed = async () => {
    if (!bookingId) {
      showNotice("Booking ID is missing. Please return to the previous step and try again.", "Booking Required", "warning");
      return;
    }

    if (!rooms.length) {
      showNotice("Please select at least one room before saving pax details.", "Rooms Required", "warning");
      return;
    }

    try {
      const rows = rooms.map((room) => ({
        roomNumber: room.name,
        adults: Number(paxData[room.name]?.adults || 0),
        children: Number(paxData[room.name]?.children || 0),
        mealPlan: "EP",
      }));

      await API.post(`/hotel/pax/${bookingId}`, {
        rows,
        adults: rows.reduce((sum, row) => sum + row.adults, 0),
        children: rows.reduce((sum, row) => sum + row.children, 0),
        mealPlan: "EP",
      });

      navigate("/hotel/room-tariff", {
        state: {
          bookingId,
          bookingCode,
          rooms,
          paxData,
        },
      });
    } catch (error) {
      console.error(error);
      showNotice(error.response?.data?.message || "Unable to save guest details right now. Please try again.", "Save Failed", "error");
    }
  };

  return (
    <div className="min-h-screen w-full bg-[linear-gradient(135deg,#f4fbff_0%,#f8fff9_42%,#fffaf1_100%)] p-4 sm:p-6">
      <div className="w-full space-y-6">
        <section className="overflow-hidden rounded-[28px] border border-white/70 bg-[linear-gradient(135deg,#08253d_0%,#0e7490_55%,#164e63_100%)] px-6 py-7 text-white shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_320px] lg:items-center">
            

            <div className="space-y-3 rounded-[24px] border border-white/15 bg-white/10 p-5 backdrop-blur">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-cyan-100/80">
                  Selected Rooms
                </div>
                <div className="mt-1 text-2xl font-black">{rooms.length}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-cyan-100/80">
                  Booking Ref
                </div>
                <div className="mt-1 text-xl font-black">{bookingRef || "Pending"}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[26px] border border-slate-200/80 bg-white/90 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
          <div className="grid gap-4 md:grid-cols-4 text-[15px] font-black uppercase tracking-[0.22em] text-slate-900">
            <div>Room No.</div>
            <div>Adults</div>
            <div>Children</div>
            <div>Total</div>
          </div>

          <div className="mt-4 space-y-4">
            {rooms.map((room, index) => (
              <div
                key={`${room.name}-${index}`}
                className="grid gap-4 rounded-[22px] border border-slate-200/80 bg-white p-5 md:grid-cols-4 md:items-center"
              >
                <div>
                  <div className="text-[30px] font-black leading-none text-slate-950">{room.name}</div>
                  <div className="mt-2 text-lg font-semibold text-slate-700">{room.roomTypeName}</div>
                </div>

                <input
                  type="number"
                  min="0"
                  placeholder="Adults"
                  value={paxData[room.name]?.adults || ""}
                  onChange={(event) => handleChange(room.name, "adults", event.target.value)}
                  className={fieldCls}
                />

                <input
                  type="number"
                  min="0"
                  placeholder="Children"
                  value={paxData[room.name]?.children || ""}
                  onChange={(event) => handleChange(room.name, "children", event.target.value)}
                  className={fieldCls}
                />

                <div className="rounded-[18px] bg-sky-50 px-5 py-5 text-center">
                  <div className="text-[14px] font-black uppercase tracking-[0.18em] text-slate-900">Total</div>
                  <div className="mt-2 text-[34px] font-black leading-none text-slate-950">
                    {getTotal(room.name)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              onClick={() => navigate("/hotel/room")}
              className="rounded-[22px] border border-slate-200 bg-white px-6 py-4 text-lg font-black text-slate-800 transition hover:bg-slate-50"
            >
              Go Back
            </button>
            <BookingCancelAction
              bookingId={bookingId}
              bookingCode={bookingCode}
              buttonClassName="sm:min-w-[170px]"
            />
            <button
              onClick={handleProceed}
              className="rounded-[22px] bg-gradient-to-r from-sky-600 to-cyan-500 px-7 py-4 text-lg font-black text-white shadow-[0_16px_35px_rgba(14,165,233,0.24)] transition hover:-translate-y-0.5"
            >
              Save & Proceed
            </button>
          </div>
        </section>

        {notice.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-[30px] border border-white/70 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-6 shadow-[0_28px_80px_rgba(15,23,42,0.24)]">
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-xl font-black shadow-sm ${
                    notice.tone === "error"
                      ? "bg-rose-50 text-rose-600"
                      : notice.tone === "warning"
                        ? "bg-amber-50 text-amber-600"
                        : "bg-sky-50 text-sky-600"
                  }`}
                >
                  !
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-[22px] font-black text-slate-950">{notice.title}</div>
                  <p className="mt-2 text-base leading-7 text-slate-700">{notice.message}</p>
                </div>
              </div>

              <div className="mt-7 flex justify-end">
                <button
                  type="button"
                  onClick={() =>
                    setNotice((prev) => ({
                      ...prev,
                      open: false,
                    }))
                  }
                  className="inline-flex min-w-[112px] items-center justify-center rounded-[18px] bg-gradient-to-r from-sky-600 to-blue-500 px-6 py-3.5 text-base font-black text-white shadow-[0_14px_35px_rgba(37,99,235,0.24)] transition hover:-translate-y-0.5"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Pax;
