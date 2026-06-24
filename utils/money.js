/**
 * Money helpers. Every amount-accepting endpoint should pass through
 * `assertPositiveAmount` before touching the database. The default cap
 * is intentionally generous (10 crore INR) — adjust per-endpoint if
 * the domain warrants it (refunds, salaries, petty-cash).
 */
const { HttpError } = require("../middleware/errorHandler");

const DEFAULT_MAX = 100_000_000; // ₹10 crore per single transaction

function assertPositiveAmount(value, { field = "amount", max = DEFAULT_MAX } = {}) {
  if (value === undefined || value === null || value === "") {
    throw new HttpError(400, `${field} is required`, "VALIDATION");
  }
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) {
    throw new HttpError(400, `${field} must be a number`, "VALIDATION");
  }
  if (num <= 0) {
    throw new HttpError(400, `${field} must be greater than zero`, "VALIDATION");
  }
  if (num > max) {
    throw new HttpError(400, `${field} exceeds the maximum allowed value of ${max}`, "VALIDATION");
  }
  // Round to 2 decimal places to keep ledger math stable.
  return Math.round(num * 100) / 100;
}

function assertNonNegativeAmount(value, { field = "amount", max = DEFAULT_MAX } = {}) {
  if (value === undefined || value === null || value === "") {
    throw new HttpError(400, `${field} is required`, "VALIDATION");
  }
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) {
    throw new HttpError(400, `${field} must be a number`, "VALIDATION");
  }
  if (num < 0) {
    throw new HttpError(400, `${field} must not be negative`, "VALIDATION");
  }
  if (num > max) {
    throw new HttpError(400, `${field} exceeds the maximum allowed value of ${max}`, "VALIDATION");
  }
  return Math.round(num * 100) / 100;
}

module.exports = {
  assertPositiveAmount,
  assertNonNegativeAmount,
  DEFAULT_MAX,
};
