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

  /**
   * Checks if a value is a plain object (not null, not an array).
   * @param {*} value - The value to check.
   * @returns {boolean} True if the value is a plain object, false otherwise.
   */
  function isPlainObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  /**
   * Sanitizes the user preferences object by validating each preference according to its rule.
   * Unknown or invalid preferences are ignored. Optionally logs warnings for invalid entries.
   *
   * @param {Object} prefs - The preferences object to sanitize.
   * @param {Object} [options] - Optional configuration.
   * @param {boolean} [options.warn=false] - If true, logs warnings for unknown or invalid preferences.
   * @returns {Object} The sanitized preferences object.
   */
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

  /**
   * Compares two preference objects for deep equality.
   * Returns true if all keys and values are strictly equal.
   *
   * @param {Object} a - First preferences object.
   * @param {Object} b - Second preferences object.
   * @returns {boolean} True if preferences are equal, false otherwise.
   */
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

  /**
   * Enqueues an asynchronous operation for a specific entity ID, ensuring that operations
   * for the same ID are executed sequentially. Prevents race conditions by serializing
   * operations per entity.
   *
   * @param {string} id - The unique identifier for the entity.
   * @param {Function} op - The asynchronous operation to execute.
   * @returns {Promise<*>} A promise that resolves with the result of the operation.
   */
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

  const supportsWebLocks = typeof navigator !== "undefined" && !!navigator?.locks?.request;

  const withEntityLock = (entityType, id, fn) => {
    if (!supportsWebLocks || !id) {
      return fn();
    }
    const name = "us-dhl:" + entityType + ":" + id;
    return navigator.locks.request(name, { mode: "exclusive" }, fn);
  };

  /**
   * Loads all entities and user preferences from persistent storage into memory caches.
   * Populates caches for episodes, series, seasons, movies, and preferences.
   * Notifies subscribers when initialization is complete.
   *
   * @async
   * @returns {Promise<void>} Resolves when all data is loaded.
   */
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

  /**
   * Sets the state of an entity (episode, series, season, or movie) in both memory and persistent storage.
   * Handles updating timestamps, hierarchy fields, and notifies subscribers of the change.
   * Uses locking and error handling to ensure consistency and prevent race conditions.
   *
   * @async
   * @param {string} entityType - The type of entity ("episode", "series", "season", "movie").
   * @param {string} id - The unique identifier of the entity.
   * @param {string} state - The new state to set (e.g., "seen", "watching").
   * @param {Object} [extraFields={}] - Additional fields to merge into the entity object.
   * @returns {Promise<Object>} Resolves with the updated entity object.
   */
  async function setState(entityType, id, state, extraFields = {}) {
    const store = TYPE_TO_STORE[entityType];
    return enqueueById(id, () =>
      withEntityLock(entityType, id, () =>
        withErrorHandling(
          async () => {
            const freshFromDb = await DatabaseManager.get(store, id);
            const cached = caches[store].get(id);
            const base = freshFromDb || cached || { id };
            const obj = { ...base, id };

            const timestamp = typeof extraFields.t === "number" ? extraFields.t : Date.now();
            obj.state = state;
            obj.t = timestamp;

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

            Object.assign(obj, extraFields);
            if (typeof obj.t !== "number") {
              obj.t = timestamp;
            }

            await DatabaseManager.set(store, id, obj);
            caches[store].set(id, obj);
            notify &&
              notify({
                type: entityType.toUpperCase() + "_CHANGE",
                payload: { id, state, ...extraFields },
              });
            return obj;
          },
          {
            errorMessageKey: "toastErrorSaving",
            logContext: `Error saving state for store=${store}, id=${id}`,
          },
        ),
      ),
    );
  }

  /**
   * Clears the state of an entity (episode, series, season, or movie) in both memory and persistent storage.
   * Removes the `state` and `t` (timestamp) fields from the entity object.
   * Notifies subscribers of the change.
   *
   * @async
   * @param {string} entityType - The type of entity ("episode", "series", "season", "movie").
   * @param {string} id - The unique identifier of the entity.
   * @returns {Promise<Object|null>} Resolves with the updated entity object, or null if not found.
   */
  async function clearState(entityType, id) {
    const store = TYPE_TO_STORE[entityType];
    return enqueueById(id, () =>
      withEntityLock(entityType, id, () =>
        withErrorHandling(
          async () => {
            const existing = await DatabaseManager.get(store, id);
            if (!existing) {
              return null;
            }
            const obj = { ...existing };
            delete obj.state;
            delete obj.t;
            await DatabaseManager.set(store, id, obj);
            caches[store].set(id, obj);
            notify &&
              notify({
                type: entityType.toUpperCase() + "_CHANGE",
                payload: { id, state: STATE_UNTRACKED },
              });
            return obj;
          },
          {
            errorMessageKey: "toastErrorSaving",
            logContext: `Error clearing state for store=${store}, id=${id}`,
          },
        ),
      ),
    );
  }

  /**
   * Removes an entity (episode, series, season, or movie) from both memory and persistent storage.
   * Deletes the entity from the database and cache, and notifies subscribers of the removal.
   *
   * @async
   * @param {string} entityType - The type of entity ("episode", "series", "season", "movie").
   * @param {string} id - The unique identifier of the entity.
   * @returns {Promise<void>} Resolves when the entity has been removed.
   */
  async function remove(entityType, id) {
    const store = TYPE_TO_STORE[entityType];
    return enqueueById(id, () =>
      withEntityLock(entityType, id, () =>
        withErrorHandling(
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
        ),
      ),
    );
  }

  /**
   * Retrieves an entity object from the in-memory cache by its type and ID.
   *
   * @param {string} entityType - The type of entity ("episode", "series", "season", "movie").
   * @param {string} id - The unique identifier of the entity.
   * @returns {Object|null} The entity object if found, otherwise null.
   */
  function get(entityType, id) {
    const store = TYPE_TO_STORE[entityType];
    return caches[store].get(id) || null;
  }

  /**
   * Retrieves all entities of a given type that match the specified state.
   *
   * @param {string} entityType - The type of entity ("episode", "series", "season", "movie").
   * @param {string} state - The state to filter by (e.g., "seen", "watching").
   * @returns {Array<Object>} Array of entities matching the given state.
   */
  function getByState(entityType, state) {
    const store = TYPE_TO_STORE[entityType];
    return Array.from(caches[store].values()).filter((o) => o.state === state);
  }

  /**
   * Retrieves all entities of a given type from the in-memory cache.
   *
   * @param {string} entityType - The type of entity ("episode", "series", "season", "movie").
   * @returns {Array<Object>} Array of all entities of the specified type.
   */
  function getAll(entityType) {
    const store = TYPE_TO_STORE[entityType];
    return Array.from(caches[store].values());
  }

  /**
   * Retrieves all seasons for a given series ID, optionally filtered by state.
   *
   * @param {string} seriesId - The unique identifier of the series.
   * @param {string|null} [state=null] - Optional state to filter seasons (e.g., "seen", "watching").
   * @returns {Array<Object>} Array of season objects matching the series ID and state.
   */
  function getSeasonsBySeriesAndState(seriesId, state = null) {
    const store = caches.Seasons;
    return Array.from(store.values()).filter(
      (s) => s.series_id === seriesId && (state ? s.state === state : true),
    );
  }

  /**
   * Retrieves all episodes for a given season ID, optionally filtered by state.
   *
   * @param {string} seasonId - The unique identifier of the season.
   * @param {string|null} [state=null] - Optional state to filter episodes (e.g., "seen", "watching").
   * @returns {Array<Object>} Array of episode objects matching the season ID and state.
   */
  function getEpisodesBySeasonAndState(seasonId, state = null) {
    const store = caches.Episodes;
    return Array.from(store.values()).filter(
      (e) => e.season_id === seasonId && (state ? e.state === state : true),
    );
  }

  /**
   * Determines whether a given episode belongs to a specific series.
   * Uses the episode's `series_id` property if available, otherwise analyzes the episode ID.
   *
   * @param {Object} episode - The episode object to check.
   * @param {string} seriesId - The unique identifier of the series.
   * @returns {boolean} True if the episode belongs to the series, false otherwise.
   */
  function belongsToSeries(episode, seriesId) {
    if (!seriesId) {
      return false;
    }
    if (episode.series_id) {
      return episode.series_id === seriesId;
    }

    const analysis = PathAnalyzer.analyze(episode.id);
    if (!analysis.isValid || analysis.type !== PathAnalyzer.EntityType.EPISODE) {
      return false;
    }

    return analysis.hierarchy.seriesId === seriesId;
  }

  /**
   * Retrieves all episodes for a given series ID, optionally filtered by state.
   * Uses the `belongsToSeries` helper to determine episode membership.
   *
   * @param {string} seriesId - The unique identifier of the series.
   * @param {string|null} [state=null] - Optional state to filter episodes (e.g., "seen", "watching").
   * @returns {Array<Object>} Array of episode objects matching the series ID and state.
   */
  function getEpisodesBySeriesAndState(seriesId, state = null) {
    const store = caches.Episodes;
    return Array.from(store.values()).filter(
      (episode) => belongsToSeries(episode, seriesId) && (state ? episode.state === state : true),
    );
  }

  /**
   * Retrieves all season IDs for a given series.
   *
   * @param {string} seriesId - The unique identifier of the series.
   * @returns {Array<string>} Array of season IDs belonging to the specified series.
   */
  function getSeasonsForSeries(seriesId) {
    return Array.from(caches.Seasons.values())
      .filter((season) => season.series_id === seriesId)
      .map((season) => season.id);
  }

  /**
   * Retrieves all episode IDs for a given season.
   *
   * @param {string} seasonId - The unique identifier of the season.
   * @returns {Array<string>} Array of episode IDs belonging to the specified season.
   */
  function getEpisodesForSeason(seasonId) {
    return Array.from(caches.Episodes.values())
      .filter((ep) => ep.season_id === seasonId)
      .map((ep) => ep.id);
  }

  /**
   * Retrieves the current state of an entity (episode, series, season, or movie) by its type and ID.
   * Returns the state string if set, or STATE_UNTRACKED if not found or not set.
   *
   * @param {string} entityType - The type of entity ("episode", "series", "season", "movie").
   * @param {string} id - The unique identifier of the entity.
   * @returns {string} The state of the entity, or STATE_UNTRACKED if not set.
   */
  function getStatus(entityType, id) {
    const obj = get(entityType, id);
    return obj && typeof obj.state === "string" ? obj.state : STATE_UNTRACKED;
  }

  /**
   * Retrieves a shallow copy of the current user preferences from the in-memory cache.
   * Preferences are sanitized and returned as a plain object.
   *
   * @returns {Object} The current user preferences.
   */
  function getPrefs() {
    const prefs = caches.prefs.get("userPreferences") || {};
    return { ...prefs };
  }

  /**
   * Updates user preferences in both memory and persistent storage.
   * Sanitizes the provided preferences, merges them with the current preferences,
   * and saves the result if there are changes. Notifies subscribers of the update.
   *
   * @async
   * @param {Object} newPrefs - The new preferences to set.
   * @returns {Promise<Object>} Resolves with the merged preferences object.
   */
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

  /**
   * Determines whether row highlighting is enabled in user preferences.
   * Returns the value of the `rowHighlight` preference if set, otherwise falls back to the default.
   *
   * @returns {boolean} True if row highlighting is enabled, false otherwise.
   */
  function isRowHighlightOn() {
    const prefs = getPrefs();
    return prefs.rowHighlight !== undefined ? prefs.rowHighlight : Constants.DEFAULT_ROW_HL;
  }

  /**
   * Retrieves the user's preferred language from preferences.
   * Falls back to the default language if not set.
   *
   * @returns {string} The user's language preference.
   */
  function getUserLang() {
    const prefs = getPrefs();
    return prefs.userLang || Constants.DEFAULT_LANG;
  }

  /**
   * Clears all entities of the specified type from both memory and persistent storage.
   * Removes all items from the database and cache, and notifies subscribers of the clear event.
   *
   * @async
   * @param {string} entityType - The type of entity ("episode", "series", "season", "movie").
   * @returns {Promise<void>} Resolves when the store has been cleared.
   */
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

  /**
   * Subscribes a callback function to state change notifications.
   * The callback will be invoked with a change object whenever the store state changes.
   *
   * @param {Function} fn - The callback function to invoke on state changes.
   */
  function subscribe(fn) {
    subscribers.push(fn);
  }

  /**
   * Notifies all subscribed listeners of a state change event.
   * Iterates through the list of subscriber callbacks and invokes each with the provided change object.
   * Catches and logs errors from individual subscribers to avoid breaking notification flow.
   *
   * @param {Object} change - The change event object describing the state update.
   */
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
   * Synchronizes the seen state of an episode or movie across browser tabs.
   * If the incoming timestamp is newer, updates the state accordingly.
   * For episodes, clears the state if not seen; for movies, removes the entity.
   *
   * @param {string} id - The unique identifier of the item.
   * @param {boolean} seen - Whether the item is marked as seen.
   * @param {number} [t] - The timestamp of the sync event.
   * @returns {Promise<void>} Resolves when synchronization is complete.
   */
  async function receiveSync(id, seen, t) {
    if (!id) {
      return;
    }

    const pathInfo = PathAnalyzer.analyze(id);

    if (!pathInfo.isValid) {
      return;
    }

    if (
      pathInfo.type !== PathAnalyzer.EntityType.EPISODE &&
      pathInfo.type !== PathAnalyzer.EntityType.MOVIE
    ) {
      return;
    }

    const current = get(pathInfo.type, id);
    if (current?.t && typeof t === "number" && current.t > t) {
      return;
    }

    if (seen) {
      const extras = typeof t === "number" ? { t } : {};
      await setState(pathInfo.type, id, "seen", extras);
      return;
    }

    if (pathInfo.type === PathAnalyzer.EntityType.EPISODE) {
      await clearState(pathInfo.type, id);
    } else {
      await remove(pathInfo.type, id);
    }
  }

  // Expose API
  return {
    load,
    setState,
    clearState,
    remove,
    get,
    getByState,
    getAll,
    getSeasonsBySeriesAndState,
    getEpisodesBySeasonAndState,
    getEpisodesBySeriesAndState,
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
