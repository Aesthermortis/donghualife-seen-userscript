/**
 * Creates a throttled version of the provided function that limits invocations to at most once per interval.
 * @param {(...args: unknown[]) => unknown} fn The function to throttle.
 * @param {number} interval The minimum time in milliseconds between allowed invocations.
 * @param {{ leading?: boolean, trailing?: boolean }} [options] Throttle configuration flags.
 * @param {boolean} [options.leading] Whether to invoke on the leading edge of the interval.
 * @param {boolean} [options.trailing] Whether to invoke on the trailing edge of the interval.
 * @returns {(...args: unknown[]) => void} Throttled function maintaining the latest invocation context and arguments.
 */
export function throttle(fn, interval, { leading = true, trailing = true } = {}) {
  let lastTime = 0;
  let timeoutId = null;
  let lastArgs = null;

  /**
   * Executes the throttled function with the preserved context and arguments while updating timing metadata.
   * @param {unknown} ctx Execution context for the pending invocation.
   * @param {unknown[]} args Arguments captured during the latest call to the throttled function.
   * @returns {void}
   */
  function invoke(ctx, args) {
    lastTime = Date.now();
    timeoutId = null;
    fn.apply(ctx, args);
  }

  return function throttled(...args) {
    const now = Date.now();
    if (!lastTime && !leading) {
      lastTime = now;
    }
    const remaining = interval - (now - lastTime);
    lastArgs = args;

    if (remaining <= 0 || remaining > interval) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      invoke(this, lastArgs);
    } else if (trailing && !timeoutId) {
      timeoutId = setTimeout(() => invoke(this, lastArgs), remaining);
    }
  };
}
