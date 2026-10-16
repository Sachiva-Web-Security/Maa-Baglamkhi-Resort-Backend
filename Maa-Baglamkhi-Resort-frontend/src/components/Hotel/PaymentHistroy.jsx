import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import API from "../../api";
import { getStoredBookingCode, getStoredBookingId } from "./bookingSession";

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const PaymentHistory = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const bookingId = location.state?.bookingId || getStoredBookingId();
  const bookingCode = location.state?.bookingCode || getStoredBookingCode();
  const [payments, setPayments] = useState([]);
  const [booking, setBooking] = useState(null);
  const bookingRef = booking?.bookingCode || bookingCode || bookingId;

  useEffect(() => {
    if (!bookingId) return;

    const fetchData = async () => {
      try {
        const [paymentsRes, bookingRes] = await Promise.all([
          API.get(`/hotel/payment-history/${bookingId}`),
          API.get(`/hotel/full-booking/${bookingId}`),
        ]);

        setPayments(Array.isArray(paymentsRes.data) ? paymentsRes.data : []);
        setBooking(bookingRes.data || null);
      } catch (err) {
        console.error(err);
        alert("Failed to load payment history");
      }
    };

    fetchData();
  }, [bookingId]);

  const roomList = useMemo(() => {
    if (Array.isArray(booking?.rooms) && booking.rooms.length) {
      return booking.rooms.map((room) => room.room_number).join(", ");
    }
    return payments[0]?.rooms || "-";
  }, [booking?.rooms, payments]);

  const fallbackTableRow = useMemo(
    () => ({
      id: `fallback-${bookingId}`,
      guest_name: booking?.guest_name || "--",
      rooms: roomList,
      amount: booking?.paidAmount || 0,
      discount_amount: booking?.discountAmount || 0,
      payment_mode: booking?.payment_mode || "Summary",
      created_at: booking?.check_out || booking?.check_in || new Date().toISOString(),
      isFallback: true,
    }),
    [booking, bookingId, roomList],
  );

  if (!bookingId) {
    return <div className="p-6 text-slate-500">Booking ID missing hai.</div>;
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#f8fbff_0%,#f8fffc_45%,#fff9f2_100%)] p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="overflow-hidden rounded-[28px] border border-white/70 bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_50%,#0f766e_100%)] px-6 py-7 text-white shadow-[0_22px_60px_rgba(15,23,42,0.22)]">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-200">Payment History</p>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">Booking #{bookingRef} payment timeline</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-100/85 sm:text-base">
The booking summary will also be displayed along with the payment entries, so the table does not appear empty.          </p>
        </section>

        <section className="rounded-[28px] border border-white/70 bg-white/88 p-5 shadow-[0_18px_55px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-[22px] bg-slate-950 p-4 text-white">
              <div className="text-xs uppercase tracking-[0.2em] text-white/65">Guest</div>
              <div className="mt-2 text-lg font-black">{booking?.guest_name || payments[0]?.guest_name || "--"}</div>
            </div>
            <div className="rounded-[22px] bg-sky-50 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-sky-700">Rooms</div>
              <div className="mt-2 text-lg font-black text-sky-900">{roomList}</div>
            </div>
            <div className="rounded-[22px] bg-emerald-50 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-emerald-700">Paid</div>
              <div className="mt-2 text-lg font-black text-emerald-900">{formatCurrency(booking?.paidAmount || 0)}</div>
            </div>
            <div className="rounded-[22px] bg-amber-50 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-amber-700">Remaining</div>
              <div className="mt-2 text-lg font-black text-amber-900">{formatCurrency(booking?.remainingAmount || 0)}</div>
            </div>
          </div>

          <div className="mt-5 rounded-[22px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <div className="grid gap-3 md:grid-cols-3">
              <div><span className="font-semibold text-slate-900">Mobile:</span> {booking?.mobile || "--"}</div>
              <div><span className="font-semibold text-slate-900">Company:</span> {booking?.company_name || "--"}</div>
              <div><span className="font-semibold text-slate-900">Status:</span> {booking?.booking_status || "--"}</div>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-[24px] border border-slate-200">
            <table className="w-full">
              <thead className="bg-slate-100 text-left text-sm text-slate-700">
                <tr>
                  <th className="px-4 py-3">Guest</th>
                  <th className="px-4 py-3">Room</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Discount</th>
                  <th className="px-4 py-3">Mode</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {(payments.length ? payments : [fallbackTableRow]).map((payment) => (
                    <tr key={payment.id} className="border-t border-slate-200 text-sm text-slate-700">
                      <td className="px-4 py-3 font-semibold text-slate-900">{payment.guest_name}</td>
                      <td className="px-4 py-3">{payment.rooms}</td>
                      <td className="px-4 py-3">{formatCurrency(payment.amount)}</td>
                      <td className="px-4 py-3">{formatCurrency(payment.discount_amount || 0)}</td>
                      <td className="px-4 py-3">{payment.payment_mode}</td>
                      <td className="px-4 py-3">
                        {payment.isFallback
                          ? "No payment entry, booking summary"
                          : new Date(payment.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={() => navigate("/hotel/all-bookings")}
              className="rounded-full bg-blue-600 px-5 py-3 text-sm font-bold text-white"
            >
              Back To All Bookings
            </button>
            <button
              onClick={() => navigate("/hotel/booking-history")}
              className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700"
            >
              Open Booking History
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default PaymentHistory;
