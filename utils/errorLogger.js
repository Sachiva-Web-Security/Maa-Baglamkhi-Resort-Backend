const formatErrorLog = (req, error) => {
  console.error("====================================");
  console.error("ERROR:", error);
  console.error("MESSAGE:", error.message || "No message");
  console.error("STACK:", error.stack);
  if (req) {
    console.error("URL:", req.originalUrl);
    console.error("METHOD:", req.method);
    console.error("BODY:", JSON.stringify(req.body, null, 2));
    console.error("PARAMS:", JSON.stringify(req.params, null, 2));
    console.error("QUERY:", JSON.stringify(req.query, null, 2));
  }
  console.error("TIME:", new Date().toISOString());
  console.error("====================================");
};

const logRequest = (req) => {
  console.log("====================================");
  console.log("[REQ] HTTP Method:", req.method);
  console.log("[REQ] URL:", req.originalUrl);
  console.log("[REQ] IP Address:", req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress || "unknown");
  console.log("[REQ] Request Body:", JSON.stringify(req.body, null, 2));
  console.log("[REQ] Query Parameters:", JSON.stringify(req.query, null, 2));
  console.log("[REQ] Route Params:", JSON.stringify(req.params, null, 2));
  console.log("[REQ] Timestamp:", new Date().toISOString());
  console.log("====================================");
};

const logDatabaseError = (sql, params, error) => {
  console.error("====================================");
  console.error("[DB ERROR] SQL:", sql);
  console.error("[DB ERROR] Params:", JSON.stringify(params, null, 2));
  console.error("[DB ERROR] MESSAGE:", error.message);
  console.error("[DB ERROR] CODE:", error.code);
  console.error("[DB ERROR] ERRNO:", error.errno);
  console.error("[DB ERROR] STACK:", error.stack);
  console.error("[DB ERROR] TIME:", new Date().toISOString());
  console.error("====================================");
};

const logConnectionError = (source, error) => {
  console.error("====================================");
  console.error(`[CONNECTION ERROR] Source: ${source}`);
  console.error("[CONNECTION ERROR] MESSAGE:", error.message);
  console.error("[CONNECTION ERROR] CODE:", error.code);
  console.error("[CONNECTION ERROR] ERRNO:", error.errno);
  console.error("[CONNECTION ERROR] STACK:", error.stack);
  console.error("[CONNECTION ERROR] TIME:", new Date().toISOString());
  console.error("====================================");
};

const logApiError = (serviceName, endpoint, error) => {
  console.error("====================================");
  console.error(`[API ERROR] Service: ${serviceName}`);
  console.error("[API ERROR] Endpoint:", endpoint);
  console.error("[API ERROR] MESSAGE:", error.message);
  console.error("[API ERROR] STATUS:", error.statusCode || "N/A");
  console.error("[API ERROR] BODY:", error.body || "N/A");
  console.error("[API ERROR] STACK:", error.stack);
  console.error("[API ERROR] TIME:", new Date().toISOString());
  console.error("====================================");
};

module.exports = {
  formatErrorLog,
  logRequest,
  logDatabaseError,
  logConnectionError,
  logApiError,
};
