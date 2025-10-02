// Centralized error utilities for consistent logging and normalization.

const PREFIX = "DonghuaLife";
const MAX_SEEN = 200;
const seenKeys = new Set();

/**
 * Normalize an unknown thrown value to an Error instance.
 * @param {unknown} err Thrown value to normalize.
 * @returns {Error}
 */
export function toError(err) {
  if (err instanceof Error) {
    return err;
  }
  if (typeof err === "string") {
    return new Error(err);
  }
  try {
    return new Error(JSON.stringify(err));
  } catch {
    return new Error(String(err));
  }
}

/**
 * Log an error with a consistent prefix and optional de-duplication.
 * @param {string} context Short description of where the failure happened.
 * @param {unknown} err Thrown value to log.
 * @param {{ onceKey?: string, rethrow?: boolean }} [opts] Optional logging settings.
 */
export function logError(context, err, opts = {}) {
  const error = toError(err);
  const { onceKey, rethrow } = opts;
  const key = onceKey ? `${context}::${onceKey}::${error.message}` : null;

  if (key !== null) {
    if (seenKeys.has(key)) {
      if (rethrow === true) {
        throw error;
      }
      return;
    }
    if (seenKeys.size > MAX_SEEN) {
      seenKeys.clear();
    }
    seenKeys.add(key);
  }

  console.error(`${PREFIX}: ${context}`, error);

  if (rethrow === true) {
    throw error;
  }
}

/**
 * Create a logger scoped to a given namespace.
 * @param {string} namespace Logical area name included in every log entry.
 * @returns {(context: string, err: unknown, opts?: { onceKey?: string, rethrow?: boolean }) => void}
 */
export function makeLogger(namespace) {
  return (context, err, opts) => logError(`${namespace}: ${context}`, err, opts);
}
