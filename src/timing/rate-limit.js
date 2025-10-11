import { throttle } from "./throttle.js";
import { debounce } from "./debounce.js";

/**
 * Returns a function that applies both throttling and debouncing to the provided callback.
 * The throttled function executes at most once per `throttleMs` interval,
 * while the debounced function delays execution until `debounceMs` have passed since the last call.
 * @param {(...args: unknown[]) => void} fn - The callback to be rate-limited.
 * @param {{ throttleMs?: number, debounceMs?: number }} [options] - Configuration options.
 * @param {number} [options.throttleMs] - Throttle interval in milliseconds.
 * @param {number} [options.debounceMs] - Debounce interval in milliseconds.
 * @returns {(...args: unknown[]) => void} A function that applies both throttling and debouncing to `fn`.
 */
export function makeRateLimited(fn, { throttleMs = 120, debounceMs = 180 } = {}) {
  const throttled = throttle(fn, throttleMs, { leading: true, trailing: true });
  const debounced = debounce(fn, debounceMs);
  return (...args) => {
    throttled(...args);
    debounced(...args);
  };
}
