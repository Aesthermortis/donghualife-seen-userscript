import { TYPE_TO_STORE, DB_STORE_PREFS, STATE_UNTRACKED, Constants } from "./constants.js";
import DatabaseManager from "./database-manager.js";
import PathAnalyzer from "./path-analyzer.js";
import withErrorHandling from "./error-handler.js";

/**
 * @module Store
 * @description Manages the application state, including seen/watching sets and preferences.
 */
const Store = (() => {
  // Caches for storing entities in memory
  const caches = {
    Episodes: new Map(),
    Series: new Map(),
    Seasons: new Map(),
    Movies: new Map(),
    prefs: new Map(),
  };

  const PREF_RULES = {
    rowHighlight: (value) => (typeof value === "boolean" ? value : undefined),
    userLang: (value) => {
      if (typeof value !== "string") {
        return undefined;
      }
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    },
  };

  function isPlainObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  function sanitizePrefs(prefs, { warn = false } = {}) {
    if (!isPlainObject(prefs)) {
      if (warn && prefs !== undefined) {
        console.warn("Store: preferences must be an object. Ignoring update.", prefs);
      }
      return {};
    }

    const sanitized = {};
    for (const [key, value] of Object.entries(prefs)) {
      const sanitize = PREF_RULES[key];
      if (!sanitize) {
        if (warn) {
          console.warn(`Store: ignoring unknown preference "${key}".`);
        }
        continue;
      }
      const sanitizedValue = sanitize(value);
      if (sanitizedValue === undefined) {
        if (warn) {
          console.warn(`Store: ignoring invalid value for preference "${key}".`, value);
        }
        continue;
      }
      sanitized[key] = sanitizedValue;
    }
    return sanitized;
  }

  function arePrefsEqual(a, b) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      if (!Object.is(a[key], b[key])) {
        return false;
      }
    }
    return true;
  }

  // Operation queue to serialize operations per entity ID
  const opQueue = new Map();
  function enqueueById(id, op) {
    const prev = opQueue.get(id) || Promise.resolve();
    const next = prev.then(op, op).finally(() => {
      if (opQueue.get(id) === next) {
        opQueue.delete(id);
      }
    });
    opQueue.set(id, next);
    return next;
  }

  // Map entity types to their respective stores
  async function load() {
    for (const store of Object.values(TYPE_TO_STORE)) {
      const items = await DatabaseManager.getAll(store);
      caches[store].clear();
      for (const obj of items) {
        caches[store].set(obj.id, obj);
      }
    }
    // Load preferences
    const prefs = await DatabaseManager.get(DB_STORE_PREFS, "userPreferences");
    const sanitizedPrefs = sanitizePrefs(prefs);
    caches.prefs.set("userPreferences", sanitizedPrefs);

    // Notify that everything is ready
    notify && notify({ type: "INIT" });
  }

  // Universal: sets (or overwrites) the state of an entity
  async function setState(entityType, id, state, extraFields = {}) {
    const store = TYPE_TO_STORE[entityType];
    const obj = caches[store].get(id) || { id, t: Date.now() };
    obj.state = state;
    obj.t = Date.now();

    // Auto-fill series_id and season_id from path if missing
    const pathInfo = PathAnalyzer.analyze(id);

    if (pathInfo.isValid) {
      if (entityType === "season" && !obj.series_id && pathInfo.hierarchy.seriesId) {
        obj.series_id = pathInfo.hierarchy.seriesId;
      }

      if (entityType === "episode") {
        if (!obj.season_id && pathInfo.hierarchy.seasonId) {
          obj.season_id = pathInfo.hierarchy.seasonId;
        }
        if (!obj.series_id && pathInfo.hierarchy.seriesId) {
          obj.series_id = pathInfo.hierarchy.seriesId;
        }
      }

      // Lazy migration: if name is missing, fill from PathAnalyzer
      if (entityType === "series" && !obj.name) {
        const name = PathAnalyzer.formatSeriesName(id);
        if (name) {
          obj.name = name;
        }
      }
      if (entityType === "season" && !obj.name) {
        const name = PathAnalyzer.formatSeasonName(id);
        if (name) {
          obj.name = name;
        }
      }
    }

    // Allow manual override of any fields
    Object.assign(obj, extraFields);

    return withErrorHandling(
      async () => {
        await DatabaseManager.set(store, id, obj);
        caches[store].set(id, obj);
        notify &&
          notify({
            type: entityType.toUpperCase() + "_CHANGE",
            payload: { id, state, ...extraFields },
          });
      },
      {
        errorMessageKey: "toastErrorSaving",
        logContext: `Error saving state for store=${store}, id=${id}`,
      },
    );
  }

  // Universal: removes an entity
  async function remove(entityType, id) {
    const store = TYPE_TO_STORE[entityType];
    return withErrorHandling(
      async () => {
        await DatabaseManager.delete(store, id);
        caches[store].delete(id);
        notify &&
          notify({
            type: entityType.toUpperCase() + "_REMOVE",
            payload: { id },
          });
      },
      {
        errorMessageKey: "toastErrorRemoving",
        logContext: `Error removing store=${store}, id=${id}`,
      },
    );
  }

  // Universal: get object by id
  function get(entityType, id) {
    const store = TYPE_TO_STORE[entityType];
    return caches[store].get(id) || null;
  }

  // Universal: get all objects of a type by state
  function getByState(entityType, state) {
    const store = TYPE_TO_STORE[entityType];
    return Array.from(caches[store].values()).filter((o) => o.state === state);
  }

  // Universal: get all objects of a type (unfiltered)
  function getAll(entityType) {
    const store = TYPE_TO_STORE[entityType];
    return Array.from(caches[store].values());
  }

  // Advanced search: e.g., all seasons of a series in state X
  function getSeasonsBySeriesAndState(seriesId, state = null) {
    const store = caches.Seasons;
    return Array.from(store.values()).filter(
      (s) => s.series_id === seriesId && (state ? s.state === state : true),
    );
  }

  // Advanced search: all episodes of a season in a state
  function getEpisodesBySeasonAndState(seasonId, state = null) {
    const store = caches.Episodes;
    return Array.from(store.values()).filter(
      (e) => e.season_id === seasonId && (state ? e.state === state : true),
    );
  }

  // Get all seasons for a specific series
  function getSeasonsForSeries(seriesId) {
    return Array.from(caches.Seasons.values())
      .filter((season) => season.series_id === seriesId)
      .map((season) => season.id);
  }

  // Get all episodes for a specific season
  function getEpisodesForSeason(seasonId) {
    return Array.from(caches.Episodes.values())
      .filter((ep) => ep.season_id === seasonId)
      .map((ep) => ep.id);
  }

  // Universal: get status of an entity (returns STATE_UNTRACKED if not found)
  function getStatus(entityType, id) {
    const obj = get(entityType, id);
    return obj ? obj.state : STATE_UNTRACKED;
  }

  // Get user preferences
  function getPrefs() {
    const prefs = caches.prefs.get("userPreferences") || {};
    return { ...prefs };
  }

  // Set user preferences
  async function setPrefs(newPrefs) {
    const sanitizedUpdate = sanitizePrefs(newPrefs, { warn: true });

    const currentPrefs = caches.prefs.get("userPreferences");
    const sanitizedCurrentPrefs = sanitizePrefs(currentPrefs);
    caches.prefs.set("userPreferences", sanitizedCurrentPrefs);

    const oldPrefs = { ...sanitizedCurrentPrefs };
    const mergedPrefs = { ...sanitizedCurrentPrefs, ...sanitizedUpdate };

    if (arePrefsEqual(mergedPrefs, sanitizedCurrentPrefs)) {
      return oldPrefs;
    }

    caches.prefs.set("userPreferences", mergedPrefs);

    return withErrorHandling(
      async () => {
        await DatabaseManager.set(DB_STORE_PREFS, "userPreferences", mergedPrefs);
        notify &&
          notify({
            type: "PREFS_CHANGE",
            payload: { oldPrefs, newPrefs: mergedPrefs },
          });
        return mergedPrefs;
      },
      {
        errorMessageKey: "toastErrorSaving",
        logContext: "Error saving user preferences",
      },
    );
  }

  // Row Highlight
  function isRowHighlightOn() {
    const prefs = getPrefs();
    return prefs.rowHighlight !== undefined ? prefs.rowHighlight : Constants.DEFAULT_ROW_HL;
  }

  // User Language
  function getUserLang() {
    const prefs = getPrefs();
    return prefs.userLang || Constants.DEFAULT_LANG;
  }

  async function clear(entityType) {
    const store = TYPE_TO_STORE[entityType];
    return withErrorHandling(
      async () => {
        await DatabaseManager.clear(store);
        caches[store].clear();
        notify && notify({ type: entityType.toUpperCase() + "_CLEAR" });
      },
      {
        errorMessageKey: "toastErrorClearing",
        logContext: `Error clearing store=${store}`,
      },
    );
  }

  const subscribers = [];
  function subscribe(fn) {
    subscribers.push(fn);
  }

  function notify(change) {
    for (const fn of subscribers) {
      try {
        fn(change);
      } catch (e) {
        console.error("A subscriber failed to process a change:", e);
      }
    }
  }

  /**
   * Handles synchronization events from other tabs (BroadcastChannel).
   * Only used for episodes and movies.
   * @param {string} id - The unique identifier of the item.
   * @param {boolean} seen - Whether the item is marked as seen.
   */
  async function receiveSync(id, seen) {
    if (!id) {
      return;
    }

    const pathInfo = PathAnalyzer.analyze(id);

    if (!pathInfo.isValid) {
      return;
    }

    // Only synchronize episodes and movies
    if (
      pathInfo.type !== PathAnalyzer.EntityType.EPISODE &&
      pathInfo.type !== PathAnalyzer.EntityType.MOVIE
    ) {
      return;
    }

    await enqueueById(id, () =>
      seen ? setState(pathInfo.type, id, "seen") : remove(pathInfo.type, id),
    );
  }

  // Expose API
  return {
    load,
    setState,
    remove,
    get,
    getByState,
    getAll,
    getSeasonsBySeriesAndState,
    getEpisodesBySeasonAndState,
    getSeasonsForSeries,
    getEpisodesForSeason,
    getStatus,
    getPrefs,
    setPrefs,
    isRowHighlightOn,
    getUserLang,
    clear,
    subscribe,
    receiveSync,
  };
})();

export default Store;
