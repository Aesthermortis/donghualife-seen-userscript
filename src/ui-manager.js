import { CSS } from "./constants.js";
import Utils from "./utils.js";
import I18n from "./i18n.js";

/**
 * @module UIManager
 * @description Handles all direct DOM manipulations for UI elements like toasts and modals.
 */
const UIManager = (() => {
  const getToastContainer = () => {
    let container = Utils.$("#us-dhl-toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "us-dhl-toast-container";
      container.className = "us-dhl-toast-container";
      document.body.appendChild(container);
    }
    return container;
  };
  const createModal = (content) => {
    const overlay = document.createElement("div");
    overlay.className = "us-dhl-modal-overlay";
    overlay.innerHTML = `<div class="us-dhl-modal" role="dialog" aria-modal="true">${content}</div>`;
    document.body.appendChild(overlay);
    return overlay;
  };
  return {
    injectCSS: () => {
      if (Utils.$("#us-dhl-seen-style")) {
        return;
      }
      const style = document.createElement("style");
      style.id = "us-dhl-seen-style";
      style.textContent = CSS;
      document.head.appendChild(style);
    },
    showToast: (message, duration = 3000) => {
      const toast = document.createElement("div");
      toast.className = "us-dhl-toast";
      toast.textContent = message;
      getToastContainer().appendChild(toast);
      setTimeout(() => toast.remove(), duration);
    },
    showConfirm: ({ title, text, okLabel = I18n.t("accept"), cancelLabel = I18n.t("cancel") }) =>
      new Promise((resolve) => {
        const modalHTML = `<div class="us-dhl-modal-header">${title}</div><div class="us-dhl-modal-body"><p>${text}</p></div><div class="us-dhl-modal-footer"><button class="us-dhl-modal-btn secondary">${cancelLabel}</button><button class="us-dhl-modal-btn primary">${okLabel}</button></div>`;
        const overlay = createModal(modalHTML);
        const close = (value) => {
          overlay.remove();
          resolve(value);
        };
        Utils.$(".primary", overlay).addEventListener("click", () => close(true));
        Utils.$(".secondary", overlay).addEventListener("click", () => close(false));
        overlay.addEventListener("click", () => close(false));
        Utils.$(".us-dhl-modal", overlay).addEventListener("click", (e) => e.stopPropagation());
      }),
    showPrompt: ({ title, text, okLabel = I18n.t("accept"), cancelLabel = I18n.t("cancel") }) =>
      new Promise((resolve) => {
        const modalHTML = `<div class="us-dhl-modal-header">${title}</div><div class="us-dhl-modal-body"><p>${text}</p><textarea></textarea></div><div class="us-dhl-modal-footer"><button class="us-dhl-modal-btn secondary">${cancelLabel}</button><button class="us-dhl-modal-btn primary">${okLabel}</button></div>`;
        const overlay = createModal(modalHTML);
        const input = Utils.$("textarea", overlay);
        const close = (value) => {
          overlay.remove();
          resolve(value);
        };
        Utils.$(".primary", overlay).addEventListener("click", () => close(input.value));
        Utils.$(".secondary", overlay).addEventListener("click", () => close(null));
        overlay.addEventListener("click", () => close(null));
        Utils.$(".us-dhl-modal", overlay).addEventListener("click", (e) => e.stopPropagation());
        input.focus();
      }),
    showFilePicker: ({
      title,
      text,
      accept = ".json,application/json",
      okLabel = I18n.t("accept"),
      cancelLabel = I18n.t("cancel"),
    }) =>
      new Promise((resolve) => {
        const modalHTML = `<div class="us-dhl-modal-header">${title}</div><div class="us-dhl-modal-body"><p>${text}</p><input type="file" class="us-dhl-file-input" accept="${accept}"></div><div class="us-dhl-modal-footer"><button class="us-dhl-modal-btn secondary">${cancelLabel}</button><button class="us-dhl-modal-btn primary" disabled>${okLabel}</button></div>`;
        const overlay = createModal(modalHTML);
        const modal = Utils.$(".us-dhl-modal", overlay);
        const input = Utils.$(".us-dhl-file-input", overlay);
        const primary = Utils.$(".primary", overlay);
        const secondary = Utils.$(".secondary", overlay);
        let selectedFile = null;

        const close = (value) => {
          overlay.remove();
          resolve(value);
        };

        input.addEventListener("change", () => {
          selectedFile = input.files && input.files[0] ? input.files[0] : null;
          primary.disabled = !selectedFile;
        });

        primary.addEventListener("click", () => {
          if (!selectedFile) {
            input.click();
            return;
          }
          close(selectedFile);
        });

        secondary.addEventListener("click", () => close(null));
        overlay.addEventListener("click", () => close(null));
        modal.addEventListener("click", (e) => e.stopPropagation());
        input.focus();
      }),
    showExport: ({ title, text, data }) => {
      const modalHTML = `<div class="us-dhl-modal-header">${title}</div><div class="us-dhl-modal-body"><p>${text}</p><textarea readonly></textarea></div><div class="us-dhl-modal-footer"><button class="us-dhl-modal-btn primary">${I18n.t(
        "close",
      )}</button></div>`;
      const overlay = createModal(modalHTML);
      const textarea = Utils.$("textarea", overlay);
      textarea.value = data;
      const close = () => overlay.remove();
      Utils.$(".primary", overlay).addEventListener("click", close);
      overlay.addEventListener("click", close);
      Utils.$(".us-dhl-modal", overlay).addEventListener("click", (e) => e.stopPropagation());
      textarea.select();
    },
    showSettingsMenu: ({ title, actions }) => {
      const actionButtons = actions
        .map(
          (action, index) =>
            `<button class="us-dhl-modal-btn ${
              action.isDestructive ? "secondary" : "primary"
            }" data-action-index="${index}">${action.label}</button>`,
        )
        .join("");
      const modalHTML = `<div class="us-dhl-modal-header">${title}</div><div class="us-dhl-modal-body"><div class="us-dhl-settings-menu">${actionButtons}</div></div>`;
      const overlay = createModal(modalHTML);
      const close = () => overlay.remove();
      Utils.$(".us-dhl-modal", overlay).addEventListener("click", (e) => {
        e.stopPropagation();
        const button = e.target.closest("[data-action-index]");
        if (button) {
          const actionIndex = parseInt(button.dataset.actionIndex, 10);
          if (actions[actionIndex]?.onClick) {
            actions[actionIndex].onClick();
          }
          if (!actions[actionIndex]?.keepOpen) {
            close();
          }
        }
      });
      overlay.addEventListener("click", close);
    },
    showProgress: (message) => {
      const toast = document.createElement("div");
      toast.className = "us-dhl-toast";
      toast.innerHTML = `<div>${message}</div><progress value="0" max="100" class="us-dhl-progress"></progress>`;
      getToastContainer().appendChild(toast);
      return {
        update: (value) => {
          const progress = toast.querySelector("progress");
          if (progress) {
            progress.value = value;
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
