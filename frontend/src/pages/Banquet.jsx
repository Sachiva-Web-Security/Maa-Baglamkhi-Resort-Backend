import { useEffect, useMemo, useState } from 'react';
import BanquetStepper from '../components/Banquet/BanquetStepper';
import BanquetHallCard from '../components/Banquet/BanquetHallCard';
import BanquetBookingRow from '../components/Banquet/BanquetBookingRow';
import BanquetBill from '../components/Banquet/BanquetBill';
import Modal from '../components/Hotel/Modal';
import API from "../api";

const formatINR = (amount) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

const menuPackages = [
  { id: 'standard', name: 'Standard', perGuest: 650 },
  { id: 'premium', name: 'Premium', perGuest: 950 },
  { id: 'royal', name: 'Royal', perGuest: 1250 },
];

const initialHalls = [
  { id: 'grand', name: 'Grand Ballroom', capacity: 500, ratePerHour: 12000, status: 'Available' },
  { id: 'garden', name: 'Garden Banquet', capacity: 300, ratePerHour: 9000, status: 'Available' },
  { id: 'crystal', name: 'Crystal Hall', capacity: 200, ratePerHour: 6500, status: 'Available' },
  { id: 'board', name: 'Board Room', capacity: 60, ratePerHour: 2500, status: 'Available' },
];

const steps = [
  'Select Banquet Hall',
  'Add Event Details',
  'Assign Date & Time',
  'Confirm Booking',
  'Event Completed',
  'Generate Bill',
];

function hoursBetween(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  const diff = endMin - startMin;
  if (diff <= 0) return 0;
  return Math.max(1, Math.ceil(diff / 60));
}

const Banquet = () => {
  const [halls, setHalls] = useState(initialHalls);
  const [activeStep, setActiveStep] = useState(0);

  const [wizard, setWizard] = useState({
    hallId: '',
    customerName: '',
    phone: '',
    eventType: 'Wedding',
    guests: 150,
    menuPackageId: 'standard',
    decorationFee: 15000,
    notes: '',
    date: '',
    startTime: '18:00',
    endTime: '22:00',
    discount: 0,
    gstPercent: 5,
  });

  const [bookings, setBookings] = useState([]);

  const [modals, setModals] = useState({ viewBill: false });
  const [selectedBooking, setSelectedBooking] = useState(null);

  const selectedHall = useMemo(() => halls.find((h) => h.code === wizard.hallId || h.id === wizard.hallId) || null, [halls, wizard.hallId]);
  const selectedPackage = useMemo(
    () => menuPackages.find((p) => p.id === wizard.menuPackageId) || menuPackages[0],
    [wizard.menuPackageId],
  );

  const wizardHours = useMemo(() => hoursBetween(wizard.startTime, wizard.endTime), [wizard.startTime, wizard.endTime]);

  const wizardTotals = useMemo(() => {
    const hallCharge = selectedHall ? selectedHall.ratePerHour * wizardHours : 0;
    const foodCharge = (Number(wizard.guests) || 0) * (selectedPackage?.perGuest || 0);
    const decoration = Number(wizard.decorationFee) || 0;
    const subTotal = hallCharge + foodCharge + decoration;
    const discount = Math.min(subTotal, Number(wizard.discount) || 0);
    const taxable = Math.max(0, subTotal - discount);
    const gst = Math.round((taxable * (Number(wizard.gstPercent) || 0)) / 100);
    const grandTotal = taxable + gst;
    return { hallCharge, foodCharge, decoration, subTotal, discount, taxable, gst, grandTotal };
  }, [
    selectedHall,
    wizardHours,
    wizard.guests,
    wizard.decorationFee,
    wizard.discount,
    wizard.gstPercent,
    selectedPackage,
  ]);

  const openModal = (name) => setModals((prev) => ({ ...prev, [name]: true }));
  const closeModal = (name) => setModals((prev) => ({ ...prev, [name]: false }));

  const resetWizard = () => {
    setWizard((prev) => ({
      ...prev,
      hallId: '',
      customerName: '',
      phone: '',
      eventType: 'Wedding',
      guests: 150,
      menuPackageId: 'standard',
      decorationFee: 15000,
      notes: '',
      date: '',
      startTime: '18:00',
      endTime: '22:00',
      discount: 0,
      gstPercent: 5,
    }));
    setActiveStep(0);
  };

  const canNext = useMemo(() => {
    if (activeStep === 0) return Boolean(wizard.hallId);
    if (activeStep === 1) return Boolean(wizard.customerName.trim()) && Boolean(wizard.phone.trim());
    if (activeStep === 2) return Boolean(wizard.date) && Boolean(wizard.startTime) && Boolean(wizard.endTime) && wizardHours > 0;
    if (activeStep === 3) return true;
    return false;
  }, [activeStep, wizard.hallId, wizard.customerName, wizard.phone, wizard.date, wizard.startTime, wizard.endTime, wizardHours]);

  const goNext = () => {
    if (!canNext) return;
    setActiveStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const goBack = () => setActiveStep((s) => Math.max(0, s - 1));

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await API.get("/banquet");
        if (res.data?.halls) {
          setHalls(
            res.data.halls.map((h) => ({
              id: h.code || h.id,
              code: h.code,
              name: h.name,
              capacity: h.capacity,
              ratePerHour: h.ratePerHour,
              status: h.status,
            }))
          );
        }
        if (res.data?.bookings) {
          setBookings(res.data.bookings);
        }
      } catch (err) {
        console.error("Error loading banquet data", err);
      }
    };
    fetchData();
  }, []);

  const handleConfirmBooking = async () => {
    if (!selectedHall) return;

    const payload = {
      hallId: selectedHall.id || selectedHall.code,
      customerName: wizard.customerName,
      phone: wizard.phone,
      eventType: wizard.eventType,
      guests: Number(wizard.guests) || 0,
      menuPackageId: wizard.menuPackageId,
      decorationFee: Number(wizard.decorationFee) || 0,
      notes: wizard.notes,
      date: wizard.date,
      startTime: wizard.startTime,
      endTime: wizard.endTime,
      discount: wizard.discount,
      gstPercent: wizard.gstPercent,
    };

    try {
      const res = await API.post("/banquet", payload);
      const newId = res.data?.id || Date.now();
      const hallName = selectedHall.name;
      setBookings((prev) => [
        {
          id: newId,
          hallId: selectedHall.id || selectedHall.code,
          hallName,
          customerName: wizard.customerName,
          phone: wizard.phone,
          eventType: wizard.eventType,
          guests: Number(wizard.guests) || 0,
          menuPackageId: wizard.menuPackageId,
          decorationFee: Number(wizard.decorationFee) || 0,
          notes: wizard.notes,
          date: wizard.date,
          startTime: wizard.startTime,
          endTime: wizard.endTime,
          status: 'Confirmed',
          invoiceNo: '',
        },
        ...prev,
      ]);
      setActiveStep(4);
      alert(`Booking Confirmed for ${wizard.customerName} (${hallName})`);
    } catch (err) {
      console.error("Error creating banquet booking", err);
      alert("Error creating booking");
    }
  };

  const markCompleted = async (booking) => {
    try {
      await API.put(`/banquet/${booking.id}/complete`);
      setBookings((prev) => prev.map((b) => (b.id === booking.id ? { ...b, status: 'Completed' } : b)));
      alert(`Event marked completed: ${booking.hallName}`);
    } catch (err) {
      console.error("Error marking completed", err);
      alert("Error marking completed");
    }
  };

  const generateBill = async (booking) => {
    try {
      const res = await API.put(`/banquet/${booking.id}/bill`, {
        invoiceNo: booking.invoiceNo,
      });
      const invoiceNo = res.data?.invoiceNo || booking.invoiceNo;
      const updated = { ...booking, invoiceNo, status: 'Billed' };
      setBookings((prev) => prev.map((b) => (b.id === booking.id ? updated : b)));
      setSelectedBooking(updated);
      openModal('viewBill');
    } catch (err) {
      console.error("Error billing booking", err);
      alert("Error generating bill");
    }
  };

  const hallStats = useMemo(() => {
    const total = halls.length;
    const upcoming = bookings.filter((b) => b.status === 'Confirmed').length;
    const completed = bookings.filter((b) => b.status === 'Completed' || b.status === 'Billed').length;
    const billed = bookings.filter((b) => b.status === 'Billed').length;
    return { total, upcoming, completed, billed };
  }, [halls.length, bookings]);

  return (
    <div className="min-h-screen bg-gray-100 pt-[100px] px-[30px] pb-[30px]">
      <h1 className="text-2xl font-extrabold text-gray-900 mb-5">Banquet Management</h1>

      <div className="flex flex-wrap gap-3 mb-5">
        <button
          className="bg-blue-600 text-white px-4 py-2.5 rounded-lg font-extrabold hover:opacity-90 hover:-translate-y-0.5 active:translate-y-0 transition-all"
          onClick={resetWizard}
        >
          + New Booking
        </button>
        <button
          className="bg-green-600 text-white px-4 py-2.5 rounded-lg font-extrabold hover:opacity-90 hover:-translate-y-0.5 active:translate-y-0 transition-all"
          onClick={() => alert(`Upcoming: ${hallStats.upcoming}\nCompleted: ${hallStats.completed}\nBilled: ${hallStats.billed}`)}
        >
          Quick Summary
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="text-gray-600 font-extrabold text-xs mb-2">Total Halls</div>
          <div className="text-gray-900 font-black text-xl">{hallStats.total}</div>
        </div>
        <div className="bg-green-100 rounded-xl shadow-sm p-4">
          <div className="text-gray-600 font-extrabold text-xs mb-2">Upcoming Events</div>
          <div className="text-green-600 font-black text-xl">{hallStats.upcoming}</div>
        </div>
        <div className="bg-yellow-100 rounded-xl shadow-sm p-4">
          <div className="text-gray-600 font-extrabold text-xs mb-2">Completed</div>
          <div className="text-yellow-700 font-black text-xl">{hallStats.completed}</div>
        </div>
        <div className="bg-purple-100 rounded-xl shadow-sm p-4">
          <div className="text-gray-600 font-extrabold text-xs mb-2">Billed</div>
          <div className="text-purple-600 font-black text-xl">{hallStats.billed}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-5">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-base font-black text-gray-900">Booking Flow</h2>
          <div className="text-gray-600 text-xs font-semibold mt-1.5">Select Hall → Details → Date/Time → Confirm → Completed → Bill</div>
        </div>

        <BanquetStepper steps={steps} activeStep={activeStep} />

        <div className="p-4">
          {activeStep === 0 && (
            <div>
              <h3 className="text-sm font-black text-gray-900 mb-3">Select Banquet Hall</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {halls.map((hall) => (
                  <BanquetHallCard
                    key={hall.id}
                    hall={hall}
                    selected={wizard.hallId === (hall.code || hall.id)}
                    onSelect={() => setWizard((prev) => ({ ...prev, hallId: hall.code || hall.id }))}
                  />
                ))}
              </div>
            </div>
          )}

          {activeStep === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-black text-gray-700">Customer Name</label>
                <input
                  className="border border-gray-300 rounded-lg px-3 py-2.5 font-bold text-gray-900 focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  value={wizard.customerName}
                  onChange={(e) => setWizard((p) => ({ ...p, customerName: e.target.value }))}
                  placeholder="Enter customer name"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-black text-gray-700">Phone</label>
                <input
                  className="border border-gray-300 rounded-lg px-3 py-2.5 font-bold text-gray-900 focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  value={wizard.phone}
                  onChange={(e) => setWizard((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="Enter phone number"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-black text-gray-700">Event Type</label>
                <select
                  className="border border-gray-300 rounded-lg px-3 py-2.5 font-bold text-gray-900 focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  value={wizard.eventType}
                  onChange={(e) => setWizard((p) => ({ ...p, eventType: e.target.value }))}
                >
                  <option>Wedding</option>
                  <option>Reception</option>
                  <option>Birthday</option>
                  <option>Engagement</option>
                  <option>Conference</option>
                  <option>Corporate</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-black text-gray-700">Guests</label>
                <input
                  type="number"
                  className="border border-gray-300 rounded-lg px-3 py-2.5 font-bold text-gray-900 focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  value={wizard.guests}
                  onChange={(e) => setWizard((p) => ({ ...p, guests: e.target.value }))}
                  min={1}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-black text-gray-700">Menu Package</label>
                <select
                  className="border border-gray-300 rounded-lg px-3 py-2.5 font-bold text-gray-900 focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  value={wizard.menuPackageId}
                  onChange={(e) => setWizard((p) => ({ ...p, menuPackageId: e.target.value }))}
                >
                  {menuPackages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({formatINR(p.perGuest)}/guest)
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-black text-gray-700">Decoration Fee</label>
                <input
                  type="number"
                  className="border border-gray-300 rounded-lg px-3 py-2.5 font-bold text-gray-900 focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  value={wizard.decorationFee}
                  onChange={(e) => setWizard((p) => ({ ...p, decorationFee: e.target.value }))}
                  min={0}
                />
              </div>
              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-xs font-black text-gray-700">Notes</label>
                <textarea
                  className="border border-gray-300 rounded-lg px-3 py-2.5 font-bold text-gray-900 min-h-[90px] focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 resize-y"
                  value={wizard.notes}
                  onChange={(e) => setWizard((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Any special instructions..."
                />
              </div>
            </div>
          )}

          {activeStep === 2 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-black text-gray-700">Event Date</label>
                <input
                  type="date"
                  className="border border-gray-300 rounded-lg px-3 py-2.5 font-bold text-gray-900 focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  value={wizard.date}
                  onChange={(e) => setWizard((p) => ({ ...p, date: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-black text-gray-700">Start Time</label>
                <input
                  type="time"
                  className="border border-gray-300 rounded-lg px-3 py-2.5 font-bold text-gray-900 focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  value={wizard.startTime}
                  onChange={(e) => setWizard((p) => ({ ...p, startTime: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-black text-gray-700">End Time</label>
                <input
                  type="time"
                  className="border border-gray-300 rounded-lg px-3 py-2.5 font-bold text-gray-900 focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  value={wizard.endTime}
                  onChange={(e) => setWizard((p) => ({ ...p, endTime: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-black text-gray-700">Duration</label>
                <div className="bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 font-extrabold text-gray-900">
                  {wizardHours > 0 ? `${wizardHours} hour(s)` : 'Select valid times'}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-black text-gray-700">Discount</label>
                <input
                  type="number"
                  className="border border-gray-300 rounded-lg px-3 py-2.5 font-bold text-gray-900 focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  value={wizard.discount}
                  onChange={(e) => setWizard((p) => ({ ...p, discount: e.target.value }))}
                  min={0}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-black text-gray-700">GST %</label>
                <input
                  type="number"
                  className="border border-gray-300 rounded-lg px-3 py-2.5 font-bold text-gray-900 focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  value={wizard.gstPercent}
                  onChange={(e) => setWizard((p) => ({ ...p, gstPercent: e.target.value }))}
                  min={0}
                />
              </div>
            </div>
          )}

          {activeStep === 3 && (
            <div>
              <h3 className="text-sm font-black text-gray-900 mb-3">Confirm Booking</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="border border-gray-200 rounded-xl p-3.5">
                  <div className="flex justify-between gap-2.5 py-2.5 border-b border-gray-100">
                    <span className="text-gray-600 font-extrabold text-xs">Hall</span>
                    <span className="text-gray-900 font-extrabold text-xs text-right">{selectedHall ? selectedHall.name : '-'}</span>
                  </div>
                  <div className="flex justify-between gap-2.5 py-2.5 border-b border-gray-100">
                    <span className="text-gray-600 font-extrabold text-xs">Customer</span>
                    <span className="text-gray-900 font-extrabold text-xs text-right">{wizard.customerName || '-'}</span>
                  </div>
                  <div className="flex justify-between gap-2.5 py-2.5 border-b border-gray-100">
                    <span className="text-gray-600 font-extrabold text-xs">Event</span>
                    <span className="text-gray-900 font-extrabold text-xs text-right">{wizard.eventType}</span>
                  </div>
                  <div className="flex justify-between gap-2.5 py-2.5 border-b border-gray-100">
                    <span className="text-gray-600 font-extrabold text-xs">Guests</span>
                    <span className="text-gray-900 font-extrabold text-xs text-right">{wizard.guests}</span>
                  </div>
                  <div className="flex justify-between gap-2.5 py-2.5">
                    <span className="text-gray-600 font-extrabold text-xs">Date & Time</span>
                    <span className="text-gray-900 font-extrabold text-xs text-right">
                      {wizard.date || '-'} ({wizard.startTime} - {wizard.endTime})
                    </span>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-xl p-3.5">
                  <div className="flex justify-between gap-2.5 py-2.5 border-b border-gray-100">
                    <span className="text-gray-600 font-extrabold text-xs">Hall Charges</span>
                    <span className="text-gray-900 font-extrabold text-xs text-right">{formatINR(wizardTotals.hallCharge)}</span>
                  </div>
                  <div className="flex justify-between gap-2.5 py-2.5 border-b border-gray-100">
                    <span className="text-gray-600 font-extrabold text-xs">Food Charges</span>
                    <span className="text-gray-900 font-extrabold text-xs text-right">{formatINR(wizardTotals.foodCharge)}</span>
                  </div>
                  <div className="flex justify-between gap-2.5 py-2.5 border-b border-gray-100">
                    <span className="text-gray-600 font-extrabold text-xs">Decoration</span>
                    <span className="text-gray-900 font-extrabold text-xs text-right">{formatINR(wizardTotals.decoration)}</span>
                  </div>
                  <div className="flex justify-between gap-2.5 py-2.5 border-b border-gray-100">
                    <span className="text-gray-600 font-extrabold text-xs">Discount</span>
                    <span className="text-gray-900 font-extrabold text-xs text-right">- {formatINR(wizardTotals.discount)}</span>
                  </div>
                  <div className="flex justify-between gap-2.5 py-2.5 border-b border-gray-100">
                    <span className="text-gray-600 font-extrabold text-xs">GST</span>
                    <span className="text-gray-900 font-extrabold text-xs text-right">{formatINR(wizardTotals.gst)}</span>
                  </div>
                  <div className="flex justify-between gap-2.5 py-2.5">
                    <span className="text-gray-900 font-black text-xs">Grand Total</span>
                    <span className="text-gray-900 font-black text-xs text-right">{formatINR(wizardTotals.grandTotal)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex justify-end">
                <button
                  className="bg-blue-600 text-white px-4 py-2.5 rounded-lg font-extrabold hover:opacity-90 hover:-translate-y-0.5 active:translate-y-0 transition-all"
                  onClick={handleConfirmBooking}
                >
                  Confirm Booking
                </button>
              </div>
            </div>
          )}

          {activeStep === 4 && (
            <div>
              <h3 className="text-sm font-black text-gray-900 mb-3">Event Completed</h3>
              <p className="text-gray-600 text-xs font-semibold mb-3">
                You can mark the event as completed from the booking list below, then generate the bill.
              </p>
              <div className="flex justify-end">
                <button
                  className="bg-blue-600 text-white px-4 py-2.5 rounded-lg font-extrabold hover:opacity-90 hover:-translate-y-0.5 active:translate-y-0 transition-all"
                  onClick={() => setActiveStep(5)}
                >
                  Go to Generate Bill
                </button>
              </div>
            </div>
          )}

          {activeStep === 5 && (
            <div>
              <h3 className="text-sm font-black text-gray-900 mb-3">Generate Bill</h3>
              <p className="text-gray-600 text-xs font-semibold">Select a completed/confirmed event from the list and click "Generate Bill".</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 flex justify-end gap-2.5">
          <button
            className="bg-gray-100 text-gray-900 px-4 py-2.5 rounded-lg font-extrabold hover:opacity-90 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
            onClick={goBack}
            disabled={activeStep === 0}
          >
            Back
          </button>
          <button
            className="bg-blue-600 text-white px-4 py-2.5 rounded-lg font-extrabold hover:opacity-90 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
            onClick={goNext}
            disabled={activeStep >= 3 || !canNext}
            title={activeStep >= 3 ? 'Use Confirm Booking' : !canNext ? 'Complete this step to continue' : 'Next'}
          >
            Next
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-baseline justify-between gap-3">
          <h2 className="text-base font-black text-gray-900">Bookings</h2>
          <div className="text-gray-600 text-xs font-bold">Use actions to complete event and generate bill.</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-3 py-3 text-xs font-black text-gray-700">Hall</th>
                <th className="px-3 py-3 text-xs font-black text-gray-700">Customer</th>
                <th className="px-3 py-3 text-xs font-black text-gray-700">Event</th>
                <th className="px-3 py-3 text-xs font-black text-gray-700">Date</th>
                <th className="px-3 py-3 text-xs font-black text-gray-700">Time</th>
                <th className="px-3 py-3 text-xs font-black text-gray-700">Status</th>
                <th className="px-3 py-3 text-xs font-black text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <BanquetBookingRow
                  key={b.id}
                  booking={b}
                  onComplete={() => markCompleted(b)}
                  onGenerateBill={() => generateBill(b)}
                  onView={() => {
                    setSelectedBooking(b);
                    openModal('viewBill');
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={modals.viewBill} onClose={() => closeModal('viewBill')} title="Banquet Bill / Invoice (Demo)">
        {selectedBooking ? (
          <BanquetBill booking={selectedBooking} halls={halls} menuPackages={menuPackages} formatINR={formatINR} />
        ) : (
          <div className="text-gray-600 text-xs font-semibold">No booking selected.</div>
        )}
      </Modal>
    </div>
  );
};

export default Banquet;


