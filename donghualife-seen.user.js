// ==UserScript==
// @name         DonghuaLife – Mark Watched Episodes (✅)
// @namespace    us_dhl_seen
// @version      2.1.0
// @description  Adds a button to mark watched episodes, syncs status across tabs, and provides data management tools.
// @author       Aesthermortis
// @match        *://*.donghualife.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=donghualife.com
// @run-at       document-idle
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.registerMenuCommand
// @license      MIT
// @noframes
// @downloadURL  https://raw.githubusercontent.com/Aesthermortis/donghualife-seen-userscript/main/donghualife-seen.user.js
// @updateURL    https://raw.githubusercontent.com/Aesthermortis/donghualife-seen-userscript/main/donghualife-seen.user.js
// @supportURL   https://github.com/Aesthermortis/donghualife-seen-userscript/issues
// @homepageURL  https://github.com/Aesthermortis/donghualife-seen-userscript
// ==/UserScript==

(() => {
  "use strict";

  /**
   * @module Constants
   * @description Defines all the constants used throughout the script.
   */
  const Constants = {
    // Storage and Sync
    PREFS_KEY: "us-dhl:prefs:v1",
    SYNC_CHANNEL_NAME: "us-dhl-sync:v1",
    DB_NAME: "donghualife-seen-db",
    DB_VERSION: 2,
    DB_STORE_SEEN: "seenEpisodes",
    DB_STORE_WATCHING: "watchingItems",
    DB_STORE_COMPLETED: "completedItems",

    // DOM Attributes and Classes
    ITEM_SEEN_ATTR: "data-us-dhl-decorated",
    ITEM_SEEN_STATE_ATTR: "data-us-dhl-seen-state",
    ITEM_DECORATED_ATTR: "data-us-dhl-decorated-type",
    ITEM_STATE_ATTR: "data-us-dhl-state",
    TABLE_MARK_ATTR: "data-us-dhl-ctrlcol",
    BTN_CLASS: "us-dhl-seen-btn",
    BTN_TYPE_ATTR: "data-us-dhl-btn-type",
    CARD_BTN_CLASS: "us-dhl-card-btn",
    ITEM_SEEN_CLASS: "us-dhl-item-seen",
    ITEM_WATCHING_CLASS: "us-dhl-item-watching",
    ITEM_COMPLETED_CLASS: "us-dhl-item-completed",
    ROOT_HL_CLASS: "us-dhl-rowhl-on",
    CTRL_CELL_CLASS: "us-dhl-ctrlcol",
    FAB_CLASS: "us-dhl-fab",
    KIND_ATTR: "data-us-dhl-kind",
    BTN_TYPE_ATTR: "data-us-dhl-btn-type",

    // Selectors
    EPISODE_ITEM_SELECTOR: "table tr, .views-row .episode",
    EPISODE_LINK_SELECTOR: "a[href]",

    // Patterns
    EPISODE_PATH_PATTERNS: [
      /\/episode\//i,
      /\/watch\//i,
      /\/capitulo\//i,
      /\/ver\//i,
      /\/ep\//i,
      /\/e\//i,
      /\/[0-9]+\/?$/i,
      /\/[^/]+\/[0-9]+/i,
    ],
    NON_EPISODE_PATH_PATTERNS: [/\/user\//i, /\/search\//i, /\/category\//i],

    // Defaults
    DEFAULT_ROW_HL: false,
    DEFAULT_LANG: "en",
  };

  /**
   * @module CSS
   * @description Contains all the CSS styles injected into the page.
   */
  const CSS = `
    /* Base Button Style */
    .${Constants.BTN_CLASS}{
      cursor:pointer; user-select:none; font-size:0.9rem; line-height:1;
      padding:0.32rem 0.65rem; border:none; border-radius:0.75rem;
      background:rgba(255,255,255,.06); color:#f5f7fa;
      transition:filter .15s ease, background .15s ease; white-space: nowrap;
    }
    .${Constants.BTN_CLASS}:hover{ filter:brightness(1.2); }
    .${Constants.BTN_CLASS}[aria-pressed="true"]{ background:rgba(4, 120, 87, .3); color:#f0fff8; }
    .${Constants.BTN_CLASS}[aria-pressed="true"]:hover{ filter:brightness(1.3); }
    .${Constants.BTN_CLASS}:focus{ outline:2px solid rgba(255,255,255,.35); outline-offset:2px; }

    /* Episode Card Button Specifics */
    .views-row .episode { position: relative; }
    .${Constants.CARD_BTN_CLASS} {
      position: absolute; top: 8px; right: 8px; z-index: 10;
      background: rgba(20, 20, 22, 0.7); box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      backdrop-filter: blur(4px);
    }
    .${Constants.CARD_BTN_CLASS}[aria-pressed="true"] { background: rgba(4, 120, 87, 0.75); }

    /* Table Control Column */
    .${Constants.CTRL_CELL_CLASS}{ width:1%; white-space:nowrap; text-align:right; }

    /* Seen Item Highlight (when enabled) */
    .${Constants.ROOT_HL_CLASS} .${Constants.ITEM_SEEN_CLASS}{ background: rgba(4, 120, 87, .1); }
    .${Constants.ROOT_HL_CLASS} .${Constants.ITEM_SEEN_CLASS}:hover,
    .${Constants.ROOT_HL_CLASS} .${Constants.ITEM_SEEN_CLASS}:focus-within { background: rgba(4, 120, 87, .18); }
    .${Constants.ROOT_HL_CLASS} .${Constants.ITEM_SEEN_CLASS} a{ opacity: .95; }
    .${Constants.ROOT_HL_CLASS} .${Constants.ITEM_SEEN_CLASS} .${Constants.BTN_CLASS}[aria-pressed="true"]{ filter: none; }

    /* Motion Preferences */
    @media (prefers-reduced-motion: no-preference) {
      .${Constants.BTN_CLASS}, .${Constants.ROOT_HL_CLASS} .${Constants.ITEM_SEEN_CLASS} { transition: all .15s ease; }
    }

    /* Floating Action Button (FAB) */
    .${Constants.FAB_CLASS} {
      position: fixed; bottom: 1.5rem; right: 1.5rem; z-index: 9990;
      width: 56px; height: 56px; border-radius: 50%; border: none;
      background: #059669; color: white; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: transform .2s ease, filter .2s ease;
    }
    .${Constants.FAB_CLASS}:hover { filter: brightness(1.1); transform: scale(1.05); }
    .${Constants.FAB_CLASS} svg { width: 24px; height: 24px; }

    /* --- Modern UI (Toasts & Modals) --- */
    .us-dhl-toast-container { position: fixed; top: 1rem; right: 1rem; z-index: 9999; display: flex; flex-direction: column; gap: 0.5rem; }
    .us-dhl-toast { padding: 0.75rem 1.25rem; border-radius: 0.5rem; color: #fff; background: #333; box-shadow: 0 4px 12px rgba(0,0,0,0.2); animation: us-dhl-toast-in .3s ease; }
    @keyframes us-dhl-toast-in { from { opacity:0; transform:translateX(100%); } }
    .us-dhl-modal-overlay { position: fixed; inset: 0; z-index: 9998; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; animation: us-dhl-fade-in .2s ease; }
    @keyframes us-dhl-fade-in { from { opacity: 0; } }
    .us-dhl-modal { background: #1e1e20; border-radius: 0.75rem; color: #f5f7fa; width: 90%; max-width: 500px; box-shadow: 0 5px 20px rgba(0,0,0,0.4); animation: us-dhl-modal-in .2s ease-out; }
    @keyframes us-dhl-modal-in { from { opacity:0; transform:scale(0.95); } }
    .us-dhl-modal-header { padding: 1rem 1.5rem; font-size: 1.2rem; font-weight: 600; border-bottom: 1px solid rgba(255,255,255,.1); }
    .us-dhl-modal-body { padding: 1.5rem; }
    .us-dhl-modal-body p { margin: 0 0 1rem; line-height: 1.5; }
    .us-dhl-modal-body textarea, .us-dhl-modal-body input { width: 100%; padding: 0.75rem; border-radius: 0.5rem; border: 1px solid rgba(255,255,255,.2); background: #2a2a2e; color: #f5f7fa; font-family: inherit; font-size: 1rem; box-sizing: border-box; }
    .us-dhl-modal-body textarea { min-height: 120px; resize: vertical; }
    .us-dhl-modal-footer { padding: 1rem 1.5rem; display: flex; justify-content: flex-end; gap: 0.75rem; background: rgba(0,0,0,.1); border-top: 1px solid rgba(255,255,255,.1); border-bottom-left-radius: 0.75rem; border-bottom-right-radius: 0.75rem; }
    .us-dhl-modal-btn { padding: 0.5rem 1rem; border-radius: 0.5rem; border: none; cursor: pointer; font-weight: 600; transition: filter .15s ease; }
    .us-dhl-modal-btn:hover { filter: brightness(1.15); }
    .us-dhl-modal-btn.primary { background: #059669; color: #fff; }
    .us-dhl-modal-btn.secondary { background: rgba(255,255,255,.1); color: #f5f7fa; }
    .us-dhl-settings-menu { display: flex; flex-direction: column; gap: 0.75rem; }
    .us-dhl-settings-menu .us-dhl-modal-btn { width: 100%; text-align: center; padding: 0.75rem 1rem; justify-content: center; }
    .us-dhl-progress {width: 100%; margin-top: 8px;}
  `;

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
     * Converts slug to title case.
     * @param {string} slug
     * @returns {string}
     */
    slugToTitle: (slug) => slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()),

    /**
     * Extracts seriesId and seasonId from an episode path.
     * Supports multiple URL formats for robustness.
     * @param {string} episodePath
     * @returns {{ seasonId: string|null, seriesId: string|null }}
     */
    getHierarchyFromEpisodePath: (episodePath) => {
      if (typeof episodePath !== "string") {
        return { seriesId: null, seasonId: null };
      }
      // Try to match /series/{sid}/season/{stid}/episode/{eid}
      const parts = episodePath.split("/");
      let seriesId = null;
      let seasonId = null;
      for (let i = 0; i < parts.length; i += 1) {
        if (parts[i] === "series" && parts[i + 1]) {
          seriesId = `/series/${parts[i + 1]}`;
        }
        if (parts[i] === "season" && parts[i + 1]) {
          seasonId = `/season/${parts[i + 1]}`;
        }
      }
      // Fallback to previous slug-based extraction if needed
      if (!seriesId || !seasonId) {
        const m = episodePath.match(/^\/episode\/(.+?)-(\d+)-/i);
        if (m) {
          const slug = m[1];
          const num = m[2];
          return { seasonId: `/season/${slug}-${num}`, seriesId: `/series/${slug}` };
        }
      }
      return { seasonId, seriesId };
    },

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
     * Checks if the pathname is an episode.
     * @param {string} pathname
     * @returns {boolean}
     */
    isEpisodePathname: (pathname) => {
      if (Constants.NON_EPISODE_PATH_PATTERNS.some((rx) => rx.test(pathname))) {
        return false;
      }
      return Constants.EPISODE_PATH_PATTERNS.some((rx) => rx.test(pathname));
    },
  };

  /**
   * @module I18n
   * @description Handles internationalization and provides translation strings.
   */
  const I18n = (() => {
    const locales = {
      en: {
        // Buttons & Labels
        seen: "Seen",
        mark: "Mark",
        accept: "Accept",
        cancel: "Cancel",
        close: "Close",
        // Settings Menu
        settingsTitle: "Script Settings",
        changeLanguage: "Change Language",
        selectLanguage: "Select Language",
        enableHighlight: 'Enable "Seen" item highlight',
        disableHighlight: 'Disable "Seen" item highlight',
        resetDisplayPrefs: "Reset display preferences",
        exportJson: "Export seen (JSON)",
        importJson: "Import seen (JSON)",
        resetAllData: "Reset all seen data",
        // Toasts
        toastErrorLoading: "Error loading user data.",
        toastErrorSaving: "Error saving state.",
        toastErrorExporting: "Error exporting data.",
        toastErrorImporting: "Error: Invalid JSON data provided.",
        toastErrorResetting: "Error resetting data.",
        toastHighlightEnabled: "Row highlight enabled.",
        toastHighlightDisabled: "Row highlight disabled.",
        toastPrefsReset: "Display preferences have been reset.",
        toastLangChanged: "Language changed. Reloading...",
        toastImportSuccess: "Successfully imported {count} records. Reloading...",
        toastDataReset: "Data reset. Reloading...",
        // Modals & Prompts
        exportTitle: "Export Backup",
        exportText: "Copy this text to save a backup of your seen episodes.",
        importTitle: "Import Backup",
        importText: "Paste the backup JSON you saved previously.",
        confirmImportTitle: "Confirm Import",
        confirmImportText:
          "Found {count} records. This will overwrite your current data. Continue?",
        confirmImportOk: "Yes, import",
        resetConfirmTitle: "Confirm Reset",
        resetConfirmText:
          "Are you sure you want to delete all seen episode data? This cannot be undone.",
        resetConfirmOk: "Yes, delete all",
        // ARIA & Titles
        fabTitle: "Script Settings",
        fabAriaLabel: "Open userscript settings",
        btnToggleSeen: "Toggle seen status",
        btnTitleSeen: "Marked as seen. Click to unmark.",
        btnTitleNotSeen: "Not seen. Click to mark.",
      },
      es: {
        // Buttons & Labels
        seen: "Visto",
        mark: "Marcar",
        accept: "Aceptar",
        cancel: "Cancelar",
        close: "Cerrar",
        // Settings Menu
        settingsTitle: "Configuración del Script",
        changeLanguage: "Cambiar Idioma",
        selectLanguage: "Seleccionar Idioma",
        enableHighlight: 'Activar resaltado de "Visto"',
        disableHighlight: 'Desactivar resaltado de "Visto"',
        resetDisplayPrefs: "Restablecer preferencias de visualización",
        exportJson: "Exportar vistos (JSON)",
        importJson: "Importar vistos (JSON)",
        resetAllData: "Restablecer todos los datos",
        // Toasts
        toastErrorLoading: "Error al cargar los datos del usuario.",
        toastErrorSaving: "Error al guardar el estado.",
        toastErrorExporting: "Error al exportar los datos.",
        toastErrorImporting: "Error: El formato JSON proporcionado no es válido.",
        toastErrorResetting: "Error al restablecer los datos.",
        toastHighlightEnabled: "Resaltado de fila activado.",
        toastHighlightDisabled: "Resaltado de fila desactivado.",
        toastPrefsReset: "Las preferencias de visualización han sido restablecidas.",
        toastLangChanged: "Idioma cambiado. Recargando...",
        toastImportSuccess: "Se importaron {count} registros correctamente. Recargando...",
        toastDataReset: "Datos restablecidos. Recargando...",
        // Modals & Prompts
        exportTitle: "Copia de Seguridad",
        exportText: "Copia este texto para guardar una copia de seguridad de tus episodios vistos.",
        importTitle: "Importar Copia de Seguridad",
        importText: "Pega la copia de seguridad en formato JSON que guardaste.",
        confirmImportTitle: "Confirmar Importación",
        confirmImportText:
          "Se encontraron {count} registros. Esto sobrescribirá tus datos actuales. ¿Continuar?",
        confirmImportOk: "Sí, importar",
        resetConfirmTitle: "Confirmar Restablecimiento",
        resetConfirmText:
          "Estás a punto de borrar todos los datos de episodios vistos. Esta acción no se puede deshacer.",
        resetConfirmOk: "Sí, borrar todo",
        // ARIA & Titles
        fabTitle: "Configuración del Script",
        fabAriaLabel: "Abrir la configuración del userscript",
        btnToggleSeen: "Alternar estado de visto",
        btnTitleSeen: "Marcado como visto. Haz clic para desmarcar.",
        btnTitleNotSeen: "No visto. Haz clic para marcar.",
      },
    };

    let currentTranslations = locales[Constants.DEFAULT_LANG];

    const init = (lang) => {
      const language = lang?.startsWith("es") ? "es" : "en";
      currentTranslations = locales[language];
    };

    const t = (key, replacements = {}) => {
      let translation = currentTranslations[key] || locales[Constants.DEFAULT_LANG][key] || key;
      Object.entries(replacements).forEach(([placeholder, value]) => {
        translation = translation.replace(`{${placeholder}}`, String(value));
      });
      return translation;
    };

    return { init, t, locales };
  })();

  /**
   * @module DatabaseManager
   * @description Handles all interactions with the IndexedDB.
   */
  const DatabaseManager = (() => {
    let dbInstance = null;
    const openDB = () => {
      if (dbInstance) {
        return Promise.resolve(dbInstance);
      }
      const tryOpen = (version) =>
        new Promise((resolve, reject) => {
          const request =
            version !== null
              ? indexedDB.open(Constants.DB_NAME, version)
              : indexedDB.open(Constants.DB_NAME);
          request.onerror = (event) => reject(event.target.error);
          request.onsuccess = (event) => {
            dbInstance = event.target.result;
            resolve(dbInstance);
          };
          request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(Constants.DB_STORE_SEEN)) {
              db.createObjectStore(Constants.DB_STORE_SEEN);
            }
            if (!db.objectStoreNames.contains(Constants.DB_STORE_WATCHING)) {
              db.createObjectStore(Constants.DB_STORE_WATCHING);
            }
            if (!db.objectStoreNames.contains(Constants.DB_STORE_COMPLETED)) {
              db.createObjectStore(Constants.DB_STORE_COMPLETED);
            }
          };
        });
      return tryOpen(Constants.DB_VERSION).catch((err) => {
        if (String(err?.name) === "VersionError") {
          return tryOpen(null);
        }
        throw err;
      });
    };
    const perform = async (storeName, mode, operation) => {
      const db = await openDB();
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      return new Promise((resolve, reject) => {
        const request = operation(store);
        request.onerror = (event) => reject(event.target.error);
        request.onsuccess = (event) => resolve(event.target.result);
      });
    };
    return {
      set: (store, key, value) => perform(store, "readwrite", (s) => s.put(value, key)),
      delete: (store, key) => perform(store, "readwrite", (s) => s.delete(key)),
      clear: (store) => perform(store, "readwrite", (s) => s.clear()),
      getAll: (store) => perform(store, "readonly", (s) => s.getAll()),
      getAllKeys: (store) => perform(store, "readonly", (s) => s.getAllKeys()),
    };
  })();

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

  /**
   * @module Store
   * @description Manages the application's state, including seen/watching sets and preferences.
   */
  const Store = (() => {
    const state = {
      seenSet: new Set(),
      watchingSet: new Set(),
      completedSet: new Set(),
      prefs: {},
    };
    const listeners = [];
    const broadcast = (change) => {
      listeners.forEach((listener) => listener(change));
    };
    return {
      subscribe: (listener) => {
        listeners.push(listener);
        return () => {
          const index = listeners.indexOf(listener);
          if (index > -1) {
            listeners.splice(index, 1);
          }
        };
      },
      getState: () => ({ ...state }),
      isSeen: (id) => state.seenSet.has(id),
      isRowHighlightOn: () =>
        typeof state.prefs.rowHighlight === "boolean"
          ? state.prefs.rowHighlight
          : Constants.DEFAULT_ROW_HL,
      getUserLang: () => state.prefs.userLang || navigator.language || Constants.DEFAULT_LANG,
      async load() {
        try {
          const [seenKeys, watchingKeys, completedKeys, rawPrefs] = await Promise.all([
            DatabaseManager.getAllKeys(Constants.DB_STORE_SEEN),
            DatabaseManager.getAllKeys(Constants.DB_STORE_WATCHING),
            DatabaseManager.getAllKeys(Constants.DB_STORE_COMPLETED),
            GM.getValue(Constants.PREFS_KEY, "{}"),
          ]);
          state.seenSet = new Set(seenKeys);
          state.watchingSet = new Set(watchingKeys);
          state.completedSet = new Set(completedKeys);
          state.prefs = JSON.parse(rawPrefs);
          broadcast({ type: "INIT", payload: { oldPrefs: {}, newPrefs: state.prefs } });
        } catch (error) {
          console.error("[Store] Failed to load initial state:", error);
          UIManager.showToast(I18n.t("toastErrorLoading"));
        }
      },
      async setSeen(id, seen = true) {
        await DatabaseManager[seen ? "set" : "delete"](Constants.DB_STORE_SEEN, id, {
          t: Date.now(),
        });
        state.seenSet[seen ? "add" : "delete"](id);
        broadcast({ type: "SEEN_CHANGE", payload: { id } });
      },
      async setWatching(id, watching = true) {
        await DatabaseManager[watching ? "set" : "delete"](Constants.DB_STORE_WATCHING, id, {
          t: Date.now(),
        });
        state.watchingSet[watching ? "add" : "delete"](id);
        if (watching && state.completedSet.has(id)) {
          await DatabaseManager.delete(Constants.DB_STORE_COMPLETED, id);
          state.completedSet.delete(id);
          broadcast({ type: "COMPLETED_CHANGE", payload: { id } });
        }
        broadcast({ type: "WATCHING_CHANGE", payload: { id } });
      },
      async setCompleted(id, completed = true) {
        await DatabaseManager[completed ? "set" : "delete"](Constants.DB_STORE_COMPLETED, id, {
          t: Date.now(),
        });
        state.completedSet[completed ? "add" : "delete"](id);
        if (completed && state.watchingSet.has(id)) {
          await DatabaseManager.delete(Constants.DB_STORE_WATCHING, id);
          state.watchingSet.delete(id);
          broadcast({ type: "WATCHING_CHANGE", payload: { id } });
        }
        broadcast({ type: "COMPLETED_CHANGE", payload: { id } });
      },
      async setPrefs(newPrefs) {
        const oldPrefs = { ...state.prefs };
        state.prefs = newPrefs;
        await GM.setValue(Constants.PREFS_KEY, JSON.stringify(newPrefs));
        broadcast({ type: "PREFS_CHANGE", payload: { oldPrefs, newPrefs } });
      },
      receiveSync(id, seen) {
        if (seen) {
          state.seenSet.add(id);
        } else {
          state.seenSet.delete(id);
        }
        broadcast({ type: "SEEN_CHANGE", payload: { id, seen } });
      },
      async clearAllData() {
        state.seenSet.clear();
        state.watchingSet.clear();
        state.completedSet.clear();
        await Promise.all([
          DatabaseManager.clear(Constants.DB_STORE_SEEN),
          DatabaseManager.clear(Constants.DB_STORE_WATCHING),
          DatabaseManager.clear(Constants.DB_STORE_COMPLETED),
        ]);
        broadcast({ type: "CLEAR_ALL" });
      },
      async exportData() {
        const [seenKeys, watchingKeys, completedKeys] = await Promise.all([
          DatabaseManager.getAllKeys(Constants.DB_STORE_SEEN),
          DatabaseManager.getAllKeys(Constants.DB_STORE_WATCHING),
          DatabaseManager.getAllKeys(Constants.DB_STORE_COMPLETED),
        ]);
        const [seenVals, watchingVals, completedVals] = await Promise.all([
          DatabaseManager.getAll(Constants.DB_STORE_SEEN),
          DatabaseManager.getAll(Constants.DB_STORE_WATCHING),
          DatabaseManager.getAll(Constants.DB_STORE_COMPLETED),
        ]);
        const zip = (keys, vals) => keys.reduce((acc, k, i) => ((acc[k] = vals[i]), acc), {});
        return {
          seen: zip(seenKeys, seenVals),
          watching: zip(watchingKeys, watchingVals),
          completed: zip(completedKeys, completedVals),
        };
      },
    };
  })();

  /**
   * @module ContentDecorator
   * @description Unified decorator for episode, season, and series items.
   */
  const ContentDecorator = (() => {
    /**
     * Computes the unique ID for the given item.
     * Supports different strategies based on the target type.
     */
    const computeId = (element, selector, preferKind = null) => {
      let link = null;
      if (preferKind === "season") {
        link = Utils.$("a[href^='/season/']", element) || null;
      } else if (preferKind === "series") {
        link = Utils.$("a[href^='/series/']", element) || null;
      } else {
        link =
          Utils.$("a[href^='/season/']", element) ||
          Utils.$("a[href^='/series/']", element) ||
          null;
      }
      if (!link) {
        link = Utils.$(selector, element);
      }
      if (!link?.href) {
        return null;
      }
      try {
        return new URL(link.href, location.origin).pathname;
      } catch {
        return null;
      }
    };

    /**
     * Updates the button text, ARIA, and state based on type and logical status.
     */
    const updateButtonState = (btn, type, status) => {
      let textKey;
      let titleKey;
      let ariaLabelKey;

      if (type === "seen") {
        const isSet = status === "seen";
        textKey = isSet ? "seen" : "mark";
        titleKey = isSet ? "btnTitleSeen" : "btnTitleNotSeen";
        ariaLabelKey = "btnToggleSeen";
        btn.setAttribute("aria-pressed", String(isSet));
      } else {
        switch (status) {
          case Constants.STATE_COMPLETED:
            textKey = "completed";
            titleKey = "btnTitleCompleted";
            break;
          case Constants.STATE_WATCHING:
            textKey = "watching";
            titleKey = "btnTitleWatching";
            break;
          default:
            textKey = "mark";
            titleKey = "btnTitleNotWatching";
        }
        ariaLabelKey = "btnToggleWatching";
      }

      btn.textContent = I18n.t(textKey);
      btn.title = I18n.t(titleKey);
      btn.setAttribute("aria-label", I18n.t(ariaLabelKey));
      btn.setAttribute(Constants.ITEM_STATE_ATTR, status);
    };

    /**
     * Creates and returns a state button for the given type and status.
     */
    const makeButton = (type, status, isCard) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = isCard
        ? `${Constants.BTN_CLASS} ${Constants.CARD_BTN_CLASS}`
        : Constants.BTN_CLASS;
      b.setAttribute(Constants.BTN_TYPE_ATTR, type);
      updateButtonState(b, type, status);
      return b;
    };

    /**
     * Adds control column to a table if not present.
     */
    const prepareTable = (table) => {
      if (!table || table.hasAttribute(Constants.TABLE_MARK_ATTR)) {
        return;
      }
      const headerRow = table.tHead?.rows?.[0];
      if (headerRow) {
        const th = document.createElement("th");
        th.className = Constants.CTRL_CELL_CLASS;
        headerRow.appendChild(th);
      }
      table.setAttribute(Constants.TABLE_MARK_ATTR, "1");
    };

    /**
     * Returns the td container to insert the button in a table row.
     */
    const getButtonContainerForRow = (row) => {
      const c = document.createElement("td");
      c.className = Constants.CTRL_CELL_CLASS;
      row.appendChild(c);
      return c;
    };

    /**
     * Applies or removes visual classes for state.
     */
    const updateItem = (item, type, status) => {
      if (type === "seen") {
        item.classList.toggle(Constants.ITEM_SEEN_CLASS, status === "seen");
      } else {
        item.classList.toggle(Constants.ITEM_WATCHING_CLASS, status === Constants.STATE_WATCHING);
        item.classList.toggle(Constants.ITEM_COMPLETED_CLASS, status === Constants.STATE_COMPLETED);
      }
      const btn =
        item.querySelector(`.${Constants.BTN_CLASS}[${Constants.BTN_TYPE_ATTR}="${type}"]`) ||
        item.querySelector(`.${Constants.BTN_CLASS}`);
      if (btn) {
        updateButtonState(btn, type, status);
      }
    };

    /**
     * Decorates the item (row or card) with the button and state.
     */
    const decorateItem = (
      item,
      { type, selector, onToggle, isSetFn, getStatusFn, preferKind = null },
    ) => {
      if (item.getAttribute(Constants.ITEM_DECORATED_ATTR) === type) {
        return;
      }
      // Store kind if relevant
      if (type === "series" && preferKind) {
        item.setAttribute(Constants.KIND_ATTR, preferKind);
      }

      const id = computeId(item, selector, type === "series" ? preferKind : null);
      if (!id) {
        return;
      }

      item.setAttribute(Constants.ITEM_DECORATED_ATTR, type);

      let status;
      if (type === "seen") {
        status = isSetFn(id) ? "seen" : "unseen";
      } else {
        // For series/seasons, status is based on logical state
        // Not implemented until main flow uses this decorator
        status = Constants.STATE_UNTRACKED;
      }

      updateItem(item, type, status);

      const isCard = !item.matches("tr");
      const btn = makeButton(type, status, isCard);

      let container = item;
      if (!isCard) {
        const table = item.closest("table");
        prepareTable(table);
        container = getButtonContainerForRow(item);
      }
      if (isCard) {
        const cs = window.getComputedStyle(container);
        if (cs.position === "static") {
          container.style.position = "relative";
        }
      }
      container.appendChild(btn);

      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const currentStatus = btn.getAttribute(Constants.ITEM_STATE_ATTR);
        onToggle(type, id, currentStatus, item);
      });
    };

    /**
     * Refreshes UI for the given id.
     */
    const updateItemUI = (id, { isSetFn, getStatusFn, type }) => {
      for (const item of Utils.$$(`[${Constants.ITEM_DECORATED_ATTR}="${type}"]`)) {
        const preferKind = type === "series" ? item.getAttribute(Constants.KIND_ATTR) : null;
        const matchesId = computeId(item, Constants.LINK_SELECTOR, preferKind) === id;
        if (!matchesId) {
          continue;
        }
        let status;
        if (type === "seen") {
          status = isSetFn(id) ? "seen" : "unseen";
        } else {
          status = Constants.STATE_UNTRACKED; // Placeholder until main flow integration
        }
        updateItem(item, type, status);
      }
    };

    return { decorateItem, updateItemUI };
  })();

  /**
   * @module DOMObserver
   * @description Observes the DOM for changes and triggers callbacks.
   */
  const DOMObserver = (() => {
    let observer = null;
    const observe = (callback) => {
      if (observer) {
        observer.disconnect();
      }
      const debouncedCallback = Utils.debounce(callback, 150);
      observer = new MutationObserver((mutationsList) => {
        const hasAddedNodes = mutationsList.some((m) => m.addedNodes.length > 0);
        if (hasAddedNodes) {
          debouncedCallback();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    };
    return { observe };
  })();

  /**
   * @module Settings
   * @description Manages the settings menu and its actions (import, export, etc.).
   */
  const Settings = (() => {
    const exportJSON = async () => {
      try {
        const keys = await DatabaseManager.getAllKeys();
        const allData = await DatabaseManager.getAll();
        const exportObj = {};
        keys.forEach((key, index) => {
          exportObj[key] = allData[index];
        });
        UIManager.showExport({
          title: I18n.t("exportTitle"),
          text: I18n.t("exportText"),
          data: JSON.stringify(exportObj, null, 2),
        });
      } catch (error) {
        console.error("Failed to export data:", error);
        UIManager.showToast(I18n.t("toastErrorExporting"));
      }
    };
    const importJSON = async () => {
      const txt = await UIManager.showPrompt({
        title: I18n.t("importTitle"),
        text: I18n.t("importText"),
      });
      if (!txt) {
        return;
      }

      try {
        const parsed = JSON.parse(txt);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          throw new Error("Invalid JSON format.");
        }

        const count = Object.keys(parsed).length;
        const confirmed = await UIManager.showConfirm({
          title: I18n.t("confirmImportTitle"),
          text: I18n.t("confirmImportText", { count }),
          okLabel: I18n.t("confirmImportOk"),
        });
        if (!confirmed) {
          return;
        }

        const progress = UIManager.showProgress("Importing...");
        await Store.clearSeen();
        let importedCount = 0;
        for (const key in parsed) {
          if (Object.prototype.hasOwnProperty.call(parsed, key)) {
            await Store.setSeen(key, true);
            importedCount += 1;
            progress.update((importedCount / count) * 100);
          }
        }
        progress.close();
        UIManager.showToast(I18n.t("toastImportSuccess", { count }));
        setTimeout(() => location.reload(), 1500);
      } catch (error) {
        console.error("Failed to import data:", error);
        UIManager.showToast(I18n.t("toastErrorImporting"));
      }
    };
    const resetAll = async () => {
      const confirmed = await UIManager.showConfirm({
        title: I18n.t("resetConfirmTitle"),
        text: I18n.t("resetConfirmText"),
        okLabel: I18n.t("resetConfirmOk"),
        isDestructive: true,
      });
      if (!confirmed) {
        return;
      }

      try {
        await Store.clearSeen();
        UIManager.showToast(I18n.t("toastDataReset"));
        setTimeout(() => location.reload(), 1500);
      } catch (error) {
        console.error("Failed to reset data:", error);
        UIManager.showToast(I18n.t("toastErrorResetting"));
      }
    };

    const openLanguageMenu = () => {
      const langActions = [
        {
          label: "English",
          onClick: () => changeLanguage("en"),
        },
        {
          label: "Español",
          onClick: () => changeLanguage("es"),
        },
      ];
      UIManager.showSettingsMenu({
        title: I18n.t("selectLanguage"),
        actions: langActions,
      });
    };

    const changeLanguage = async (lang) => {
      const { prefs } = Store.getState();
      await Store.setPrefs({ ...prefs, userLang: lang });
    };

    const openMenu = () => {
      const isHlOn = Store.isRowHighlightOn();
      const actions = [
        {
          label: I18n.t("changeLanguage"),
          onClick: openLanguageMenu,
          keepOpen: true,
        },
        {
          label: isHlOn ? I18n.t("disableHighlight") : I18n.t("enableHighlight"),
          onClick: async () => {
            const { prefs } = Store.getState();
            const newHighlightState = !isHlOn;
            await Store.setPrefs({ ...prefs, rowHighlight: newHighlightState });
            UIManager.showToast(
              newHighlightState
                ? I18n.t("toastHighlightEnabled")
                : I18n.t("toastHighlightDisabled"),
            );
          },
        },
        {
          label: I18n.t("resetDisplayPrefs"),
          isDestructive: true,
          onClick: async () => {
            await Store.setPrefs({});
            UIManager.showToast(I18n.t("toastPrefsReset"));
          },
        },
        {
          label: I18n.t("exportJson"),
          onClick: exportJSON,
          keepOpen: true,
        },
        {
          label: I18n.t("importJson"),
          onClick: importJSON,
          keepOpen: true,
        },
        {
          label: I18n.t("resetAllData"),
          onClick: resetAll,
          isDestructive: true,
          keepOpen: true,
        },
      ];
      UIManager.showSettingsMenu({ title: I18n.t("settingsTitle"), actions });
    };
    const createButton = () => {
      if (Utils.$(`.${Constants.FAB_CLASS}`)) {
        return;
      }
      const fab = document.createElement("button");
      fab.className = Constants.FAB_CLASS;
      fab.title = I18n.t("fabTitle");
      fab.setAttribute("aria-label", I18n.t("fabAriaLabel"));
      fab.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.44,0.17-0.48,0.41L9.22,5.72C8.63,5.96,8.1,6.29,7.6,6.67L5.22,5.71C5,5.64,4.75,5.7,4.63,5.92L2.71,9.24 c-0.12,0.2-0.07,0.47,0.12,0.61l2.03,1.58C4.8,11.66,4.78,11.98,4.78,12.3c0,0.32,0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.38,2.91 c0.04,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.48,0.41l0.38-2.91c0.59-0.24,1.12-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0.02,0.59-0.22l1.92-3.32c0.12-0.2,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/></svg>';
      fab.addEventListener("click", openMenu);
      document.body.appendChild(fab);
    };
    return { createButton };
  })();

  /**
   * @module AppController
   * @description The main controller that orchestrates the entire script.
   */
  const AppController = (() => {
    let syncChannel = null;

    /**
     * Orchestrates UI decoration for episodes, series, and seasons.
     * Replaces previous EpisodeMarker logic with unified ContentDecorator.
     * Airbnb JS Style Guide compliant.
     */
    const applyAll = (root = document) => {
      // Decorate episode items (table rows and cards)
      for (const item of Utils.$$(Constants.EPISODE_ITEM_SELECTOR, root)) {
        if (item.tagName === "TR" && item.closest("thead")) {
          continue;
        }
        if (!Utils.$(Constants.EPISODE_LINK_SELECTOR, item)) {
          continue;
        }
        ContentDecorator.decorateItem(item, {
          type: "seen",
          selector: Constants.EPISODE_LINK_SELECTOR,
          onToggle: handleToggle,
          isSetFn: Store.isSeen,
        });
      }

      // Decorate series items (headers and cards)
      for (const item of Utils.$$(Constants.SERIES_ITEM_SELECTOR, root)) {
        const hasSeries = Boolean(Utils.$("a[href^='/series/']", item));
        if (!hasSeries) {
          continue;
        }
        const hasSeason = Boolean(Utils.$("a[href^='/season/']", item));
        const isHeaderLike = Boolean(
          Utils.$(".page-title", item) || Utils.$("h1", item) || Utils.$("header h1", item),
        );

        // Only decorate as series if header or no season present
        if (isHeaderLike || !hasSeason) {
          ContentDecorator.decorateItem(item, {
            type: "series",
            selector: Constants.LINK_SELECTOR,
            onToggle: handleToggle,
            isSetFn: Store.isWatching,
            getStatusFn: Store.getSeriesStatus,
            preferKind: "series",
          });
        }
      }

      // Decorate season items (cards/lists)
      for (const item of Utils.$$(Constants.SERIES_ITEM_SELECTOR, root)) {
        if (!Utils.$("a[href^='/season/']", item)) {
          continue;
        }
        // Avoid double decoration
        if (item.getAttribute(Constants.ITEM_DECORATED_ATTR) === "series") {
          continue;
        }
        ContentDecorator.decorateItem(item, {
          type: "series",
          selector: Constants.LINK_SELECTOR,
          onToggle: handleToggle,
          isSetFn: Store.isWatching,
          getStatusFn: Store.getSeriesStatus,
          preferKind: "season",
        });
      }
    };

    /**
     * Propagates the "watching" state to season and series when an episode is marked as seen.
     * Isolated for clarity and testability.
     * @param {string} episodeId - The episode's unique identifier.
     * @returns {Promise<void>}
     */
    const propagateWatchingState = async (episodeId) => {
      const { seasonId, seriesId } = Utils.getHierarchyFromEpisodePath(episodeId);
      if (seasonId && !Store.isWatching(seasonId)) {
        await Store.setWatching(seasonId, true);
      }
      if (seriesId && !Store.isWatching(seriesId)) {
        await Store.setWatching(seriesId, true);
        const seriesName = Utils.getSeriesNameForId(seriesId);
        UIManager.showToast(I18n.t("toastAutoTrack", { seriesName }));
      }
    };

    /**
     * Handles item state changes and propagates them across hierarchy.
     */
    const handleToggle = async (type, id, currentStatus, item) => {
      // Episodes
      if (type === "seen") {
        const newSeen = currentStatus !== "seen";
        await Store.setSeen(id, newSeen);

        // Automatic propagation to season and series
        const { seasonId, seriesId } = Utils.getHierarchyFromEpisodePath(id);
        if (newSeen) {
          await propagateWatchingState(id);
        }
        ContentDecorator.updateItemUI(id, {
          type: "seen",
          isSetFn: Store.isSeen,
        });
        // Optional: update season/series in the UI
        if (seasonId) {
          ContentDecorator.updateItemUI(seasonId, {
            type: "series",
            isSetFn: Store.isWatching,
            getStatusFn: Store.getSeriesStatus,
          });
        }
        if (seriesId) {
          ContentDecorator.updateItemUI(seriesId, {
            type: "series",
            isSetFn: Store.isWatching,
            getStatusFn: Store.getSeriesStatus,
          });
        }
        return;
      }

      // Series/Seasons
      if (type === "series") {
        if (currentStatus === Constants.STATE_WATCHING) {
          // Mark as completed
          await Store.setCompleted(id, true);
          // Propagate to seasons and episodes
          const seasons = await Store.getSeasonsForSeries(id);
          for (const seasonId of seasons) {
            await Store.setCompleted(seasonId, true);
            const episodes = await Store.getEpisodesForSeason(seasonId);
            for (const episodeId of episodes) {
              await Store.setSeen(episodeId, true);
            }
          }
        } else if (currentStatus === Constants.STATE_COMPLETED) {
          // Unmark as completed
          await Store.setCompleted(id, false);
          const seasons = await Store.getSeasonsForSeries(id);
          for (const seasonId of seasons) {
            await Store.setCompleted(seasonId, false);
            const episodes = await Store.getEpisodesForSeason(seasonId);
            for (const episodeId of episodes) {
              await Store.setSeen(episodeId, false);
            }
          }
        }
        ContentDecorator.updateItemUI(id, {
          type: "series",
          isSetFn: Store.isWatching,
          getStatusFn: Store.getSeriesStatus,
        });
        return;
      }
    };

    const setupSyncChannel = () => {
      if (!("BroadcastChannel" in window)) {
        return;
      }
      syncChannel = new BroadcastChannel(Constants.SYNC_CHANNEL_NAME);
      syncChannel.onmessage = (event) => {
        const { id, seen } = event.data;
        Store.receiveSync(id, seen);
      };
    };

    const setupGlobalClickListener = () => {
      document.addEventListener(
        "click",
        async (e) => {
          const link = e.target?.closest("a[href]");
          if (!link) {
            return;
          }

          let url;
          try {
            url = new URL(link.href, location.origin);
          } catch {
            return;
          }

          if (url.origin !== location.origin || !Utils.isEpisodePathname(url.pathname)) {
            return;
          }
          if (Store.isSeen(url.pathname)) {
            return;
          }

          const isPrimaryClick =
            e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
          if (isPrimaryClick && link.target !== "_blank") {
            e.preventDefault();
            await handleToggle(url.pathname, true);
            location.href = url.href;
          } else {
            handleToggle(url.pathname, true);
          }
        },
        { capture: true, passive: false },
      );
    };

    const handleStateChange = (change) => {
      switch (change.type) {
        case "INIT": {
          document.documentElement.classList.toggle(
            Constants.ROOT_HL_CLASS,
            Store.isRowHighlightOn(),
          );
          break;
        }

        case "PREFS_CHANGE": {
          const { oldPrefs, newPrefs } = change.payload;
          const highlightChanged = oldPrefs.rowHighlight !== newPrefs.rowHighlight;
          const langChanged = oldPrefs.userLang !== newPrefs.userLang;

          if (highlightChanged) {
            document.documentElement.classList.toggle(
              Constants.ROOT_HL_CLASS,
              Store.isRowHighlightOn(),
            );
          }

          if (langChanged) {
            UIManager.showToast(I18n.t("toastLangChanged"));
            setTimeout(() => location.reload(), 1500);
          }
          break;
        }

        case "SEEN_CHANGE":
          ContentDecorator.updateItemUI(change.payload.id, {
            type: "seen",
            isSetFn: Store.isSeen,
          });
          break;
        case "CLEAR_SEEN":
          Utils.$$(`[${Constants.ITEM_SEEN_ATTR}]`).forEach(ContentDecorator.resetItemUI);
          break;
      }
    };

    const init = async () => {
      if (!document.body) {
        await new Promise((resolve) => {
          const obs = new MutationObserver(() => {
            if (document.body) {
              obs.disconnect();
              resolve();
            }
          });
          obs.observe(document.documentElement, { childList: true });
        });
      }

      I18n.init(navigator.language);

      UIManager.injectCSS();
      Store.subscribe(handleStateChange);
      await Store.load();
      I18n.init(Store.getUserLang());

      Settings.createButton();
      setupSyncChannel();
      setupGlobalClickListener();

      applyAll();
      DOMObserver.observe(() => applyAll());

      const currentPath = location.pathname;
      if (Utils.isEpisodePathname(currentPath) && !Store.isSeen(currentPath)) {
        handleToggle(currentPath, true);
      }
    };

    return { init };
  })();

  // --- Entry Point ---
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", AppController.init);
  } else {
    AppController.init();
  }

  // Expose Utils to the global scope
  window.Utils = Utils;
})();
