// middleware/sanitizeHtml.js
// Sanitize any string fields that may contain rich-text HTML.
// Used on routes that persist user-authored rich text (invoice_note, etc.).
//
// Usage: `router.put('/fo-settings', sanitizeHtml(['invoice_note']), handler)`
// or globally: `app.use(sanitizeHtml([...]))` for a list of body keys.
const createDOMPurifier = require("dompurify");
const { JSDOM } = require("jsdom");

const window = new JSDOM("").window;
const purify = createDOMPurifier(window);

const DEFAULT_OPTIONS = {
  ALLOWED_TAGS: [
    "p", "br", "strong", "em", "b", "i", "u", "s", "strike",
    "ul", "ol", "li", "blockquote", "h1", "h2", "h3", "h4",
    "a", "code", "pre", "hr", "span", "div",
  ],
  ALLOWED_ATTR: ["href", "target", "rel"],
  ALLOW_DATA_ATTR: false,
  KEEP_CONTENT: true,
};

/**
 * Sanitize HTML fields on `req.body`.
 * @param {string[]} fields  list of body keys to sanitize (mutates in place)
 * @param {object}   options DOMPurify options (overrides defaults)
 */
const sanitizeHtml = (fields = [], options = DEFAULT_OPTIONS) => (req, _res, next) => {
  try {
    if (!req.body || typeof req.body !== "object") return next();
    for (const f of fields) {
      if (typeof req.body[f] === "string") {
        req.body[f] = purify.sanitize(req.body[f], options);
      }
    }
  } catch (err) {
    // Never block the request on sanitizer errors — log and continue.
    console.warn("[sanitizeHtml] sanitizer failed:", err.message);
  }
  next();
};

module.exports = sanitizeHtml;
module.exports.sanitizeHtmlString = (html, options = DEFAULT_OPTIONS) =>
  purify.sanitize(html || "", options);
