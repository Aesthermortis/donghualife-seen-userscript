/**
 * Returns a debounced version of the provided function.
 * The debounced function delays invoking `fn` until after `ms` milliseconds have elapsed
 * since the last time it was called.
 * @param {(...args: unknown[]) => void} fn - The function to debounce.
 * @param {number} ms - The number of milliseconds to delay.
 * @returns {(...args: unknown[]) => void} A debounced function.
 */
export function debounce(fn, ms) {
  let timeoutId;
  return function debounced(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  };
}
