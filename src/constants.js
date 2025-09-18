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
