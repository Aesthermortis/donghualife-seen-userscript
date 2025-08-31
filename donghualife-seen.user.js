// ==UserScript==
// @name         DonghuaLife – Mark Watched Episodes (✅)
// @namespace    us_dhl_seen
// @version      1.0.4
// @description  Adds a button to mark watched episodes and syncs status across tabs.
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
   * -------------------------------------------------------------
   * Config & Constants
   * -------------------------------------------------------------
   */
  const PREFS_KEY = "us-dhl:prefs:v1";
  const ITEM_SEEN_ATTR = "data-us-dhl-decorated";
  const BTN_CLASS = "us-dhl-seen-btn";
  const CARD_BTN_CLASS = "us-dhl-card-btn";
  const ITEM_SEEN_CLASS = "us-dhl-item-seen";
  const ROOT_HL_CLASS = "us-dhl-rowhl-on";
  const CTRL_CELL_CLASS = "us-dhl-ctrlcol";
  const TABLE_MARK_ATTR = "data-us-dhl-ctrlcol";
  const SYNC_CHANNEL_NAME = "us-dhl-sync:v1"; // Added for BroadcastChannel
  const DEFAULT_ROW_HL = false; // Default row highlight (true = ON, false = OFF)
  const EP_PATTERNS = [/\/episode\//i, /\/watch\//i, /\/capitulo\//i, /\/ver\//i];

  // CSS styles
  const CSS = `
    /* Estilo base del botón */
    .${BTN_CLASS}{
      cursor:pointer;
      user-select:none;
      font-size:0.9rem;
      line-height:1;
      padding:0.32rem 0.65rem;
      border:none;
      border-radius:0.75rem;
      background:rgba(255,255,255,.06);
      color:#f5f7fa;
      transition:filter .15s ease, background .15s ease;
      white-space: nowrap;
    }

    .${BTN_CLASS}:hover{ filter:brightness(1.2); }

    .${BTN_CLASS}[aria-pressed="true"]{
      background:rgba(4, 120, 87, .3); /* Verde más oscuro */
      color:#f0fff8;
    }

    .${BTN_CLASS}[aria-pressed="true"]:hover{ filter:brightness(1.3); }

    .${BTN_CLASS}:focus{ outline:2px solid rgba(255,255,255,.35); outline-offset:2px; }

    /* Contenedor relativo para tarjetas de episodio */
    .views-row .episode {
      position: relative;
    }

    /* Estilos específicos para el botón en tarjetas de episodio */
    .${CARD_BTN_CLASS} {
      position: absolute;
      top: 8px;
      right: 8px;
      z-index: 10;
      /* Fondo más opaco para legibilidad sobre imágenes */
      background: rgba(20, 20, 22, 0.7);
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      backdrop-filter: blur(4px);
    }

    .${CARD_BTN_CLASS}[aria-pressed="true"] {
      background: rgba(4, 120, 87, 0.75); /* Verde más oscuro */
    }

    .${CTRL_CELL_CLASS}{
      width:1%;
      white-space:nowrap;
      text-align:right;
    }

    /* Estilo de item marcado (solo si el highlight global está ON) */
    .${ROOT_HL_CLASS} .${ITEM_SEEN_CLASS}{
      background: rgba(4, 120, 87, .1);
      transition: background .15s ease;
    }

    /* Intensidad al hover (solo si el highlight global está ON) */
    .${ROOT_HL_CLASS} .${ITEM_SEEN_CLASS}:hover{
      background: rgba(4, 120, 87, .18);
    }

    /* A11y: también resalta cuando el item contiene foco (navegación con teclado) */
    .${ROOT_HL_CLASS} .${ITEM_SEEN_CLASS}:focus-within{
      background: rgba(4, 120, 87, .18);
    }

    /* Evitar “parpadeo” en móvil/touch: aplica hover solo en puntero fino */
    @media (hover: hover) and (pointer: fine){
      .${ROOT_HL_CLASS} .${ITEM_SEEN_CLASS}{
        transition: background .15s ease;
      }
    }

    /* Respeta “reducir movimiento” del sistema */
    @media (prefers-reduced-motion: reduce){
      .${ROOT_HL_CLASS} .${ITEM_SEEN_CLASS}{
        transition: none;
      }
    }

    /* Enlaces en items marcados: opacidad ligeramente reducida (solo si el highlight global está ON) */
    .${ROOT_HL_CLASS} .${ITEM_SEEN_CLASS} a{
      opacity: .95;
    }

    /* Botón en items marcados: filtro de brillo reducido (solo si el highlight global está ON) */
    .${ROOT_HL_CLASS} .${ITEM_SEEN_CLASS} .${BTN_CLASS}[aria-pressed="true"]{
      filter: none;
    }

    /* --- Modern UI (Toasts & Modals) --- */
    .us-dhl-toast-container {
      position: fixed; top: 1rem; right: 1rem; z-index: 9999;
      display: flex; flex-direction: column; gap: 0.5rem;
    }
    .us-dhl-toast {
      padding: 0.75rem 1.25rem; border-radius: 0.5rem; color: #fff;
      background: #333; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      animation: us-dhl-toast-in .3s ease;
    }
    @keyframes us-dhl-toast-in { from { opacity:0; transform:translateX(100%); } }

    .us-dhl-modal-overlay {
      position: fixed; inset: 0; z-index: 9998;
      background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      animation: us-dhl-fade-in .2s ease;
    }
    @keyframes us-dhl-fade-in { from { opacity: 0; } }

    .us-dhl-modal {
      background: #1e1e20; border-radius: 0.75rem; color: #f5f7fa;
      width: 90%; max-width: 500px; box-shadow: 0 5px 20px rgba(0,0,0,0.4);
      animation: us-dhl-modal-in .2s ease-out;
    }
    @keyframes us-dhl-modal-in { from { opacity:0; transform:scale(0.95); } }

    .us-dhl-modal-header { padding: 1rem 1.5rem; font-size: 1.2rem; font-weight: 600; border-bottom: 1px solid rgba(255,255,255,.1); }
    .us-dhl-modal-body { padding: 1.5rem; }
    .us-dhl-modal-body p { margin: 0 0 1rem; line-height: 1.5; }
    .us-dhl-modal-body textarea, .us-dhl-modal-body input {
      width: 100%; padding: 0.75rem; border-radius: 0.5rem; border: 1px solid rgba(255,255,255,.2);
      background: #2a2a2e; color: #f5f7fa; font-family: inherit; font-size: 1rem;
      box-sizing: border-box; /* Added for consistent sizing */
    }
    .us-dhl-modal-body textarea { min-height: 120px; resize: vertical; }

    .us-dhl-modal-footer {
      padding: 1rem 1.5rem; display: flex; justify-content: flex-end; gap: 0.75rem;
      background: rgba(0,0,0,.1); border-top: 1px solid rgba(255,255,255,.1);
      border-bottom-left-radius: 0.75rem; border-bottom-right-radius: 0.75rem;
    }
    .us-dhl-modal-btn {
      padding: 0.5rem 1rem; border-radius: 0.5rem; border: none; cursor: pointer;
      font-weight: 600; transition: filter .15s ease;
    }
    .us-dhl-modal-btn:hover { filter: brightness(1.15); }
    .us-dhl-modal-btn.primary { background: #059669; color: #fff; }
    .us-dhl-modal-btn.secondary { background: rgba(255,255,255,.1); color: #f5f7fa;
    }

    /* Floating Action Button (FAB) for settings */
    .us-dhl-fab {
      position: fixed;
      bottom: 1.5rem;
      right: 1.5rem;
      z-index: 9990;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      border: none;
      background: #059669;
      color: white;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform .2s ease, filter .2s ease;
    }
    .us-dhl-fab:hover {
      filter: brightness(1.1);
      transform: scale(1.05);
    }
    .us-dhl-fab svg {
      width: 24px;
      height: 24px;
    }

    /* New: Settings Modal specific styles */
    .us-dhl-settings-menu {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .us-dhl-settings-menu .us-dhl-modal-btn {
      width: 100%;
      text-align: center;
      padding: 0.75rem 1rem;
      justify-content: center;
    }
  `;

  /**
   * -------------------------------------------------------------
   * Utilities
   * -------------------------------------------------------------
   */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const debounce = (fn, ms) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  };

  /**
   * -------------------------------------------------------------
   * DatabaseManager Module (Revealing Module Pattern)
   * Handles all IndexedDB interactions.
   * -------------------------------------------------------------
   */
  const DatabaseManager = (() => {
    const DB_NAME = "donghualife-seen-db";
    const STORE_NAME = "seenEpisodes";
    const DB_VERSION = 1;
    let dbInstance = null;

    // Private method to open and prepare the database.
    const openDB = () => {
      if (dbInstance) {
        return Promise.resolve(dbInstance);
      }

      return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
          console.error("IndexedDB error:", event.target.error);
          reject(`IndexedDB error: ${event.target.error}`);
        };

        request.onsuccess = (event) => {
          dbInstance = event.target.result;
          resolve(dbInstance);
        };

        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };
      });
    };

    // Private method to perform a transaction.
    const perform = async (mode, operation) => {
      try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);

        return new Promise((resolve, reject) => {
          const request = operation(store);
          request.onerror = (event) => reject(event.target.error);
          request.onsuccess = (event) => resolve(event.target.result);
        });
      } catch (error) {
        console.error(`IndexedDB transaction failed (mode: ${mode}):`, error);
        throw error; // Re-throw to allow caller to handle it
      }
    };

    // Public API
    return {
      set: (key, value) => perform("readwrite", (store) => store.put(value, key)),
      get: (key) => perform("readonly", (store) => store.get(key)),
      delete: (key) => perform("readwrite", (store) => store.delete(key)),
      clear: () => perform("readwrite", (store) => store.clear()),
      getAll: () => perform("readonly", (store) => store.getAll()),
      getAllKeys: () => perform("readonly", (store) => store.getAllKeys()),
    };
  })();

  /**
   * -------------------------------------------------------------
   * UIManager Module (Revealing Module Pattern)
   * Handles all UI interactions like modals, toasts, and DOM injections.
   * -------------------------------------------------------------
   */
  const UIManager = (() => {
    const _getToastContainer = () => {
      let container = $("#us-dhl-toast-container");
      if (!container) {
        container = document.createElement("div");
        container.id = "us-dhl-toast-container";
        container.className = "us-dhl-toast-container";
        document.body.appendChild(container);
      }
      return container;
    };

    const _createModal = (content) => {
      const overlay = document.createElement("div");
      overlay.className = "us-dhl-modal-overlay";
      overlay.innerHTML = `
        <div class="us-dhl-modal" role="dialog" aria-modal="true">
          ${content}
        </div>
      `;
      document.body.appendChild(overlay);
      return overlay;
    };

    // Public API
    return {
      injectCSS: () => {
        if ($("#us-dhl-seen-style")) {
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
        _getToastContainer().appendChild(toast);
        setTimeout(() => toast.remove(), duration);
      },

      showConfirm: ({ title, text, okLabel = "Aceptar", cancelLabel = "Cancelar" }) => {
        return new Promise((resolve) => {
          const modalHTML = `
            <div class="us-dhl-modal-header">${title}</div>
            <div class="us-dhl-modal-body"><p>${text}</p></div>
            <div class="us-dhl-modal-footer">
              <button class="us-dhl-modal-btn secondary">${cancelLabel}</button>
              <button class="us-dhl-modal-btn primary">${okLabel}</button>
            </div>
          `;
          const overlay = _createModal(modalHTML);
          const modal = $(".us-dhl-modal", overlay);
          const close = (value) => {
            overlay.remove();
            resolve(value);
          };

          modal.addEventListener("click", (e) => e.stopPropagation());
          overlay.addEventListener("click", () => close(false));
          $(".primary", overlay).addEventListener("click", () => close(true));
          $(".secondary", overlay).addEventListener("click", () => close(false));
        });
      },

      showPrompt: ({ title, text, okLabel = "Aceptar", cancelLabel = "Cancelar" }) => {
        return new Promise((resolve) => {
          const modalHTML = `
            <div class="us-dhl-modal-header">${title}</div>
            <div class="us-dhl-modal-body">
                <p>${text}</p>
                <textarea></textarea>
            </div>
            <div class="us-dhl-modal-footer">
                <button class="us-dhl-modal-btn secondary">${cancelLabel}</button>
                <button class="us-dhl-modal-btn primary">${okLabel}</button>
            </div>
          `;
          const overlay = _createModal(modalHTML);
          const modal = $(".us-dhl-modal", overlay);
          const input = $("textarea", overlay);
          const close = (value) => {
            overlay.remove();
            resolve(value);
          };

          modal.addEventListener("click", (e) => e.stopPropagation());
          overlay.addEventListener("click", () => close(null));
          $(".primary", overlay).addEventListener("click", () => close(input.value));
          $(".secondary", overlay).addEventListener("click", () => close(null));
          input.focus();
        });
      },

      showExport: ({ title, text, data }) => {
        const modalHTML = `
          <div class="us-dhl-modal-header">${title}</div>
          <div class="us-dhl-modal-body">
              <p>${text}</p>
              <textarea readonly></textarea>
          </div>
          <div class="us-dhl-modal-footer">
              <button class="us-dhl-modal-btn primary">Cerrar</button>
          </div>
        `;
        const overlay = _createModal(modalHTML);
        const modal = $(".us-dhl-modal", overlay);
        const textarea = $("textarea", overlay);
        textarea.value = data;
        const close = () => overlay.remove();

        modal.addEventListener("click", (e) => e.stopPropagation());
        overlay.addEventListener("click", close);
        $(".primary", overlay).addEventListener("click", close);
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

        const modalHTML = `
          <div class="us-dhl-modal-header">${title}</div>
          <div class="us-dhl-modal-body">
              <div class="us-dhl-settings-menu">
                  ${actionButtons}
              </div>
          </div>
        `;
        const overlay = _createModal(modalHTML);
        const modal = $(".us-dhl-modal", overlay);
        const close = () => overlay.remove();

        modal.addEventListener("click", (e) => {
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
    };
  })();

  /**
   * -------------------------------------------------------------
   * App Module (Revealing Module Pattern)
   * Main application logic.
   * -------------------------------------------------------------
   */
  const App = (() => {
    let seenSet = new Set(); // In-memory cache of seen episode keys
    let syncChannel = null; // Holds the BroadcastChannel instance for cross-tab sync.

    // --- Preferences Management ---
    const loadPrefs = async () => {
      const raw = await GM.getValue(PREFS_KEY, "{}");
      try {
        return JSON.parse(raw);
      } catch (e) {
        console.error("Failed to parse preferences:", e);
        return {};
      }
    };

    const savePrefs = async (prefs) => {
      await GM.setValue(PREFS_KEY, JSON.stringify(prefs));
    };

    const isRowHlOn = (prefs) => {
      return typeof prefs.rowHighlight === "boolean" ? prefs.rowHighlight : DEFAULT_ROW_HL;
    };

    const applyPrefs = (prefs) => {
      document.documentElement.classList.toggle(ROOT_HL_CLASS, isRowHlOn(prefs));
    };

    // --- Data Management Actions ---
    const exportJSON = async () => {
      try {
        const keys = await DatabaseManager.getAllKeys();
        const allData = await DatabaseManager.getAll();
        const exportObj = {};
        keys.forEach((key, index) => {
          exportObj[key] = allData[index];
        });
        UIManager.showExport({
          title: "Exportar Respaldo",
          text: "Copia este texto para guardar un respaldo de tus episodios vistos.",
          data: JSON.stringify(exportObj, null, 2),
        });
      } catch (error) {
        console.error("Failed to export data:", error);
        UIManager.showToast("Error al exportar los datos.");
      }
    };

    const importJSON = async () => {
      const txt = await UIManager.showPrompt({
        title: "Importar Respaldo",
        text: "Pega aquí el JSON de respaldo que guardaste previamente.",
      });
      if (txt === null) {
        return;
      }

      try {
        const parsed = JSON.parse(txt);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          const confirmed = await UIManager.showConfirm({
            title: "Confirmar Importación",
            text: `Se encontraron ${
              Object.keys(parsed).length
            } registros. Esto sobreescribirá tus datos actuales. ¿Deseas continuar?`,
            okLabel: "Sí, importar",
            cancelLabel: "Cancelar",
          });

          if (!confirmed) {
            return;
          }

          await DatabaseManager.clear();
          for (const key in parsed) {
            if (Object.prototype.hasOwnProperty.call(parsed, key)) {
              await DatabaseManager.set(key, parsed[key]);
            }
          }
          UIManager.showToast("Importado con éxito. Recargando...");
          setTimeout(() => location.reload(), 1500);
        } else {
          UIManager.showToast("Error: El texto introducido no es un objeto JSON válido.");
        }
      } catch (error) {
        console.error("Failed to import data:", error);
        UIManager.showToast("Error: El texto introducido no es un JSON válido.");
      }
    };

    const resetAll = async () => {
      const confirmed = await UIManager.showConfirm({
        title: "Confirmar Reinicio",
        text: "¿Estás seguro de que quieres borrar todos los episodios marcados como vistos? Esta acción no se puede deshacer.",
        okLabel: "Sí, borrar todo",
        cancelLabel: "Cancelar",
      });
      if (!confirmed) {
        return;
      }

      try {
        await DatabaseManager.clear();
        UIManager.showToast("Datos reiniciados. Recargando...");
        setTimeout(() => location.reload(), 1500);
      } catch (error) {
        console.error("Failed to reset data:", error);
        UIManager.showToast("Error al reiniciar los datos.");
      }
    };

    // --- UI Creation & Management ---
    const computeId = (element) => {
      const a = $("a[href]", element);
      if (a?.href) {
        try {
          return new URL(a.href, location.origin).pathname;
        } catch (e) {
          console.warn("Invalid URL found in element, falling back to text content.", a.href, e);
        }
      }
      const txt = (element.textContent || "").replace(/\s+/g, " ").trim();
      const prefix = element.tagName === "TR" ? "row:" : "item:";
      return prefix + txt.slice(0, 160);
    };

    const updateButtonState = (btn, isSeen) => {
      btn.textContent = isSeen ? "Visto" : "Marcar";
      btn.title = isSeen
        ? "Marcado como visto. Click para desmarcar."
        : "No visto. Click para marcar.";
      btn.setAttribute("aria-pressed", String(!!isSeen));
    };

    const setItemSeenState = (item, seen) => {
      if (item) {
        item.classList.toggle(ITEM_SEEN_CLASS, !!seen);
        item.setAttribute("data-us-dhl-seen-state", seen ? "1" : "0");
      }
    };

    const makeSeenButton = (isSeen, isCard) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = isCard ? `${BTN_CLASS} ${CARD_BTN_CLASS}` : BTN_CLASS;
      updateButtonState(btn, isSeen);
      btn.setAttribute("aria-label", "Alternar episodio visto");
      return btn;
    };

    const ensureTableControlColumn = (table) => {
      if (!table || table.getAttribute(TABLE_MARK_ATTR) === "1") {
        return;
      }
      if (table.tHead?.rows?.length) {
        const th = document.createElement("th");
        th.className = CTRL_CELL_CLASS;
        table.tHead.rows[0].appendChild(th);
      }
      table.setAttribute(TABLE_MARK_ATTR, "1");
    };

    const getButtonContainer = (item) => {
      if (item.tagName === "TR") {
        const table = item.closest("table");
        ensureTableControlColumn(table);
        let cell = item.querySelector(`td.${CTRL_CELL_CLASS}`);
        if (!cell) {
          cell = document.createElement("td");
          cell.className = CTRL_CELL_CLASS;
          item.appendChild(cell);
        }
        return cell;
      }
      return item; // For cards, append directly to the item.
    };

    /**
     * Updates the UI for a specific item based on its seen state.
     * This function is called both by local user actions and by the sync channel.
     * @param {string} id - The unique identifier of the episode item.
     * @param {boolean} isSeen - The new seen state.
     */
    const updateItemUI = (id, isSeen) => {
      // Find the DOM element that has already been decorated and corresponds to the ID.
      const item = $$(`[${ITEM_SEEN_ATTR}]`).find((el) => computeId(el) === id);
      if (!item) {
        return; // The item is not present in the current view.
      }

      const btn = $(`.${BTN_CLASS}`, item);
      if (btn) {
        updateButtonState(btn, isSeen);
      }
      setItemSeenState(item, isSeen);
    };

    // --- Core Logic ---
    const decorateItem = async (item) => {
      if (item.getAttribute(ITEM_SEEN_ATTR) === "1") {
        return;
      }

      const id = computeId(item);
      if (!id) {
        return;
      }

      const isSeen = seenSet.has(id);
      setItemSeenState(item, isSeen);

      const isCard = item.matches(".views-row .episode");
      const controlContainer = getButtonContainer(item);
      const btn = makeSeenButton(isSeen, isCard);
      controlContainer.appendChild(btn);

      btn.addEventListener("click", async (ev) => {
        ev.stopPropagation();
        const currentlySeen = seenSet.has(id);
        const nowSeen = !currentlySeen;

        try {
          if (nowSeen) {
            await DatabaseManager.set(id, { t: Date.now() });
            seenSet.add(id);
          } else {
            await DatabaseManager.delete(id);
            seenSet.delete(id);
          }

          // Update local UI immediately.
          updateButtonState(btn, nowSeen);
          setItemSeenState(item, nowSeen);

          // Broadcast the change to other tabs.
          if (syncChannel) {
            syncChannel.postMessage({ id, seen: nowSeen });
          }
        } catch (error) {
          console.error("Failed to update seen status in DB:", error);
          UIManager.showToast("Error al guardar el estado.");
        }
      });

      item.setAttribute(ITEM_SEEN_ATTR, "1");
    };

    const scanItems = (root = document) => {
      return $$("table tr, .views-row .episode", root).filter((item) => {
        if (item.tagName === "TR" && item.closest("thead")) {
          return false;
        }
        return !!$("a[href]", item);
      });
    };

    const applyAll = async (root = document) => {
      const items = scanItems(root);
      // Use Promise.all for concurrent decoration
      await Promise.all(
        items.map((item) =>
          decorateItem(item).catch((e) => console.error("Failed to decorate item:", e)),
        ),
      );
    };

    /**
     * Sets up a MutationObserver to watch for dynamically added nodes.
     * @param {Function} callback - The function to call when mutations are observed.
     */
    const observeMutations = (callback) => {
      const observer = new MutationObserver((mutationsList) => {
        // We only care if nodes were added
        const hasAddedNodes = mutationsList.some((mutation) => mutation.addedNodes.length > 0);
        if (hasAddedNodes) {
          callback();
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      return observer;
    };

    const isEpisodePathname = (pn) => {
      return EP_PATTERNS.some((rx) => rx.test(pn));
    };

    const isPrimaryUnmodifiedClick = (e, link) => {
      return (
        e.button === 0 &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.shiftKey &&
        !e.altKey &&
        (!link || link.target !== "_blank")
      );
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
            return; // Invalid URL, ignore.
          }

          if (url.origin !== location.origin || !isEpisodePathname(url.pathname)) {
            return;
          }

          const alreadySeen = seenSet.has(url.pathname);
          if (alreadySeen) {
            return;
          }

          if (isPrimaryUnmodifiedClick(e, link)) {
            e.preventDefault();
            try {
              await DatabaseManager.set(url.pathname, { t: Date.now() });
              seenSet.add(url.pathname);
              // Broadcast this auto-mark event as well
              if (syncChannel) {
                syncChannel.postMessage({ id: url.pathname, seen: true });
              }
              location.href = url.href;
            } catch (error) {
              console.error("Failed to mark item as seen before navigation:", error);
              location.href = url.href; // Navigate anyway
            }
          } else {
            // For background tabs, etc., just mark as seen without blocking.
            DatabaseManager.set(url.pathname, { t: Date.now() }).catch((error) => {
              console.error("Failed to mark item as seen in background:", error);
            });
            seenSet.add(url.pathname);
            // Also broadcast this change
            if (syncChannel) {
              syncChannel.postMessage({ id: url.pathname, seen: true });
            }
          }
        },
        { capture: true, passive: false },
      );
    };

    /**
     * Builds and displays the settings menu modal.
     * This function is responsible for fetching current preferences and constructing
     * the list of actions available to the user.
     */
    const openSettingsMenu = async () => {
      const prefs = await loadPrefs();
      const actions = [
        {
          label: (isRowHlOn(prefs) ? "Desactivar" : "Activar") + " color de items 'Visto'",
          async onClick() {
            const latest = await loadPrefs();
            const next = { ...latest, rowHighlight: !isRowHlOn(latest) };
            await savePrefs(next);
            applyPrefs(next);
            UIManager.showToast(
              `Resalte de items ${isRowHlOn(next) ? "activado" : "desactivado"}.`,
            );
          },
        },
        {
          label: "Restablecer preferencias visuales",
          isDestructive: true,
          async onClick() {
            await savePrefs({});
            applyPrefs({});
            UIManager.showToast("Preferencias visuales restablecidas.");
          },
        },
        {
          label: "Exportar vistos (JSON)",
          onClick: exportJSON,
          keepOpen: true,
        },
        {
          label: "Importar vistos (JSON)",
          onClick: importJSON,
          keepOpen: true,
        },
        {
          label: "Reiniciar todos los vistos",
          onClick: resetAll,
          isDestructive: true,
          keepOpen: true,
        },
      ];
      UIManager.showSettingsMenu({ title: "Configuración", actions });
    };

    /**
     * Creates and injects the floating action button (FAB) for settings.
     * The button's click handler is now simplified to just call `openSettingsMenu`.
     */
    const createSettingsButton = () => {
      if ($(".us-dhl-fab")) {
        return;
      }

      const fab = document.createElement("button");
      fab.className = "us-dhl-fab";
      fab.title = "Configuración del script";
      fab.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.44,0.17-0.48,0.41L9.22,5.72C8.63,5.96,8.1,6.29,7.6,6.67L5.22,5.71C5,5.64,4.75,5.7,4.63,5.92L2.71,9.24 c-0.12,0.2-0.07,0.47,0.12,0.61l2.03,1.58C4.8,11.66,4.78,11.98,4.78,12.3c0,0.32,0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.38,2.91 c0.04,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.48,0.41l0.38-2.91c0.59-0.24,1.12-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0.02,0.59-0.22l1.92-3.32c0.12-0.2,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/></svg>';

      // The event listener is now cleaner, delegating the work to a dedicated function.
      fab.addEventListener("click", openSettingsMenu);

      document.body.appendChild(fab);
    };

    const setupMenuCommands = async (prefs) => {
      if (typeof GM.registerMenuCommand !== "function") {
        return;
      }

      GM.registerMenuCommand(
        (isRowHlOn(prefs) ? "Desactivar" : "Activar") + " color de items 'Visto'",
        async () => {
          const latest = await loadPrefs();
          const next = { ...latest, rowHighlight: !isRowHlOn(latest) };
          await savePrefs(next);
          applyPrefs(next);
          UIManager.showToast(`Resalte de items ${isRowHlOn(next) ? "activado" : "desactivado"}.`);
        },
      );
      GM.registerMenuCommand("Restablecer preferencias visuales", async () => {
        await savePrefs({});
        applyPrefs({});
        UIManager.showToast("Preferencias visuales restablecidas.");
      });
      GM.registerMenuCommand("Exportar vistos (JSON)", exportJSON);
      GM.registerMenuCommand("Importar vistos (JSON)", importJSON);
      GM.registerMenuCommand("Reiniciar marcados", resetAll);
    };

    // Public API for the App module
    return {
      init: async () => {
        // Wait for body to be ready
        if (!document.body) {
          await new Promise((resolve) => {
            const observer = new MutationObserver(() => {
              if (document.body) {
                observer.disconnect();
                resolve();
              }
            });
            observer.observe(document.documentElement, { childList: true });
          });
        }

        UIManager.injectCSS();

        const prefs = await loadPrefs();
        applyPrefs(prefs);

        createSettingsButton();
        setupMenuCommands(prefs);

        try {
          seenSet = new Set(await DatabaseManager.getAllKeys());
        } catch (error) {
          console.error("Failed to load seen episodes from DB:", error);
          UIManager.showToast("Error al cargar los datos de episodios vistos.");
          return; // Stop execution if DB is not available
        }

        // --- BroadcastChannel Initialization ---
        // Establishes a communication channel between open tabs for real-time state synchronization.
        if ("BroadcastChannel" in window) {
          syncChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
          syncChannel.onmessage = (event) => {
            const { id, seen } = event.data;

            // Update the in-memory set in this tab.
            if (seen) {
              seenSet.add(id);
            } else {
              seenSet.delete(id);
            }
            // Update the UI to reflect the change from another tab.
            updateItemUI(id, seen);
          };
        }

        // Auto-mark current episode page if it's not marked yet
        if (isEpisodePathname(location.pathname) && !seenSet.has(location.pathname)) {
          try {
            await DatabaseManager.set(location.pathname, { t: Date.now() });
            seenSet.add(location.pathname);
          } catch (error) {
            console.error("Failed to auto-mark current episode:", error);
          }
        }

        setupGlobalClickListener();

        // Initial decoration of existing items
        await applyAll();

        // Observe subsequent DOM changes for dynamically loaded content
        observeMutations(debounce(() => applyAll(), 150));
      },
    };
  })();

  // --- Entry Point ---
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", App.init);
  } else {
    App.init();
  }
})();
