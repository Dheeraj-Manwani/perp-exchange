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
        ignore: "pid,hostname,req,res,responseTime",
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
  quietReqLogger: true,
  customSuccessMessage(req, res) {
    return `${req.method} ${req.url} ${res.statusCode}`;
  },
  customErrorMessage(req, res, err) {
    return `${req.method} ${req.url} ${res.statusCode} — ${err.message}`;
  },
  customLogLevel(_req, res, err) {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  serializers: {
    req(req) {
      return { method: req.method, url: req.url };
    },
  },
});

export type { Logger } from "pino";
