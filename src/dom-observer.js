import { Constants } from './constants.js';
import Utils from './utils.js';

/**
 * @module DOMObserver
 * @description Observes the DOM for changes and triggers callbacks.
 */
const DOMObserver = (() => {
  let observer = null;
  const pendingRefs = new Set();

  const isElement = (node) => node instanceof Element;

  const isOwnedByScript = (node) => {
    if (!isElement(node)) {
      return false;
    }
    if (node.hasAttribute(Constants.OWNED_ATTR)) {
      return true;
    }
    return Boolean(node.closest?.(`[${Constants.OWNED_ATTR}]`));
  };

  const isOwnedSubtree = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent?.trim() === '';
    }
    if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
      return Array.from(node.childNodes).every(isOwnedSubtree);
    }
    if (!isElement(node)) {
      return false;
    }
    if (!isOwnedByScript(node)) {
      return false;
    }
    return Array.from(node.childNodes).every(isOwnedSubtree);
  };

  const areAllOwned = (nodes) => {
    if (!nodes || nodes.length === 0) {
      return false;
    }
    return Array.from(nodes).every(isOwnedSubtree);
  };

  const shouldIgnoreAttributeMutation = (mutation) => {
    const { attributeName, target } = mutation;
    if (!attributeName || !isElement(target)) {
      return false;
    }
    if (attributeName.startsWith('data-us-dhl-')) {
      return true;
    }
    if (isOwnedByScript(target)) {
      return true;
    }
    if (
      attributeName === 'class' &&
      Array.from(target.classList).some((cls) => cls.startsWith('us-dhl-'))
    ) {
      return true;
    }
    return false;
  };

  const isSelfInflictedChildList = (mutation) => {
    const { addedNodes, removedNodes } = mutation;
    const hasOwnedAdds = addedNodes.length > 0 && areAllOwned(addedNodes);
    const hasOwnedRemovals = removedNodes.length > 0 && areAllOwned(removedNodes);

    if ((addedNodes.length && !hasOwnedAdds) || (removedNodes.length && !hasOwnedRemovals)) {
      return false;
    }

    return addedNodes.length > 0 || removedNodes.length > 0;
  };

  const markPending = (element) => {
    if (!isElement(element) || isOwnedByScript(element)) {
      return false;
    }
    if (element.hasAttribute(Constants.OBSERVER_PENDING_ATTR)) {
      return false;
    }
    element.setAttribute(Constants.OBSERVER_PENDING_ATTR, '1');
    pendingRefs.add(new WeakRef(element));
    return true;
  };

  const collectFromNode = (node) => {
    if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
      return Array.from(node.childNodes).some(collectFromNode);
    }
    if (isElement(node)) {
      return markPending(node);
    }
    return false;
  };

  const collectFromMutation = (mutation) => {
    if (mutation.type === 'attributes') {
      if (shouldIgnoreAttributeMutation(mutation)) {
        return false;
      }
      return markPending(mutation.target);
    }

    if (mutation.type === 'childList') {
      if (isSelfInflictedChildList(mutation)) {
        return false;
      }

      let queued = false;
      for (const node of mutation.addedNodes) {
        if (collectFromNode(node)) {
          queued = true;
        }
      }
      if (mutation.target && markPending(mutation.target)) {
        queued = true;
      }
      return queued;
    }

    return false;
  };

  const flushPending = (callback) => {
    if (!pendingRefs.size) {
      return;
    }
    const nodes = [];
    for (const ref of pendingRefs) {
      const node = ref.deref();
      if (isElement(node)) {
        node.removeAttribute(Constants.OBSERVER_PENDING_ATTR);
        nodes.push(node);
      }
    }
    pendingRefs.clear();
    if (nodes.length) {
      callback(nodes);
    }
  };

  const observe = (callback) => {
    if (observer) {
      observer.disconnect();
    }
    pendingRefs.clear();

    const rateLimited = Utils.makeRateLimited(() => flushPending(callback), {
      throttleMs: 120,
      debounceMs: 180,
    });

    observer = new MutationObserver((mutationsList) => {
      let relevant = false;
      for (const mutation of mutationsList) {
        if (collectFromMutation(mutation)) {
          relevant = true;
        }
      }
      if (relevant) {
        rateLimited();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeOldValue: false,
    });
  };

  return { observe };
})();

export default DOMObserver;
