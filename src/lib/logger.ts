type LogLevel = "debug" | "info" | "warn" | "error";

type LogFields = Record<string, unknown>;

/**
 * Minimal structured logger. Every line is a single JSON object so it can
 * be filtered/queried in Vercel's log explorer (or any log aggregator) by
 * field — e.g. `deliveryId`, `eventType`, `repo` — instead of grepping
 * free-text strings. Deliberately dependency-free: this is a 72-hour
 * exercise, not a place to pull in a full logging framework.
 *
 * Secrets must never be passed in `fields` — see redact() below, which is
 * a last-line-of-defense scrub for common accidental leaks (tokens,
 * Authorization headers), not a substitute for not logging them.
 */
const SENSITIVE_KEY_PATTERN = /token|secret|password|authorization|private[_-]?key/i;

function redact(fields: LogFields): LogFields {
  const out: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    out[key] = SENSITIVE_KEY_PATTERN.test(key) ? "[redacted]" : value;
  }
  return out;
}

function emit(level: LogLevel, message: string, fields: LogFields = {}) {
  const line = {
    level,
    message,
    time: new Date().toISOString(),
    ...redact(fields),
  };
  const serialized = JSON.stringify(line);
  if (level === "error") console.error(serialized);
  else if (level === "warn") console.warn(serialized);
  else console.log(serialized);
}

export const logger = {
  debug: (message: string, fields?: LogFields) => emit("debug", message, fields),
  info: (message: string, fields?: LogFields) => emit("info", message, fields),
  warn: (message: string, fields?: LogFields) => emit("warn", message, fields),
  error: (message: string, fields?: LogFields) => emit("error", message, fields),
};
