/**
 * @module Utils
 * @description Provides utility functions for DOM manipulation and data parsing.
 */
const Utils = {
  /**
   * Selects the first element matching the selector.
   * @param {string} sel
   * @param {Document|Element} root
   * @returns {Element|null}
   */
  $: (sel, root = document) => root.querySelector(sel),

  /**
   * Selects all elements matching the selector.
   * @param {string} sel
   * @param {Document|Element} root
   * @returns {Element[]}
   */
  $$: (sel, root = document) => Array.from(root.querySelectorAll(sel)),

  /**
   * Finds the series name for a given seriesId by searching the DOM.
   * @param {string} seriesId
   * @returns {string}
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
   * @param {string} seasonId
   * @returns {string}
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
   * @param {Element|Document} root
   * @returns {string|null}
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
   * @param {Element|Document} root
   * @returns {string|null}
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
   * Debounces a function.
   * @param {Function} fn
   * @param {number} ms
   * @returns {Function}
   */
  debounce: (fn, ms) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), ms);
    };
  },

  /**
   * Throttle: limits how often `fn` can run within `interval` ms.
   * Supports leading/trailing calls for smoother UX on bursts.
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
   * Combines a fast leading throttle with a trailing debounce.
   * - Throttle gives quick but bounded reactions during bursts.
   * - Debounce ensures one final "settled" pass after the burst.
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
   * Triggers a download for the provided text content.
   * @param {string} filename
   * @param {string} data
   * @param {string} [mimeType]
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
};

export default Utils;
