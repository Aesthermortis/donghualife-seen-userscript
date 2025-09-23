import { Constants, STATE_UNTRACKED, STATE_WATCHING, STATE_COMPLETED } from "./constants.js";
import Utils from "./utils.js";
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
 * @description The main controller that orchestrates the entire script.
 */
const AppController = (() => {
  let syncChannel = null;
  let cleanupTasks = new Set();
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

  const ALL_ITEMS_SELECTOR = Object.values(SELECTORS)
    .map((cfg) => cfg.item)
    .join(", ");

  const scheduleBatch = (fn) =>
    new Promise((resolve) => {
      if ("requestIdleCallback" in window) {
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
   * Decorates eligible items using a single DOM traversal and idle batching.
   */
  const applyAll = (root = document) => {
    const rootIsElement = root instanceof Element;
    const candidates = [];

    if (rootIsElement && root.matches(ALL_ITEMS_SELECTOR)) {
      candidates.push(root);
    }

    if (typeof root.querySelectorAll === "function") {
      for (const el of root.querySelectorAll(ALL_ITEMS_SELECTOR)) {
        candidates.push(el);
      }
    }

    if (!candidates.length) {
      return;
    }

    const batches = {
      episode: [],
      season: [],
      series: [],
      movie: [],
    };

    const detectionOrder = ["episode", "season", "series", "movie"];

    for (const el of candidates) {
      let type = null;
      let cfg = null;

      for (const candidateType of detectionOrder) {
        const candidateCfg = SELECTORS[candidateType];
        if (!el.matches(candidateCfg.item)) {
          continue;
        }
        if (!candidateCfg.validate(el)) {
          continue;
        }
        if (!Utils.$(candidateCfg.link, el)) {
          continue;
        }
        if (
          (candidateType === "series" || candidateType === "season") &&
          el.getAttribute(Constants.ITEM_DECORATED_ATTR) === candidateType
        ) {
          continue;
        }
        type = candidateType;
        cfg = candidateCfg;
        break;
      }

      if (!type || !cfg) {
        continue;
      }

      batches[type].push(el);
    }

    if (
      !batches.episode.length &&
      !batches.series.length &&
      !batches.season.length &&
      !batches.movie.length
    ) {
      return;
    }

    const run = async () => {
      if (batches.episode.length) {
        await scheduleBatch(() => {
          for (const item of batches.episode) {
            ContentDecorator.decorateItem(item, {
              type: "episode",
              selector: Constants.EPISODE_LINK_SELECTOR,
              onToggle: handleToggle,
            });
          }
        });
      }

      if (batches.season.length) {
        await scheduleBatch(() => {
          for (const item of batches.season) {
            ContentDecorator.decorateItem(item, {
              type: "season",
              selector: Constants.LINK_SELECTOR,
              onToggle: handleToggle,
              preferKind: "season",
            });
          }
        });
      }

      if (batches.series.length) {
        await scheduleBatch(() => {
          for (const item of batches.series) {
            ContentDecorator.decorateItem(item, {
              type: "series",
              selector: Constants.LINK_SELECTOR,
              onToggle: handleToggle,
              preferKind: "series",
            });
          }
        });
      }

      if (batches.movie.length) {
        await scheduleBatch(() => {
          for (const item of batches.movie) {
            ContentDecorator.decorateItem(item, {
              type: "movie",
              selector: Constants.LINK_SELECTOR,
              onToggle: handleToggle,
            });
          }
        });
      }
    };

    void run();
  };

  const observerCallback = (nodes = []) => {
    if (Array.isArray(nodes) && nodes.length > 0) {
      const seen = new Set();
      for (const node of nodes) {
        if (node instanceof Element && !seen.has(node)) {
          seen.add(node);
          applyAll(node);
        }
      }
    } else {
      applyAll();
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
    if (seasonId && Store.getStatus("season", seasonId) !== STATE_WATCHING) {
      const extraFields = {};
      if (seriesId) {
        extraFields.series_id = seriesId;
      }
      const seasonName = PathAnalyzer.formatSeasonName(seasonId) || "Unknown Season";
      extraFields.name = seasonName;

      await Store.setState("season", seasonId, STATE_WATCHING, extraFields);
      UIManager.showToast(I18n.t("toastAutoTrackSeason", { seasonName }));
    }

    // Propagate to Series
    if (seriesId && Store.getStatus("series", seriesId) !== STATE_WATCHING) {
      const extraFields = {};
      const seriesName = PathAnalyzer.formatSeriesName(seriesId) || "Unknown Series";
      extraFields.name = seriesName;

      await Store.setState("series", seriesId, STATE_WATCHING, extraFields);
      UIManager.showToast(I18n.t("toastAutoTrackSeries", { seriesName }));
    }
  };

  /**
   * Synchronizes seen state across tabs using BroadcastChannel or localStorage fallback.
   * Episodes and movies are the only entities that emit sync updates.
   * @param {string} type
   * @param {string} id
   */
  const emitSyncUpdate = (type, id) => {
    if (!id || (type !== "episode" && type !== "movie")) {
      return;
    }

    const seen = Store.getStatus(type, id) === "seen";
    const entity = Store.get(type, id);
    const timestamp = typeof entity?.t === "number" ? entity.t : Date.now();
    const payload = { id, seen, t: timestamp };

    if (syncChannel) {
      syncChannel.postMessage(payload);
      return;
    }

    localStorage.setItem(Constants.SYNC_CHANNEL_NAME, JSON.stringify(payload));
    localStorage.removeItem(Constants.SYNC_CHANNEL_NAME);
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
        const hasRemainingEpisodes = Store.getByState("episode", "seen").some((episode) => {
          if (episode.series_id) {
            return episode.series_id === seriesId;
          }
          const episodeInfo = PathAnalyzer.analyze(episode.id);
          return (
            episodeInfo.isValid &&
            episodeInfo.type === PathAnalyzer.EntityType.EPISODE &&
            episodeInfo.hierarchy.seriesId === seriesId
          );
        });

        if (!hasRemainingEpisodes) {
          await Store.remove("series", seriesId);
        }
      }
    }
  };

  /**
   * Handles item state changes and propagates them across hierarchy.
   */
  const handleToggle = async (type, id, currentStatus) => {
    // Episodes
    if (type === "episode") {
      const newSeen = currentStatus !== "seen";
      if (newSeen) {
        // First, save the episode state.
        await Store.setState("episode", id, "seen");
        // Then, propagate the 'watching' state up the hierarchy.
        await propagateWatchingState(id);
      } else {
        await Store.remove("episode", id);
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
      if (currentStatus === STATE_UNTRACKED) {
        const extraFields = {};
        if (type === "series") {
          extraFields.name = PathAnalyzer.formatSeriesName(id) || "Unknown Series";
        } else {
          extraFields.name = PathAnalyzer.formatSeasonName(id) || "Unknown Season";
        }
        // UNTRACKED → WATCHING
        await Store.setState(type, id, STATE_WATCHING, extraFields);
        // No propagation needed
      } else if (currentStatus === STATE_WATCHING) {
        // WATCHING → COMPLETED (and propagate)
        await Store.setState(type, id, STATE_COMPLETED);

        if (type === "series") {
          // Mark all seasons and episodes as COMPLETED/SEEN
          const childSeasons = await Store.getSeasonsForSeries(id);
          for (const seasonId of childSeasons) {
            await Store.setState("season", seasonId, STATE_COMPLETED);
            ContentDecorator.updateItemUI(seasonId, { type: "season" });

            const episodes = await Store.getEpisodesForSeason(seasonId);
            for (const episodeId of episodes) {
              await Store.setState("episode", episodeId, "seen");
              ContentDecorator.updateItemUI(episodeId, { type: "episode" });
            }
          }
        } else if (type === "season") {
          // Mark all episodes of the season as SEEN
          const episodes = await Store.getEpisodesForSeason(id);
          for (const episodeId of episodes) {
            await Store.setState("episode", episodeId, "seen");
            ContentDecorator.updateItemUI(episodeId, { type: "episode" });
          }
        }
      } else if (currentStatus === STATE_COMPLETED) {
        // COMPLETED → UNTRACKED (remove tracking and propagate)
        await Store.remove(type, id);

        if (type === "series") {
          const childSeasons = await Store.getSeasonsForSeries(id);
          for (const seasonId of childSeasons) {
            await Store.remove("season", seasonId);
            ContentDecorator.updateItemUI(seasonId, { type: "season" });

            const episodes = await Store.getEpisodesForSeason(seasonId);
            for (const episodeId of episodes) {
              await Store.remove("episode", episodeId);
              ContentDecorator.updateItemUI(episodeId, { type: "episode" });
            }
          }
        } else if (type === "season") {
          const episodes = await Store.getEpisodesForSeason(id);
          for (const episodeId of episodes) {
            await Store.remove("episode", episodeId);
            ContentDecorator.updateItemUI(episodeId, { type: "episode" });
          }
        }
      }

      // Always update the main button for the series or season
      ContentDecorator.updateItemUI(id, { type });

      return;
    }

    // Movies
    if (type === "movie") {
      const newSeen = currentStatus !== "seen";
      if (newSeen) {
        await Store.setState("movie", id, "seen");
      } else {
        await Store.remove("movie", id);
      }
      ContentDecorator.updateItemUI(id, { type: "movie" });
      emitSyncUpdate(type, id);
      return;
    }
  };

  const setupSyncChannel = () => {
    if ("BroadcastChannel" in window) {
      const channel = new BroadcastChannel(Constants.SYNC_CHANNEL_NAME);
      const onMessage = async (event) => {
        const { id, seen, t } = event.data || {};
        await withErrorHandling(() => Store.receiveSync(id, seen, t), {
          logContext: "BroadcastChannel receiveSync",
        });
      };
      channel.onmessage = onMessage;
      syncChannel = channel;

      registerCleanup(() => {
        try {
          channel.onmessage = null;
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

    const storageHandler = async (event) => {
      if (event.key === Constants.SYNC_CHANNEL_NAME && event.newValue) {
        await withErrorHandling(
          async () => {
            const data = JSON.parse(event.newValue);
            await Store.receiveSync(data.id, data.seen, data.t);
          },
          { logContext: "LocalStorage sync event" },
        );
      }
    };

    window.addEventListener("storage", storageHandler);
    registerCleanup(() => {
      window.removeEventListener("storage", storageHandler);
    });
    syncChannel = null;
  };

  const setupGlobalClickListener = () => {
    const clickHandler = async (event) => {
      const link = event.target?.closest("a[href]");
      if (!link) {
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

      if (Store.getStatus(pathInfo.type, pathInfo.id) === "seen") {
        return;
      }

      if (isPlainLeftClick) {
        event.preventDefault();
      }
      await handleToggle(
        pathInfo.type,
        pathInfo.id,
        Store.getStatus(pathInfo.type, pathInfo.id),
        link.closest("tr, .episode, .movie"),
      );

      emitSyncUpdate(pathInfo.type, pathInfo.id);

      if (isPlainLeftClick) {
        window.location.assign(link.href);
      }
    };

    document.addEventListener("click", clickHandler, { capture: true, passive: false });
    registerCleanup(() => {
      document.removeEventListener("click", clickHandler, { capture: true });
    });
  };

  // Handles state changes from the Store and updates the UI accordingly.
  const handleStateChange = (change) => {
    if (change.type === "INIT") {
      document.documentElement.classList.toggle(Constants.ROOT_HL_CLASS, Store.isRowHighlightOn());
      return;
    }
    if (change.type === "PREFS_CHANGE") {
      const { oldPrefs, newPrefs } = change.payload;
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

    // Map entity → lowercase type
    const TYPE_MAP = {
      SERIES: "series",
      SEASON: "season",
      EPISODE: "episode",
      MOVIE: "movie",
    };
    const match = /^([A-Z]+)_(CHANGE|REMOVE|CLEAR)$/.exec(change.type);
    if (!match) {
      return;
    }
    const [, entity, action] = match;
    const type = TYPE_MAP[entity];
    if (!type) {
      return;
    }

    if (action === "CLEAR") {
      // Recalculate and refresh ALL decorated items of that type
      const selector = `[${Constants.ITEM_DECORATED_ATTR}="${type}"]`;
      for (const item of Utils.$$(selector)) {
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
   * App initialization: ensures robust state synchronization, localization,
   * and immediate UI feedback.
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
    DOMObserver.observe(observerCallback, { observeAttributes: false });

    const currentPathInfo = PathAnalyzer.analyze(location.pathname);

    if (
      currentPathInfo.isValid &&
      (currentPathInfo.type === PathAnalyzer.EntityType.EPISODE ||
        currentPathInfo.type === PathAnalyzer.EntityType.MOVIE) &&
      Store.getStatus(currentPathInfo.type, currentPathInfo.id) !== "seen"
    ) {
      await handleToggle(
        currentPathInfo.type,
        currentPathInfo.id,
        Store.getStatus(currentPathInfo.type, currentPathInfo.id),
      );
    }
  };

  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      setupSyncChannel();
      setupGlobalClickListener();

      DOMObserver.observe(observerCallback, { observeAttributes: false });
      applyAll();
    }
  });

  window.addEventListener("pagehide", teardown);

  return { init, teardown };
})();
export default AppController;
