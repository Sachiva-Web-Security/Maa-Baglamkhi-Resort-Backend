import { expect, test } from "playwright/test";

function addDaysISO(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function buildGuestPayload(suffix) {
  return {
    guestName: `PW Guest ${suffix}`,
    mobile: `98${String(suffix).slice(-8)}`,
    guestEmail: `pw-guest-${suffix}@test.com`,
    checkIn: addDaysISO(1),
    checkOut: addDaysISO(3),
    arrival: "12:00",
    departure: "13:30",
    bookingStatus: "Confirmed",
  };
}

async function loginAsReception(page) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill("reception@resort.com");
  await page.locator('input[type="password"]').fill("password");
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL(/\/reception-dashboard$/, { timeout: 30_000 });
}

async function getHotelAuthHeaders(request, baseURL) {
  const loginResponse = await request.post(`${baseURL}/api/auth/login`, {
    data: {
      email: "reception@resort.com",
      password: "password",
    },
  });

  expect(loginResponse.ok()).toBeTruthy();
  const loginData = await loginResponse.json();

  return {
    Authorization: `Bearer ${loginData.token}`,
  };
}

async function fetchHotelSnapshot(request, baseURL) {
  const headers = await getHotelAuthHeaders(request, baseURL);

  const [activeResponse, historyResponse] = await Promise.all([
    request.get(`${baseURL}/api/hotel/all-bookings`, { headers }),
    request.get(`${baseURL}/api/hotel/booking-history`, { headers }),
  ]);

  expect(activeResponse.ok()).toBeTruthy();
  expect(historyResponse.ok()).toBeTruthy();

  return {
    active: await activeResponse.json(),
    history: await historyResponse.json(),
  };
}

async function createHotelBookingViaApi(request, baseURL, overrides = {}) {
  const headers = await getHotelAuthHeaders(request, baseURL);
  const suffix = Date.now();
  const payload = {
    ...buildGuestPayload(suffix),
    ...overrides,
  };

  const response = await request.post(`${baseURL}/api/hotel/guest`, {
    data: payload,
    headers,
  });

  expect(response.ok()).toBeTruthy();
  const data = await response.json();

  return {
    ...payload,
    bookingId: data.bookingId,
    bookingCode: data.bookingCode,
  };
}

async function fetchHotelRoomSetup(request, baseURL) {
  const headers = await getHotelAuthHeaders(request, baseURL);
  const [setupResponse, activeResponse] = await Promise.all([
    request.get(`${baseURL}/api/hotel/rooms/setup`, { headers }),
    request.get(`${baseURL}/api/hotel/all-bookings`, { headers }),
  ]);

  expect(setupResponse.ok()).toBeTruthy();
  expect(activeResponse.ok()).toBeTruthy();

  return {
    setup: await setupResponse.json(),
    active: await activeResponse.json(),
  };
}

function findFirstAvailableWizardRoom(setupRows, activeBookings) {
  const bookedRooms = new Set(
    (activeBookings || []).flatMap((booking) =>
      String(booking.rooms || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );

  for (const [index, category] of (setupRows || []).entries()) {
    for (const detail of category.roomDetails || []) {
      const status = String(detail.status || "").toLowerCase();
      const roomNumber = String(detail.roomNumber || "").trim();
      if (!roomNumber) continue;
      if (bookedRooms.has(roomNumber)) continue;
      if (status.includes("available")) {
        return {
          roomTypeIndex: index,
          roomTypeId: category.id,
          roomTypeName: category.name,
          defaultPrice: Number(category.defaultPrice || 0),
          unitLabel: category.unitLabel || "PER NIGHT",
          roomNumber,
        };
      }
    }
  }

  for (const [index, category] of (setupRows || []).entries()) {
    for (const detail of category.roomDetails || []) {
      const status = String(detail.status || "").toLowerCase();
      const roomNumber = String(detail.roomNumber || "").trim();
      if (!roomNumber) continue;
      if (bookedRooms.has(roomNumber)) continue;
      if (
        !status.includes("occupied") &&
        !status.includes("blocked") &&
        !status.includes("out of service")
      ) {
        return {
          roomTypeIndex: index,
          roomTypeId: category.id,
          roomTypeName: category.name,
          defaultPrice: Number(category.defaultPrice || 0),
          unitLabel: category.unitLabel || "PER NIGHT",
          roomNumber,
        };
      }
    }
  }

  return null;
}

async function cancelHotelBookingViaApi(request, baseURL, bookingId, reason) {
  const headers = await getHotelAuthHeaders(request, baseURL);
  const response = await request.put(`${baseURL}/api/hotel/cancel/${bookingId}`, {
    data: { reason },
    headers,
  });

  expect(response.ok()).toBeTruthy();
}

async function openAllBookings(page) {
  await page.goto("/hotel/all-bookings");
  await expect(
    page.getByRole("heading", { name: "All bookings in a" }),
  ).toBeVisible();
}

function getBookingCard(page, booking) {
  return page.locator("article").filter({
    hasText: `${booking.guest_name || "Walk-in Guest"}`,
  }).first();
}

function getBookingCardByGuestName(page, guestName) {
  return page.locator("article").filter({ hasText: guestName }).first();
}

test.describe("Hotel all-bookings smoke flow", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsReception(page);
  });

  test("loads active booking summary and actions", async ({ page, request, baseURL }) => {
    const snapshot = await fetchHotelSnapshot(request, baseURL);

    await openAllBookings(page);
    await expect(page.getByText("Upcoming arrivals, in-house guests, and payment follow-up in one clean dashboard")).toBeVisible();
    await expect(page.getByRole("button", { name: "Active" })).toBeVisible();
    await expect(page.getByRole("button", { name: "History" })).toBeVisible();

    if (!snapshot.active.length) {
      await expect(page.getByText("No active booking yet")).toBeVisible();
      return;
    }

    const booking = snapshot.active[0];
    const card = getBookingCard(page, booking);

    await expect(card.getByText(`Booking #${booking.bookingId}`)).toBeVisible();
    await expect(card.getByText(booking.guest_name)).toBeVisible();
    await expect(card.getByText(`Room: ${booking.rooms || "Not assigned"}`)).toBeVisible();
    await expect(card.getByRole("button", { name: "View" })).toBeVisible();
    await expect(card.getByRole("button", { name: "Generate Invoice" })).toBeVisible();
    await expect(card.getByRole("button", { name: "History" })).toBeVisible();
    await expect(card.getByRole("button", { name: "Folio" })).toBeVisible();

    if (String(booking.booking_status || "").toLowerCase().includes("checked in")) {
      await expect(card.getByRole("button", { name: "Check Out" })).toBeVisible();
      await expect(card.getByRole("button", { name: "Cancel Booking" })).toHaveCount(0);
    } else {
      await expect(card.getByRole("button", { name: "Check In" })).toBeVisible();
    }

    if (Number(booking.remainingAmount || 0) > 0) {
      await expect(card.getByText("Balance Due").first()).toBeVisible();
      await expect(card.getByRole("button", { name: "Collect Payment" })).toBeVisible();
    } else {
      await expect(card.getByText("Fully Paid")).toBeVisible();
    }
  });

  test("switches to checkout history and renders past stays", async ({ page, request, baseURL }) => {
    const snapshot = await fetchHotelSnapshot(request, baseURL);

    await openAllBookings(page);
    await page.getByRole("button", { name: "History" }).click();

    if (!snapshot.history.length) {
      await expect(page.getByText("Checkout history abhi empty hai.")).toBeVisible();
      return;
    }

    for (const booking of snapshot.history.slice(0, 2)) {
      const card = getBookingCard(page, booking);
      await expect(card.getByText(`Booking #${booking.bookingId}`)).toBeVisible();
      await expect(card.getByText(booking.guest_name)).toBeVisible();
      await expect(card.getByText("History")).toBeVisible();
    }

    await expect(page.getByRole("button", { name: "Active" })).toBeVisible();
  });

  test("opens collect payment page from booking card", async ({ page, request, baseURL }) => {
    const snapshot = await fetchHotelSnapshot(request, baseURL);
    const booking = snapshot.active.find(
      (item) => Number(item.remainingAmount || 0) > 0,
    );

    test.skip(!booking, "No active booking with pending balance is available.");

    await openAllBookings(page);

    const card = getBookingCard(page, booking);
    await card.getByRole("button", { name: "Collect Payment" }).click();

    await expect(page).toHaveURL(/\/hotel\/collect-payment$/);
    await expect(
      page.getByRole("heading", { name: "Collect booking payment with discount" }),
    ).toBeVisible();
    await expect(page.getByText(`Booking Reference`)).toBeVisible();
    await expect(page.getByText(`#${booking.bookingId}`)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Enter amount and discount" })).toBeVisible();
  });

  test("opens folio and payment history from booking actions", async ({ page, request, baseURL }) => {
    const snapshot = await fetchHotelSnapshot(request, baseURL);

    test.skip(!snapshot.active.length, "No active hotel booking is available.");
    const booking = snapshot.active[0];

    await openAllBookings(page);

    const card = getBookingCard(page, booking);
    await card.getByRole("button", { name: "Folio" }).click();

    await expect(page).toHaveURL(/\/hotel\/folio$/);
    await expect(page.getByText(/Guest Folio/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "+ Add Charge" })).toBeVisible();

    await page.locator("button").filter({ hasText: /^All Bookings$/ }).last().click();
    await expect(page).toHaveURL(/\/hotel\/all-bookings$/);

    await getBookingCard(page, booking).getByRole("button", { name: "History" }).click();

    await expect(page).toHaveURL(/\/hotel\/payment-history$/);
    await expect(page.getByText("Payment History").first()).toBeVisible();
    await expect(page.getByText(booking.guest_name).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Back To All Bookings" })).toBeVisible();
  });

  test("creates a new booking from guest step and shows it in all bookings", async ({ page }) => {
    const suffix = Date.now();
    const booking = buildGuestPayload(suffix);

    await page.goto("/hotel/guest");
    await page.locator('input[name="mobile"]').fill(booking.mobile);
    await page.locator('input[name="guestName"]').fill(booking.guestName);
    await page.locator('input[name="guestEmail"]').fill(booking.guestEmail);
    await page.locator('input[name="checkIn"]').fill(booking.checkIn);
    await page.locator('input[name="checkOut"]').fill(booking.checkOut);
    await page.locator('input[name="arrival"]').fill(booking.arrival);
    await page.locator('input[name="departure"]').fill(booking.departure);
    await page.getByRole("button", { name: "Next Step" }).click();

    await expect(page).toHaveURL(/\/hotel\/other-booking$/);
    await expect(page.getByText("Booking ID")).toBeVisible();

    await openAllBookings(page);
    const card = getBookingCardByGuestName(page, booking.guestName);

    await expect(card).toBeVisible();
    await expect(card.getByText(booking.guestName)).toBeVisible();
    await expect(card.getByRole("button", { name: "Edit" })).toBeVisible();
    await expect(card.getByRole("button", { name: "Cancel Booking" })).toBeVisible();



  const snapshot = await fetchHotelSnapshot(request, baseURL);
  const createdBooking = snapshot.active.find(
    (row) => row.guest_name === booking.guestName,
  );
  if (createdBooking) {
    await cancelHotelBookingViaApi(
      request,
      baseURL,
      createdBooking.bookingId,
      "Playwright test cleanup",
    );
  }







  });

  test("edits a created booking and shows updated guest details", async ({ page, request, baseURL }) => {
    const booking = await createHotelBookingViaApi(request, baseURL);
    const updatedName = `${booking.guestName} Updated`;
    const updatedMobile = `97${booking.mobile.slice(-8)}`;

    await openAllBookings(page);
    await getBookingCardByGuestName(page, booking.guestName)
      .getByRole("button", { name: "Edit" })
      .click();

    await expect(page).toHaveURL(/\/hotel\/edit-booking$/);
    await expect(page.getByPlaceholder("Guest Name")).toHaveValue(booking.guestName);
    await expect(page.locator('input[type="date"]').first()).not.toHaveValue("");
    await page.getByPlaceholder("Guest Name").fill(updatedName);
    await page.getByPlaceholder("Mobile").fill(updatedMobile);

    const dialogPromise = page.waitForEvent("dialog");
    await page.getByRole("button", { name: "Save Changes" }).click();
    const dialog = await dialogPromise;
    expect(dialog.message()).toMatch(/updated successfully/i);
    await dialog.accept();

    await expect(page).toHaveURL(/\/hotel\/all-bookings$/);
    const updatedCard = getBookingCardByGuestName(page, updatedName);
    await expect(updatedCard).toBeVisible();
    await expect(updatedCard.getByText(updatedName)).toBeVisible();



await cancelHotelBookingViaApi(
    request,
    baseURL,
    booking.bookingId,
    "Playwright edit test cleanup",
  );





  });

  test("cancels a confirmed booking with reason and removes it from active bookings", async ({ page, request, baseURL }) => {
    const booking = await createHotelBookingViaApi(request, baseURL);
    const cancelReason = `Playwright cancel ${Date.now()}`;

    await openAllBookings(page);

    const card = getBookingCardByGuestName(page, booking.guestName);
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Cancel Booking" }).click();

    await page.locator("textarea").fill(cancelReason);
    await page.getByRole("button", { name: "Confirm Cancel" }).click();

    await expect(getBookingCardByGuestName(page, booking.guestName)).toHaveCount(0);

    const snapshot = await fetchHotelSnapshot(request, baseURL);
    expect(snapshot.active.some((row) => row.bookingId === booking.bookingId)).toBe(false);
  });

  test("completes the booking wizard through communication preview", async ({ page, request, baseURL }) => {
    const suffix = Date.now();
    const booking = buildGuestPayload(suffix);
    const roomInventory = await fetchHotelRoomSetup(request, baseURL);
    const availableRoom = findFirstAvailableWizardRoom(
      roomInventory.setup,
      roomInventory.active,
    );

    test.skip(!availableRoom, "No available room was found for the wizard flow.");

    await page.goto("/hotel/guest");
    await page.locator('input[name="mobile"]').fill(booking.mobile);
    await page.locator('input[name="guestName"]').fill(booking.guestName);
    await page.locator('input[name="guestEmail"]').fill(booking.guestEmail);
    await page.locator('input[name="checkIn"]').fill(booking.checkIn);
    await page.locator('input[name="checkOut"]').fill(booking.checkOut);
    await page.locator('input[name="arrival"]').fill(booking.arrival);
    await page.locator('input[name="departure"]').fill(booking.departure);
    await page.getByRole("button", { name: "Next Step" }).click();

    await expect(page).toHaveURL(/\/hotel\/other-booking$/);
    await page.locator("select").nth(0).selectOption("Solo");
    await page.locator("select").nth(1).selectOption("Front Office");
    await page.getByPlaceholder("Enter booking reference").fill(`PW-REF-${suffix}`);
    await page.getByRole("button", { name: "Save & Next" }).click();

    await expect(page).toHaveURL(/\/hotel\/reference$/);
    await page.locator("select").selectOption("VIP Guest");
    await page
      .getByPlaceholder("Preferences, requests, special arrangements...")
      .fill("Late arrival and bottled water requested");
    await page
      .getByPlaceholder("Internal reminders for front desk or operations...")
      .fill("Wizard smoke test note");
    await page.getByRole("button", { name: "Save & Next" }).click();

    await expect(page).toHaveURL(/\/hotel\/company$/);
    await page.getByPlaceholder("Enter GSTIN").fill(`GST-${suffix}`);
    await page.getByRole("button", { name: "Save & Next" }).click();

    await expect(page).toHaveURL(/\/hotel\/room$/);
    await page.evaluate((room) => {
      const key = "hotel_booking_step_draft";
      const raw = sessionStorage.getItem(key);
      const current = raw ? JSON.parse(raw) : {};
      const roomTypeId = String(room.roomTypeId);

      sessionStorage.setItem(
        key,
        JSON.stringify({
          ...current,
          room: {
            activeRoom: null,
            selectedRooms: { [roomTypeId]: [room.roomNumber] },
            roomOptions: { [roomTypeId]: [room.roomNumber] },
            inputValue: {},
            priceInputs: { [roomTypeId]: String(room.defaultPrice || 0) },
            pickerValues: {},
            roomTypeMap: { [roomTypeId]: room.roomTypeName },
            roomCatalog: [
              {
                id: Number(room.roomTypeId),
                name: room.roomTypeName,
                defaultPrice: Number(room.defaultPrice || 0),
                unitLabel: room.unitLabel || "PER NIGHT",
              },
            ],
          },
        }),
      );
    }, availableRoom);
    await page.goto("/hotel/pax");

    await expect(page).toHaveURL(/\/hotel\/pax$/);
    const paxRow = page.locator("div").filter({
      hasText: availableRoom.roomNumber,
    }).filter({
      has: page.getByPlaceholder("Adults"),
    }).first();
    await paxRow.getByPlaceholder("Adults").fill("2");
    await paxRow.getByPlaceholder("Children").fill("1");
    await page.getByRole("button", { name: "Save & Proceed" }).click();

    await expect(page).toHaveURL(/\/hotel\/room-tariff$/);
    await expect(page.getByText(availableRoom.roomNumber)).toBeVisible();
    await expect(page.getByText("Booking Total")).toBeVisible();
    await page.getByRole("button", { name: "Save & Proceed" }).click();

    await expect(page).toHaveURL(/\/hotel\/advance$/);
    await page.getByPlaceholder("Enter received amount").fill("700");
    await page.locator("select").first().selectOption("UPI");
    await page
      .getByPlaceholder("Payment reference, remarks, partial advance reason...")
      .fill("Wizard smoke advance");
    await page.getByRole("button", { name: "Save Advance & Continue" }).click();

    await expect(page).toHaveURL(/\/hotel\/communication$/);
    await expect(page.getByText("Communication & Invoice")).toBeVisible();
    await expect(page.getByText(booking.guestName).first()).toBeVisible();
    await expect(page.getByText(availableRoom.roomNumber).first()).toBeVisible();
    await expect(page.getByText("Payment Snapshot", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Check In" })).toBeVisible();

    await page.getByRole("button", { name: "Submit Booking" }).click();
    await expect(page).toHaveURL(/\/hotel\/all-bookings$/);
    await expect(getBookingCardByGuestName(page, booking.guestName)).toBeVisible();

    const snapshot = await fetchHotelSnapshot(request, baseURL);
    const createdBooking = snapshot.active.find(
      (row) => row.guest_name === booking.guestName,
    );

    expect(createdBooking).toBeTruthy();
    await cancelHotelBookingViaApi(
      request,
      baseURL,
      createdBooking.bookingId,
      "Playwright wizard cleanup",
    );
  });
});
