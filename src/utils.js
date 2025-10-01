/**
 * @module Utils
 * @description Provides utility functions for DOM manipulation and data parsing.
 */
const Utils = {
  // Selects the first element matching the selector.
  $: (sel, root = document) => root.querySelector(sel),

  // Selects all elements matching the selector.
  $$: (sel, root = document) => Array.from(root.querySelectorAll(sel)),

  /**
   * Finds the series name for a given seriesId by searching the DOM.
   *
   * Attempts to locate a link element whose href starts with the provided seriesId,
   * and returns its trimmed text content. If not found, falls back to searching for
   * a main page title or header element. Returns "Unknown Series" if no match is found.
   *
   * @param {string} seriesId - The identifier of the series to search for.
   * @returns {string} The name of the series, or "Unknown Series" if not found.
   */
  getSeriesNameForId: (seriesId) => {
    if (typeof seriesId !== "string") {
      return "Unknown Series";
    }
    // Look for a link that starts with the seriesId
    const link = document.querySelector(`a[href^='${seriesId}']`);
    if (link && link.textContent) {
      return link.textContent.trim();
    }
    // Fallback: look for main page title/header
    const header = document.querySelector(
      ".page-title, h1.title, h1, .entry-title, .titulo, .title, header h1",
    );
    if (header && header.textContent) {
      return header.textContent.trim();
    }
    return "Unknown Series";
  },

  /**
   * Finds the season name for a given seasonId by searching the DOM.
   *
   * Attempts to locate a link element whose href starts with the provided seasonId,
   * and returns its trimmed text content. If not found, falls back to searching for
   * a main page title or header element. Returns "Unknown Season" if no match is found.
   *
   * @param {string} seasonId - The identifier of the season to search for.
   * @returns {string} The name of the season, or "Unknown Season" if not found.
   */
  getSeasonNameForId: (seasonId) => {
    if (typeof seasonId !== "string") {
      return "Unknown Season";
    }
    // Look for a link that starts with the seasonId
    const link = document.querySelector(`a[href^='${seasonId}']`);
    if (link && link.textContent) {
      return link.textContent.trim();
    }
    // Fallback: look for main page title/header
    const header = document.querySelector(
      ".season-title, h2.title, h1, .entry-title, .titulo, .title, header h1",
    );
    if (header && header.textContent) {
      return header.textContent.trim();
    }
    return "Unknown Season";
  },

  /**
   * Finds the series title from a root element.
   *
   * Searches for a series title within the provided root element using a set of
   * candidate selectors. Returns the trimmed text content of the first matching
   * element, or null if no title is found.
   *
   * @param {Element|Document} root - The root element or document to search within.
   * @returns {string|null} The series title if found, otherwise null.
   */
  getSeriesTitleFromElement: (root) => {
    const cands = [
      ".page-title",
      "h1.title",
      "h1",
      ".entry-title",
      ".titulo",
      ".title",
      "header h1",
    ];
    for (const sel of cands) {
      const t = root.querySelector(sel)?.textContent?.trim();
      if (t) {
        return t;
      }
    }
    return null;
  },

  /**
   * Finds the season title from a root element.
   *
   * Searches for a season title within the provided root element using a set of
   * candidate selectors. Returns the trimmed text content of the first matching
   * element, or null if no title is found.
   *
   * @param {Element|Document} root - The root element or document to search within.
   * @returns {string|null} The season title if found, otherwise null.
   */
  getSeasonTitleFromElement: (root) => {
    const cands = [
      ".season-title",
      "h2.title",
      "h2",
      ".entry-title",
      ".titulo",
      ".title",
      "header h2",
    ];
    for (const sel of cands) {
      const t = root.querySelector(sel)?.textContent?.trim();
      if (t) {
        return t;
      }
    }
    return null;
  },

  /**
   * Creates a debounced version of the provided function.
   * The debounced function delays invoking the original function until after
   * the specified number of milliseconds have elapsed since the last time it was called.
   *
   * @function
   * @param {Function} fn - The function to debounce.
   * @param {number} ms - The number of milliseconds to delay.
   * @returns {Function} A debounced version of the input function.
   */
  debounce: (fn, ms) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), ms);
    };
  },

  /**
   * Executes the provided function at most once per specified interval.
   * - If `leading` is true, the function is called immediately on the first invocation.
   * - If `trailing` is true, the function is called once more after the last invocation in a burst.
   *
   * @param {Function} fn - The function to throttle.
   * @param {number} interval - The minimum time interval (in ms) between calls.
   * @param {Object} [options] - Throttle options.
   * @param {boolean} [options.leading=true] - Whether to invoke on the leading edge.
   * @param {boolean} [options.trailing=true] - Whether to invoke on the trailing edge.
   * @returns {Function} A throttled version of the input function.
   */
  throttle: (fn, interval, { leading = true, trailing = true } = {}) => {
    let lastTime = 0;
    let timeoutId = null;
    let lastArgs = null;

    const invoke = (ctx, args) => {
      lastTime = Date.now();
      timeoutId = null;
      fn.apply(ctx, args);
    };

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
  },

  /**
   * Creates a rate-limited version of the provided function.
   *
   * The returned function combines throttling and debouncing:
   * - Throttling ensures the function is called at most once per `throttleMs` interval,
   *   providing quick, bounded responses during bursts.
   * - Debouncing ensures the function is called once more after changes settle,
   *   with a delay of `debounceMs`.
   *
   * Useful for handling rapid-fire events (e.g., scroll, resize, input) where both
   * immediate and final responses are desired.
   *
   * @param {Function} fn - The function to rate-limit.
   * @param {Object} [options] - Configuration options.
   * @param {number} [options.throttleMs=120] - Throttle interval in milliseconds.
   * @param {number} [options.debounceMs=180] - Debounce delay in milliseconds.
   * @returns {Function} A function that applies both throttling and debouncing to `fn`.
   */
  makeRateLimited: (fn, { throttleMs = 120, debounceMs = 180 } = {}) => {
    const throttled = Utils.throttle(fn, throttleMs, {
      leading: true,
      trailing: true,
    });
    const debounced = Utils.debounce(fn, debounceMs);
    return (...args) => {
      throttled(...args); // quick, bounded responses during storms
      debounced(...args); // final sweep once changes settle
    };
  },

  /**
   * Downloads a text file with the specified filename and data.
   *
   * Creates a Blob from the provided data and triggers a download using an
   * invisible anchor element. The file is downloaded with the given filename
   * and MIME type (defaults to "application/json").
   *
   * @param {string} filename - The name of the file to be downloaded.
   * @param {string|Blob|ArrayBuffer} data - The data to be included in the file.
   * @param {string} [mimeType="application/json"] - The MIME type of the file.
   */
  downloadTextFile: (filename, data, mimeType = "application/json") => {
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = "none";
    (document.body || document.documentElement).appendChild(anchor);
    anchor.click();
    setTimeout(() => {
      anchor.remove();
      URL.revokeObjectURL(url);
    }, 0);
  },

  /**
   * Determines if a DOM element is visible to the user.
   *
   * Checks visibility using the element's `checkVisibility` method if available,
   * otherwise falls back to checking `offsetParent` and bounding client rects.
   * Returns `true` if the element is visible, otherwise `false`.
   *
   * @param {Element} element - The DOM element to check for visibility.
   * @returns {boolean} True if the element is visible, false otherwise.
   */
  isElementVisible: (element) => {
    if (!element) {
      return false;
    }
    if (typeof element.checkVisibility === "function") {
      try {
        return element.checkVisibility({
          checkOpacity: true,
          checkVisibilityCSS: true,
        });
      } catch (error) {
        void error;
      }
    }
    if (element.offsetParent !== null) {
      return true;
    }
    const rects = element.getClientRects();
    return rects.length > 0 && Array.from(rects).some((rect) => rect.width > 0 && rect.height > 0);
  },
};

export default Utils;
