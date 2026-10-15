require("dotenv").config({ quiet: true });

/**
 * Reproduces the REAL frontend booking sequence from BookingFlow.jsx rather
 * than a synthetic one:
 *
 *   1. POST /hotel/guest            (no roomNumber — the UI doesn't send it)
 *   2. POST /hotel/other-booking/:id
 *   3. POST /hotel/reference/:id
 *   4. POST /hotel/company/:id
 *   5. POST /hotel/room-tariff/:id  (this is what writes booking_rooms)
 *   6. POST /hotel/pax/:id          (UPDATEs the same row's adults/children)
 *   7. POST /hotel/advance/:id      (optional)
 *
 * Then checks the invoice that auto-confirm generated. The reported symptom was
 * "[auto-confirm] failed ... Unknown column 'status' in 'invoices'" on every
 * booking, so this asserts the invoice exists and is priced.
 */

const ROOT = "http://127.0.0.1:5002/api";

const call = async (method, path, body, token) => {
  const res = await fetch(ROOT + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
};

const iso = (offsetDays) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

async function main() {
  const login = await call("POST", "/auth/login", {
    email: "verify.reception@test.com",
    password: "Verify@123",
  });
  if (login.status !== 200) {
    console.error(`Login failed (${login.status}):`, login.data);
    process.exit(1);
  }
  const token = login.data.token;

  const setup = await call("GET", "/hotel/rooms/setup", null, token);
  const checkIn = iso(60);
  const checkOut = iso(62);
  const nights = 2;

  let chosen = null;
  for (const cat of setup.data || []) {
    for (const rn of cat.rooms || []) {
      const probe = await call(
        "POST",
        "/hotel/rooms/validate-availability",
        { roomNumbers: [rn], checkIn, checkOut },
        token,
      );
      if (probe.status === 200 && probe.data?.available) {
        chosen = { cat, rn };
        break;
      }
    }
    if (chosen) break;
  }
  if (!chosen) {
    console.error("No free room available in the test window.");
    process.exit(1);
  }

  const tariff = Number(chosen.cat.defaultPrice || 2500);
  console.log(`Booking room ${chosen.rn} (${chosen.cat.name}) @ ${tariff}/night for ${nights} nights.`);

  // 1. guest
  const guestRes = await call(
    "POST",
    "/hotel/guest",
    {
      agentBooking: false,
      bookingPoint: "",
      mobile: "9900003333",
      guestName: "Invoice Sequence Guest",
      guestEmail: "invoice-seq@test.com",
      checkIn,
      checkOut,
      arrival: "12:00",
      departure: "11:00",
      bookingStatus: "Confirmed",
      bookedBy: "Front Desk",
      bookingType: "Walk-in",
      idProofType: "",
      idProofNumber: "",
    },
    token,
  );
  if (guestRes.status >= 400) {
    console.error(`POST /hotel/guest FAILED (${guestRes.status}):`, guestRes.data);
    process.exit(1);
  }
  const bookingId = guestRes.data.bookingId;
  console.log(`  1. guest created      -> ${bookingId}`);

  // 2-4. secondary fragments (all settled independently by the UI)
  for (const [label, path, payload] of [
    ["other-booking", `/hotel/other-booking/${bookingId}`, { bookingType: "Walk-in", bookingSource: "Walk-in", bookingReference: "", address: "", country: "", state: "", city: "", pincode: "" }],
    ["reference", `/hotel/reference/${bookingId}`, { guestType: "", guestNotes: "", internalNotes: "" }],
    ["company", `/hotel/company/${bookingId}`, { companyName: "Direct Booking", gst: "" }],
  ]) {
    const r = await call("POST", path, payload, token);
    console.log(`  ${label.padEnd(14)} -> ${r.status}`);
    if (r.status >= 500) console.error(`     ${JSON.stringify(r.data)}`);
  }

  // 5. room-tariff — the call that actually creates booking_rooms
  const tariffRes = await call(
    "POST",
    `/hotel/room-tariff/${bookingId}`,
    {
      roomNumber: chosen.rn,
      date: new Date().toISOString().slice(0, 19).replace("T", " "),
      quantity: 1,
      tariff,
      gstPercent: 0,
      total: tariff * nights,
    },
    token,
  );
  console.log(`  5. room-tariff       -> ${tariffRes.status} ${JSON.stringify(tariffRes.data).slice(0, 90)}`);
  if (tariffRes.status >= 400) {
    console.error("room-tariff failed — booking_rooms was not written.");
    process.exit(1);
  }

  // 6. pax
  const paxRes = await call(
    "POST",
    `/hotel/pax/${bookingId}`,
    { roomNumber: chosen.rn, adults: 2, children: 0 },
    token,
  );
  console.log(`  6. pax              -> ${paxRes.status}`);

  // 7. advance (mirrors "amount > 0" branch)
  const advRes = await call(
    "POST",
    `/hotel/advance/${bookingId}`,
    { amount: 500, discount: 0, paymentMode: "Cash", notes: "invoice verify" },
    token,
  );
  console.log(`  7. advance          -> ${advRes.status}`);

  await new Promise((r) => setTimeout(r, 5000));

  const db = require("../src/config/db");
  const q = (sql, params) =>
    new Promise((resolve, reject) => {
      db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
    });

  const inv = await q(
    `SELECT id, invoice_no, customer_name, phone, room_no, payment_status, status,
            subtotal, final_total, total_amount, items_json
     FROM invoices WHERE booking_id = ? OR customer_id = ?`,
    [bookingId, bookingId],
  );
  const rooms = await q(
    "SELECT room_id, category_id, rate_per_night, nights, total, adults, children FROM booking_rooms WHERE booking_id = ?",
    [bookingId],
  );

  console.log(`\nbooking_rooms rows: ${rooms.length}`);
  rooms.forEach((r) =>
    console.log(
      `  room_id=${r.room_id} rate=${r.rate_per_night} nights=${r.nights} total=${r.total} pax=${r.adults}+${r.children}`,
    ),
  );

  console.log(`\ninvoices: ${inv.length}`);
  if (!inv.length) {
    console.error("\nFAIL: auto-confirm produced no invoice.");
    process.exit(1);
  }
  const i = inv[0];
  let items = [];
  try {
    items = JSON.parse(i.items_json || "[]");
  } catch {}
  console.log(`  no=${i.invoice_no} customer=${i.customer_name}/${i.phone}`);
  console.log(`  room_no=${i.room_no}  payment_status=${JSON.stringify(i.payment_status)} (label ${JSON.stringify(i.status)})`);
  console.log(`  subtotal=${i.subtotal} total=${i.final_total ?? i.total_amount} items=${items.length}`);
  items.forEach((it) => console.log(`    - ${it.name} x${it.quantity} ${it.total}`));

  const failures = [];
  if (!rooms.length) failures.push("no booking_rooms row (room-tariff path broken)");
  if (!String(i.room_no || "").trim()) failures.push("invoice room_no empty");
  if (Number(i.subtotal || 0) <= 0) failures.push("invoice subtotal is 0 — room line not priced");
  if (i.payment_status === null || i.payment_status === "") failures.push("payment_status blank");
  if (!String(i.customer_name || "").trim()) failures.push("customer_name empty");

  if (failures.length) {
    console.error(`\nFAIL: ${failures.join("; ")}`);
    process.exit(1);
  }

  console.log("\nRESULT: real frontend booking sequence produces a priced invoice with no auto-confirm error.");
  process.exit(0);
}

main().catch((err) => {
  console.error("verification failed:", err.message);
  process.exit(1);
});
