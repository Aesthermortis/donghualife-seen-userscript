/**
 * Obtain the first element that matches the selector within the provided root.
 * @param {string} selector CSS selector used to locate the element.
 * @param {Document | Element | DocumentFragment} [root] Node that limits the scope of the search.
 * @returns {Element | null} Matching element or `null` when no match exists.
 */
export function select(selector, root = document) {
  return root.querySelector(selector);
}

/**
 * Collect every element that matches the selector within the provided root.
 * @param {string} selector CSS selector used to collect elements.
 * @param {Document | Element | DocumentFragment} [root] Node that limits the scope of the search.
 * @returns {Element[]} Array of matching elements, possibly empty.
 */
export function selectAll(selector, root = document) {
  return [...root.querySelectorAll(selector)];
}
