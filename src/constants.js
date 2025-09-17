export const DB_NAME = "donghualife-seen-db";
export const DB_VERSION = 4;
export const DB_STORE_SERIES = "Series";
export const DB_STORE_SEASONS = "Seasons";
export const DB_STORE_EPISODES = "Episodes";
export const DB_STORE_MOVIES = "Movies";
export const DB_STORE_PREFS = "Preferences";

export const STORE_LIST = [
  DB_STORE_SERIES,
  DB_STORE_SEASONS,
  DB_STORE_EPISODES,
  DB_STORE_MOVIES,
  DB_STORE_PREFS,
];

export const TYPE_TO_STORE = {
  series: DB_STORE_SERIES,
  season: DB_STORE_SEASONS,
  episode: DB_STORE_EPISODES,
  movie: DB_STORE_MOVIES,
};

export const STATE_UNTRACKED = "untracked";
export const STATE_WATCHING = "watching";
export const STATE_COMPLETED = "completed";

export const Constants = {
  // Sync
  SYNC_CHANNEL_NAME: "us-dhl-sync:v1",

  // DOM Attributes and Classes
  ITEM_SEEN_ATTR: "data-us-dhl-decorated",
  ITEM_SEEN_STATE_ATTR: "data-us-dhl-seen-state",
  ITEM_DECORATED_ATTR: "data-us-dhl-decorated-type",
  ITEM_STATE_ATTR: "data-us-dhl-state",
  TABLE_MARK_ATTR: "data-us-dhl-ctrlcol",
  OBSERVER_PENDING_ATTR: "data-us-dhl-observer-pending",
  OWNED_ATTR: "data-us-dhl-owned",
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

  // Selectors
  LINK_SELECTOR: "a[href]",
  EPISODE_LINK_SELECTOR:
    "a[href*='/episode/'], a[href*='/capitulo/'], a[href*='/watch/'], a[href*='/ver/']",
  EPISODE_ITEM_SELECTOR: "table tr, .views-row .episode, .episodio",
  SEASON_ITEM_SELECTOR: ".serie, .season, .views-row .season, .listado-seasons .season, .titulo",
  SERIES_ITEM_SELECTOR: ".series, .views-row .serie, .listado-series .serie, .titulo",
  MOVIE_ITEM_SELECTOR: ".movie, .views-row .movie, .listado-movies .movie",

  // Defaults
  DEFAULT_ROW_HL: false,
  DEFAULT_LANG: "en",
};

export const CSS = `
    /* Base Button Style */
    .${Constants.BTN_CLASS}{
      cursor:pointer; user-select:none; font-size:0.9rem; line-height:1;
      padding:0.32rem 0.65rem; border:none; border-radius:0.75rem;
      background:rgba(255,255,255,.06); color:#f5f7fa;
      transition:filter .15s ease, background .15s ease; white-space: nowrap;
    }
    .${Constants.BTN_CLASS}:hover{ filter:brightness(1.2); }
    .${Constants.BTN_CLASS}[aria-pressed="true"]{ background:rgba(4, 120, 87, .75); color:#f0fff8; }
    .${Constants.BTN_CLASS}[aria-pressed="true"]:hover{ filter:brightness(1.3); }
    .${Constants.BTN_CLASS}:focus{ outline:2px solid rgba(255,255,255,.35); outline-offset:2px; }

    .${Constants.BTN_CLASS}[${Constants.ITEM_STATE_ATTR}="seen"]      { background: rgba(4,120,87,.75);  color:#f0fff8; }
    .${Constants.BTN_CLASS}[${Constants.ITEM_STATE_ATTR}="watching"]  { background: rgba(59,130,246,.75); color:#eff6ff; }
    .${Constants.BTN_CLASS}[${Constants.ITEM_STATE_ATTR}="completed"] { background: rgba(139,92,246,.75); color:#f5f3ff; }

    /* Episode Card Button Specifics */
    .views-row .episode { position: relative; }
    .${Constants.CARD_BTN_CLASS} {
      position: absolute; top: 8px; right: 8px; z-index: 10;
      background: rgba(20, 20, 22, 0.7); box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      backdrop-filter: blur(4px);
    }
    .${Constants.CARD_BTN_CLASS}[aria-pressed="true"] { background: rgba(4, 120, 87, 0.75); }
    .${Constants.CARD_BTN_CLASS}[${Constants.ITEM_STATE_ATTR}="seen"]      { background: rgba(4,120,87,.75); }
    .${Constants.CARD_BTN_CLASS}[${Constants.ITEM_STATE_ATTR}="watching"]  { background: rgba(59,130,246,.75); }
    .${Constants.CARD_BTN_CLASS}[${Constants.ITEM_STATE_ATTR}="completed"] { background: rgba(139,92,246,.75); }

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
      .${Constants.BTN_CLASS}, .${Constants.ROOT_HL_CLASS} .${Constants.ITEM_SEEN_CLASS}, .${Constants.ITEM_WATCHING_CLASS}, .${Constants.ITEM_COMPLETED_CLASS} { transition: all .15s ease; }
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
