// ==UserScript==
// @name         DonghuaLife – Mark Watched Episodes (✅)
// @namespace    us_dhl_seen
// @version      1.0.3
// @description  Adds a button to mark watched episodes in season tables and episode cards on donghualife.com.
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
   * Config & Utilities
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

  // Default row highlight (true = ON by default, false = OFF by default)
  const DEFAULT_ROW_HL = false;

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

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // Injects CSS if not already present
  function injectCSS() {
    if ($("#us-dhl-seen-style")) {
      return;
    }
    const style = document.createElement("style");
    style.id = "us-dhl-seen-style";
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  const UImanager = {
    _getToastContainer() {
      let container = $("#us-dhl-toast-container");
      if (!container) {
        container = document.createElement("div");
        container.id = "us-dhl-toast-container";
        container.className = "us-dhl-toast-container";
        document.body.appendChild(container);
      }
      return container;
    },
    showToast(message, duration = 3000) {
      const toast = document.createElement("div");
      toast.className = "us-dhl-toast";
      toast.textContent = message;
      this._getToastContainer().appendChild(toast);
      setTimeout(() => toast.remove(), duration);
    },
    _createModal(content) {
      const overlay = document.createElement("div");
      overlay.className = "us-dhl-modal-overlay";
      overlay.innerHTML = `
        <div class="us-dhl-modal" role="dialog" aria-modal="true">
          ${content}
        </div>
      `;
      document.body.appendChild(overlay);
      return overlay;
    },
    showConfirm({ title, text, okLabel = "Aceptar", cancelLabel = "Cancelar" }) {
      return new Promise((resolve) => {
        const modalHTML = `
          <div class="us-dhl-modal-header">${title}</div>
          <div class="us-dhl-modal-body"><p>${text}</p></div>
          <div class="us-dhl-modal-footer">
            <button class="us-dhl-modal-btn secondary">${cancelLabel}</button>
            <button class="us-dhl-modal-btn primary">${okLabel}</button>
          </div>
        `;
        const overlay = this._createModal(modalHTML);
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
    showPrompt({ title, text, okLabel = "Aceptar", cancelLabel = "Cancelar" }) {
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
        const overlay = this._createModal(modalHTML);
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
    showExport({ title, text, data }) {
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
      const overlay = this._createModal(modalHTML);
      const modal = $(".us-dhl-modal", overlay);
      const textarea = $("textarea", overlay);
      textarea.value = data;
      const close = () => overlay.remove();

      modal.addEventListener("click", (e) => e.stopPropagation());
      overlay.addEventListener("click", close);
      $(".primary", overlay).addEventListener("click", close);
      textarea.select();
    },
    // Display a modal dialog with configurable action buttons
    showSettingsMenu({ title, actions }) {
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
      const overlay = this._createModal(modalHTML);
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
          // Close modal after action, unless the action itself opens another modal
          if (!actions[actionIndex]?.keepOpen) {
            close();
          }
        }
      });
      overlay.addEventListener("click", close);
    },
  };

  /**
   * -------------------------------------------------------------
   * IndexedDB Storage Layer
   * -------------------------------------------------------------
   */
  const db = (() => {
    const DB_NAME = "donghualife-seen-db";
    const STORE_NAME = "seenEpisodes";
    const DB_VERSION = 1;
    let dbInstance = null;

    function openDB() {
      if (dbInstance) {
        return Promise.resolve(dbInstance);
      }

      return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject("IndexedDB error: " + request.error);
        request.onsuccess = () => {
          dbInstance = request.result;
          resolve(dbInstance);
        };
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };
      });
    }

    async function perform(mode, operation) {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);
      return new Promise((resolve, reject) => {
        const request = operation(store);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
    }

    return {
      set: (key, value) => perform("readwrite", (store) => store.put(value, key)),
      get: (key) => perform("readonly", (store) => store.get(key)),
      delete: (key) => perform("readwrite", (store) => store.delete(key)),
      clear: () => perform("readwrite", (store) => store.clear()),
      getAll: () => perform("readonly", (store) => store.getAll()),
      getAllKeys: () => perform("readonly", (store) => store.getAllKeys()),
    };
  })();

  // Loads user preferences
  async function loadPrefs() {
    const raw = await GM.getValue(PREFS_KEY, "{}");
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  // Saves user preferences
  async function savePrefs(prefs) {
    await GM.setValue(PREFS_KEY, JSON.stringify(prefs));
  }

  // Returns the effective state (storage if it exists, otherwise the code default)
  function isRowHlOn(prefs) {
    return typeof prefs.rowHighlight === "boolean" ? prefs.rowHighlight : DEFAULT_ROW_HL;
  }

  // Applies visual preferences (row highlighting)
  function applyPrefs(prefs) {
    document.documentElement.classList.toggle(ROOT_HL_CLASS, isRowHlOn(prefs));
  }

  function computeId(element) {
    // Prefer the first absolute pathname to be stable across navigations
    const a = $("a[href]", element);
    if (a) {
      try {
        // Use try-catch for invalid URLs which can happen
        return new URL(a.href, location.origin).pathname;
      } catch (e) {
        // Fallback if URL is invalid
      }
    }
    // Fallback: compact hash-like key from element text
    const txt = (element.textContent || "").replace(/\s+/g, " ").trim();
    const prefix = element.tagName === "TR" ? "row:" : "item:";
    return prefix + txt.slice(0, 160);
  }

  function makeSeenButton(isSeen, isCard) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = isCard ? `${BTN_CLASS} ${CARD_BTN_CLASS}` : BTN_CLASS;
    updateButtonState(btn, isSeen);
    btn.setAttribute("aria-label", "Alternar episodio visto");
    return btn;
  }

  function updateButtonState(btn, isSeen) {
    btn.textContent = isSeen ? "Visto" : "Marcar";
    btn.title = isSeen
      ? "Marcado como visto. Click para desmarcar."
      : "No visto. Click para marcar.";
    btn.setAttribute("aria-pressed", String(!!isSeen));
  }

  // UI helper: toggle seen styling and expose state
  function setItemSeenState(item, seen) {
    if (!item) {
      return;
    }
    item.classList.toggle(ITEM_SEEN_CLASS, !!seen);
    item.setAttribute("data-us-dhl-seen-state", seen ? "1" : "0");
  }

  // Simple debounce to prevent thrashing on heavy DOM updates
  function debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  // Route patterns that represent episode pages (adjustable)
  const EP_PATTERNS = [/\/episode\//i, /\/watch\//i, /\/capitulo\//i, /\/ver\//i];

  function isEpisodePathname(pn) {
    try {
      return EP_PATTERNS.some((rx) => rx.test(pn));
    } catch {
      return false;
    }
  }

  function isPrimaryUnmodifiedClick(e, link) {
    return (
      e.button === 0 &&
      !e.metaKey &&
      !e.ctrlKey &&
      !e.shiftKey &&
      !e.altKey &&
      (!link || link.target !== "_blank")
    );
  }

  // Reflect button state on an item (row or card)
  function applySeenUIForItemWithLink(link) {
    const item = link.closest("tr, .views-row .episode");
    if (item) {
      const btn = item.querySelector("." + BTN_CLASS);
      if (btn) {
        updateButtonState(btn, true);
        setItemSeenState(item, true);
      }
    }
  }

  function observeMutations(callback) {
    const debounced = debounce(callback, 120);
    const mo = new MutationObserver((muts) => {
      if (muts.some((m) => (m.addedNodes && m.addedNodes.length) || m.type === "childList")) {
        debounced();
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
    return mo;
  }

  async function exportJSON() {
    const keys = await db.getAllKeys();
    const allData = await db.getAll();
    const exportObj = {};
    keys.forEach((key, index) => {
      exportObj[key] = allData[index];
    });
    UImanager.showExport({
      title: "Exportar Respaldo",
      text: "Copia este texto para guardar un respaldo de tus episodios vistos.",
      data: JSON.stringify(exportObj, null, 2),
    });
  }

  async function importJSON() {
    const txt = await UImanager.showPrompt({
      title: "Importar Respaldo",
      text: "Pega aquí el JSON de respaldo que guardaste previamente.",
    });
    if (txt === null) {
      // User cancelled
      return;
    }
    try {
      const parsed = JSON.parse(txt);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const confirmed = await UImanager.showConfirm({
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

        await db.clear();
        for (const key in parsed) {
          if (Object.prototype.hasOwnProperty.call(parsed, key)) {
            await db.set(key, parsed[key]);
          }
        }
        UImanager.showToast("Importado con éxito. Recargando...");
        setTimeout(() => location.reload(), 1500);
      } else {
        UImanager.showToast("Error: El texto introducido no es un objeto JSON válido.");
      }
    } catch {
      UImanager.showToast("Error: El texto introducido no es un JSON válido.");
    }
  }

  async function resetAll() {
    const confirmed = await UImanager.showConfirm({
      title: "Confirmar Reinicio",
      text: "¿Estás seguro de que quieres borrar todos los episodios marcados como vistos? Esta acción no se puede deshacer.",
      okLabel: "Sí, borrar todo",
      cancelLabel: "Cancelar",
    });
    if (!confirmed) {
      return;
    }
    await db.clear();
    UImanager.showToast("Datos reiniciados. Recargando...");
    setTimeout(() => location.reload(), 1500);
  }

  /**
   * -------------------------------------------------------------
   * Layout helpers
   * -------------------------------------------------------------
   */
  function ensureTableControlColumn(table) {
    if (!table || table.getAttribute(TABLE_MARK_ATTR) === "1") {
      return;
    }
    const cg = table.querySelector("colgroup");
    if (cg) {
      const col = document.createElement("col");
      col.className = CTRL_CELL_CLASS;
      cg.appendChild(col);
    }
    if (table.tHead?.rows?.length) {
      const th = document.createElement("th");
      th.className = CTRL_CELL_CLASS;
      th.textContent = "";
      table.tHead.rows[0].appendChild(th);
    }
    table.setAttribute(TABLE_MARK_ATTR, "1");
  }

  function getButtonContainer(item) {
    if (item.tagName === "TR") {
      const table = item.closest("table");
      ensureTableControlColumn(table);
      let cell = item.querySelector("td." + CTRL_CELL_CLASS);
      if (!cell) {
        cell = document.createElement("td");
        cell.className = CTRL_CELL_CLASS;
        item.appendChild(cell);
      }
      return cell;
    }
    // For episode cards, the button is added directly to the item.
    return item;
  }

  /**
   * -------------------------------------------------------------
   * Item decoration (for tables rows and episode cards)
   * -------------------------------------------------------------
   */
  async function decorateItem(item, seenSet) {
    if (item.getAttribute(ITEM_SEEN_ATTR) === "1") {
      return;
    }

    const id = computeId(item);
    if (!id) {
      return;
    } // Do not process items without a valid ID

    let isSeen = seenSet.has(id);
    setItemSeenState(item, isSeen);

    const isCard = item.matches(".views-row .episode");
    const controlContainer = getButtonContainer(item);
    const btn = makeSeenButton(isSeen, isCard);
    controlContainer.appendChild(btn);

    // Auto-mark on episode link click
    const link = $("a[href]", item);
    if (link) {
      link.addEventListener(
        "click",
        async (e) => {
          const alreadySeen = seenSet.has(id);
          if (alreadySeen) {
            // If already seen, just navigate.
            return;
          }

          if (isPrimaryUnmodifiedClick(e, link)) {
            // Primary click in same tab: guarantee persistence before navigating
            e.preventDefault();
            await db.set(id, { t: Date.now() });
            seenSet.add(id);
            updateButtonState(btn, true);
            setItemSeenState(item, true);
            location.href = link.href;
          } else {
            // Middle/CTRL/CMD/Shift or target=_blank: don't block navigation
            await db.set(id, { t: Date.now() });
            seenSet.add(id);
            updateButtonState(btn, true);
            setItemSeenState(item, true);
          }
        },
        { passive: false },
      );
    }

    btn.addEventListener(
      "click",
      async (ev) => {
        ev.stopPropagation();
        const currentlySeen = seenSet.has(id);
        const nowSeen = !currentlySeen;

        if (nowSeen) {
          await db.set(id, { t: Date.now() });
          seenSet.add(id);
        } else {
          await db.delete(id);
          seenSet.delete(id);
        }

        // Update UI
        updateButtonState(btn, nowSeen);
        setItemSeenState(item, nowSeen);
      },
      { passive: true },
    );

    item.setAttribute(ITEM_SEEN_ATTR, "1");
  }

  function scanItems(root = document) {
    // Heuristic: rows within tables that include at least one link
    // AND .episode elements inside .views-row
    return $$("table tr, .views-row .episode", root).filter((item) => {
      // For TRs, they must not be a table header
      if (item.tagName === "TR" && item.closest("thead")) {
        return false;
      }
      return !!$("a[href]", item);
    });
  }

  // Function to create and manage the floating settings button
  function createSettingsButton() {
    if ($(".us-dhl-fab")) {
      return;
    }

    const fab = document.createElement("button");
    fab.className = "us-dhl-fab";
    fab.title = "Configuración del script";
    fab.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.44,0.17-0.48,0.41L9.22,5.72C8.63,5.96,8.1,6.29,7.6,6.67L5.22,5.71C5,5.64,4.75,5.7,4.63,5.92L2.71,9.24 c-0.12,0.2-0.07,0.47,0.12,0.61l2.03,1.58C4.8,11.66,4.78,11.98,4.78,12.3c0,0.32,0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.38,2.91 c0.04,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.48-0.41l0.38-2.91c0.59-0.24,1.12-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0.02,0.59-0.22l1.92-3.32c0.12-0.2,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/></svg>`;

    fab.addEventListener("click", async () => {
      const prefs = await loadPrefs();
      const actions = [
        {
          label: (isRowHlOn(prefs) ? "Desactivar" : "Activar") + " color de items 'Visto'",
          async onClick() {
            const latest = await loadPrefs();
            const next = { ...latest, rowHighlight: !isRowHlOn(latest) };
            await savePrefs(next);
            applyPrefs(next);
            UImanager.showToast(
              `Resalte de items ${isRowHlOn(next) ? "activado" : "desactivado"}.`,
            );
          },
        },
        {
          label: "Restablecer preferencias visuales",
          isDestructive: true,
          async onClick() {
            await GM.setValue(PREFS_KEY, "{}");
            applyPrefs({});
            UImanager.showToast("Preferencias visuales restablecidas.");
          },
        },
        { label: "Exportar vistos (JSON)", onClick: exportJSON, keepOpen: true },
        { label: "Importar vistos (JSON)", onClick: importJSON, keepOpen: true },
        {
          label: "Reiniciar todos los vistos",
          onClick: resetAll,
          isDestructive: true,
          keepOpen: true,
        },
      ];
      UImanager.showSettingsMenu({ title: "Configuración", actions });
    });

    document.body.appendChild(fab);
  }

  /**
   * -------------------------------------------------------------
   * Main
   * -------------------------------------------------------------
   */
  async function main() {
    // Wait for the body to be available before doing anything that touches it.
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

    injectCSS();

    // Load and apply highlight preference
    const prefs = await loadPrefs();
    applyPrefs(prefs);

    // Creates a floating action button (FAB) for easy access to script settings and data management.
    // This provides a modern, accessible UI alternative to traditional userscript menu commands,
    // ensuring consistent functionality across different userscript managers and environments.
    createSettingsButton();

    // Fallback for environments that still support GM.registerMenuCommand, to not lose the feature there.
    if (typeof GM.registerMenuCommand === "function") {
      GM.registerMenuCommand(
        (isRowHlOn(prefs) ? "Desactivar" : "Activar") + " color de items 'Visto'",
        async () => {
          const latest = await loadPrefs();
          const next = { ...latest, rowHighlight: !isRowHlOn(latest) };
          await savePrefs(next);
          applyPrefs(next);
          UImanager.showToast(
            "Resalte de items " + (isRowHlOn(next) ? "activado" : "desactivado") + ".",
          );
        },
      );

      GM.registerMenuCommand("Restablecer preferencias visuales", async () => {
        await GM.setValue(PREFS_KEY, "{}");
        applyPrefs({});
        UImanager.showToast("Preferencias visuales restablecidas.");
      });

      // Commands to export/import/reset seen episodes
      GM.registerMenuCommand("Exportar vistos (JSON)", exportJSON);
      GM.registerMenuCommand("Importar vistos (JSON)", importJSON);
      GM.registerMenuCommand("Reiniciar marcados", resetAll);
    }

    // Load all seen episode keys into a Set for fast, synchronous lookups.
    const seenSet = new Set(await db.getAllKeys());

    try {
      if (isEpisodePathname(location.pathname) && !seenSet.has(location.pathname)) {
        await db.set(location.pathname, { t: Date.now() });
        seenSet.add(location.pathname);
      }
    } catch {
      /* noop */
    }

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
        if (url.origin !== location.origin || !isEpisodePathname(url.pathname)) {
          return;
        }

        const alreadySeen = seenSet.has(url.pathname);
        if (alreadySeen) return;

        if (isPrimaryUnmodifiedClick(e, link)) {
          e.preventDefault();
          await db.set(url.pathname, { t: Date.now() });
          seenSet.add(url.pathname);
          applySeenUIForItemWithLink(link);
          location.href = url.href;
        } else {
          await db.set(url.pathname, { t: Date.now() });
          seenSet.add(url.pathname);
          applySeenUIForItemWithLink(link);
        }
      },
      { capture: true, passive: false },
    );

    const applyAll = async (root = document) => {
      const items = scanItems(root);
      for (const item of items) {
        try {
          await decorateItem(item, seenSet);
        } catch {
          /* no-op for robustness */
        }
      }
    };

    await applyAll();
    observeMutations(() => applyAll());
  }

  // Defer main execution until the DOM is interactive or complete
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", main);
  } else {
    main();
  }
})();
