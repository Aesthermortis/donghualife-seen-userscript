/**
 * Determines whether the provided element is currently visible within the DOM.
 * @param {Element | null} element - Element whose visibility should be evaluated.
 * @returns {boolean} True when the element is perceptibly visible to the user.
 */
export function isElementVisible(element) {
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
      console.debug("Failed to call checkVisibility.", error);
    }
  }
  if (element.offsetParent !== null) {
    return true;
  }
  const rects = element.getClientRects();
  return rects.length > 0 && [...rects].some((rect) => rect.width > 0 && rect.height > 0);
}
