/**
 * Shared utilities for the banquet module.
 * Single source of truth for DB helpers, column detection,
 * metadata parsing, and booking/hall lookups.
 */

const db = require("../config/db");
const { runQuery } = require("../utils/poolPromise");

const metaStartToken = "[[BNQ_META]]";
const metaEndToken = "[[/BNQ_META]]";

const parseBanquetMeta = (notes = "") => {
  const match = String(notes || "").match(
    new RegExp(`${metaStartToken}(.*?)${metaEndToken}`)
  );

  if (!match || !match[1]) return {};

  try {
    return JSON.parse(match[1]);
  } catch {
    return {};
  }
};

const stripBanquetMeta = (notes = "") =>
  String(notes || "").replace(
    new RegExp(`\\s*${metaStartToken}.*?${metaEndToken}`),
    ""
  ).trim();

const buildBanquetNotes = (notes, meta) => {
  const plainNotes = stripBanquetMeta(notes);
  const serializedMeta = JSON.stringify(meta || {});

  return `${plainNotes}\n${metaStartToken}${serializedMeta}${metaEndToken}`.trim();
};

const hasTimeOverlap = (startA, endA, startB, endB) => {
  if (!startA || !endA || !startB || !endB) return false;
  return startA < endB && endA > startB;
};

const toNumber = (value) => Number(value || 0);

const validateBookingPayload = ({
  hallId,
  customerName,
  eventType,
  guests,
  date,
  startTime,
  endTime,
}) => Boolean(hallId && customerName && eventType && guests && date && startTime && endTime);

let hallRateColumnPromise = null;

const getHallRateColumn = async () => {
  // The v4 schema settles on rate_per_hour; kept as a resolver so older
  // databases that used ratePerHour keep working.
  if (!hallRateColumnPromise) {
    hallRateColumnPromise = (async () => {
      const [snake] = await runQuery(
        "SHOW COLUMNS FROM banquet_halls LIKE ?",
        ["rate_per_hour"]
      );
      if (snake.length) return "rate_per_hour";

      const [camel] = await runQuery(
        "SHOW COLUMNS FROM banquet_halls LIKE ?",
        ["ratePerHour"]
      );
      if (camel.length) return "ratePerHour";

      throw new Error(
        "Neither rate_per_hour nor ratePerHour exists in banquet_halls"
      );
    })();
  }

  return hallRateColumnPromise;
};

const getBookingById = async (id) => {
  // poolPromise.runQuery returns the mysql2 tuple [rows, fields].
  const [rows] = await runQuery(
    `SELECT * FROM banquet_bookings WHERE id = ? LIMIT 1`,
    [id]
  );

  return rows[0] || null;
};

const getHallById = async (id) => {
  const rows = await runQuery(
    `SELECT id, name, description,
            capacity_min AS capacityMin, capacity_max AS capacityMax,
            rate_per_hour AS ratePerHour, rate_per_day AS ratePerDay,
            is_ac AS isAc, has_projector AS hasProjector,
            has_sound_system AS hasSoundSystem, has_stage AS hasStage,
            has_dance_floor AS hasDanceFloor, image_url AS imageUrl, status
     FROM banquet_halls WHERE id = ? LIMIT 1`,
    [id]
  );

  return rows[0] || null;
};

module.exports = {
  runQuery,
  parseBanquetMeta,
  stripBanquetMeta,
  buildBanquetNotes,
  hasTimeOverlap,
  toNumber,
  validateBookingPayload,
  getHallRateColumn,
  getBookingById,
  getHallById,
};
