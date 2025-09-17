import Utils from './utils.js';

/**
 * @module DOMObserver
 * @description Observes the DOM for changes and triggers callbacks.
 */
const DOMObserver = (() => {
  let observer = null;

  const hasRelevantChange = (m) => {
    return (
      (m.addedNodes && m.addedNodes.length > 0) ||
      (m.removedNodes && m.removedNodes.length > 0) ||
      m.type === "attributes"
    );
  };

  const observe = (callback) => {
    if (observer) {
      observer.disconnect();
    }

    const rateLimited = Utils.makeRateLimited(callback, {
      throttleMs: 120, // responde pronto pero con tope
      debounceMs: 180, // última pasada cuando se calma
    });

    observer = new MutationObserver((mutationsList) => {
      if (mutationsList.some(hasRelevantChange)) {
        rateLimited();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true, // opcional pero recomendable
      attributeFilter: undefined, // o pon una lista si sabes qué atributos te interesan
    });
  };

  return { observe };
})();

export default DOMObserver;
