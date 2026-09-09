/**
 * Pricing configuration for banquet bookings.
 */

const {
  runQuery,
  toNumber,
} = require("../utils/banquetHelpers");

const DEFAULT_BANQUET_PRICING_CONFIG = {
  menuPackages: [
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
  ],
  lightingOptions: [
    { id: "classic", label: "Classic", price: 8000 },
    { id: "stage", label: "Stage Focus", price: 15000 },
    { id: "premium", label: "Premium Intelligent", price: 28000 },
  ],
  mealSectionPrices: {
    "Welcome Drinks": 60,
    Starters: 140,
    "Main Course": 260,
    "Live Counter": 220,
    Desserts: 120,
  },
  eventSupportFee: 12000,
  decorServiceFee: 15000,
};

const normalizeBanquetPricingConfig = (raw = {}) => {
  const fallback = DEFAULT_BANQUET_PRICING_CONFIG;
  const next = raw && typeof raw === "object" ? raw : {};

  return {
    menuPackages:
      Array.isArray(next.menuPackages) &&
      next.menuPackages.length === fallback.menuPackages.length
        ? next.menuPackages.map((item, index) => ({
            ...fallback.menuPackages[index],
            ...(item || {}),
            perGuest: toNumber(item?.perGuest ?? fallback.menuPackages[index].perGuest),
          }))
        : fallback.menuPackages,
    lightingOptions:
      Array.isArray(next.lightingOptions) &&
      next.lightingOptions.length === fallback.lightingOptions.length
        ? next.lightingOptions.map((item, index) => ({
            ...fallback.lightingOptions[index],
            ...(item || {}),
            price: toNumber(item?.price ?? fallback.lightingOptions[index].price),
          }))
        : fallback.lightingOptions,
    mealSectionPrices: {
      ...fallback.mealSectionPrices,
      ...(next.mealSectionPrices || {}),
    },
    eventSupportFee: toNumber(next.eventSupportFee ?? fallback.eventSupportFee),
    decorServiceFee: toNumber(next.decorServiceFee ?? fallback.decorServiceFee),
  };
};

const getBanquetPricingConfig = async () => {
  const rows = await runQuery(
    `SELECT config_json FROM banquet_pricing_config WHERE id = 1 LIMIT 1`
  );

  if (!rows[0]?.config_json) {
    return DEFAULT_BANQUET_PRICING_CONFIG;
  }

  try {
    return normalizeBanquetPricingConfig(JSON.parse(rows[0].config_json));
  } catch {
    return DEFAULT_BANQUET_PRICING_CONFIG;
  }
};

const saveBanquetPricingConfig = async (rawConfig = {}) => {
  const config = normalizeBanquetPricingConfig(rawConfig);

  await runQuery(
    `INSERT INTO banquet_pricing_config (id, config_json)
     VALUES (1, ?)
     ON DUPLICATE KEY UPDATE config_json = VALUES(config_json)`,
    [JSON.stringify(config)]
  );

  return config;
};

const getBanquetPricingConfigHandler = async (req, res) => {
  try {
    const pricingConfig = await getBanquetPricingConfig();
    res.status(200).json({ pricingConfig });
  } catch (error) {
    console.error("getBanquetPricingConfig error:", error);
    res.status(500).json({ message: "Failed to load banquet pricing config" });
  }
};

const updateBanquetPricingConfig = async (req, res) => {
  try {
    const pricingConfig = await saveBanquetPricingConfig(req.body || {});
    res.status(200).json({
      message: "Banquet pricing config updated successfully",
      pricingConfig,
    });
  } catch (error) {
    console.error("updateBanquetPricingConfig error:", error);
    res.status(500).json({ message: "Failed to update banquet pricing config" });
  }
};

module.exports = {
  DEFAULT_BANQUET_PRICING_CONFIG,
  getBanquetPricingConfig,
  getBanquetPricingConfigHandler,
  updateBanquetPricingConfig,
};
