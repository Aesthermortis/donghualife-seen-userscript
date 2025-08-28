// ==UserScript==
// @name         DonghuaLife – Mark Watched Episodes (✅)
// @namespace    us_dhl_seen
// @version      1.0.0
// @description  Adds a ✅ marker to indicate watched episodes in season tables on donghualife.com. The watched state is saved locally using script storage, allowing you to track your progress across sessions. You can mark/unmark episodes as watched by clicking the "Marcar"/"Visto" button next to each episode. The script also provides options to export/import your watched list as JSON and to reset all marks via the user script menu.
// @author       you
// @match        https://donghualife.com/season/*
// @run-at       document-idle
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.deleteValue
// @grant        GM.listValues
// @grant        GM_registerMenuCommand
// ==/UserScript==

(() => {
  'use strict';

  // ---- Config & utils ------------------------------------------------------
  const STORE_KEY = 'seenEpisodes:v1';
  const CSS = `
    .us-dhl-seen-btn{
      cursor:pointer; user-select:none; font-size:0.9rem; line-height:1;
      padding:0.2rem 0.45rem; border:1px solid rgba(0,0,0,.15); border-radius:0.5rem;
      background:rgba(0,0,0,.03);
    }
    .us-dhl-seen-btn:hover{ filter:brightness(0.95); }
    .us-dhl-seen-chip{
      margin-left:0.35rem; font-size:1rem;
    }
    .us-dhl-date-insert{
      display:inline-flex; align-items:center;
    }
  `;

  const DATE_REGEXES = [
    /\b\d{4}-\d{2}-\d{2}\b/,                // 2025-08-28
    /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/,        // 28/08/2025
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},\s*\d{4}\b/i, // Aug 28, 2025
    /\b(?:Ene|Feb|Mar|Abr|May|Jun|Jul|Ago|Sep|Oct|Nov|Dic)\s+\d{1,2},?\s*\d{4}\b/i       // Ago 28, 2025
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
    // Prefer <time>, otherwise regex; otherwise null
    const withTime = cells.find(td => $('time', td));
    if (withTime) return withTime;
    const byRegex = cells.find(td => isDateCell(td));
    return byRegex || null;
  }

  function computeEpisodeId(tr){
    // Heuristic: use the first link in the row as a stable ID
    const a = $('a[href]', tr);
    if (a) return new URL(a.href, location.origin).pathname;
    // Fallback: hash of the row's text (simple)
    return 'row:' + (tr.textContent || '').trim().slice(0,200);
  }

  function makeSeenButton(isSeen){
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'us-dhl-seen-btn';
    btn.title = isSeen ? 'Marcado como visto. Click para desmarcar.' : 'No visto. Click para marcar.';
    btn.textContent = isSeen ? 'Visto' : 'Marcar';
    return btn;
  }

  function makeCheckChip(){
    const chip = document.createElement('span');
    chip.className = 'us-dhl-seen-chip';
    chip.textContent = '✅';
    return chip;
  }

  function insertAfterDate(targetCell, node){
    if (!targetCell) return false;
    // Insert “chip” right after the content of the date cell
    const wrap = document.createElement('span');
    wrap.className = 'us-dhl-date-insert';
    // Keep previous content and add the chip at the end
    // But to avoid duplication, only add the chip (do not touch existing content)
    targetCell.appendChild(node);
    return true;
  }

  function ensureControlCell(tr, preferredAfterCell){
    // Create a container for the toggle button.
    // If there is a date cell, create the button as a separate element and insert it in the same row (last cell),
    // and the ✅ is placed next to the date. If there is no date, the ✅ goes next to the button.
    const cells = Array.from(tr.children).filter(el => el.tagName === 'TD' || el.tagName === 'TH');
    // Try control column at the end
    let ctl = cells[cells.length - 1];
    if (!ctl) return null;
    return ctl;
  }

  function flagAlreadyPlaced(tr){
    return !!$('.us-dhl-seen-btn', tr) || !!$('.us-dhl-seen-chip', tr);
  }

  async function decorateTableRow(tr, store, saveFn){
    try{
      if (flagAlreadyPlaced(tr)) return;

      const id = computeEpisodeId(tr);
      const seen = !!store[id];

      // locate cells
      const tds = Array.from(tr.querySelectorAll('td,th'));
      const dateCell = findDateCell(tds);
      const controlCell = ensureControlCell(tr, dateCell);

      // toggle button
      const btn = makeSeenButton(seen);

      // button placement: in the last cell (controlCell)
      if (controlCell){
        const holder = document.createElement('div');
        holder.style.display = 'inline-flex';
        holder.style.alignItems = 'center';
        holder.style.gap = '0.5rem';
        holder.appendChild(btn);
        // If we DO NOT find the date, also place the ✅ next to the button,
        // to maintain the visual promise.
        if (!dateCell && seen) holder.appendChild(makeCheckChip());
        controlCell.appendChild(holder);
      }

      // place ✅ after the date if watched and there is a date cell
      if (seen && dateCell){
        insertAfterDate(dateCell, makeCheckChip());
      }

      // handler
      btn.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        const nowSeen = !store[id];
        store[id] = nowSeen ? { t: Date.now() } : undefined;
        if (!store[id]) delete store[id];
        await saveFn(store);

        // update UI
        btn.textContent = nowSeen ? 'Visto' : 'Marcar';
        btn.title = nowSeen ? 'Marcado como visto. Click para desmarcar.' : 'No visto. Click para marcar.';

        // manage chips
        const existingChips = $$('.us-dhl-seen-chip', tr);
        existingChips.forEach(c => c.remove());

        if (nowSeen){
          if (dateCell){
            insertAfterDate(dateCell, makeCheckChip());
          } else {
            // no date: add chip next to the button
            btn.parentElement?.appendChild(makeCheckChip());
          }
        }
      }, { passive: true });
    }catch(e){
      // Silent failure for robustness
      // console.error(e);
    }
  }

  function scanTables(root=document){
    // Heuristic: <table> rows with at least one link.
    const rows = $$('table tr', root).filter(tr => $('a[href]', tr));
    return rows;
  }

  function observeMutations(callback){
    const mo = new MutationObserver((muts) => {
      const added = muts.some(m => m.addedNodes && m.addedNodes.length);
      if (added) callback();
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
    return mo;
  }

  async function exportJSON(){
    const data = await GM.getValue(STORE_KEY, '{}');
    prompt('Copia tu respaldo de episodios vistos:', data);
  }
  async function importJSON(){
    const txt = prompt('Pega el JSON de respaldo:');
    if (!txt) return;
    try{
      JSON.parse(txt);
      await GM.setValue(STORE_KEY, txt);
      alert('Importado. Recargando para aplicar…');
      location.reload();
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

  // ---- Main ----------------------------------------------------------------
  (async function main(){
    injectCSS();

    // Menu
    if (typeof GM_registerMenuCommand === 'function'){
      GM_registerMenuCommand('Exportar vistos (JSON)', exportJSON);
      GM_registerMenuCommand('Importar vistos (JSON)', importJSON);
      GM_registerMenuCommand('Reiniciar marcados', resetAll);
    }

    const store = await loadStore();

    const applyAll = async (root=document) => {
      const rows = scanTables(root);
      for (const tr of rows){
        await decorateTableRow(tr, store, saveStore);
      }
    };

    await applyAll();

    // Observe changes due to internal navigation or deferred loads
    observeMutations(() => {
      applyAll();
    });
  })();

})();
