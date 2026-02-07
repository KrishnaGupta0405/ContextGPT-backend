import { applicationErrors } from "../../drizzle/schema.ts";
import { db } from "../index.js";

/**
 * Sanitize sensitive data from request body
 * Remove passwords, tokens, API keys, etc.
 */
const sanitizeRequestBody = (body) => {
  if (!body || typeof body !== "object") return body;

  const sensitiveFields = [
    "password",
    "token",
    "apiKey",
    "api_key",
    "secret",
    "refreshToken",
    "accessToken",
  ];
  const sanitized = { ...body };

  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = "[REDACTED]";
    }
  }

  return sanitized;
};

/**
 * Determine error type based on error message and code
 */
const determineErrorType = (error) => {
  const message = error.message?.toLowerCase() || "";
  const code = error.code?.toLowerCase() || "";

  if (
    message.includes("database") ||
    message.includes("query") ||
    code.includes("23") ||
    message.includes("drizzle")
  ) {
    return "DATABASE";
  }
  if (
    message.includes("unauthorized") ||
    message.includes("forbidden") ||
    message.includes("token") ||
    message.includes("auth")
  ) {
    return "AUTHENTICATION";
  }
  if (
    message.includes("validation") ||
    message.includes("invalid") ||
    error.statusCode === 400
  ) {
    return "VALIDATION";
  }
  if (message.includes("s3") || message.includes("bucket")) {
    return "S3";
  }
  if (message.includes("lambda")) {
    return "LAMBDA";
  }
  if (message.includes("api") || message.includes("request")) {
    return "API";
  }

  return "UNKNOWN";
};

/**
 * Determine error severity
 */
const determineSeverity = (error) => {
  const statusCode = error.statusCode || error.status || 500;

  if (statusCode >= 500) return "CRITICAL";
  if (statusCode >= 400 && statusCode < 500) return "WARN";
  if (error.message?.toLowerCase().includes("critical")) return "CRITICAL";
  if (error.message?.toLowerCase().includes("error")) return "ERROR";

  return "ERROR";
};

/**
 * Log error to database
 */
const logErrorToDatabase = async (error, req) => {
  try {
    const errorType = determineErrorType(error);
    const severity = determineSeverity(error);

    await db.insert(applicationErrors).values({
      errorType,
      severity,
      endpoint: req.originalUrl || req.url,
      method: req.method,
      requestIp: req.ip || req.connection?.remoteAddress,
      userAgent: req.get("user-agent"),
      userId: req.user?.id || null,
      chatbotId:
        req.body?.chatbotId ||
        req.params?.chatbotId ||
        req.query?.chatbotId ||
        null,
      errorCode: error.statusCode?.toString() || error.code || "UNKNOWN",
      errorMessage: error.message || "An unknown error occurred",
      errorStack: error.stack || null,
      requestBody: sanitizeRequestBody(req.body),
      requestParams: req.params || null,
      requestQuery: req.query || null,
      metadata: {
        errorName: error.name,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (dbError) {
    // If database logging fails, log to console
    console.error("❌ Failed to log error to database:", dbError);
    console.error("Original error:", error);
  }
};

const asyncHandler = (requestHandler) => {
  return (req, res, next) => {
    Promise.resolve(requestHandler(req, res, next)).catch(async (err) => {
      // Log error to database
      await logErrorToDatabase(err, req);

      // Pass error to Express error handler
      next(err);
    });
  };
};

export { asyncHandler };

// const asyncHandler = () => {}
// const asyncHandler = (func) => () => {}
// const asyncHandler = (func) => async () => {}

// const asyncHandler = (fn) => async (req, res, next) => {
//     try {
//         await fn(req, res, next)
//     } catch (error) {
//         res.status(err.code || 500).json({
//             success: false,
//             message: err.message
//         })
//     }
// }
