require("dotenv").config({ quiet: true });

/**
 * End-to-end re-verification of the auto-confirm invoice path after the v1 -> v4
 * rewrite. Creates a booking through the same controller path that was logging
 * "[auto-confirm] failed for booking N", then checks an invoice row exists with
 * a valid payment_status.
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
  const email = "verify.reception@test.com";
  const password = "Verify@123";

  const login = await call("POST", "/auth/login", { email, password });
  if (login.status !== 200) {
    console.error(`Login failed (${login.status}):`, login.data);
    process.exit(1);
  }
  const token = login.data.token;

  const setup = await call("GET", "/hotel/rooms/setup", null, token);
  const checkIn = iso(60);
  const checkOut = iso(62);

  let chosen = null;
  for (const cat of setup.data || []) {
    for (const rn of cat.rooms || []) {
      const probe = await call(
        "POST",
        "/hotel/rooms/validate-availability",
        { rooms: [{ roomNumber: rn }], checkIn, checkOut },
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

  console.log(`Creating a booking for room ${chosen.rn} (${chosen.cat.name})...`);
  const created = await call(
    "POST",
    "/hotel/guest",
    {
      guestName: "Invoice Verify Guest",
      mobile: "9900002222",
      guestEmail: "invoice-verify@test.com",
      checkIn,
      checkOut,
      arrival: "12:00",
      departure: "11:00",
      bookingStatus: "Confirmed",
      adults: 2,
      roomType: chosen.cat.name,
      roomNumber: chosen.rn,
    },
    token,
  );

  if (created.status >= 400) {
    console.error(`Booking FAILED (${created.status}):`, created.data);
    process.exit(1);
  }
  const bookingId = created.data?.bookingId;
  console.log(`  Booking created (id ${bookingId}).`);

  // The controller's catch runs asynchronously after the response.
  await new Promise((r) => setTimeout(r, 5000));

  const db = require("../src/config/db");
  const q = (sql, params) =>
    new Promise((resolve, reject) => {
      db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
    });

  const rows = await q(
    `SELECT id, invoice_no, customer_name, phone, room_no, payment_status, status,
            subtotal, final_total, total_amount, items_json, check_in, check_out
     FROM invoices WHERE booking_id = ? OR customer_id = ?`,
    [bookingId, bookingId],
  );

  console.log(`\nInvoices for booking ${bookingId}: ${rows.length}`);
  for (const r of rows) {
    let items = [];
    try {
      items = JSON.parse(r.items_json || "[]");
    } catch {}
    console.log(`  id=${r.id} no=${r.invoice_no}`);
    console.log(`    customer    = ${r.customer_name} / ${r.phone}`);
    console.log(`    room_no     = ${r.room_no}`);
    console.log(`    stay        = ${r.check_in} -> ${r.check_out}`);
    console.log(`    payment     = ${JSON.stringify(r.payment_status)} (status label ${JSON.stringify(r.status)})`);
    console.log(`    subtotal    = ${r.subtotal}  total = ${r.final_total ?? r.total_amount}`);
    console.log(`    line items  = ${items.length}`);
    for (const it of items.slice(0, 6)) {
      console.log(`      - ${it.name}  x${it.quantity}  ${it.total}`);
    }
  }

  if (!rows.length) {
    console.error("\nFAIL: no invoice row was written for this booking.");
    process.exit(1);
  }
  const inv = rows[0];
  if (inv.payment_status === null || inv.payment_status === "") {
    console.error("\nFAIL: payment_status is blank.");
    process.exit(1);
  }
  if (!inv.customer_name || String(inv.customer_name).trim() === "") {
    console.error("\nFAIL: customer_name is empty — the v4 guest join did not resolve.");
    process.exit(1);
  }
  if (!inv.room_no || String(inv.room_no).trim() === "") {
    console.error("\nFAIL: room_no is empty — the booking_rooms join did not resolve.");
    process.exit(1);
  }

  console.log("\nRESULT: invoice generated from the v4 schema with a valid payment_status.");
  process.exit(0);
}

main().catch((err) => {
  console.error("verification failed:", err.message);
  process.exit(1);
});
