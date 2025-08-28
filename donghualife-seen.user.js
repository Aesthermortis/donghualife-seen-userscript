// ==UserScript==
// @name         DonghuaLife – Mark Watched Episodes (✅)
// @namespace    us_dhl_seen
// @version      1.0.2
// @description  Adds a button to mark watched episodes in season tables on donghualife.com.
// @author       Aesthermortis
// @match        https://donghualife.com/season/*
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
  const ROW_SEEN_ATTR = "data-us-dhl-decorated";
  const BTN_CLASS = "us-dhl-seen-btn";
  const CTRL_CELL_CLASS = "us-dhl-ctrlcol";
  const TABLE_MARK_ATTR = "data-us-dhl-ctrlcol";

  const CSS = `
    .${BTN_CLASS}{
      cursor:pointer; user-select:none; font-size:0.9rem; line-height:1;
      padding:0.28rem 0.6rem; border:1px solid rgba(255,255,255,.18); border-radius:0.75rem;
      background:rgba(255,255,255,.06);
      color:#f5f7fa;
      transition:filter .15s ease, background .15s ease, border-color .15s ease;
    }

    .${BTN_CLASS}:hover{ filter:brightness(1.05); }

    .${BTN_CLASS}[aria-pressed="true"]{
      background:rgba(16,185,129,.18); border-color:rgba(16,185,129,.35);
      color:#e8fff0;
    }

    .${BTN_CLASS}:focus{ outline:2px solid rgba(255,255,255,.35); outline-offset:2px; }

    .${CTRL_CELL_CLASS}{
      width:1%;
      white-space:nowrap;
      text-align:right;
    }
  `;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

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

  function computeEpisodeId(tr) {
    // Prefer the first absolute pathname to be stable across navigations
    const a = $("a[href]", tr);
    if (a) return new URL(a.href, location.origin).pathname;
    // Fallback: compact hash-like key from row text
    const txt = (tr.textContent || "").replace(/\s+/g, " ").trim();
    return "row:" + txt.slice(0, 160);
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

  // Simple debounce to prevent thrashing on heavy DOM updates
  function debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  function observeMutations(callback) {
    const debounced = debounce(callback, 120);
    const mo = new MutationObserver((muts) => {
      if (
        muts.some(
          (m) => (m.addedNodes && m.addedNodes.length) || m.type === "childList"
        )
      )
        debounced();
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
   * Row decoration
   * -------------------------------------------------------------
   */
  async function decorateTableRow(tr, store) {
    if (tr.getAttribute(ROW_SEEN_ATTR) === "1") return; // already processed

    const id = computeEpisodeId(tr);
    const seen = !!store[id];

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
      },
      { passive: true }
    );

    tr.setAttribute(ROW_SEEN_ATTR, "1");
  }

  function scanRows(root = document) {
    // Heuristic: rows within tables that include at least one link
    return $$("table tr", root).filter((tr) => $("a[href]", tr));
  }

  /**
   * -------------------------------------------------------------
   * Main
   * -------------------------------------------------------------
   */
  (async function main() {
    injectCSS();

    if (typeof GM_registerMenuCommand === "function") {
      GM_registerMenuCommand("Exportar vistos (JSON)", exportJSON);
      GM_registerMenuCommand("Importar vistos (JSON)", importJSON);
      GM_registerMenuCommand("Reiniciar marcados", resetAll);
    }

    const store = await loadStore();

    const applyAll = async (root = document) => {
      const rows = scanRows(root);
      for (const tr of rows) {
        try {
          await decorateTableRow(tr, store);
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
