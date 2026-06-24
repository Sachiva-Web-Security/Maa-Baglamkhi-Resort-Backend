/**
 * Request validation helpers.
 *
 * `allowList(req.body, schema)` strips unknown keys and validates the
 * value types of known ones. Returns either `{ ok: true, value }` or
 * `{ ok: false, error }` so the caller can `next(new HttpError(...))`
 * without leaking validation logic.
 *
 * Schemas look like:
 *   {
 *     name: { type: "string", required: true, min: 1, max: 191 },
 *     amount: { type: "number", required: true, min: 0, max: 1_000_000 },
 *     active: { type: "boolean", required: false },
 *     tags:   { type: "string[]", max: 32, each: { type: "string", max: 64 } },
 *   }
 *
 * This is deliberately small. The goal is to stop mass assignment via
 * `req.body` spread, not to replace joi/zod.
 */
const { HttpError } = require("./errorHandler");

const TYPE_CHECKS = {
  string: (v) => typeof v === "string",
  number: (v) => typeof v === "number" && Number.isFinite(v),
  integer: (v) => Number.isInteger(v),
  boolean: (v) => typeof v === "boolean",
  object: (v) =>
    v !== null && typeof v === "string"
      ? false
      : typeof v === "object" && !Array.isArray(v),
  array: (v) => Array.isArray(v),
  "string[]": (v) => Array.isArray(v) && v.every((x) => typeof x === "string"),
  "number[]": (v) =>
    Array.isArray(v) && v.every((x) => typeof x === "number" && Number.isFinite(x)),
  any: () => true,
};

function validateValue(value, def, path) {
  if (value === undefined || value === null) {
    if (def.required) {
      return { ok: false, error: `${path} is required` };
    }
    return { ok: true, value: undefined };
  }

  const check = TYPE_CHECKS[def.type] || TYPE_CHECKS.any;
  if (!check(value)) {
    return { ok: false, error: `${path} must be of type ${def.type}` };
  }

  if (def.enum && !def.enum.includes(value)) {
    return { ok: false, error: `${path} must be one of ${def.enum.join(", ")}` };
  }

  if (typeof value === "string") {
    if (def.min != null && value.length < def.min) {
      return { ok: false, error: `${path} must be at least ${def.min} characters` };
    }
    if (def.max != null && value.length > def.max) {
      return { ok: false, error: `${path} must be at most ${def.max} characters` };
    }
  }

  if (typeof value === "number") {
    if (def.min != null && value < def.min) {
      return { ok: false, error: `${path} must be >= ${def.min}` };
    }
    if (def.max != null && value > def.max) {
      return { ok: false, error: `${path} must be <= ${def.max}` };
    }
  }

  if (Array.isArray(value)) {
    if (def.max != null && value.length > def.max) {
      return { ok: false, error: `${path} must have at most ${def.max} items` };
    }
    if (def.each) {
      for (let i = 0; i < value.length; i += 1) {
        const inner = validateValue(value[i], def.each, `${path}[${i}]`);
        if (!inner.ok) return inner;
      }
    }
  }

  return { ok: true, value };
}

function allowList(input, schema, { stripUnknown = true } = {}) {
  const source = input && typeof input === "object" ? input : {};
  const result = {};
  const errors = [];

  for (const [key, def] of Object.entries(schema)) {
    const check = validateValue(source[key], def, key);
    if (!check.ok) {
      errors.push(check.error);
    } else if (check.value !== undefined) {
      result[key] = check.value;
    }
  }

  if (!stripUnknown) {
    for (const key of Object.keys(source)) {
      if (!(key in schema) && !(key in result)) {
        result[key] = source[key];
      }
    }
  }

  if (errors.length) {
    return { ok: false, errors };
  }
  return { ok: true, value: result };
}

function applyOrFail(req, schema, { location = "body", stripUnknown = true } = {}) {
  const out = allowList(req[location], schema, { stripUnknown });
  if (!out.ok) {
    return {
      ok: false,
      fail: () => {
        const err = new HttpError(400, `Invalid request: ${out.errors[0]}`);
        err.code = "VALIDATION";
        throw err;
      },
    };
  }
  return { ok: true, value: out.value };
}

module.exports = {
  allowList,
  applyOrFail,
  HttpError,
};
