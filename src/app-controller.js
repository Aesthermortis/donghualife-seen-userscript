import { Constants, STATE_UNTRACKED, STATE_WATCHING, STATE_COMPLETED } from './constants.js';
import Utils from './utils.js';
import I18n from './i18n.js';
import UIManager from './ui-manager.js';
import Store from './store.js';
import Settings from './settings.js';
import ContentDecorator from './content-decorator.js';
import DOMObserver from './dom-observer.js';
import PathAnalyzer from './path-analyzer.js';
import withErrorHandling from './error-handler.js';

/**
 * @module AppController
 * @description The main controller that orchestrates the entire script.
 */
const AppController = (() => {
  let syncChannel = null;

  /**
   * Orchestrates UI decoration for episodes, series, and seasons.
   * Replaces previous EpisodeMarker logic with unified ContentDecorator.
   * Airbnb JS Style Guide compliant.
   */
  const applyAll = (root = document) => {
    const rootIsElement = root instanceof Element;
    const gather = (selector) => [
      ...(rootIsElement && root.matches(selector) ? [root] : []),
      ...Utils.$$(selector, root),
    ];

    // Decorate episode items (table rows and cards)
    for (const item of gather(Constants.EPISODE_ITEM_SELECTOR)) {
      if (item.tagName === "TR" && item.closest("thead")) {
        continue;
      }
      if (!Utils.$(Constants.EPISODE_LINK_SELECTOR, item)) {
        continue;
      }
      ContentDecorator.decorateItem(item, {
        type: "episode",
        selector: Constants.EPISODE_LINK_SELECTOR,
        onToggle: handleToggle,
      });
    }

    // Decorate series items (headers and cards)
    for (const item of gather(Constants.SERIES_ITEM_SELECTOR)) {
      if (!Utils.$("a[href^='/series/']", item)) {
        continue;
      }
      // Avoid double decoration
      if (item.getAttribute(Constants.ITEM_DECORATED_ATTR) === "series") {
        continue;
      }
      ContentDecorator.decorateItem(item, {
        type: "series",
        selector: Constants.LINK_SELECTOR,
        onToggle: handleToggle,
        preferKind: "series",
      });
    }

    // Decorate season items (cards/lists)
    for (const item of gather(Constants.SEASON_ITEM_SELECTOR)) {
      if (!Utils.$("a[href^='/season/']", item)) {
        continue;
      }
      // Avoid double decoration
      if (item.getAttribute(Constants.ITEM_DECORATED_ATTR) === "season") {
        continue;
      }
      if (item.closest("table, tr")) {
        continue;
      }
      ContentDecorator.decorateItem(item, {
        type: "season",
        selector: Constants.LINK_SELECTOR,
        onToggle: handleToggle,
        preferKind: "season",
      });
    }

    // Decorate movie items (cards)
    for (const item of gather(Constants.MOVIE_ITEM_SELECTOR)) {
      ContentDecorator.decorateItem(item, {
        type: "movie",
        selector: Constants.LINK_SELECTOR,
        onToggle: handleToggle,
      });
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
      }

      ContentDecorator.updateItemUI(id, { type: "episode" });

      // Visually update associated season and series
      const pathInfo = PathAnalyzer.analyze(id);
      if (pathInfo.isValid) {
        if (pathInfo.hierarchy.seasonId) {
          ContentDecorator.updateItemUI(pathInfo.hierarchy.seasonId, { type: "season" });
        }
        if (pathInfo.hierarchy.seriesId) {
          ContentDecorator.updateItemUI(pathInfo.hierarchy.seriesId, { type: "series" });
        }
      }
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
      return;
    }
  };

  const setupSyncChannel = () => {
    if ("BroadcastChannel" in window) {
      syncChannel = new BroadcastChannel(Constants.SYNC_CHANNEL_NAME);
      syncChannel.onmessage = async (event) => {
        const { id, seen } = event.data || {};
        await withErrorHandling(() => Store.receiveSync(id, seen), {
          logContext: "BroadcastChannel receiveSync",
        });
      };
    } else {
      // Fallback to localStorage events
      window.addEventListener("storage", async (event) => {
        if (event.key === Constants.SYNC_CHANNEL_NAME && event.newValue) {
          await withErrorHandling(
            async () => {
              const data = JSON.parse(event.newValue);
              await Store.receiveSync(data.id, data.seen);
            },
            { logContext: "LocalStorage sync event" },
          );
        }
      });
    }
  };

  const setupGlobalClickListener = () => {
    document.addEventListener(
      "click",
      async (event) => {
        const link = event.target?.closest("a[href]");
        if (!link) {
          return;
        }

        // Solo interceptar click izquierdo “normal” (sin Ctrl/Cmd/Shift/Alt)
        const isPlainLeftClick =
          event.button === 0 &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey;

        const pathInfo = PathAnalyzer.analyze(link.href);

        if (!pathInfo.isValid) {
          return;
        }

        // Only auto-mark episodes and movies when clicking
        if (
          pathInfo.type !== PathAnalyzer.EntityType.EPISODE &&
          pathInfo.type !== PathAnalyzer.EntityType.MOVIE
        ) {
          return;
        }

        // If already marked as seen, do nothing
        if (Store.getStatus(pathInfo.type, pathInfo.id) === "seen") {
          return;
        }

        // Mark as seen and propagate
        if (isPlainLeftClick) {
          event.preventDefault();
        }
        await handleToggle(
          pathInfo.type,
          pathInfo.id,
          Store.getStatus(pathInfo.type, pathInfo.id),
          link.closest("tr, .episode, .movie"),
        );

        // Synchronize across tabs
        if (syncChannel) {
          syncChannel.postMessage({ id: pathInfo.id, seen: true });
        } else {
          // Fallback: Trigger cross-tab sync via localStorage event
          localStorage.setItem(
            Constants.SYNC_CHANNEL_NAME,
            JSON.stringify({ id: pathInfo.id, seen: true }),
          );
          // Remove immediately: ensures event only notifies, doesn't persist data
          localStorage.removeItem(Constants.SYNC_CHANNEL_NAME);
        }

        if (isPlainLeftClick) {
          window.location.assign(link.href);
        }
      },
      { capture: true, passive: false },
    );
  };

  // Handles state changes from the Store and updates the UI accordingly.
  const handleStateChange = (change) => {
    if (change.type === "INIT") {
      document.documentElement.classList.toggle(
        Constants.ROOT_HL_CLASS,
        Store.isRowHighlightOn(),
      );
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
    const TYPE_MAP = { SERIES: "series", SEASON: "season", EPISODE: "episode", MOVIE: "movie" };
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

    // Subscribe to state changes for real-time UI updates
    Store.subscribe(handleStateChange);

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
    DOMObserver.observe((nodes = []) => {
      if (!Array.isArray(nodes) || nodes.length === 0) {
        applyAll();
        return;
      }

      const seen = new Set();
      for (const node of nodes) {
        if (!(node instanceof Element)) {
          continue;
        }
        if (seen.has(node)) {
          continue;
        }
        seen.add(node);
        applyAll(node);
      }
    });

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

  return { init };
})();
export default AppController;

