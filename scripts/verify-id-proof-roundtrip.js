require("dotenv").config({ quiet: true });

/**
 * Full round-trip for ID Proof / ID Number, including the EDIT path.
 *
 * 1. POST /hotel/guest with idProofType/idProofNumber  -> saved
 * 2. GET  /hotel/full-booking/:id                       -> returned as
 *    id_proof_type/id_proof_number (what Guest Information renders)
 * 3. PUT  /hotel/full-booking/:id with changed values   -> updated in place
 * 4. GET  again                                          -> new values, and
 *    exactly one guest_identifications row (no duplicates)
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

  const db = require("../src/config/db");
  const q = (sql, params) =>
    new Promise((resolve, reject) => {
      db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
    });

  const idRowsFor = async (bookingId) =>
    q(
      "SELECT id, id_type, id_number FROM guest_identifications WHERE booking_id = ? ORDER BY id ASC",
      [bookingId],
    );

  const checkIn = iso(150);
  const checkOut = iso(152);

  // ── 1. create ───────────────────────────────────────────────────────────
  const created = await call(
    "POST",
    "/hotel/guest",
    {
      guestName: "Id Round Trip Guest",
      mobile: "9900007777",
      guestEmail: "id-roundtrip@test.com",
      checkIn,
      checkOut,
      bookingStatus: "Confirmed",
      idProofType: "Aadhar Card",
      idProofNumber: "1234 5678 9012",
    },
    token,
  );
  if (created.status >= 400) {
    console.error(`create failed (${created.status}):`, created.data);
    process.exit(1);
  }
  const bookingId = created.data.bookingId;
  console.log(`1. created booking ${bookingId}`);

  let rows = await idRowsFor(bookingId);
  console.log(`   db row: ${JSON.stringify(rows[0])}`);
  if (!rows.length || rows[0].id_type !== "aadhaar" || rows[0].id_number !== "1234 5678 9012") {
    console.error("   FAIL: ID not saved on create");
    process.exit(1);
  }

  // ── 2. read back ────────────────────────────────────────────────────────
  const full1 = await call("GET", `/hotel/full-booking/${bookingId}`, null, token);
  const d1 = full1.data || {};
  console.log(`2. api returns: id_proof_type=${JSON.stringify(d1.id_proof_type)} id_proof_number=${JSON.stringify(d1.id_proof_number)}`);
  if (d1.id_proof_type !== "aadhaar" || d1.id_proof_number !== "1234 5678 9012") {
    console.error("   FAIL: ID not returned by full-booking");
    process.exit(1);
  }

  // ── 3. edit ─────────────────────────────────────────────────────────────
  const updated = await call(
    "PUT",
    `/hotel/full-booking/${bookingId}`,
    {
      guest_name: "Id Round Trip Guest",
      mobile: "9900007777",
      checkIn,
      checkOut,
      rooms: [],
      idProofType: "Passport",
      idProofNumber: "M9876543",
    },
    token,
  );
  console.log(`3. PUT /hotel/full-booking -> ${updated.status}`);
  if (updated.status >= 400) {
    console.error("   FAIL: edit rejected:", updated.data);
    process.exit(1);
  }

  rows = await idRowsFor(bookingId);
  console.log(`   db rows after edit: ${rows.length}`);
  rows.forEach((r) => console.log(`     id=${r.id} type=${JSON.stringify(r.id_type)} number=${JSON.stringify(r.id_number)}`));
  if (rows.length !== 1) {
    console.error(`   FAIL: expected 1 guest_identifications row, found ${rows.length} (duplicate inserts)`);
    process.exit(1);
  }
  if (rows[0].id_type !== "passport" || rows[0].id_number !== "M9876543") {
    console.error("   FAIL: edit did not update the ID row");
    process.exit(1);
  }

  // ── 4. read back again ──────────────────────────────────────────────────
  const full2 = await call("GET", `/hotel/full-booking/${bookingId}`, null, token);
  const d2 = full2.data || {};
  console.log(`4. api returns: id_proof_type=${JSON.stringify(d2.id_proof_type)} id_proof_number=${JSON.stringify(d2.id_proof_number)}`);
  if (d2.id_proof_type !== "passport" || d2.id_proof_number !== "M9876543") {
    console.error("   FAIL: updated ID not returned after edit");
    process.exit(1);
  }

  // ── 5. clearing both must not leave a stale row ─────────────────────────
  const cleared = await call(
    "PUT",
    `/hotel/full-booking/${bookingId}`,
    { checkIn, checkOut, rooms: [], idProofType: "", idProofNumber: "" },
    token,
  );
  if (cleared.status >= 400) {
    console.error(`   FAIL: clearing rejected: ${JSON.stringify(cleared.data)}`);
    process.exit(1);
  }
  const clearedRows = await idRowsFor(bookingId);
  const clearedApi = (await call("GET", `/hotel/full-booking/${bookingId}`, null, token)).data || {};
  console.log(
    `5. cleared -> db row: ${JSON.stringify(clearedRows[0])}, api: ${JSON.stringify(clearedApi.id_proof_type)}`,
  );
  if (clearedApi.id_proof_type || clearedApi.id_proof_number) {
    console.error("   FAIL: clearing left a stale value");
    process.exit(1);
  }

  console.log("\nRESULT: ID Proof / ID Number saved, read back, edited, and cleared correctly.");
  process.exit(0);
}

main().catch((err) => {
  console.error("verification failed:", err.message);
  process.exit(1);
});
