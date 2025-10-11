import CSS from "./styles.css";
import { select, selectAll } from "./dom/select.js";
import { isElementVisible } from "./dom/visibility.js";
import I18n from "./i18n.js";

/**
 * @module UIManager
 * @description Handles all direct DOM manipulations for UI elements like toasts and modals.
 */
const UIManager = (() => {
  const modalOverlayClass = "us-dhl-modal-overlay";
  const modalClass = "us-dhl-modal";
  const focusableSelector = [
    "a[href]",
    "button:not([disabled])",
    "textarea:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    '[tabindex]:not([tabindex="-1"])',
  ].join(",");
  let modalIdCounter = 0;

  const getToastContainer = () => {
    let container = select("#us-dhl-toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "us-dhl-toast-container";
      container.className = "us-dhl-toast-container";
      document.body.append(container);
    }
    return container;
  };

  const defaultSanitize = (html) => {
    const value = html === null ? "" : String(html);
    const purifier = typeof globalThis === "undefined" ? undefined : globalThis.DOMPurify;
    if (purifier && typeof purifier.sanitize === "function") {
      return purifier.sanitize(value, {
        ALLOW_UNKNOWN_PROTOCOLS: false,
        FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "link"],
        FORBID_ATTR: ["onerror", "onload", "onclick", "style"],
        USE_PROFILES: { html: true, svg: false, mathMl: false },
      });
    }
    const temp = document.createElement("div");
    temp.textContent = value;
    return temp.innerHTML;
  };

  const ensureOverlay = () => {
    let overlay = select(`.${modalOverlayClass}`);
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = modalOverlayClass;
      overlay.dataset.ui = "overlay";
      overlay.tabIndex = -1;
      document.body.append(overlay);
    } else if (!document.body.contains(overlay)) {
      document.body.append(overlay);
    }
    return overlay;
  };

  const lockScroll = () => {
    const { body, documentElement } = document;
    if (!body || body.dataset.usDhlScrollLocked === "true") {
      return;
    }
    const prevOverflow = body.style.overflow || "";
    const prevPaddingRight = body.style.paddingRight || "";
    const scrollbarWidth = Math.max(window.innerWidth - documentElement.clientWidth, 0);
    body.dataset.usDhlScrollLocked = "true";
    body.dataset.usDhlPrevOverflow = prevOverflow;
    body.dataset.usDhlPrevPaddingRight = prevPaddingRight;
    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }
  };

  const unlockScroll = () => {
    const { body } = document;
    if (!body || body.dataset.usDhlScrollLocked !== "true") {
      return;
    }
    const prevOverflow = body.dataset.usDhlPrevOverflow ?? "";
    const prevPaddingRight = body.dataset.usDhlPrevPaddingRight ?? "";
    body.style.overflow = prevOverflow;
    body.style.paddingRight = prevPaddingRight;
    delete body.dataset.usDhlScrollLocked;
    delete body.dataset.usDhlPrevOverflow;
    delete body.dataset.usDhlPrevPaddingRight;
  };

  const removeExistingModal = (overlay) => {
    const existing = select(`.${modalClass}`, overlay);
    if (existing) {
      existing.remove();
    }
  };

  const stopModalClickPropagation = (event) => {
    event.stopPropagation();
  };

  const destroyModal = (overlay = select(`.${modalOverlayClass}`)) => {
    if (!overlay) {
      return;
    }
    if (typeof overlay._modalCleanup === "function") {
      overlay._modalCleanup();
      overlay._modalCleanup = undefined;
    }
    removeExistingModal(overlay);
    if (!overlay.childElementCount) {
      overlay.remove();
      unlockScroll();
    }
  };

  const attachModalBehaviors = (overlay, modal, state) => {
    if (typeof overlay._modalCleanup === "function") {
      overlay._modalCleanup();
    }

    const getFocusable = () =>
      selectAll(focusableSelector, modal).filter(
        (el) => !el.hasAttribute("disabled") && isElementVisible(el),
      );

    const focusFirst = () => {
      const focusable = getFocusable();
      const target = focusable[0] || modal;
      requestAnimationFrame(() => {
        target.focus();
      });
    };

    const onKeyDown = (event) => {
      if (!document.body.contains(modal)) {
        return;
      }
      if (event.key === "Escape" && state.closeOnEscape) {
        event.preventDefault();
        state.onRequestClose?.("escape");
        return;
      }
      if (event.key === "Tab" && state.trapFocus) {
        const focusable = getFocusable();
        if (focusable.length === 0) {
          event.preventDefault();
          modal.focus();
          return;
        }
        const first = focusable[0];
        const last = focusable.at(-1);
        const { activeElement } = document;
        if (event.shiftKey) {
          if (activeElement === first || !modal.contains(activeElement)) {
            event.preventDefault();
            last.focus();
          }
        } else if (activeElement === last || !modal.contains(activeElement)) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    const onOverlayClick = (event) => {
      if (event.target === overlay && state.closeOnOverlay) {
        state.onRequestClose?.("overlay");
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    overlay.addEventListener("click", onOverlayClick);
    modal.addEventListener("click", stopModalClickPropagation);
    focusFirst();

    overlay._modalCleanup = () => {
      document.removeEventListener("keydown", onKeyDown, true);
      overlay.removeEventListener("click", onOverlayClick);
      modal.removeEventListener("click", stopModalClickPropagation);
    };
  };

  const createModal = (content, options = {}) => {
    const {
      allowHTML = false,
      sanitize = defaultSanitize,
      labelledById = null,
      trapFocus = true,
      closeOnEscape = true,
      closeOnOverlay = true,
    } = options;

    const activeElement = typeof document === "undefined" ? null : document.activeElement;
    const previouslyFocusedElement =
      activeElement && typeof activeElement.focus === "function" ? activeElement : null;

    const overlay = ensureOverlay();
    removeExistingModal(overlay);

    const modal = document.createElement("div");
    modal.className = modalClass;
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.tabIndex = -1;

    if (labelledById) {
      modal.setAttribute("aria-labelledby", labelledById);
    }

    if (content instanceof Node) {
      modal.append(content);
    } else if (typeof content === "string") {
      if (allowHTML) {
        const safe = sanitize(content);
        if (typeof safe === "string") {
          modal.insertAdjacentHTML("afterbegin", safe);
        } else if (safe instanceof Node) {
          modal.append(safe);
        } else {
          modal.textContent = "";
        }
      } else {
        modal.textContent = content;
      }
    } else if (content !== null) {
      modal.textContent = String(content);
    }

    overlay.append(modal);
    lockScroll();

    const restoreFocus = () => {
      if (!previouslyFocusedElement || typeof previouslyFocusedElement.focus !== "function") {
        return;
      }
      if (previouslyFocusedElement.isConnected === false) {
        return;
      }
      if (typeof document.contains === "function" && !document.contains(previouslyFocusedElement)) {
        return;
      }
      previouslyFocusedElement.focus();
    };

    let isDestroyed = false;
    const destroyInstance = () => {
      if (isDestroyed) {
        return;
      }
      isDestroyed = true;
      destroyModal(overlay);
      restoreFocus();
    };

    const state = {
      onRequestClose: () => destroyInstance(),
      trapFocus,
      closeOnEscape,
      closeOnOverlay,
    };

    attachModalBehaviors(overlay, modal, state);

    return {
      overlay,
      modal,
      destroy: destroyInstance,
      setOnRequestClose: (fn) => {
        if (typeof fn === "function") {
          state.onRequestClose = fn;
        }
      },
      updateOptions: ({ trapFocus: tf, closeOnEscape: ce, closeOnOverlay: co } = {}) => {
        if (typeof tf === "boolean") {
          state.trapFocus = tf;
        }
        if (typeof ce === "boolean") {
          state.closeOnEscape = ce;
        }
        if (typeof co === "boolean") {
          state.closeOnOverlay = co;
        }
      },
    };
  };

  return {
    injectCSS: () => {
      if (select("#us-dhl-seen-style")) {
        return;
      }
      const style = document.createElement("style");
      style.id = "us-dhl-seen-style";
      style.textContent = CSS;
      document.head.append(style);
    },
    showToast: (message, duration = 3000) => {
      const toast = document.createElement("div");
      toast.className = "us-dhl-toast";
      toast.textContent = message;
      getToastContainer().append(toast);
      setTimeout(() => toast.remove(), duration);
    },
    showConfirm: ({ title, text, okLabel = I18n.t("accept"), cancelLabel = I18n.t("cancel") }) =>
      new Promise((resolve) => {
        const headerId = `us-dhl-modal-title-${++modalIdCounter}`;
        const fragment = document.createDocumentFragment();

        const header = document.createElement("div");
        header.className = "us-dhl-modal-header";
        header.id = headerId;
        header.textContent = title;

        const body = document.createElement("div");
        body.className = "us-dhl-modal-body";
        const paragraph = document.createElement("p");
        paragraph.textContent = text;
        body.append(paragraph);

        const footer = document.createElement("div");
        footer.className = "us-dhl-modal-footer";
        const cancelButton = document.createElement("button");
        cancelButton.className = "us-dhl-modal-btn secondary";
        cancelButton.type = "button";
        cancelButton.textContent = cancelLabel;
        const okButton = document.createElement("button");
        okButton.className = "us-dhl-modal-btn primary";
        okButton.type = "button";
        okButton.textContent = okLabel;
        footer.append(cancelButton, okButton);

        fragment.append(header, body, footer);

        const { destroy, setOnRequestClose } = createModal(fragment, {
          labelledById: headerId,
        });

        const close = (value) => {
          destroy();
          resolve(value);
        };

        setOnRequestClose(() => close(false));
        cancelButton.addEventListener("click", () => close(false));
        okButton.addEventListener("click", () => close(true));
      }),
    showPrompt: ({ title, text, okLabel = I18n.t("accept"), cancelLabel = I18n.t("cancel") }) =>
      new Promise((resolve) => {
        const headerId = `us-dhl-modal-title-${++modalIdCounter}`;
        const fragment = document.createDocumentFragment();

        const header = document.createElement("div");
        header.className = "us-dhl-modal-header";
        header.id = headerId;
        header.textContent = title;

        const body = document.createElement("div");
        body.className = "us-dhl-modal-body";
        const paragraph = document.createElement("p");
        paragraph.textContent = text;
        const textarea = document.createElement("textarea");
        body.append(paragraph, textarea);

        const footer = document.createElement("div");
        footer.className = "us-dhl-modal-footer";
        const cancelButton = document.createElement("button");
        cancelButton.className = "us-dhl-modal-btn secondary";
        cancelButton.type = "button";
        cancelButton.textContent = cancelLabel;
        const okButton = document.createElement("button");
        okButton.className = "us-dhl-modal-btn primary";
        okButton.type = "button";
        okButton.textContent = okLabel;
        footer.append(cancelButton, okButton);

        fragment.append(header, body, footer);

        const { destroy, setOnRequestClose } = createModal(fragment, {
          labelledById: headerId,
        });

        const close = (value) => {
          destroy();
          resolve(value);
        };

        setOnRequestClose(() => close(null));
        cancelButton.addEventListener("click", () => close(null));
        okButton.addEventListener("click", () => close(textarea.value));
        requestAnimationFrame(() => textarea.focus());
      }),
    showFilePicker: ({
      title,
      text,
      accept = ".json,application/json",
      okLabel = I18n.t("accept"),
      cancelLabel = I18n.t("cancel"),
    }) =>
      new Promise((resolve) => {
        const headerId = `us-dhl-modal-title-${++modalIdCounter}`;
        const fragment = document.createDocumentFragment();

        const header = document.createElement("div");
        header.className = "us-dhl-modal-header";
        header.id = headerId;
        header.textContent = title;

        const body = document.createElement("div");
        body.className = "us-dhl-modal-body";
        const paragraph = document.createElement("p");
        paragraph.textContent = text;
        const input = document.createElement("input");
        input.type = "file";
        input.className = "us-dhl-file-input";
        input.accept = accept;
        body.append(paragraph, input);

        const footer = document.createElement("div");
        footer.className = "us-dhl-modal-footer";
        const cancelButton = document.createElement("button");
        cancelButton.className = "us-dhl-modal-btn secondary";
        cancelButton.type = "button";
        cancelButton.textContent = cancelLabel;
        const okButton = document.createElement("button");
        okButton.className = "us-dhl-modal-btn primary";
        okButton.type = "button";
        okButton.textContent = okLabel;
        okButton.disabled = true;
        footer.append(cancelButton, okButton);

        fragment.append(header, body, footer);

        const { destroy, setOnRequestClose } = createModal(fragment, {
          labelledById: headerId,
        });

        let selectedFile = null;

        const close = (value) => {
          destroy();
          resolve(value);
        };

        setOnRequestClose(() => close(null));

        input.addEventListener("change", () => {
          selectedFile = input.files && input.files[0] ? input.files[0] : null;
          okButton.disabled = !selectedFile;
        });

        okButton.addEventListener("click", () => {
          if (!selectedFile) {
            input.click();
            return;
          }
          close(selectedFile);
        });

        cancelButton.addEventListener("click", () => close(null));
        requestAnimationFrame(() => input.focus());
      }),
    showExport: ({ title, text, data }) => {
      const headerId = `us-dhl-modal-title-${++modalIdCounter}`;
      const fragment = document.createDocumentFragment();

      const header = document.createElement("div");
      header.className = "us-dhl-modal-header";
      header.id = headerId;
      header.textContent = title;

      const body = document.createElement("div");
      body.className = "us-dhl-modal-body";
      const paragraph = document.createElement("p");
      paragraph.textContent = text;
      const textarea = document.createElement("textarea");
      textarea.readOnly = true;
      body.append(paragraph, textarea);

      const footer = document.createElement("div");
      footer.className = "us-dhl-modal-footer";
      const closeButton = document.createElement("button");
      closeButton.className = "us-dhl-modal-btn primary";
      closeButton.type = "button";
      closeButton.textContent = I18n.t("close");
      footer.append(closeButton);

      fragment.append(header, body, footer);

      const { destroy, setOnRequestClose } = createModal(fragment, {
        labelledById: headerId,
      });

      textarea.value = data;

      const close = () => {
        destroy();
      };

      setOnRequestClose(close);
      closeButton.addEventListener("click", close);
      requestAnimationFrame(() => {
        textarea.select();
      });
    },
    showSettingsMenu: ({ title, actions }) => {
      const headerId = `us-dhl-modal-title-${++modalIdCounter}`;
      const fragment = document.createDocumentFragment();

      const header = document.createElement("div");
      header.className = "us-dhl-modal-header";
      header.id = headerId;
      header.textContent = title;

      const body = document.createElement("div");
      body.className = "us-dhl-modal-body";
      const menu = document.createElement("div");
      menu.className = "us-dhl-settings-menu";

      for (const [index, action] of actions.entries()) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `us-dhl-modal-btn ${action.isDestructive ? "secondary" : "primary"}`;
        button.dataset.actionIndex = String(index);
        button.textContent = action.label;
        menu.append(button);
      }

      body.append(menu);
      fragment.append(header, body);

      const { modal, destroy, setOnRequestClose } = createModal(fragment, {
        labelledById: headerId,
        closeOnOverlay: true,
      });

      const close = () => {
        destroy();
      };

      setOnRequestClose(close);

      modal.addEventListener("click", (event) => {
        const button = event.target.closest("[data-action-index]");
        if (!button) {
          return;
        }
        const { actionIndex: actionIndexRaw } = button.dataset;
        if (typeof actionIndexRaw !== "string" || actionIndexRaw.length === 0) {
          return;
        }
        const actionIndex = Number.parseInt(actionIndexRaw, 10);
        if (!Number.isInteger(actionIndex)) {
          return;
        }
        const selectedAction = actions.at(actionIndex);
        if (!selectedAction) {
          return;
        }
        if (typeof selectedAction.onClick === "function") {
          selectedAction.onClick();
        }
        if (!selectedAction.keepOpen) {
          close();
        }
      });
    },
    showProgress: (message) => {
      const toast = document.createElement("div");
      toast.className = "us-dhl-toast";
      const messageWrapper = document.createElement("div");
      messageWrapper.textContent = message;
      const progress = document.createElement("progress");
      progress.value = 0;
      progress.max = 100;
      progress.className = "us-dhl-progress";
      toast.append(messageWrapper, progress);
      getToastContainer().append(toast);
      return {
        update: (value) => {
          const progressEl = toast.querySelector("progress");
          if (progressEl) {
            progressEl.value = value;
          }
        },
        close: (delay = 1000) => {
          setTimeout(() => toast.remove(), delay);
        },
      };
    },
  };
})();

export default UIManager;
