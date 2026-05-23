import pino from "pino";
import pinoHttp from "pino-http";

const isDev = process.env["NODE_ENV"] !== "production";

// Fields redacted in every log line — values replaced with "[Redacted]"
const REDACTED_FIELDS = [
  "password",
  "confirmPassword",
  "token",
  "accessToken",
  "refreshToken",
  "secret",
  "authorization",
  "req.headers.authorization",
  "req.headers.cookie",
  "*.password",
  "*.token",
  "*.secret",
];

const transport = isDev
  ? {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:HH:MM:ss.l",
        ignore: "pid,hostname",
        messageFormat: "{msg}",
      },
    }
  : undefined;

export const logger = pino({
  level: process.env["LOG_LEVEL"] ?? (isDev ? "debug" : "info"),
  redact: { paths: REDACTED_FIELDS, censor: "[Redacted]" },
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
  // In production emit a structured "app started" base object for log routers
  base: isDev ? undefined : { service: process.env["SERVICE_NAME"] ?? "api" },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport,
});

/**
 * Create a child logger pre-bound with fixed context fields.
 * Use this inside request handlers, background jobs, or any scoped operation.
 *
 * @example
 * const log = createLogger({ module: "OrderService", userId });
 * log.info({ orderId }, "Order placed");
 */
export function createLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}

/**
 * Express / Node HTTP middleware — logs every request/response pair.
 *
 * Attach before your route handlers:
 * @example
 * app.use(httpLogger);
 *
 * Production JSON line example:
 * {"level":30,"time":"...","req":{"method":"POST","url":"/orders"},"res":{"statusCode":201},"responseTime":12,"msg":"request completed"}
 */
export const httpLogger = pinoHttp({
  logger,
  // Quiet down noisy health-check endpoints
  quietReqLogger: true,
  customSuccessMessage(req, res) {
    if (res.statusCode >= 500) return "request errored";
    if (res.statusCode >= 400) return "request rejected";
    return "request completed";
  },
  customErrorMessage(_req, _res, err) {
    return `request failed — ${err.message}`;
  },
  // Assign a severity label matching common log-router conventions (GCP, Datadog)
  customLogLevel(_req, res, err) {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  // Skip body logging — bodies may contain PII; log only what you need in controllers
  serializers: {
    req(req) {
      return {
        id: req.id,
        method: req.method,
        url: req.url,
        userAgent: req.headers["user-agent"],
        // Include userId if set by auth middleware
        userId: (req.raw as { userId?: string }).userId,
      };
    },
  },
});

export type { Logger } from "pino";
