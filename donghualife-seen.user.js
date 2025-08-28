// ==UserScript==
// @name         DonghuaLife – Mark Watched Episodes (✅)
// @namespace    us_dhl_seen
// @version      1.0.1
// @description  Adds a ✅ marker to indicate watched episodes in season tables on donghualife.com. Persist state locally; toggle via a per‑row button; export/import JSON; reset marks. Debounced observers and a few a11y/robustness upgrades.
// @author       you
// @match        https://donghualife.com/season/*
// @run-at       document-idle
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM_registerMenuCommand
// @license      MIT
// @noframes
// @homepageURL  https://donghualife.com/
// ==/UserScript==

(() => {
  'use strict';

  /**
   * -------------------------------------------------------------
   * Config & Utilities
   * -------------------------------------------------------------
   */
  const STORE_KEY = 'seenEpisodes:v1';
  const ROW_SEEN_ATTR = 'data-us-dhl-decorated';
  const BTN_CLASS = 'us-dhl-seen-btn';
  const CHIP_CLASS = 'us-dhl-seen-chip';
  const DATE_INSERT_CLASS = 'us-dhl-date-insert';

  const CSS = `
    .${BTN_CLASS}{
      cursor:pointer; user-select:none; font-size:0.9rem; line-height:1;
      padding:0.2rem 0.45rem; border:1px solid rgba(0,0,0,.15); border-radius:0.5rem;
      background:rgba(0,0,0,.03);
    }
    .${BTN_CLASS}:hover{ filter:brightness(0.95); }
    .${BTN_CLASS}[aria-pressed="true"]{ background:rgba(0,128,0,.08); border-color:rgba(0,128,0,.25); }
    .${CHIP_CLASS}{ margin-left:0.35rem; font-size:1rem; }
    .${DATE_INSERT_CLASS}{ display:inline-flex; align-items:center; }
  `;

  // English + Spanish month forms commonly seen on the site
  const DATE_REGEXES = [
    /\b\d{4}-\d{2}-\d{2}\b/,
    /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/,
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},\s*\d{4}\b/i,
    /\b(?:Ene|Feb|Mar|Abr|May|Jun|Jul|Ago|Sep|Oct|Nov|Dic)\s+\d{1,2},?\s*\d{4}\b/i
  ];

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  function injectCSS(){
    if ($('#us-dhl-seen-style')) return;
    const s = document.createElement('style');
    s.id = 'us-dhl-seen-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  async function loadStore(){
    const raw = await GM.getValue(STORE_KEY, '{}');
    try { return JSON.parse(raw); } catch { return {}; }
  }
  async function saveStore(obj){
    await GM.setValue(STORE_KEY, JSON.stringify(obj));
  }

  function isDateCell(td){
    const text = td.textContent.trim();
    if ($('time', td)) return true;
    return DATE_REGEXES.some(rx => rx.test(text));
  }

  function findDateCell(cells){
    const withTime = cells.find(td => $('time', td));
    if (withTime) return withTime;
    const byRegex = cells.find(td => isDateCell(td));
    return byRegex || null;
  }

  function computeEpisodeId(tr){
    // Prefer the first absolute pathname to be stable across navigations
    const a = $('a[href]', tr);
    if (a) return new URL(a.href, location.origin).pathname;
    // Fallback: compact hash-like key from row text
    const txt = (tr.textContent || '').replace(/\s+/g,' ').trim();
    return 'row:' + txt.slice(0,160);
  }

  function makeSeenButton(isSeen){
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = BTN_CLASS;
    btn.title = isSeen ? 'Marcado como visto. Click para desmarcar.' : 'No visto. Click para marcar.';
    btn.textContent = isSeen ? 'Visto' : 'Marcar';
    btn.setAttribute('aria-pressed', String(!!isSeen));
    btn.setAttribute('aria-label', 'Alternar episodio visto');
    return btn;
  }

  function makeCheckChip(){
    const chip = document.createElement('span');
    chip.className = CHIP_CLASS;
    chip.textContent = '✅';
    return chip;
  }

  function insertAfterDate(targetCell, chipNode){
    if (!targetCell) return false;
    // Ensure a single wrapper per cell
    let wrap = $('.' + DATE_INSERT_CLASS, targetCell);
    if (!wrap){
      wrap = document.createElement('span');
      wrap.className = DATE_INSERT_CLASS;
      targetCell.appendChild(wrap);
    }
    // Avoid duplicates
    if (!$('.' + CHIP_CLASS, wrap)) wrap.appendChild(chipNode);
    return true;
  }

  function getControlCell(tr){
    const cells = Array.from(tr.children).filter(el => el.tagName === 'TD' || el.tagName === 'TH');
    return cells[cells.length - 1] || null;
  }

  async function decorateTableRow(tr, store){
    if (tr.getAttribute(ROW_SEEN_ATTR) === '1') return; // already processed (row-level)

    const id = computeEpisodeId(tr);
    const seen = !!store[id];

    const tds = Array.from(tr.querySelectorAll('td,th'));
    const dateCell = findDateCell(tds);
    const controlCell = getControlCell(tr);

    const btn = makeSeenButton(seen);

    if (controlCell){
      const holder = document.createElement('div');
      holder.style.display = 'inline-flex';
      holder.style.alignItems = 'center';
      holder.style.gap = '0.5rem';
      holder.appendChild(btn);
      if (!dateCell && seen) holder.appendChild(makeCheckChip());
      controlCell.appendChild(holder);
    }

    if (seen && dateCell){ insertAfterDate(dateCell, makeCheckChip()); }

    btn.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      const nowSeen = !store[id];
      if (nowSeen) {
        store[id] = { t: Date.now() };
      } else {
        delete store[id];
      }
      await saveStore(store);

      // Update UI
      btn.textContent = nowSeen ? 'Visto' : 'Marcar';
      btn.title = nowSeen ? 'Marcado como visto. Click para desmarcar.' : 'No visto. Click para marcar.';
      btn.setAttribute('aria-pressed', String(nowSeen));

      // Remove existing chips within the row
      $$('.' + CHIP_CLASS, tr).forEach(c => c.remove());

      if (nowSeen){
        if (dateCell){
          insertAfterDate(dateCell, makeCheckChip());
        } else {
          btn.parentElement && btn.parentElement.appendChild(makeCheckChip());
        }
      }
    }, { passive: true });

    tr.setAttribute(ROW_SEEN_ATTR, '1');
  }

  function scanRows(root=document){
    // Heuristic: rows within tables that include at least one link
    return $$('table tr', root).filter(tr => $('a[href]', tr));
  }

  // Simple debounce to prevent thrashing on heavy DOM updates
  function debounce(fn, ms){
    let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  function observeMutations(callback){
    const debounced = debounce(callback, 120);
    const mo = new MutationObserver((muts) => {
      if (muts.some(m => (m.addedNodes && m.addedNodes.length) || m.type === 'childList')) debounced();
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
    return mo;
  }

  async function exportJSON(){
    const data = await GM.getValue(STORE_KEY, '{}');
    // Using prompt is acceptable in userscripts for quick export
    prompt('Copia tu respaldo de episodios vistos:', data);
  }

  async function importJSON(){
    const txt = prompt('Pega el JSON de respaldo:');
    if (!txt) return;
    try{
      const parsed = JSON.parse(txt);
      if (parsed && typeof parsed === 'object'){
        await GM.setValue(STORE_KEY, JSON.stringify(parsed));
        alert('Importado. Recargando para aplicar…');
        location.reload();
      } else {
        alert('JSON inválido.');
      }
    }catch{
      alert('JSON inválido.');
    }
  }

  async function resetAll(){
    if (!confirm('¿Borrar todos los episodios marcados?')) return;
    await GM.setValue(STORE_KEY, '{}');
    alert('Listo. Recargando…');
    location.reload();
  }

  /**
   * -------------------------------------------------------------
   * Main
   * -------------------------------------------------------------
   */
  (async function main(){
    injectCSS();

    if (typeof GM_registerMenuCommand === 'function'){
      GM_registerMenuCommand('Exportar vistos (JSON)', exportJSON);
      GM_registerMenuCommand('Importar vistos (JSON)', importJSON);
      GM_registerMenuCommand('Reiniciar marcados', resetAll);
    }

    const store = await loadStore();

    const applyAll = async (root=document) => {
      const rows = scanRows(root);
      for (const tr of rows){
        try { await decorateTableRow(tr, store); } catch { /* no‑op for robustness */ }
      }
    };

    await applyAll();

    // Observe changes due to internal navigation or deferred loads
    observeMutations(() => { applyAll(); });
  })();

})();
