// ==UserScript==
// @name         DonghuaLife – Mark Watched Episodes (✅)
// @namespace    us_dhl_seen
// @version      1.0.2
// @description  Adds a button to mark watched episodes in season tables on donghualife.com.
// @author       Aesthermortis
// @match        *://donghualife.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=donghualife.com
// @run-at       document-idle
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM_registerMenuCommand
// @license      MIT
// @noframes
// @downloadURL  https://raw.githubusercontent.com/Aesthermortis/donghualife-seen-userscript/refs/tags/v1.0.2/donghualife-seen.user.js
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
  const ROW_SEEN_ATTR = "data-us-dhl-decorated";
  const BTN_CLASS = "us-dhl-seen-btn";
  const EPISODE_BTN_CLASS = "us-dhl-episode-btn";
  const ROW_SEEN_CLASS = "us-dhl-seen-row";
  const EPISODE_SEEN_CLASS = "us-dhl-episode-seen";
  const ROOT_HL_CLASS = "us-dhl-rowhl-on";
  const CTRL_CELL_CLASS = "us-dhl-ctrlcol";
  const TABLE_MARK_ATTR = "data-us-dhl-ctrlcol";
  const EPISODE_SEEN_ATTR = "data-us-dhl-episode-decorated";

  // Default row highlight (true = ON por defecto, false = OFF por defecto)
  const DEFAULT_ROW_HL = false; // cámbialo a false si quieres opt-in por defecto

  // CSS styles
  const CSS = `
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
    }

    .${BTN_CLASS}:hover{ filter:brightness(1.05); }

    .${BTN_CLASS}[aria-pressed="true"]{
      background:rgba(16,185,129,.18); border-color:rgba(16,185,129,.35);
      color:#e8fff0;
    }

    .${BTN_CLASS}[aria-pressed="true"]:hover{ filter:brightness(1.3); }

    .${BTN_CLASS}:focus{ outline:2px solid rgba(255,255,255,.35); outline-offset:2px; }

    .${CTRL_CELL_CLASS}{
      width:1%;
      white-space:nowrap;
      text-align:right;
    }

    /* Estilo de fila marcada (solo si el highlight global está ON) */
    .${ROOT_HL_CLASS} .${ROW_SEEN_CLASS}{
      background: rgba(16,185,129,.06);
      transition: background .15s ease;
    }

    /* Intensidad al hover (solo si el highlight global está ON) */
    .${ROOT_HL_CLASS} .${ROW_SEEN_CLASS}:hover{
      background: rgba(16,185,129,.12);
    }

    /* A11y: también resalta cuando la fila contiene foco (navegación con teclado) */
    .${ROOT_HL_CLASS} .${ROW_SEEN_CLASS}:focus-within{
      background: rgba(16,185,129,.12);
    }

    /* Evitar “parpadeo” en móvil/touch: aplica hover solo en puntero fino */
    @media (hover: hover) and (pointer: fine){
      .us-dhl-rowhl-on .us-dhl-seen-row{
        transition: background .15s ease;
      }
    }

    /* Respeta “reducir movimiento” del sistema */
    @media (prefers-reduced-motion: reduce){
      .us-dhl-rowhl-on .us-dhl-seen-row{
        transition: none;
      }
    }

    /* Enlaces en filas marcadas: opacidad ligeramente reducida (solo si el highlight global está ON) */
    .${ROOT_HL_CLASS} .${ROW_SEEN_CLASS} a{
      opacity: .95;
    }

    /* Botón en filas marcadas: filtro de brillo reducido (solo si el highlight global está ON) */
    .${ROOT_HL_CLASS} .${ROW_SEEN_CLASS} .${BTN_CLASS}[aria-pressed="true"]{
      filter: none;
    }

    /* Estilos para botón redondo de episodios */
    .${EPISODE_BTN_CLASS}{
      position: absolute;
      top: 8px;
      right: 8px;
      width: 32px;
      height: 32px;
      border: none;
      border-radius: 50%;
      background: rgba(16,185,129,.8);
      color: white;
      font-size: 16px;
      line-height: 1;
      cursor: pointer;
      user-select: none;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all .15s ease;
      z-index: 10;
      box-shadow: 0 2px 4px rgba(0,0,0,.3);
    }

    .${EPISODE_BTN_CLASS}:hover{
      transform: scale(1.1);
      box-shadow: 0 4px 8px rgba(0,0,0,.4);
    }

    .${EPISODE_BTN_CLASS}:focus{
      outline: 2px solid rgba(255,255,255,.8);
      outline-offset: 2px;
    }

    .${EPISODE_BTN_CLASS}[aria-pressed="false"]{
      background: rgba(108, 117, 125, .8);
    }

    .${EPISODE_BTN_CLASS}[aria-pressed="false"]:hover{
      background: rgba(16,185,129,.8);
    }

    /* Contenedor de episodio con posición relativa para el botón absoluto */
    .views-row .episode{
      position: relative;
    }

    /* Estilo para episodios marcados como vistos */
    .${EPISODE_SEEN_CLASS}{
      opacity: 0.7;
      transition: opacity .15s ease;
    }

    .${EPISODE_SEEN_CLASS}:hover{
      opacity: 1;
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

  function computeEpisodeId(tr) {
    // Prefer the first absolute pathname to be stable across navigations
    const a = $("a[href]", tr);
    if (a) return new URL(a.href, location.origin).pathname;
    // Fallback: compact hash-like key from row text
    const txt = (tr.textContent || "").replace(/\s+/g, " ").trim();
    return "row:" + txt.slice(0, 160);
  }

  function computeEpisodeIdFromElement(element) {
    // Prefer the first absolute pathname to be stable across navigations
    const a = $("a[href]", element);
    if (a) return new URL(a.href, location.origin).pathname;
    // Fallback: compact hash-like key from element text
    const txt = (element.textContent || "").replace(/\s+/g, " ").trim();
    return "episode:" + txt.slice(0, 160);
  }

  function makeSeenButton(isSeen) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = BTN_CLASS;
    btn.title = isSeen
      ? "Marcado como visto. Click para desmarcar."
      : "No visto. Click para marcar.";
    btn.textContent = isSeen ? "Visto" : "Marcar";
    btn.setAttribute("aria-pressed", String(!!isSeen));
    btn.setAttribute("aria-label", "Alternar episodio visto");
    return btn;
  }

  function makeEpisodeSeenButton(isSeen) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = EPISODE_BTN_CLASS;
    btn.title = isSeen
      ? "Marcado como visto. Click para desmarcar."
      : "No visto. Click para marcar.";
    btn.textContent = isSeen ? "✔️" : "⭕";
    btn.setAttribute("aria-pressed", String(!!isSeen));
    btn.setAttribute("aria-label", "Alternar episodio visto");
    
    // Add hover behavior to show unmark indication
    if (isSeen) {
      btn.addEventListener("mouseenter", () => {
        btn.textContent = "❌";
      });
      btn.addEventListener("mouseleave", () => {
        btn.textContent = "✔️";
      });
    }
    
    return btn;
  }

  // Row-level UI helper: toggle seen styling and expose state
  function setRowSeenState(tr, seen) {
    if (!tr) return;
    tr.classList.toggle(ROW_SEEN_CLASS, !!seen);
    tr.setAttribute("data-us-dhl-seen-state", seen ? "1" : "0");
  }

  // Episode-level UI helper: toggle seen styling and expose state
  function setEpisodeSeenState(episode, seen) {
    if (!episode) return;
    episode.classList.toggle(EPISODE_SEEN_CLASS, !!seen);
    episode.setAttribute("data-us-dhl-episode-seen", seen ? "1" : "0");
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

  // Reflejar el estado del botón en una fila de temporada (si existe)
  function applySeenUIInRowForLink(link) {
    const tr = link.closest("tr");
    if (tr) {
      const btn = tr.querySelector("." + BTN_CLASS);
      if (btn) {
        btn.textContent = "Visto";
        btn.title = "Marcado como visto. Click para desmarcar.";
        btn.setAttribute("aria-pressed", "true");
        setRowSeenState(tr, true);
      }
    }

    // Also check for episode elements
    const episode = link.closest(".episode");
    if (episode && episode.closest(".views-row")) {
      const btn = episode.querySelector("." + EPISODE_BTN_CLASS);
      if (btn) {
        btn.textContent = "✔️";
        btn.title = "Marcado como visto. Click para desmarcar.";
        btn.setAttribute("aria-pressed", "true");
        setEpisodeSeenState(episode, true);
        // Add hover behavior
        btn.addEventListener("mouseenter", () => {
          btn.textContent = "❌";
        });
        btn.addEventListener("mouseleave", () => {
          btn.textContent = "✔️";
        });
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
   * Layout helpers: stable control column
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

  function ensureControlCellForRow(tr) {
    let cell = tr.querySelector(
      "td." + CTRL_CELL_CLASS + ", th." + CTRL_CELL_CLASS
    );
    if (!cell) {
      cell = document.createElement("td");
      cell.className = CTRL_CELL_CLASS;
      tr.appendChild(cell);
    }
    return cell;
  }

  /**
   * -------------------------------------------------------------
   * Episode decoration (for .views-row .episode elements)
   * -------------------------------------------------------------
   */
  async function decorateEpisodeElement(episode, store) {
    if (episode.getAttribute(EPISODE_SEEN_ATTR) === "1") return; // already processed

    const id = computeEpisodeIdFromElement(episode);
    const seen = !!store[id];
    setEpisodeSeenState(episode, seen);

    const btn = makeEpisodeSeenButton(seen);

    episode.appendChild(btn);

    // Auto-mark al hacer clic en el enlace del episodio
    const link = $("a[href]", episode);
    if (link) {
      link.addEventListener(
        "click",
        async (e) => {
          const alreadySeen = !!store[id];
          // Actualiza UI y storage (idempotente)
          const applySeenUI = () => {
            btn.textContent = "✔️";
            btn.title = "Marcado como visto. Click para desmarcar.";
            btn.setAttribute("aria-pressed", "true");
            setEpisodeSeenState(episode, true);
            // Re-add hover behavior for seen state
            btn.addEventListener("mouseenter", () => {
              btn.textContent = "❌";
            });
            btn.addEventListener("mouseleave", () => {
              btn.textContent = "✔️";
            });
          };

          if (!alreadySeen) {
            store[id] = { t: Date.now() };
          }

          if (isPrimaryUnmodifiedClick(e, link)) {
            // Clic primario en misma pestaña: garantizamos persistencia antes de navegar
            e.preventDefault();
            await saveStore(store);
            applySeenUI();
            location.href = link.href;
          } else {
            // Middle/CTRL/CMD/Shift o target=_blank: no bloqueamos la navegación
            if (!alreadySeen) saveStore(store);
            applySeenUI();
          }
        },
        { passive: false }
      );
    }

    btn.addEventListener(
      "click",
      async (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        const nowSeen = !store[id];
        if (nowSeen) {
          store[id] = { t: Date.now() };
        } else {
          delete store[id];
        }
        await saveStore(store);

        // Update UI
        btn.textContent = nowSeen ? "✔️" : "⭕";
        btn.title = nowSeen
          ? "Marcado como visto. Click para desmarcar."
          : "No visto. Click para marcar.";
        btn.setAttribute("aria-pressed", String(nowSeen));
        setEpisodeSeenState(episode, nowSeen);

        // Remove old event listeners and add new ones based on state
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        
        if (nowSeen) {
          newBtn.addEventListener("mouseenter", () => {
            newBtn.textContent = "❌";
          });
          newBtn.addEventListener("mouseleave", () => {
            newBtn.textContent = "✔️";
          });
          newBtn.addEventListener("click", async (newEv) => {
            newEv.stopPropagation();
            newEv.preventDefault();
            delete store[id];
            await saveStore(store);
            newBtn.textContent = "⭕";
            newBtn.title = "No visto. Click para marcar.";
            newBtn.setAttribute("aria-pressed", "false");
            setEpisodeSeenState(episode, false);
          });
        } else {
          newBtn.addEventListener("click", async (newEv) => {
            newEv.stopPropagation();
            newEv.preventDefault();
            store[id] = { t: Date.now() };
            await saveStore(store);
            newBtn.textContent = "✔️";
            newBtn.title = "Marcado como visto. Click para desmarcar.";
            newBtn.setAttribute("aria-pressed", "true");
            setEpisodeSeenState(episode, true);
            // Add hover behavior for seen state
            newBtn.addEventListener("mouseenter", () => {
              newBtn.textContent = "❌";
            });
            newBtn.addEventListener("mouseleave", () => {
              newBtn.textContent = "✔️";
            });
          });
        }
      },
      { passive: false }
    );

    episode.setAttribute(EPISODE_SEEN_ATTR, "1");
  }

  /**
   * -------------------------------------------------------------
   * Row decoration (for table rows)
   * -------------------------------------------------------------
   */
  async function decorateTableRow(tr, store) {
    if (tr.getAttribute(ROW_SEEN_ATTR) === "1") return; // already processed

    const id = computeEpisodeId(tr);
    const seen = !!store[id];
    setRowSeenState(tr, seen);

    // Prepare stable control column
    const table = tr.closest("table");
    ensureTableControlColumn(table);
    const controlCell = ensureControlCellForRow(tr);

    const btn = makeSeenButton(seen);

    const holder = document.createElement("div");
    holder.style.display = "inline-flex";
    holder.style.alignItems = "center";
    holder.style.gap = "0.5rem";
    holder.appendChild(btn);
    controlCell.appendChild(holder);

    // Auto-mark al hacer clic en el enlace del episodio
    const link = $("a[href]", tr);
    if (link) {
      link.addEventListener(
        "click",
        async (e) => {
          const alreadySeen = !!store[id];
          // Actualiza UI y storage (idempotente)
          const applySeenUI = () => {
            btn.textContent = "Visto";
            btn.title = "Marcado como visto. Click para desmarcar.";
            btn.setAttribute("aria-pressed", "true");
          };

          if (!alreadySeen) {
            store[id] = { t: Date.now() };
          }

          if (isPrimaryUnmodifiedClick(e, link)) {
            // Clic primario en misma pestaña: garantizamos persistencia antes de navegar
            e.preventDefault();
            await saveStore(store);
            applySeenUI();
            location.href = link.href;
          } else {
            // Middle/CTRL/CMD/Shift o target=_blank: no bloqueamos la navegación
            if (!alreadySeen) saveStore(store);
            applySeenUI();
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
        btn.textContent = nowSeen ? "Visto" : "Marcar";
        btn.title = nowSeen
          ? "Marcado como visto. Click para desmarcar."
          : "No visto. Click para marcar.";
        btn.setAttribute("aria-pressed", String(nowSeen));
        setRowSeenState(tr, nowSeen);
      },
      { passive: true }
    );

    tr.setAttribute(ROW_SEEN_ATTR, "1");
  }

  function scanRows(root = document) {
    // Heuristic: rows within tables that include at least one link
    return $$("table tr", root).filter((tr) => $("a[href]", tr));
  }

  function scanEpisodes(root = document) {
    // Look for .episode elements inside .views-row
    return $$(".views-row .episode", root).filter((episode) => $("a[href]", episode));
  }

  /**
   * -------------------------------------------------------------
   * Main
   * -------------------------------------------------------------
   */
  (async function main() {
    injectCSS();

    // Cargar y aplicar preferencia de resaltado de filas
    const prefs = await loadPrefs();
    applyPrefs(prefs);

    if (typeof GM_registerMenuCommand === "function") {
      GM_registerMenuCommand(
        (isRowHlOn(prefs) ? "Desactivar" : "Activar") +
          " color de filas 'Visto' (actual: " +
          (isRowHlOn(prefs) ? "ON" : "OFF") +
          ")",
        async () => {
          const latest = await loadPrefs();
          const current = isRowHlOn(latest);
          const next = { ...latest, rowHighlight: !current };
          await savePrefs(next);
          applyPrefs(next);
          alert(
            "Resalte de filas: " +
              (isRowHlOn(next) ? "activado" : "desactivado") +
              ". El texto del menú se actualizará tras recargar."
          );
        }
      );

      GM_registerMenuCommand(
        "Restablecer preferencias visuales (usar defaults del script)",
        async () => {
          await GM.setValue(PREFS_KEY, "{}"); // limpia storage
          const base = {}; // sin valor => tomará DEFAULT_ROW_HL
          applyPrefs(base);
          alert(
            "Preferencias visuales restablecidas. Estado actual: " +
              (isRowHlOn(base) ? "ON" : "OFF") +
              ". El texto del menú se actualizará tras recargar."
          );
        }
      );

      // Comandos para exportar/importar/resetear vistos
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
        if (url.origin !== location.origin) return; // solo mismo origen
        if (!isEpisodePathname(url.pathname)) return;

        const already = !!store[url.pathname];

        if (isPrimaryUnmodifiedClick(e, link)) {
          // Clic primario en misma pestaña: asegurar persistencia antes de navegar
          e.preventDefault();
          if (!already) {
            store[url.pathname] = { t: Date.now() };
            await saveStore(store);
          }
          applySeenUIInRowForLink(link); // si es una fila de temporada, refleja el botón
          location.href = url.href;
        } else {
          // Middle/Ctrl/Cmd/Shift o target=_blank: no bloqueamos navegación
          if (!already) {
            store[url.pathname] = { t: Date.now() };
            saveStore(store); // async fire-and-forget
          }
          applySeenUIInRowForLink(link);
        }
      },
      { capture: true, passive: false }
    );

    const applyAll = async (root = document) => {
      // Handle table rows
      const rows = scanRows(root);
      for (const tr of rows) {
        try {
          await decorateTableRow(tr, store);
        } catch {
          /* no-op for robustness */
        }
      }

      // Handle episode elements
      const episodes = scanEpisodes(root);
      for (const episode of episodes) {
        try {
          await decorateEpisodeElement(episode, store);
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
