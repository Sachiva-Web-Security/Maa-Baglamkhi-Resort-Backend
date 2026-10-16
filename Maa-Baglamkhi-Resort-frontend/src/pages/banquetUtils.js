export const formatINR = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);

export const banquetConfigStorageKey = "banquetPricingConfig";
export const banquetMenuDraftStorageKey = "banquetReservationDraft";

export const defaultMenuPackages = [
  {
    id: "standard",
    name: "Standard Celebration",
    perGuest: 650,
    mealLabel: "Veg buffet + snacks",
    description:
      "Budget-friendly family functions ke liye balanced buffet plan.",
    highlights: [
      "Welcome drinks aur 2 starter options",
      "2 veg sabzi, dal, rice aur breads",
      "1 dessert aur standard service setup",
    ],
  },
  {
    id: "premium",
    name: "Premium Feast",
    perGuest: 950,
    mealLabel: "Veg + live counter",
    description:
      "Engagement aur reception events ke liye richer spread with live counter.",
    highlights: [
      "Mocktail station aur 3 premium starters",
      "Paneer specialty, main course buffet aur salads",
      "Live counter plus 2 dessert selections",
    ],
  },
  {
    id: "royal",
    name: "Royal Signature",
    perGuest: 1250,
    mealLabel: "Full event dining experience",
    description:
      "Large-format celebrations ke liye signature dining experience.",
    highlights: [
      "Grand welcome beverages aur chef-curated starters",
      "Multi-cuisine main course with live counter access",
      "Premium desserts, service crew aur elegant presentation",
    ],
  },
];

export const defaultLightingOptions = [
  { id: "classic", label: "Classic", price: 8000 },
  { id: "stage", label: "Stage Focus", price: 15000 },
  { id: "premium", label: "Premium Intelligent", price: 28000 },
];

export const mealSections = [
  "Welcome Drinks",
  "Starters",
  "Main Course",
  "Live Counter",
  "Desserts",
];

export const defaultMealSectionPrices = mealSections.reduce(
  (acc, section, index) => {
    acc[section] = [60, 140, 260, 220, 120][index] || 0;
    return acc;
  },
  {}
);

export const defaultPricingConfig = {
  menuPackages: defaultMenuPackages,
  lightingOptions: defaultLightingOptions,
  mealSectionPrices: defaultMealSectionPrices,
  eventSupportFee: 12000,
  decorServiceFee: 15000,
};

export function hoursBetween(start, end) {
  if (!start || !end) return 0;

  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const diff = eh * 60 + em - (sh * 60 + sm);

  if (diff <= 0) return 0;

  return Math.max(1, Math.ceil(diff / 60));
}

export function buildNotesPayload(notes, meta) {
  return `${notes?.trim() || ""}\n[[BNQ_META]]${JSON.stringify(meta)}[[/BNQ_META]]`.trim();
}

export function extractMeta(notes = "") {
  const match = notes.match(/\[\[BNQ_META\]\]([\s\S]*?)\[\[\/BNQ_META\]\]/);

  if (!match?.[1]) return {};

  try {
    return JSON.parse(match[1]);
  } catch {
    return {};
  }
}

export function stripMeta(notes = "") {
return notes.replace(/\s*\[\[BNQ_META\]\][\s\S]*?\[\[\/BNQ_META\]\]/, "").trim();
}

export function normalizeCategory(value) {
  return (value || "Other").trim().toLowerCase();
}

export function parseMenuItemsList(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }

  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function buildCustomMenuItemsText(selectedItems = [], manualItems = []) {
  return [...selectedItems, ...manualItems]
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .filter((item, index, arr) => arr.indexOf(item) === index)
    .join(", ");
}

export function parseRestaurantMenuSelection(items) {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => ({
      name: String(item?.name || "").trim(),
      qty: Number(item?.qty || 0),
      rate: Number(item?.rate || 0),
      amount: Number(item?.amount || 0),
      taxAmount: Number(item?.taxAmount || 0),
      total: Number(item?.total || 0),
    }))
    .filter((item) => item.name);
}

export function calculateRestaurantMenuCharge(items = []) {
  return parseRestaurantMenuSelection(items).reduce(
    (sum, item) => sum + (Number(item.total) || 0),
    0
  );
}

export function calculateBookingGrandTotal(booking, halls, pricingConfig) {
  const hall = halls.find((item) => String(item.id) === String(booking.hallId));
  const menu = pricingConfig.menuPackages.find(
    (item) => item.id === booking.menuPackageId
  );
  const lighting = pricingConfig.lightingOptions.find(
    (item) => item.id === booking.lightingSystem
  );

  const subtotal =
    (hall?.ratePerHour || 0) * hoursBetween(booking.startTime, booking.endTime) +
    (menu?.perGuest || 0) * (Number(booking.guests) || 0) +
    calculateRestaurantMenuCharge(booking.selectedRestaurantMenuItems) +
    (Number(booking.eventSupportFee) || 0) +
    (Number(booking.decorationFee) || 0) +
    (lighting?.price || 0);
  const discount = Math.min(subtotal, Number(booking.discount) || 0);
  const taxable = subtotal - discount;
  const gst = Math.round((taxable * (Number(booking.gstPercent) || 0)) / 100);

  return taxable + gst;
}

export function deriveBookingFinancials(booking, halls, pricingConfig) {
  const hall = halls.find((item) => String(item.id) === String(booking.hallId));
  const menu = pricingConfig.menuPackages.find(
    (item) => item.id === booking.menuPackageId
  );
  const lighting = pricingConfig.lightingOptions.find(
    (item) => item.id === booking.lightingSystem
  );

  const hallCharge =
    Number(booking.hallCharge) ||
    (hall?.ratePerHour || booking.hallRatePerHour || 0) *
      hoursBetween(booking.startTime, booking.endTime);
  const mealCharge =
    Number(booking.mealCharge) ||
    (menu?.perGuest || 0) * (Number(booking.guests) || 0);
  const customMenuCharge =
    Number(booking.customMenuCharge) ||
    calculateRestaurantMenuCharge(booking.selectedRestaurantMenuItems);
  const lightingCharge =
    Number(booking.lightingCharge) || lighting?.price || 0;
  const eventSupportFee = Number(booking.eventSupportFee) || 0;
  const decorationFee = Number(booking.decorationFee) || 0;
  const subtotalAmount =
    hallCharge +
    mealCharge +
    customMenuCharge +
    lightingCharge +
    eventSupportFee +
    decorationFee;
  const discount = Math.min(subtotalAmount, Number(booking.discount) || 0);
  const taxableAmount = Math.max(0, subtotalAmount - discount);
  const gstAmount = Math.round(
    (taxableAmount * (Number(booking.gstPercent) || 0)) / 100
  );
  const grandTotal = taxableAmount + gstAmount;
  const advance = Number(booking.advance || 0);
  const refundAmount = Number(booking.refundAmount || 0);
  const netReceived =
    Number(booking.netReceived) || Math.max(0, advance - refundAmount);
  const balanceDue =
    booking.status === "Cancelled" || booking.status === "Refunded"
      ? 0
      : Number(booking.balanceDue) || Math.max(0, grandTotal - netReceived);
  const paymentStatus =
    booking.paymentStatus ||
    (booking.status === "Refunded"
      ? "Refunded"
      : grandTotal > 0 && netReceived >= grandTotal
      ? "Paid"
      : netReceived > 0
      ? "Partial"
      : "Pending");

  return {
    hallCharge,
    mealCharge,
    customMenuCharge,
    lightingCharge,
    eventSupportFee,
    decorationFee,
    subtotalAmount,
    discount,
    taxableAmount,
    gstAmount,
    grandTotal,
    advance,
    refundAmount,
    netReceived,
    balanceDue,
    paymentStatus,
  };
}

export function getStoredPricingConfig() {
  if (typeof window === "undefined") return defaultPricingConfig;

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(banquetConfigStorageKey) || "{}"
    );

    return {
      menuPackages:
        parsed.menuPackages?.length === defaultMenuPackages.length
          ? parsed.menuPackages
          : defaultMenuPackages,
      lightingOptions:
        parsed.lightingOptions?.length === defaultLightingOptions.length
          ? parsed.lightingOptions
          : defaultLightingOptions,
      mealSectionPrices: {
        ...defaultMealSectionPrices,
        ...(parsed.mealSectionPrices || {}),
      },
      eventSupportFee: Number(
        parsed.eventSupportFee ?? defaultPricingConfig.eventSupportFee
      ),
      decorServiceFee: Number(
        parsed.decorServiceFee ?? defaultPricingConfig.decorServiceFee
      ),
    };
  } catch {
    return defaultPricingConfig;
  }
}

export function normalizeBooking(raw) {
  const meta = extractMeta(raw.notes || "");
  const selectedCustomMenuItems = parseMenuItemsList(
    meta.selectedCustomMenuItems
  );
  const manualCustomMenuItems = parseMenuItemsList(
    meta.manualCustomMenuItems || raw.customMenuItems || raw.custom_menu_items
  );
  const customMenuItemsText = buildCustomMenuItemsText(
    selectedCustomMenuItems,
    manualCustomMenuItems
  );
  const selectedRestaurantMenuItems = parseRestaurantMenuSelection(
    meta.selectedRestaurantMenuItems
  );
  const advance = Number(raw.advance ?? meta.advance ?? meta.paymentReceived ?? 0);
  const refundAmount = Number(
    raw.refundAmount ?? raw.refund_amount ?? meta.refundAmount ?? 0
  );

  return {
    ...raw,
    hallId: raw.hallId || raw.hall_id,
    customerName: raw.customerName || raw.customer_name,
    phone: raw.phone || meta.phone || "",
    eventType: raw.eventType || raw.event_type || "Event",
    guests: Number(raw.guests || 0),
    menuPackageId: raw.menuPackageId || raw.menu_package_id || "standard",
    decorationFee: Number(raw.decorationFee || raw.decoration_fee || 0),
    customMenuCharge: Number(raw.customMenuCharge || raw.custom_menu_charge || 0),
    lightingCharge: Number(raw.lightingCharge || raw.lighting_charge || 0),
    hallCharge: Number(raw.hallCharge || raw.hall_charge || 0),
    mealCharge: Number(raw.mealCharge || raw.meal_charge || 0),
    date: raw.date ? String(raw.date).slice(0, 10) : "",
    startTime: raw.startTime || raw.start_time || "",
    endTime: raw.endTime || raw.end_time || "",
    discount: Number(raw.discount || 0),
    gstPercent: Number(raw.gstPercent || raw.gst_percent || 5),
    subtotalAmount: Number(
      raw.subtotalAmount || raw.subtotal_amount || 0
    ),
    gstAmount: Number(raw.gstAmount || raw.gst_amount || 0),
    grandTotal: Number(
      raw.grandTotal ||
        raw.grand_total ||
        raw.totalAmount ||
        raw.total_amount ||
        0
    ),
    invoiceNo: raw.invoiceNo || raw.invoice_no || "",
    guestEmail: raw.guestEmail || raw.guest_email || meta.guestEmail || "",
    eventTitle: raw.eventTitle || raw.event_title || meta.eventTitle || "",
    mealSection: raw.mealSection || raw.meal_section || meta.mealSection || "",
    customMenuItems:
      customMenuItemsText ||
      meta.customMenuItems ||
      raw.customMenuItems ||
      raw.custom_menu_items ||
      "",
    selectedCustomMenuItems,
    selectedRestaurantMenuItems,
    manualCustomMenuItems,
    manualMenuEntry: "",
    lightingSystem:
      raw.lightingSystem || raw.lighting_system || meta.lightingSystem || "",
    eventSupportFee: Number(
      raw.eventSupportFee || meta.eventSupportFee || 0
    ),
    advance,
    paymentMode:
      raw.paymentMode || raw.payment_mode || meta.paymentMode || "Pending",
    paymentStatus: raw.paymentStatus || raw.payment_status || "Pending",
    paymentReferenceId:
      raw.paymentReferenceNo ||
      raw.payment_reference_no ||
      raw.paymentReferenceId ||
      raw.payment_reference_id ||
      meta.paymentReferenceId ||
      "",
    receiptFileName: meta.receiptFileName || "",
    paymentReceived: advance,
    refundAmount,
    netReceived: Number(
      raw.netReceived || raw.net_received || Math.max(0, advance - refundAmount)
    ),
    balanceDue: Number(raw.balanceDue || raw.balance_due || 0),
    notes: stripMeta(raw.notes || ""),
  };
}
