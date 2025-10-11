import { Constants } from "./constants.js";
import { makeRateLimited } from "./timing/rate-limit.js";
import { makeLogger } from "./core/errors.js";

const logDomObserverError = makeLogger("DOMObserver");

/**
 * @module DOMObserver
 * @description Observes the DOM for changes and triggers callbacks.
 */
const DOMObserver = (() => {
  let observer = null;
  const pendingRefs = new Set();

  const clearPendingRefs = () => {
    if (pendingRefs.size === 0) {
      return;
    }
    for (const ref of pendingRefs) {
      const node = ref.deref();
      if (isElement(node)) {
        node.removeAttribute(Constants.OBSERVER_PENDING_ATTR);
      }
    }
    pendingRefs.clear();
  };

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
      return node.textContent?.trim() === "";
    }
    if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
      return [...node.childNodes].every((child) => isOwnedSubtree(child));
    }
    if (!isElement(node)) {
      return false;
    }
    if (!isOwnedByScript(node)) {
      return false;
    }
    return [...node.childNodes].every((child) => isOwnedSubtree(child));
  };

  const areAllOwned = (nodes) => {
    if (!nodes || nodes.length === 0) {
      return false;
    }
    return [...nodes].every((node) => isOwnedSubtree(node));
  };

  const shouldIgnoreAttributeMutation = (mutation) => {
    const { attributeName, target } = mutation;
    if (!attributeName || !isElement(target)) {
      return false;
    }
    if (attributeName.startsWith("data-us-dhl-")) {
      return true;
    }
    if (isOwnedByScript(target)) {
      return true;
    }
    if (
      attributeName === "class" &&
      [...target.classList].some((cls) => cls.startsWith("us-dhl-"))
    ) {
      return true;
    }
    return false;
  };

  const isSelfInflictedChildList = (mutation) => {
    const { addedNodes, removedNodes } = mutation;
    const hasOwnedAdds = addedNodes.length > 0 && areAllOwned(addedNodes);
    const hasOwnedRemovals = removedNodes.length > 0 && areAllOwned(removedNodes);

    if (
      (addedNodes.length > 0 && !hasOwnedAdds) ||
      (removedNodes.length > 0 && !hasOwnedRemovals)
    ) {
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
    element.setAttribute(Constants.OBSERVER_PENDING_ATTR, "1");
    pendingRefs.add(new WeakRef(element));
    return true;
  };

  const scheduleTask = (fn, timeout = 50) =>
    new Promise((resolve) => {
      const runSafely = () => {
        try {
          fn();
        } finally {
          resolve();
        }
      };
      if ("requestIdleCallback" in globalThis) {
        requestIdleCallback(runSafely, { timeout });
        return;
      }
      requestAnimationFrame(runSafely);
    });

  const dispatchNodes = async (nodes, callback, batchSize) => {
    if (!Array.isArray(nodes) || nodes.length === 0) {
      return;
    }
    if (batchSize > 0 && nodes.length > batchSize) {
      for (let index = 0; index < nodes.length; index += batchSize) {
        const chunk = nodes.slice(index, index + batchSize);
        await scheduleTask(() => callback(chunk));
      }
      return;
    }
    await scheduleTask(() => callback(nodes));
  };

  const collectFromNode = (node) => {
    if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
      return [...node.childNodes].some((child) => collectFromNode(child));
    }
    if (isElement(node)) {
      return markPending(node);
    }
    return false;
  };

  const collectFromMutation = (mutation) => {
    if (mutation.type === "attributes") {
      if (shouldIgnoreAttributeMutation(mutation)) {
        return false;
      }
      return markPending(mutation.target);
    }

    if (mutation.type === "childList") {
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
    if (pendingRefs.size === 0) {
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
    if (nodes.length > 0) {
      callback(nodes);
    }
  };

  const disconnect = () => {
    if (!observer) {
      clearPendingRefs();
      return;
    }
    observer.takeRecords();
    observer.disconnect();
    observer = null;
    clearPendingRefs();
  };

  const observe = (callback, options = {}) => {
    const {
      observeAttributes = false,
      attributeFilter,
      rate = { throttleMs: 120, debounceMs: 180 },
      batchSize = 12,
      nodeFilter = null,
    } = options || {};

    disconnect();

    const processPending = async () => {
      let nodes = [];
      const collector = (collected) => {
        nodes = collected;
      };
      flushPending(collector);
      if (nodes.length === 0) {
        return;
      }
      if (typeof nodeFilter === "function") {
        nodes = nodes.filter((node) => {
          try {
            return nodeFilter(node);
          } catch (error) {
            logDomObserverError("nodeFilter failed; including node by default", error);
            return true;
          }
        });
      }
      if (nodes.length === 0) {
        return;
      }
      await dispatchNodes(nodes, callback, batchSize);
    };

    const rateLimited = makeRateLimited(processPending, {
      throttleMs: rate?.throttleMs ?? 120,
      debounceMs: rate?.debounceMs ?? 180,
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
      attributes: Boolean(observeAttributes),
      attributeFilter: attributeFilter || undefined,
    });
  };

  return { observe, disconnect };
})();

export default DOMObserver;
