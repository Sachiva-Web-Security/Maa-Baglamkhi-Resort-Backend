require("dotenv").config({ quiet: true });

/**
 * Verifies the ID Proof / ID Number fix across the whole stack.
 *
 * Reported symptoms:
 *   1. The ID number did not display correctly while typing.
 *   2. After submitting, both ID Proof and ID Number showed "-" in Guest
 *      Information.
 *
 * Path under test:
 *   frontend formData.idProofType / formData.idNumber
 *     -> POST /hotel/guest { idProofType, idProofNumber }
 *       -> guest_identifications (id_type ENUM, id_number)
 *     -> GET  /hotel/full-booking/:id { id_proof_type, id_proof_number }
 *       -> Guest Information panel
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

// Every option the New Booking form offers, with the enum member it must map to.
const CASES = [
  { label: "Aadhar Card", expect: "aadhaar", number: "1234 5678 9012" },
  { label: "Driving License", expect: "driving_license", number: "DL-1420110012345" },
  { label: "Passport", expect: "passport", number: "M1234567" },
  { label: "Voter ID", expect: "voter_id", number: "ABC1234567" },
  { label: "PAN Card", expect: "other", number: "ABCDE1234F" },
  { label: "Other", expect: "other", number: "EMP-99881" },
];

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

  // A room that is genuinely free for the whole run, so each booking lands.
  const setup = await call("GET", "/hotel/rooms/setup", null, token);
  const freeRooms = [];
  for (const cat of setup.data || []) {
    for (const rn of cat.rooms || []) {
      const probe = await call(
        "POST",
        "/hotel/rooms/validate-availability",
        { roomNumbers: [rn], checkIn: iso(90), checkOut: iso(92) },
        token,
      );
      if (probe.status === 200 && probe.data?.available) freeRooms.push(rn);
      if (freeRooms.length >= CASES.length) break;
    }
    if (freeRooms.length >= CASES.length) break;
  }

  if (freeRooms.length < CASES.length) {
    console.error(`Only ${freeRooms.length} free rooms; need ${CASES.length}.`);
    process.exit(1);
  }

  const db = require("../src/config/db");
  const q = (sql, params) =>
    new Promise((resolve, reject) => {
      db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
    });

  let failures = 0;

  for (let i = 0; i < CASES.length; i += 1) {
    const c = CASES[i];
    const room = freeRooms[i];
    const checkIn = iso(90 + i * 5);
    const checkOut = iso(92 + i * 5);

    // 1. Create the booking exactly as BookingFlow.jsx does — with the ID
    //    proof fields the UI sends, and NO roomNumber (the UI posts the room
    //    separately via /hotel/room-tariff/:id).
    const created = await call(
      "POST",
      "/hotel/guest",
      {
        agentBooking: false,
        bookingPoint: "",
        mobile: `9900${String(100000 + i)}`.slice(0, 10),
        guestName: `IdProof Check ${i + 1}`,
        guestEmail: `idproof${i}@test.com`,
        checkIn,
        checkOut,
        arrival: "12:00",
        departure: "11:00",
        bookingStatus: "Confirmed",
        bookedBy: "Front Desk",
        bookingType: "Walk-in",
        idProofType: c.label,
        idProofNumber: c.number,
      },
      token,
    );

    if (created.status >= 400) {
      console.error(`  [${c.label}] booking FAILED (${created.status}): ${JSON.stringify(created.data)}`);
      failures += 1;
      continue;
    }
    const bookingId = created.data.bookingId;

    // 2. Read back through the endpoint the Guest Information panel uses.
    const full = await call("GET", `/hotel/full-booking/${bookingId}`, null, token);
    const row = full.data || {};

    // 3. Check the raw DB row too, so we can tell "not saved" apart from
    //    "saved but not returned".
    const dbRows = await q(
      "SELECT id_type, id_number FROM guest_identifications WHERE booking_id = ? ORDER BY id ASC",
      [bookingId],
    );

    const savedType = dbRows[0]?.id_type || "";
    const savedNumber = dbRows[0]?.id_number || "";
    const apiType = row.id_proof_type || row.idProofType || "";
    const apiNumber = row.id_proof_number || row.idProofNumber || "";

    const okType = savedType === c.expect && apiType === savedType;
    const okNum = savedNumber === c.number && apiNumber === c.number;

    console.log(`\n[${c.label}] room ${room} booking ${bookingId}`);
    console.log(`  sent      : type=${JSON.stringify(c.label)} number=${JSON.stringify(c.number)}`);
    console.log(`  db        : id_type=${JSON.stringify(savedType)} id_number=${JSON.stringify(savedNumber)}`);
    console.log(`  api       : id_proof_type=${JSON.stringify(apiType)} id_proof_number=${JSON.stringify(apiNumber)}`);
    console.log(
      `  ${okType && okNum ? "OK  " : "FAIL"} type ${okType ? "matches" : `expected enum '${c.expect}'`}` +
        `, number ${okNum ? "matches" : "mismatch/blank"}`,
    );

    if (!okType || !okNum) failures += 1;
  }

  // Blank-safety: a booking submitted with no ID fields must not 500.
  const blank = await call(
    "POST",
    "/hotel/guest",
    {
      guestName: "No Id Proof Guest",
      mobile: "9900009999",
      checkIn: iso(200),
      checkOut: iso(202),
      bookingStatus: "Confirmed",
      idProofType: "",
      idProofNumber: "",
    },
    token,
  );
  console.log(`\n[no ID fields] -> ${blank.status}`);
  if (blank.status >= 400) {
    console.error(`  FAIL: blank ID fields should not break the booking: ${JSON.stringify(blank.data)}`);
    failures += 1;
  } else {
    const bFull = await call("GET", `/hotel/full-booking/${blank.data.bookingId}`, null, token);
    const bRow = bFull.data || {};
    console.log(
      `  api id_proof_type=${JSON.stringify(bRow.id_proof_type)} id_proof_number=${JSON.stringify(bRow.id_proof_number)}`,
    );
  }

  console.log(
    `\nRESULT: ${failures === 0 ? "all ID proof cases saved and returned correctly" : `${failures} case(s) failed`}`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("verification failed:", err.message);
  process.exit(1);
});
