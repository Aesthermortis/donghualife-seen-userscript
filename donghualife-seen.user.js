// ==UserScript==
// @name         DonghuaLife – Mark Watched Episodes (✅)
// @namespace    us_dhl_seen
// @version      1.0.2
// @description  Adds a button to mark watched episodes in season tables and episode cards on donghualife.com.
// @author       Aesthermortis
// @match        *://donghualife.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=donghualife.com
// @run-at       document-idle
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM_registerMenuCommand
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
  const STORE_KEY = "seenEpisodes:v1";
  const PREFS_KEY = "us-dhl:prefs:v1";
  const ITEM_SEEN_ATTR = "data-us-dhl-decorated";
  const BTN_CLASS = "us-dhl-seen-btn";
  const CARD_BTN_CLASS = "us-dhl-card-btn";
  const ITEM_SEEN_CLASS = "us-dhl-item-seen";
  const ROOT_HL_CLASS = "us-dhl-rowhl-on";
  const CTRL_CELL_CLASS = "us-dhl-ctrlcol";
  const TABLE_MARK_ATTR = "data-us-dhl-ctrlcol";

  // Default row highlight (true = ON por defecto, false = OFF por defecto)
  const DEFAULT_ROW_HL = false; // cámbialo a false si quieres opt-in por defecto

  // CSS styles
  const CSS = `
    /* Estilo base del botón */
    .${BTN_CLASS}{
      cursor:pointer;
      user-select:none;
      font-size:0.9rem;
      line-height:1;
      padding:0.28rem 0.6rem;
      border:1px solid rgba(255,255,255,.18);
      border-radius:0.75rem;
      background:rgba(255,255,255,.06);
      color:#f5f7fa;
      transition:filter .15s ease, background .15s ease, border-color .15s ease;
      white-space: nowrap;
    }

    .${BTN_CLASS}:hover{ filter:brightness(1.05); }

    .${BTN_CLASS}[aria-pressed="true"]{
      background:rgba(16,185,129,.18); border-color:rgba(16,185,129,.35);
      color:#e8fff0;
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
      background: rgba(20, 20, 22, 0.65);
      border-color: rgba(255, 255, 255, 0.2);
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      backdrop-filter: blur(4px);
    }

    .${CARD_BTN_CLASS}[aria-pressed="true"] {
      background: rgba(16, 185, 129, 0.6);
      border-color: rgba(16, 185, 129, 0.8);
    }

    .${CTRL_CELL_CLASS}{
      width:1%;
      white-space:nowrap;
      text-align:right;
    }

    /* Estilo de item marcado (solo si el highlight global está ON) */
    .${ROOT_HL_CLASS} .${ITEM_SEEN_CLASS}{
      background: rgba(16,185,129,.06);
      transition: background .15s ease;
    }

    /* Intensidad al hover (solo si el highlight global está ON) */
    .${ROOT_HL_CLASS} .${ITEM_SEEN_CLASS}:hover{
      background: rgba(16,185,129,.12);
    }

    /* A11y: también resalta cuando el item contiene foco (navegación con teclado) */
    .${ROOT_HL_CLASS} .${ITEM_SEEN_CLASS}:focus-within{
      background: rgba(16,185,129,.12);
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
  `;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // Inyecta CSS si no está ya presente
  function injectCSS() {
    if ($("#us-dhl-seen-style")) return;
    const s = document.createElement("style");
    s.id = "us-dhl-seen-style";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  async function loadStore() {
    const raw = await GM.getValue(STORE_KEY, "{}");
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  async function saveStore(obj) {
    await GM.setValue(STORE_KEY, JSON.stringify(obj));
  }

  /* Carga las preferencias del usuario */
  async function loadPrefs() {
    const raw = await GM.getValue(PREFS_KEY, "{}");
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  /* Guarda las preferencias del usuario */
  async function savePrefs(prefs) {
    await GM.setValue(PREFS_KEY, JSON.stringify(prefs));
  }

  // Devuelve el estado efectivo (storage si existe, si no el default de código)
  function isRowHlOn(prefs) {
    return typeof prefs.rowHighlight === "boolean"
      ? prefs.rowHighlight
      : DEFAULT_ROW_HL;
  }

  // Aplica las preferencias visuales (resalte de filas)
  function applyPrefs(prefs) {
    const on = isRowHlOn(prefs);
    document.documentElement.classList.toggle(ROOT_HL_CLASS, on);
  }

  function computeId(element) {
    // Prefer the first absolute pathname to be stable across navigations
    const a = $("a[href]", element);
    if (a) return new URL(a.href, location.origin).pathname;
    // Fallback: compact hash-like key from element text
    const txt = (element.textContent || "").replace(/\s+/g, " ").trim();
    const prefix = element.tagName === 'TR' ? 'row:' : 'item:';
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
    if (!item) return;
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

  // Patrones de rutas que representan páginas de episodios (ajustables)
  const EP_PATTERNS = [
    /\/episode\//i,
    /\/watch\//i,
    /\/capitulo\//i,
    /\/ver\//i,
  ];

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

  // Reflejar el estado del botón en un item (fila o tarjeta)
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
      if (
        muts.some(
          (m) => (m.addedNodes && m.addedNodes.length) || m.type === "childList"
        )
      ) {
        debounced();
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
    return mo;
  }

  async function exportJSON() {
    const data = await GM.getValue(STORE_KEY, "{}");
    prompt("Copia tu respaldo de episodios vistos:", data);
  }

  async function importJSON() {
    const txt = prompt("Pega el JSON de respaldo:");
    if (!txt) return;
    try {
      const parsed = JSON.parse(txt);
      if (parsed && typeof parsed === "object") {
        await GM.setValue(STORE_KEY, JSON.stringify(parsed));
        alert("Importado. Recargando para aplicar…");
        location.reload();
      } else {
        alert("JSON inválido.");
      }
    } catch {
      alert("JSON inválido.");
    }
  }

  async function resetAll() {
    if (!confirm("¿Borrar todos los episodios marcados?")) return;
    await GM.setValue(STORE_KEY, "{}");
    alert("Listo. Recargando…");
    location.reload();
  }

  /**
   * -------------------------------------------------------------
   * Layout helpers
   * -------------------------------------------------------------
   */
  function ensureTableControlColumn(table) {
    if (!table || table.getAttribute(TABLE_MARK_ATTR) === "1") return;
    // If table has a THEAD, add an empty header cell to keep column alignment
    if (table.tHead && table.tHead.rows.length) {
      const th = document.createElement("th");
      th.className = CTRL_CELL_CLASS;
      th.textContent = "";
      table.tHead.rows[0].appendChild(th);
    }
    table.setAttribute(TABLE_MARK_ATTR, "1");
  }

  function getButtonContainer(item) {
    if (item.tagName === 'TR') {
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
    // Para tarjetas de episodio, el botón se añade directamente al item.
    return item;
  }

  /**
   * -------------------------------------------------------------
   * Item decoration (for tables rows and episode cards)
   * -------------------------------------------------------------
   */
  async function decorateItem(item, store) {
    if (item.getAttribute(ITEM_SEEN_ATTR) === "1") return; // already processed

    const id = computeId(item);
    const seen = !!store[id];
    setItemSeenState(item, seen);

    const isCard = item.matches('.views-row .episode');
    const controlContainer = getButtonContainer(item);
    const btn = makeSeenButton(seen, isCard);
    controlContainer.appendChild(btn);

    // Auto-mark on episode link click
    const link = $("a[href]", item);
    if (link) {
      link.addEventListener(
        "click",
        async (e) => {
          const alreadySeen = !!store[id];
          if (!alreadySeen) {
            store[id] = { t: Date.now() };
          }

          if (isPrimaryUnmodifiedClick(e, link)) {
            // Primary click in same tab: guarantee persistence before navigating
            e.preventDefault();
            await saveStore(store);
            updateButtonState(btn, true);
            setItemSeenState(item, true);
            location.href = link.href;
          } else {
            // Middle/CTRL/CMD/Shift or target=_blank: don't block navigation
            if (!alreadySeen) saveStore(store);
            updateButtonState(btn, true);
            setItemSeenState(item, true);
          }
        },
        { passive: false }
      );
    }

    btn.addEventListener(
      "click",
      async (ev) => {
        ev.stopPropagation();
        const nowSeen = !store[id];
        if (nowSeen) {
          store[id] = { t: Date.now() };
        } else {
          delete store[id];
        }
        await saveStore(store);

        // Update UI
        updateButtonState(btn, nowSeen);
        setItemSeenState(item, nowSeen);
      },
      { passive: true }
    );

    item.setAttribute(ITEM_SEEN_ATTR, "1");
  }

  function scanItems(root = document) {
    // Heuristic: rows within tables that include at least one link
    // AND .episode elements inside .views-row
    return $$("table tr, .views-row .episode", root).filter((item) => {
        // For TRs, they must not be a table header
        if (item.tagName === 'TR' && item.closest('thead')) return false;
        return $("a[href]", item);
    });
  }

  /**
   * -------------------------------------------------------------
   * Main
   * -------------------------------------------------------------
   */
  (async function main() {
    injectCSS();

    // Load and apply highlight preference
    const prefs = await loadPrefs();
    applyPrefs(prefs);

    if (typeof GM_registerMenuCommand === "function") {
      GM_registerMenuCommand(
        (isRowHlOn(prefs) ? "Desactivar" : "Activar") +
          " color de items 'Visto' (actual: " +
          (isRowHlOn(prefs) ? "ON" : "OFF") +
          ")",
        async () => {
          const latest = await loadPrefs();
          const current = isRowHlOn(latest);
          const next = { ...latest, rowHighlight: !current };
          await savePrefs(next);
          applyPrefs(next);
          alert(
            "Resalte de items: " +
              (isRowHlOn(next) ? "activado" : "desactivado") +
              ". El texto del menú se actualizará tras recargar."
          );
        }
      );

      GM_registerMenuCommand(
        "Restablecer preferencias visuales (usar defaults del script)",
        async () => {
          await GM.setValue(PREFS_KEY, "{}"); // clear storage
          const base = {}; // no value => will take DEFAULT_ROW_HL
          applyPrefs(base);
          alert(
            "Preferencias visuales restablecidas. Estado actual: " +
              (isRowHlOn(base) ? "ON" : "OFF") +
              ". El texto del menú se actualizará tras recargar."
          );
        }
      );

      // Commands to export/import/reset seen episodes
      GM_registerMenuCommand("Exportar vistos (JSON)", exportJSON);
      GM_registerMenuCommand("Importar vistos (JSON)", importJSON);
      GM_registerMenuCommand("Reiniciar marcados", resetAll);
    }

    const store = await loadStore();

    try {
      if (isEpisodePathname(location.pathname)) {
        if (!store[location.pathname]) {
          store[location.pathname] = { t: Date.now() };
          await saveStore(store);
        }
      }
    } catch {
      /* noop */
    }

    document.addEventListener(
      "click",
      async (e) => {
        const link =
          e.target && e.target.closest && e.target.closest("a[href]");
        if (!link) return;

        let url;
        try {
          url = new URL(link.href, location.origin);
        } catch {
          return;
        }
        if (url.origin !== location.origin) return; // only same origin
        if (!isEpisodePathname(url.pathname)) return;

        const already = !!store[url.pathname];

        if (isPrimaryUnmodifiedClick(e, link)) {
          // Primary click in same tab: ensure persistence before navigating
          e.preventDefault();
          if (!already) {
            store[url.pathname] = { t: Date.now() };
            await saveStore(store);
          }
          applySeenUIForItemWithLink(link); // reflect in button if it's a decorated item
          location.href = url.href;
        } else {
          // Middle/Ctrl/Cmd/Shift or target=_blank: don't block navigation
          if (!already) {
            store[url.pathname] = { t: Date.now() };
            saveStore(store); // async fire-and-forget
          }
          applySeenUIForItemWithLink(link);
        }
      },
      { capture: true, passive: false }
    );

    const applyAll = async (root = document) => {
      const items = scanItems(root);
      for (const item of items) {
        try {
          await decorateItem(item, store);
        } catch {
          /* no-op for robustness */
        }
      }
    };

    await applyAll();

    // Observe changes due to internal navigation or deferred loads
    observeMutations(() => {
      applyAll();
    });
  })();
})();
