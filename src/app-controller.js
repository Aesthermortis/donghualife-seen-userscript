// @ts-check
/** @typedef {import('../types/types').ItemType} ItemType */
/** @typedef {import('../types/types').SelectorConfig} SelectorConfig */

import { Constants, STATE_UNTRACKED, STATE_WATCHING, STATE_COMPLETED } from "./constants.js";
import { select, selectAll } from "./dom/select.js";
import { isElementVisible } from "./dom/visibility.js";
import I18n from "./i18n.js";
import UIManager from "./ui-manager.js";
import Store from "./store.js";
import Settings from "./settings.js";
import ContentDecorator from "./content-decorator.js";
import DOMObserver from "./dom-observer.js";
import PathAnalyzer from "./path-analyzer.js";
import withErrorHandling from "./error-handler.js";

/**
 * @module AppController
 * @description
 * Main orchestrator for the DonghuaLife "Mark as Seen" userscript.
 * Handles initialization, state synchronization, UI decoration, event listeners,
 * and propagation of seen/tracking states across episodes, seasons, series, and movies.
 * All business logic and UI updates are coordinated through this controller.
 */
const AppController = (() => {
  /** @typedef {() => unknown} CleanupTask */
  /** @typedef {() => void} BatchTask */
  /**
   * @typedef {object} DecorateBatchMap
   * @property {Element[]} episode Elements to decorate as episodes
   * @property {Element[]} season Elements to decorate as seasons
   * @property {Element[]} series Elements to decorate as series
   * @property {Element[]} movie Elements to decorate as movies
   */
  /** @typedef {"seen" | "watching" | "completed" | "untracked" | null | undefined} TrackingState */
  /**
   * @typedef {object} SyncPayload
   * @property {string} id Entity ID
   * @property {boolean} seen Seen status
   * @property {number} t Timestamp
   */
  /**
   * @typedef {object} StateChange
   * @property {string} type Type of state change (e.g., "INIT", "PREFS_CHANGE", "SERIES_CHANGE", etc.)
   * @property {Record<string, unknown>} [payload] Additional data related to the state change
   */
  /** @typedef {{ rowHighlight?: boolean, userLang?: string } & Record<string, unknown>} UserPrefs */

  /** @type {BroadcastChannel | null} */
  let syncChannel = null;
  /** @type {Set<CleanupTask>} */
  const cleanupTasks = new Set();
  /**
   * @param {CleanupTask} fn - The cleanup function to register.
   * @returns {CleanupTask} A function to unregister the cleanup task.
   */
  const registerCleanup = (fn) => {
    if (typeof fn !== "function") {
      return () => {};
    }
    cleanupTasks.add(fn);
    return () => cleanupTasks.delete(fn);
  };

  const runCleanup = () => {
    if (cleanupTasks.size === 0) {
      return;
    }
    for (const task of cleanupTasks) {
      try {
        task();
      } catch (error) {
        console.error("Cleanup task failed:", error);
      }
    }
    cleanupTasks.clear();
  };

  let storeSubscribed = false;

  /** @type {ReadonlyArray<ItemType>} */
  const KNOWN_ITEM_TYPES = ["episode", "season", "series", "movie"];

  /** @type {Record<ItemType, SelectorConfig>} */
  const SELECTORS = {
    episode: {
      item: Constants.EPISODE_ITEM_SELECTOR,
      link: Constants.EPISODE_LINK_SELECTOR,
      preferKind: null,
      validate: (el) => !(el.tagName === "TR" && el.closest("thead")),
    },
    series: {
      item: Constants.SERIES_ITEM_SELECTOR,
      link: Constants.SERIES_LINK_SELECTOR,
      preferKind: "series",
      validate: () => true,
    },
    season: {
      item: Constants.SEASON_ITEM_SELECTOR,
      link: Constants.SEASON_LINK_SELECTOR,
      preferKind: "season",
      validate: (el) => !el.closest("table, tr"),
    },
    movie: {
      item: Constants.MOVIE_ITEM_SELECTOR,
      link: Constants.MOVIE_LINK_SELECTOR,
      preferKind: null,
      validate: () => true,
    },
  };

  Object.freeze(SELECTORS);

  /**
   * Checks if the provided value matches one of the supported item types.
   * @param {unknown} value - Arbitrary value to validate.
   * @returns {value is ItemType} True if the value is a known item type, false otherwise.
   */
  const isKnownItemType = (value) =>
    value === "episode" || value === "season" || value === "series" || value === "movie";

  /**
   * Retrieves the selector configuration for a known item type.
   * Uses explicit property access to avoid dynamic object lookups.
   * @param {ItemType} type - The item type to resolve.
   * @returns {SelectorConfig | undefined} The selector configuration, or undefined if type is unknown.
   */
  const getSelectorConfig = (type) => {
    switch (type) {
      case "episode": {
        return SELECTORS.episode;
      }
      case "season": {
        return SELECTORS.season;
      }
      case "series": {
        return SELECTORS.series;
      }
      case "movie": {
        return SELECTORS.movie;
      }
      default: {
        return;
      }
    }
  };

  /**
   * Determines whether a value is a valid tracking state.
   * @param {unknown} value - Value to check.
   * @returns {value is TrackingState} True if the value is a valid tracking state, false otherwise.
   */
  const isTrackingState = (value) =>
    value === "seen" ||
    value === "watching" ||
    value === "completed" ||
    value === "untracked" ||
    value === null ||
    value === undefined;

  /**
   * Retrieves the tracking status for an entity, coercing unknown values to "untracked".
   * @param {ItemType} type - Entity type to query.
   * @param {string} id - Entity identifier.
   * @returns {TrackingState} The tracking status ("seen", "watching", "completed", "untracked", null, or undefined).
   */
  const getTrackingStatus = (type, id) => {
    const status = Store.getStatus(type, id);
    if (isTrackingState(status)) {
      return status;
    }
    console.warn(`Unknown tracking status "${String(status)}" for ${type}:${id}`);
    return "untracked";
  };

  const ALL_ITEMS_SELECTOR = Object.values(SELECTORS)
    .map((cfg) => cfg.item)
    .join(", ");

  /**
   * Schedules a function to run during idle time or the next animation frame.
   * Uses `requestIdleCallback` if available, otherwise falls back to `requestAnimationFrame`.
   * Ensures non-blocking execution for batch DOM/UI updates.
   * @param {BatchTask} fn - The function to execute.
   * @returns {Promise<void>} Resolves after the function has run.
   */
  const scheduleBatch = (fn) =>
    new Promise((resolve) => {
      if ("requestIdleCallback" in globalThis) {
        requestIdleCallback(
          () => {
            try {
              fn();
            } finally {
              resolve();
            }
          },
          { timeout: 50 },
        );
      } else {
        requestAnimationFrame(() => {
          try {
            fn();
          } finally {
            resolve();
          }
        });
      }
    });

  /**
   * Determines if a DOM node is relevant for decoration.
   * Checks if the node is an Element and matches any of the selectors for episodes, seasons, series, or movies,
   * or contains such elements.
   * @param {Node} node - The DOM node to check.
   * @returns {boolean} True if the node is relevant for decoration, false otherwise.
   */
  const relevantNodeFilter = (node) => {
    if (!(node instanceof Element)) {
      return false;
    }
    if (node.matches(ALL_ITEMS_SELECTOR)) {
      return true;
    }
    return (
      typeof node.querySelector === "function" && node.querySelector(ALL_ITEMS_SELECTOR) !== null
    );
  };

  /**
   * Sets up DOM observation for relevant content nodes and triggers decoration callbacks.
   * Uses a custom node filter to detect episode, season, series, and movie elements.
   * Registers the observer with throttling and batching for performance.
   * @returns {void}
   */
  const observeDomChanges = () => {
    DOMObserver.observe(observerCallback, {
      observeAttributes: false,
      rate: { throttleMs: 120, debounceMs: 180 },
      batchSize: 12,
      nodeFilter: relevantNodeFilter,
    });
  };

  /**
   * Determines whether a given DOM element should be decorated as a specific content type.
   *
   * Checks if the element matches the expected selector, passes validation, contains the required link,
   * and has not already been decorated for series or season types.
   * @param {Element} el - The DOM element to check.
   * @param {ItemType} type - The content type ("episode", "series", "season", "movie").
   * @returns {boolean} True if the element should be decorated, false otherwise.
   */
  const shouldDecorateElement = (el, type) => {
    if (!isKnownItemType(type)) {
      return false;
    }
    const cfg = getSelectorConfig(type);
    if (!cfg) {
      return false;
    }
    if (!el.matches(cfg.item)) {
      return false;
    }
    if (!cfg.validate(el)) {
      return false;
    }
    if (!select(cfg.link, el)) {
      return false;
    }
    if (
      (type === "series" || type === "season") &&
      el.getAttribute(Constants.ITEM_DECORATED_ATTR) === type
    ) {
      return false;
    }
    return true;
  };

  /**
   * Classifies DOM elements into batches by content type for decoration.
   *
   * Iterates over candidate elements and, for each, determines its type
   * (episode, season, series, or movie) using detection order and selector config.
   * Returns an object with arrays of elements grouped by type.
   * @param {Iterable<Element>} candidates - Array of DOM elements to classify.
   * @param {ItemType[]} detectionOrder - Ordered list of types to check (e.g. ["episode", "season", ...]).
   * @returns {DecorateBatchMap} Object with keys for each type and arrays of elements to decorate.
   */
  const classifyElements = (candidates, detectionOrder) => {
    /** @type {DecorateBatchMap} */
    const batches = {
      episode: [],
      season: [],
      series: [],
      movie: [],
    };

    for (const el of candidates) {
      for (const detectionType of detectionOrder) {
        if (shouldDecorateElement(el, detectionType)) {
          switch (detectionType) {
            case "episode": {
              batches.episode.push(el);
              break;
            }
            case "season": {
              batches.season.push(el);
              break;
            }
            case "series": {
              batches.series.push(el);
              break;
            }
            case "movie": {
              batches.movie.push(el);
              break;
            }
            default: {
              break;
            }
          }
          break;
        }
      }
    }

    return batches;
  };

  /**
   * Schedules decoration of episode, season, series, and movie batches using idle batching.
   *
   * For each batch type, decorates all items in that batch by invoking ContentDecorator.decorateItem
   * with the appropriate configuration. Decoration is performed in idle time using requestIdleCallback
   * or requestAnimationFrame to avoid blocking the main thread.
   * @param {DecorateBatchMap} batches - Object containing arrays of elements to decorate, grouped by type.
   * @returns {Promise<void>}
   */
  const scheduleBatchDecorations = async (batches) => {
    if (batches.episode.length > 0) {
      await scheduleBatch(() => {
        for (const item of batches.episode) {
          ContentDecorator.decorateItem(item, {
            type: "episode",
            onToggle: handleToggle,
          });
        }
      });
    }

    if (batches.season.length > 0) {
      await scheduleBatch(() => {
        for (const item of batches.season) {
          ContentDecorator.decorateItem(item, {
            type: "season",
            onToggle: handleToggle,
            preferKind: "season",
          });
        }
      });
    }

    if (batches.series.length > 0) {
      await scheduleBatch(() => {
        for (const item of batches.series) {
          ContentDecorator.decorateItem(item, {
            type: "series",
            onToggle: handleToggle,
            preferKind: "series",
          });
        }
      });
    }

    if (batches.movie.length > 0) {
      await scheduleBatch(() => {
        for (const item of batches.movie) {
          ContentDecorator.decorateItem(item, {
            type: "movie",
            onToggle: handleToggle,
          });
        }
      });
    }
  };

  /**
   * Decorates eligible items using a single DOM traversal and idle batching.
   *
   * Traverses the DOM starting from the given root (defaults to document),
   * finds all episode, season, series, and movie elements matching selectors,
   * and decorates them using ContentDecorator. Batching is performed using
   * requestIdleCallback or requestAnimationFrame for performance.
   * @param {Element|Document} [root] - The root node to start traversal from.
   * @returns {void}
   */
  const applyAll = (root = document) => {
    const rootIsElement = root instanceof Element;
    /** @type {Element[]} */
    const candidates = [];

    if (rootIsElement && root.matches(ALL_ITEMS_SELECTOR)) {
      candidates.push(root);
    }

    if (typeof root.querySelectorAll === "function") {
      for (const el of root.querySelectorAll(ALL_ITEMS_SELECTOR)) {
        candidates.push(el);
      }
    }

    if (candidates.length === 0) {
      return;
    }

    /** @type {ItemType[]} */
    const detectionOrder = [...KNOWN_ITEM_TYPES];
    const batches = classifyElements(candidates, detectionOrder);

    const { episode = [], season = [], series = [], movie = [] } = batches;

    if ([episode, season, series, movie].every((a) => a.length === 0)) {
      return;
    }

    void scheduleBatchDecorations(batches);
  };

  /**
   * Callback for DOMObserver to handle detected DOM mutations.
   *
   * Receives an array of mutated nodes and determines which roots should be traversed for decoration.
   * For each root, applies decoration logic to eligible episode, season, series, and movie elements.
   * If no nodes are provided, applies decoration globally.
   * @param {Element[]} [nodes] - Array of mutated DOM nodes detected by the observer.
   * @returns {void}
   */
  const observerCallback = (nodes = []) => {
    if (!Array.isArray(nodes) || nodes.length === 0) {
      applyAll();
      return;
    }

    /** @type {Element[]} */
    const roots = [];
    for (const node of nodes) {
      if (!(node instanceof Element)) {
        continue;
      }
      let covered = false;
      if (roots.length > 0) {
        for (const existing of roots) {
          if (!(existing instanceof Element) || typeof existing.contains !== "function") {
            continue;
          }
          if (existing.contains(node)) {
            covered = true;
            break;
          }
        }
      }
      if (covered) {
        continue;
      }
      if (roots.length > 0 && typeof node.contains === "function") {
        for (const candidate of roots) {
          if (!(candidate instanceof Element)) {
            continue;
          }
          if (node.contains(candidate)) {
            const idx = roots.indexOf(candidate);
            if (idx !== -1) {
              roots.splice(idx, 1);
            }
          }
        }
      }
      roots.push(node);
    }

    if (roots.length === 0) {
      return;
    }

    for (const root of roots) {
      applyAll(root);
    }
  };

  /**
   * Propagates the "watching" state to season and series when an episode is marked as seen.
   * Isolated for clarity and testability.
   * @param {string} episodeId - The episode's unique identifier.
   * @returns {Promise<void>}
   */
  const propagateWatchingState = async (episodeId) => {
    const pathInfo = PathAnalyzer.analyze(episodeId);

    if (!pathInfo.isValid || pathInfo.type !== PathAnalyzer.EntityType.EPISODE) {
      return;
    }

    const { seasonId, seriesId } = pathInfo.hierarchy;

    // Propagate to Season
    if (seasonId) {
      const seasonStatus = Store.getStatus("season", seasonId);
      if (seasonStatus === STATE_UNTRACKED) {
        const extraFields = {};
        if (seriesId) {
          Object.assign(extraFields, { series_id: seriesId });
        }
        const seasonName = PathAnalyzer.formatSeasonName(seasonId) || "Unknown Season";
        Object.assign(extraFields, { name: seasonName });

        await Store.setState("season", seasonId, STATE_WATCHING, extraFields);
        UIManager.showToast(I18n.t("toastAutoTrackSeason", { seasonName }));
      }
    }

    // Propagate to Series
    if (seriesId) {
      const seriesStatus = Store.getStatus("series", seriesId);
      if (seriesStatus === STATE_UNTRACKED) {
        const extraFields = {};
        const seriesName = PathAnalyzer.formatSeriesName(seriesId) || "Unknown Series";
        extraFields.name = seriesName;

        await Store.setState("series", seriesId, STATE_WATCHING, extraFields);
        UIManager.showToast(I18n.t("toastAutoTrackSeries", { seriesName }));
      }
    }
  };

  /**
   * Synchronizes seen state across tabs using BroadcastChannel or localStorage fallback.
   * Only episodes and movies emit sync updates.
   * @function emitSyncUpdate
   * @param {"episode" | "movie"} type - The entity type ("episode" or "movie").
   * @param {string} id - The unique identifier of the entity.
   * @description
   * Emits a synchronization message containing the seen state for the given entity.
   * Uses BroadcastChannel if available, otherwise falls back to localStorage events.
   * The payload includes the entity ID, seen status, and timestamp.
   */
  const emitSyncUpdate = (type, id) => {
    if (!id || (type !== "episode" && type !== "movie")) {
      return;
    }

    const seen = Store.getStatus(type, id) === "seen";
    const entity = Store.get(type, id);
    let timestamp = Date.now();
    if (entity && typeof entity === "object") {
      const entityRecord = /** @type {Record<string, unknown>} */ (entity);
      const candidate = entityRecord["t"];
      if (typeof candidate === "number") {
        timestamp = candidate;
      }
    }
    /** @type {SyncPayload} */
    const payload = { id, seen, t: timestamp };

    if (syncChannel) {
      syncChannel.postMessage(payload);
      return;
    }

    localStorage.setItem(Constants.SYNC_CHANNEL_NAME, JSON.stringify(payload));
    localStorage.removeItem(Constants.SYNC_CHANNEL_NAME);
  };

  /**
   * Fallback when IndexedDB lacks episode records but DOM still has them.
   * @param {string|null} [filterSeasonId] - Limit results to a specific season.
   * @param {string|null} [filterSeriesId] - Limit results to a specific series.
   * @returns {string[]} Episode identifiers discovered in the DOM.
   */
  const discoverEpisodesFromDOM = (filterSeasonId = null, filterSeriesId = null) => {
    const selector = `[${Constants.ITEM_DECORATED_ATTR}="episode"]`;
    const nodes = document.querySelectorAll(selector);
    const ids = [];
    const seenIds = new Set();

    for (const element of nodes) {
      if (!isElementVisible(element)) {
        continue;
      }
      const id = ContentDecorator.computeId(element, Constants.LINK_SELECTOR, "episode");
      if (!id || seenIds.has(id)) {
        continue;
      }
      const info = PathAnalyzer.analyze(id);
      if (!info.isValid || info.type !== PathAnalyzer.EntityType.EPISODE) {
        continue;
      }
      const { seasonId, seriesId } = info.hierarchy;
      if (filterSeasonId && seasonId !== filterSeasonId) {
        continue;
      }
      if (filterSeriesId && seriesId !== filterSeriesId) {
        continue;
      }
      seenIds.add(id);
      ids.push(id);
    }

    return ids;
  };

  /**
   * Retrieve cached episodes for a season and gracefully fall back to DOM discovery.
   * @param {string} seasonId - Season identifier to lookup.
   * @returns {Promise<string[]>} Episode identifiers for the season.
   */
  const getEpisodesForSeasonWithFallback = async (seasonId) => {
    let episodes = Store.getEpisodesForSeason(seasonId);
    if (episodes.length === 0) {
      episodes = discoverEpisodesFromDOM(seasonId);
    }
    return episodes;
  };

  /**
   * Reverts the propagated "watching" state when the source episode is unmarked.
   * Ensures that seasons/series remain tracked only if they still have activity.
   * @param {string} episodeId - The episode's unique identifier.
   * @returns {Promise<void>}
   */
  const revertWatchingState = async (episodeId) => {
    const pathInfo = PathAnalyzer.analyze(episodeId);

    if (!pathInfo.isValid || pathInfo.type !== PathAnalyzer.EntityType.EPISODE) {
      return;
    }

    const { seasonId, seriesId } = pathInfo.hierarchy;

    if (seasonId) {
      const remainingSeasonEpisodes = Store.getEpisodesBySeasonAndState(seasonId, "seen");
      if (
        remainingSeasonEpisodes.length === 0 &&
        Store.getStatus("season", seasonId) === STATE_WATCHING
      ) {
        await Store.remove("season", seasonId);
      }
    }

    if (seriesId && Store.getStatus("series", seriesId) === STATE_WATCHING) {
      const watchingSeasons = Store.getSeasonsBySeriesAndState(seriesId, STATE_WATCHING);
      const completedSeasons = Store.getSeasonsBySeriesAndState(seriesId, STATE_COMPLETED);
      const hasTrackedSeasons = watchingSeasons.length > 0 || completedSeasons.length > 0;

      if (!hasTrackedSeasons) {
        const hasRemainingEpisodes = Store.getEpisodesBySeriesAndState(seriesId, "seen").length > 0;

        if (!hasRemainingEpisodes) {
          await Store.remove("series", seriesId);
        }
      }
    }
  };

  /**
   * Handles item state changes and propagates them across hierarchy.
   *
   * This function manages toggling the "seen" state for episodes and movies,
   * as well as tracking and completion states for series and seasons.
   * It propagates state changes up and down the hierarchy, updates the UI,
   * and synchronizes state across tabs. For episodes and movies, it emits
   * cross-tab sync events. For series and seasons, it propagates completion
   * or removal to child entities.
   * @param {string} type - The entity type ("episode", "series", "season", "movie").
   * @param {string} id - The unique identifier for the entity.
   * @param {TrackingState} currentStatus - The current tracking status of the entity.
   * @returns {Promise<void>}
   */
  const handleToggle = async (type, id, currentStatus) => {
    // Episodes
    if (type === "episode") {
      const newSeen = currentStatus !== "seen";
      if (newSeen) {
        // First, save the episode state.
        await Store.setState("episode", id, "seen");
        await propagateWatchingState(id);
      } else {
        await Store.clearState("episode", id);
        await revertWatchingState(id);
      }

      ContentDecorator.updateItemUI(id, { type: "episode" });

      // Visually update associated season and series
      const pathInfo = PathAnalyzer.analyze(id);
      if (pathInfo.isValid) {
        if (pathInfo.hierarchy.seasonId) {
          ContentDecorator.updateItemUI(pathInfo.hierarchy.seasonId, {
            type: "season",
          });
        }
        if (pathInfo.hierarchy.seriesId) {
          ContentDecorator.updateItemUI(pathInfo.hierarchy.seriesId, {
            type: "series",
          });
        }
      }
      emitSyncUpdate(type, id);
      return;
    }

    // Series/Seasons
    if (type === "series" || type === "season") {
      switch (currentStatus) {
        case STATE_UNTRACKED: {
          const extraFields = {};
          extraFields.name =
            type === "series"
              ? PathAnalyzer.formatSeriesName(id) || "Unknown Series"
              : PathAnalyzer.formatSeasonName(id) || "Unknown Season";
          // UNTRACKED → WATCHING
          await Store.setState(type, id, STATE_WATCHING, extraFields);
          break;
        }
        case STATE_WATCHING: {
          // WATCHING → COMPLETED (and propagate)
          await Store.setState(type, id, STATE_COMPLETED);

          /**
           * Sync policy:
           * - Do NOT emit per-episode updates inside propagation loops.
           * - Only update local UI here; cross-tab sync must be batched elsewhere.
           */
          if (type === "series") {
            // Mark all seasons and episodes as COMPLETED/SEEN
            const childSeasons = Store.getSeasonsForSeries(id);
            for (const seasonId of childSeasons) {
              await Store.setState("season", seasonId, STATE_COMPLETED);
              ContentDecorator.updateItemUI(seasonId, { type: "season" });

              const episodes = await getEpisodesForSeasonWithFallback(seasonId);
              for (const episodeId of episodes) {
                await Store.setState("episode", episodeId, "seen");
                ContentDecorator.updateItemUI(episodeId, { type: "episode" });
              }
            }
          } else if (type === "season") {
            // Mark all episodes of the season as SEEN
            const episodes = await getEpisodesForSeasonWithFallback(id);
            for (const episodeId of episodes) {
              await Store.setState("episode", episodeId, "seen");
              ContentDecorator.updateItemUI(episodeId, { type: "episode" });
            }
          }
          break;
        }
        case STATE_COMPLETED: {
          // COMPLETED → UNTRACKED (remove tracking and propagate)
          await Store.remove(type, id);

          if (type === "series") {
            const childSeasons = Store.getSeasonsForSeries(id);
            for (const seasonId of childSeasons) {
              await Store.remove("season", seasonId);
              ContentDecorator.updateItemUI(seasonId, { type: "season" });

              const episodes = await getEpisodesForSeasonWithFallback(seasonId);
              for (const episodeId of episodes) {
                await Store.clearState("episode", episodeId);
                ContentDecorator.updateItemUI(episodeId, { type: "episode" });
              }
            }
          } else if (type === "season") {
            const episodes = await getEpisodesForSeasonWithFallback(id);
            for (const episodeId of episodes) {
              await Store.clearState("episode", episodeId);
              ContentDecorator.updateItemUI(episodeId, { type: "episode" });
            }
          }
          break;
        }
        default: {
          // Handle unknown states
          console.warn(`Unknown state: ${currentStatus}`);
          break;
        }
      }

      // Always update the main button for the series or season
      ContentDecorator.updateItemUI(id, { type });

      return;
    }

    // Movies
    if (type === "movie") {
      const newSeen = currentStatus !== "seen";
      // eslint-disable-next-line unicorn/prefer-ternary
      if (newSeen) {
        await Store.setState("movie", id, "seen");
      } else {
        await Store.remove("movie", id);
      }
      ContentDecorator.updateItemUI(id, { type: "movie" });
      emitSyncUpdate(type, id);
    }
  };

  /**
   * @param {StorageEvent} event - The storage event object.
   * @returns {Promise<void>}
   */
  const storageHandler = async (event) => {
    if (event.key === Constants.SYNC_CHANNEL_NAME && typeof event.newValue === "string") {
      const rawValue = event.newValue;
      await withErrorHandling(
        async () => {
          /** @type {SyncPayload} */
          const data = JSON.parse(rawValue);
          await Store.receiveSync(data.id, data.seen, data.t);
        },
        { logContext: "LocalStorage sync event" },
      );
    }
  };

  const setupSyncChannel = () => {
    if ("BroadcastChannel" in globalThis) {
      const channel = new BroadcastChannel(Constants.SYNC_CHANNEL_NAME);
      /**
       * @param {MessageEvent<SyncPayload>} event - The message event object.
       * @returns {Promise<void>}
       */
      const onMessage = async (event) => {
        const { id, seen, t } = event.data || {};
        await withErrorHandling(() => Store.receiveSync(id, seen, t), {
          logContext: "BroadcastChannel receiveSync",
        });
      };
      channel.addEventListener("message", onMessage);
      syncChannel = channel;

      registerCleanup(() => {
        try {
          channel.removeEventListener("message", onMessage);
          channel.close();
        } catch (error) {
          console.warn("BroadcastChannel close failed:", error);
        } finally {
          if (syncChannel === channel) {
            syncChannel = null;
          }
        }
      });
      return;
    }

    globalThis.addEventListener("storage", storageHandler);
    registerCleanup(() => {
      globalThis.removeEventListener("storage", storageHandler);
    });
    syncChannel = null;
  };

  /**
   * @param {MouseEvent} event - The mouse event object.
   * @returns {Promise<void>}
   */
  const clickHandler = async (event) => {
    const target = event.target;
    const link = target instanceof Element ? target.closest("a[href]") : null;
    if (!(link instanceof HTMLAnchorElement)) {
      return;
    }

    // Only intercept plain left clicks (no modifier keys)
    const isPlainLeftClick =
      event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

    const pathInfo = PathAnalyzer.analyze(link.href);

    if (!pathInfo.isValid) {
      return;
    }

    if (
      pathInfo.type !== PathAnalyzer.EntityType.EPISODE &&
      pathInfo.type !== PathAnalyzer.EntityType.MOVIE
    ) {
      return;
    }

    const currentStatus = getTrackingStatus(pathInfo.type, pathInfo.id);
    if (currentStatus === "seen") {
      return;
    }

    if (isPlainLeftClick) {
      event.preventDefault();
    }
    await handleToggle(pathInfo.type, pathInfo.id, currentStatus);

    emitSyncUpdate(pathInfo.type, pathInfo.id);

    if (isPlainLeftClick) {
      globalThis.location.assign(link.href);
    }
  };

  const setupGlobalClickListener = () => {
    document.addEventListener("click", clickHandler, { capture: true, passive: false });
    registerCleanup(() => {
      document.removeEventListener("click", clickHandler, { capture: true });
    });
  };

  /**
   * Handles global state changes and updates the UI accordingly.
   *
   * Responds to initialization, preference changes, and entity state changes (series, season, episode, movie).
   * - On "INIT", toggles row highlight class based on preferences.
   * - On "PREFS_CHANGE", updates highlight and language, shows toast, and reloads if language changed.
   * - On entity CLEAR, refreshes all decorated items of that type.
   * - On entity CHANGE/REMOVE, refreshes the specific item.
   * @param {StateChange} change - The state change event object.
   * @returns {void}
   */
  const handleStateChange = (change) => {
    if (change.type === "INIT") {
      document.documentElement.classList.toggle(Constants.ROOT_HL_CLASS, Store.isRowHighlightOn());
      return;
    }
    if (change.type === "PREFS_CHANGE") {
      const payload = change.payload;
      if (
        !payload ||
        typeof payload !== "object" ||
        !("oldPrefs" in payload) ||
        !("newPrefs" in payload)
      ) {
        return;
      }
      const { oldPrefs, newPrefs } = /** @type {{ oldPrefs: UserPrefs; newPrefs: UserPrefs }} */ (
        payload
      );
      const highlightChanged = oldPrefs.rowHighlight !== newPrefs.rowHighlight;
      const langChanged = oldPrefs.userLang !== newPrefs.userLang;
      if (highlightChanged) {
        document.documentElement.classList.toggle(
          Constants.ROOT_HL_CLASS,
          Store.isRowHighlightOn(),
        );
      }
      if (langChanged) {
        UIManager.showToast(I18n.t("toastLangChanged"));
        setTimeout(() => location.reload(), 1500);
      }
      return;
    }

    const match = /^([A-Z]+)_(CHANGE|REMOVE|CLEAR)$/.exec(change.type);
    if (!match) {
      return;
    }
    const entity = match[1];
    const action = match[2];
    /** @type {ItemType | undefined} */
    let type;
    switch (entity) {
      case "SERIES": {
        type = "series";
        break;
      }
      case "SEASON": {
        type = "season";
        break;
      }
      case "EPISODE": {
        type = "episode";
        break;
      }
      case "MOVIE": {
        type = "movie";
        break;
      }
      default: {
        type = undefined;
      }
    }
    if (!type) {
      return;
    }

    if (action === "CLEAR") {
      // Recalculate and refresh ALL decorated items of that type
      const selector = `[${Constants.ITEM_DECORATED_ATTR}="${type}"]`;
      for (const item of selectAll(selector)) {
        const preferKind =
          type === "series" || type === "season" ? item.getAttribute(Constants.KIND_ATTR) : null;
        const id = ContentDecorator.computeId(item, Constants.LINK_SELECTOR, preferKind);
        if (id) {
          ContentDecorator.updateItemUI(id, { type });
        }
      }
      return;
    }

    // CHANGE / REMOVE: refresh the specific item
    if (change.payload?.id) {
      ContentDecorator.updateItemUI(change.payload.id, { type });
    }
  };

  const teardown = () => {
    DOMObserver.disconnect();
    runCleanup();
    syncChannel = null;
  };

  /**
   * Initializes the DonghuaLife "Mark as Seen" userscript.
   *
   * Ensures the DOM is ready, injects global styles, subscribes to state changes,
   * loads persistent state from IndexedDB, initializes i18n, creates the settings menu,
   * sets up cross-tab sync and global click listeners, decorates all eligible items,
   * and observes dynamic DOM changes for automatic decoration.
   * Also auto-marks the current episode or movie as seen if applicable.
   * @returns {Promise<void>} Resolves when initialization is complete.
   */
  const init = async () => {
    // Ensure document.body is available
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

    // Inject global styles
    UIManager.injectCSS();

    // Subscribe to state changes for real-time UI updates (idempotent)
    if (!storeSubscribed) {
      Store.subscribe(handleStateChange);
      storeSubscribed = true;
    }

    // Load persistent seen-state from DB
    await Store.load();

    // Initialize i18n with user preference
    I18n.init(Store.getUserLang());

    // Create settings menu and global listeners
    Settings.createButton();
    setupSyncChannel();
    setupGlobalClickListener();

    // Decorate all episodes based on current seen-state
    applyAll();

    // Reactively decorate episodes for dynamic DOM changes
    observeDomChanges();

    const currentPathInfo = PathAnalyzer.analyze(location.pathname);

    if (
      currentPathInfo.isValid &&
      (currentPathInfo.type === PathAnalyzer.EntityType.EPISODE ||
        currentPathInfo.type === PathAnalyzer.EntityType.MOVIE)
    ) {
      const initialStatus = getTrackingStatus(currentPathInfo.type, currentPathInfo.id);
      if (initialStatus !== "seen") {
        await handleToggle(currentPathInfo.type, currentPathInfo.id, initialStatus);
      }
    }
  };

  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      setupSyncChannel();
      setupGlobalClickListener();

      observeDomChanges();
      applyAll();
    }
  });

  window.addEventListener("pagehide", teardown);

  return { init, teardown, __testables: { propagateWatchingState, handleToggle } };
})();
export default AppController;
