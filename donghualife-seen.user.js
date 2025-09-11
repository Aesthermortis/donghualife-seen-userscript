// ==UserScript==
// @name         DonghuaLife – Mark Watched Episodes (✅)
// @namespace    us_dhl_seen
// @version      3.2.0
// @description  Adds a button to mark watched episodes, syncs status across tabs, and provides data management tools.
// @author       Aesthermortis
// @match        *://*.donghualife.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=donghualife.com
// @run-at       document-idle
// @grant        none
// @license      MIT
// @noframes
// @downloadURL  https://raw.githubusercontent.com/Aesthermortis/donghualife-seen-userscript/main/donghualife-seen.user.js
// @updateURL    https://raw.githubusercontent.com/Aesthermortis/donghualife-seen-userscript/main/donghualife-seen.user.js
// @supportURL   https://github.com/Aesthermortis/donghualife-seen-userscript/issues
// @homepageURL  https://github.com/Aesthermortis/donghualife-seen-userscript
// ==/UserScript==

(() => {
  "use strict";

  // IndexedDB constants
  const DB_NAME = "donghualife-seen-db";
  const DB_VERSION = 4;
  const DB_STORE_SERIES = "Series";
  const DB_STORE_SEASONS = "Seasons";
  const DB_STORE_EPISODES = "Episodes";
  const DB_STORE_MOVIES = "Movies";
  const DB_STORE_PREFS = "Preferences";

  const STORE_LIST = [
    DB_STORE_SERIES,
    DB_STORE_SEASONS,
    DB_STORE_EPISODES,
    DB_STORE_MOVIES,
    DB_STORE_PREFS,
  ];

  const TYPE_TO_STORE = {
    series: DB_STORE_SERIES,
    season: DB_STORE_SEASONS,
    episode: DB_STORE_EPISODES,
    movie: DB_STORE_MOVIES,
  };

  // Main logical states
  const STATE_UNTRACKED = "untracked";
  const STATE_WATCHING = "watching";
  const STATE_COMPLETED = "completed";

  /**
   * @module Constants
   * @description Defines all the constants used throughout the script.
   */
  const Constants = {
    // Sync
    SYNC_CHANNEL_NAME: "us-dhl-sync:v1",

    // DOM Attributes and Classes
    ITEM_SEEN_ATTR: "data-us-dhl-decorated",
    ITEM_SEEN_STATE_ATTR: "data-us-dhl-seen-state",
    ITEM_DECORATED_ATTR: "data-us-dhl-decorated-type",
    ITEM_STATE_ATTR: "data-us-dhl-state",
    TABLE_MARK_ATTR: "data-us-dhl-ctrlcol",
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
    EPISODE_ITEM_SELECTOR: "table tr, .views-row .episode",
    SEASON_ITEM_SELECTOR: ".serie, .season, .views-row .season, .listado-seasons .season, .titulo",
    SERIES_ITEM_SELECTOR: ".series, .views-row .serie, .listado-series .serie, .titulo",
    MOVIE_ITEM_SELECTOR: ".movie, .views-row .movie, .listado-movies .movie",

    // Defaults
    DEFAULT_ROW_HL: false,
    DEFAULT_LANG: "en",
  };

  /**
   * @module CSS
   * @description Contains all the CSS styles injected into the page.
   */
  const CSS = `
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

  /**
   * PathAnalyzer API
   * Centralizes all path analysis logic for the DonghuaLife UserScript
   * @module PathAnalyzer
   */
  const PathAnalyzer = (() => {
    // Entity type constants
    const EntityType = {
      EPISODE: "episode",
      MOVIE: "movie",
      SERIES: "series",
      SEASON: "season",
      UNKNOWN: "unknown",
    };

    // Path patterns configuration
    const pathPatterns = {
      episode: [
        {
          pattern: /^\/episode\/([^/-]+(?:-[^/-]+)*)-(\d+)-episodio-([^/]+)$/i,
          type: "donghualife",
        },
        { pattern: /^\/episode\/(.+?)-(\d+)-(.+)$/i, type: "legacy" },
        { pattern: /^\/watch\//i, type: "generic" },
        { pattern: /^\/capitulo\//i, type: "generic" },
        { pattern: /^\/ver\//i, type: "generic" },
        { pattern: /^\/ep\//i, type: "generic" },
        { pattern: /^\/e\//i, type: "generic" },
      ],
      movie: [
        { pattern: /^\/movie\//i, type: "standard" },
        { pattern: /^\/pelicula\//i, type: "spanish" },
        { pattern: /^\/film\//i, type: "generic" },
        { pattern: /^\/movies\//i, type: "list" },
        { pattern: /^\/ver-pelicula\//i, type: "spanish" },
      ],
      series: [{ pattern: /^\/series\/([^/]+)$/i, type: "standard" }],
      season: [
        { pattern: /^\/season\/([^/-]+(?:-[^/-]+)*)-(\d+)$/i, type: "standard" },
        { pattern: /^\/season\/(.+)$/i, type: "simple" },
      ],
    };

    const excludedPaths = [/\/user\//i, /\/search\//i, /\/category\//i, /\/admin\//i, /\/api\//i];

    /**
     * Main analysis function that returns comprehensive path information
     * @param {string|URL|HTMLAnchorElement} input - Path to analyze (string, URL, or anchor element)
     * @returns {PathInfo} Complete path information
     */
    function analyze(input) {
      const pathname = extractPathname(input);

      if (!pathname) {
        return createErrorResult("Invalid input");
      }

      if (isExcluded(pathname)) {
        return createExcludedResult(pathname);
      }

      // Try to identify the entity type
      const entityInfo = identifyEntity(pathname);

      if (entityInfo.type === EntityType.UNKNOWN) {
        return createUnknownResult(pathname);
      }

      // Extract all related information
      const result = {
        pathname,
        type: entityInfo.type,
        id: pathname, // The pathname itself is the ID
        format: entityInfo.format,
        isValid: true,
        error: null,
      };

      // Add entity-specific information
      switch (entityInfo.type) {
        case EntityType.EPISODE:
          Object.assign(result, extractEpisodeInfo(pathname, entityInfo.format));
          break;
        case EntityType.SEASON:
          Object.assign(result, extractSeasonInfo(pathname, entityInfo.format));
          break;
        case EntityType.SERIES:
          Object.assign(result, extractSeriesInfo(pathname, entityInfo.format));
          break;
        case EntityType.MOVIE:
          Object.assign(result, extractMovieInfo(pathname, entityInfo.format));
          break;
      }

      // Add hierarchy information
      result.hierarchy = buildHierarchy(result);

      // Add metadata
      result.metadata = extractMetadata(result);

      return result;
    }

    /**
     * Extract pathname from various input types
     */
    function extractPathname(input) {
      if (!input) {
        return null;
      }

      // String input
      if (typeof input === "string") {
        try {
          // Check if it's already a pathname
          if (input.startsWith("/")) {
            return input;
          }
          // Try to parse as full URL
          const url = new URL(input);
          return url.pathname;
        } catch {
          return input.startsWith("/") ? input : null;
        }
      }

      // URL object
      if (input instanceof URL) {
        return input.pathname;
      }

      // HTMLAnchorElement - Check for href property instead of instanceof
      if (input.tagName === "A" && input.href) {
        return new URL(input.href, window.location.origin).pathname;
      }

      // HTMLElement with href property
      if (input.nodeType === 1 && input.href) {
        return new URL(input.href, window.location.origin).pathname;
      }

      return null;
    }

    /**
     * Check if path is excluded
     */
    function isExcluded(pathname) {
      return excludedPaths.some((pattern) => pattern.test(pathname));
    }

    /**
     * Identify entity type from pathname
     */
    function identifyEntity(pathname) {
      for (const [type, patterns] of Object.entries(pathPatterns)) {
        for (const { pattern, type: format } of patterns) {
          if (pattern.test(pathname)) {
            return { type, format };
          }
        }
      }
      return { type: EntityType.UNKNOWN, format: null };
    }

    /**
     * Extract episode-specific information
     */
    function extractEpisodeInfo(pathname, format) {
      const info = {
        episodeNumber: null,
        seriesSlug: null,
        seasonNumber: null,
        episodeSlug: null,
      };

      if (format === "donghualife") {
        const match = pathname.match(/^\/episode\/([^/-]+(?:-[^/-]+)*)-(\d+)-episodio-([^/]+)$/i);
        if (match) {
          info.seriesSlug = match[1];
          info.seasonNumber = parseInt(match[2], 10);
          info.episodeSlug = match[3];
        }
      } else if (format === "legacy") {
        const match = pathname.match(/^\/episode\/(.+?)-(\d+)-(.+)$/i);
        if (match) {
          info.seriesSlug = match[1];
          info.seasonNumber = parseInt(match[2], 10);
          info.episodeSlug = match[3];
        }
      }

      return info;
    }

    /**
     * Extract season-specific information
     */
    function extractSeasonInfo(pathname, format) {
      const info = {
        seriesSlug: null,
        seasonNumber: null,
      };

      if (format === "standard") {
        const match = pathname.match(/^\/season\/([^/-]+(?:-[^/-]+)*)-(\d+)$/i);
        if (match) {
          info.seriesSlug = match[1];
          info.seasonNumber = parseInt(match[2], 10);
        }
      } else if (format === "simple") {
        const match = pathname.match(/^\/season\/(.+)$/i);
        if (match) {
          const slug = match[1];
          const lastDashIndex = slug.lastIndexOf("-");
          if (lastDashIndex > 0) {
            const possibleNumber = slug.substring(lastDashIndex + 1);
            if (/^\d+$/.test(possibleNumber)) {
              info.seriesSlug = slug.substring(0, lastDashIndex);
              info.seasonNumber = parseInt(possibleNumber, 10);
            } else {
              info.seriesSlug = slug;
            }
          }
        }
      }

      return info;
    }

    /**
     * Extract series-specific information
     */
    function extractSeriesInfo(pathname, format) {
      const info = {
        seriesSlug: null,
      };

      const match = pathname.match(/^\/series\/([^/]+)$/i);
      if (match) {
        info.seriesSlug = match[1];
      }

      return info;
    }

    /**
     * Extract movie-specific information
     */
    function extractMovieInfo(pathname, format) {
      const info = {
        movieSlug: null,
        language: format === "spanish" ? "es" : "en",
      };

      const match = pathname.match(/^\/(movie|pelicula|film|movies|ver-pelicula)\/([^/]+)$/i);
      if (match) {
        info.movieSlug = match[2];
      }

      return info;
    }

    /**
     * Build hierarchy information
     */
    function buildHierarchy(entityInfo) {
      const hierarchy = {
        seriesId: null,
        seasonId: null,
        episodeId: null,
        movieId: null,
      };

      switch (entityInfo.type) {
        case EntityType.EPISODE:
          hierarchy.episodeId = entityInfo.id;
          if (entityInfo.seriesSlug && entityInfo.seasonNumber) {
            hierarchy.seasonId = `/season/${entityInfo.seriesSlug}-${entityInfo.seasonNumber}`;
            hierarchy.seriesId = `/series/${entityInfo.seriesSlug}`;
          }
          break;

        case EntityType.SEASON:
          hierarchy.seasonId = entityInfo.id;
          if (entityInfo.seriesSlug) {
            hierarchy.seriesId = `/series/${entityInfo.seriesSlug}`;
          }
          break;

        case EntityType.SERIES:
          hierarchy.seriesId = entityInfo.id;
          break;

        case EntityType.MOVIE:
          hierarchy.movieId = entityInfo.id;
          break;
      }

      return hierarchy;
    }

    /**
     * Extract metadata (could be extended to extract from DOM if needed)
     */
    function extractMetadata(entityInfo) {
      return {
        slug: entityInfo.seriesSlug || entityInfo.movieSlug || null,
        title: null, // Could be populated from DOM if element is provided
        extractedAt: Date.now(),
      };
    }

    /**
     * Helper function to create error result
     */
    function createErrorResult(error) {
      return {
        pathname: null,
        type: EntityType.UNKNOWN,
        id: null,
        isValid: false,
        error,
        hierarchy: {},
        metadata: {},
      };
    }

    /**
     * Helper function to create excluded result
     */
    function createExcludedResult(pathname) {
      return {
        pathname,
        type: EntityType.UNKNOWN,
        id: null,
        isValid: false,
        error: "Path is excluded",
        isExcluded: true,
        hierarchy: {},
        metadata: {},
      };
    }

    /**
     * Helper function to create unknown result
     */
    function createUnknownResult(pathname) {
      return {
        pathname,
        type: EntityType.UNKNOWN,
        id: null,
        isValid: false,
        error: "Unknown entity type",
        hierarchy: {},
        metadata: {},
      };
    }

    /**
     * Batch analyze multiple paths
     * @param {Array} inputs - Array of paths to analyze
     * @returns {Array<PathInfo>} Array of results
     */
    function analyzeBatch(inputs) {
      return inputs.map((input) => analyze(input));
    }

    /**
     * Get parent path for a given path
     * @param {string} pathname - Path to analyze
     * @returns {string|null} Parent path or null
     */
    function getParent(pathname) {
      const result = analyze(pathname);

      if (!result.isValid) {
        return null;
      }

      switch (result.type) {
        case EntityType.EPISODE:
          return result.hierarchy.seasonId;
        case EntityType.SEASON:
          return result.hierarchy.seriesId;
        default:
          return null;
      }
    }

    /**
     * Get all parent paths in hierarchy
     * @param {string} pathname - Path to analyze
     * @returns {Array<string>} Array of parent paths from immediate to root
     */
    function getAncestors(pathname) {
      const result = analyze(pathname);
      const ancestors = [];

      if (!result.isValid) {
        return ancestors;
      }

      switch (result.type) {
        case EntityType.EPISODE:
          if (result.hierarchy.seasonId) {
            ancestors.push(result.hierarchy.seasonId);
          }
          if (result.hierarchy.seriesId) {
            ancestors.push(result.hierarchy.seriesId);
          }
          break;
        case EntityType.SEASON:
          if (result.hierarchy.seriesId) {
            ancestors.push(result.hierarchy.seriesId);
          }
          break;
      }

      return ancestors;
    }

    /**
     * Check if a path is of a specific type
     * @param {string} pathname - Path to check
     * @param {string} type - Type to check against
     * @returns {boolean}
     */
    function isType(pathname, type) {
      const result = analyze(pathname);
      return result.isValid && result.type === type;
    }

    /**
     * Get formatted display information
     * @param {string} pathname - Path to format
     * @returns {Object} Formatted information
     */
    function getDisplayInfo(pathname) {
      const result = analyze(pathname);

      if (!result.isValid) {
        return { title: "Unknown", subtitle: null };
      }

      switch (result.type) {
        case EntityType.EPISODE:
          return {
            title: `Episode ${result.episodeSlug || "Unknown"}`,
            subtitle: result.seasonNumber ? `Season ${result.seasonNumber}` : null,
            series: result.seriesSlug ? slugToTitle(result.seriesSlug) : null,
          };

        case EntityType.SEASON:
          return {
            title: result.seasonNumber ? `Season ${result.seasonNumber}` : "Season",
            subtitle: result.seriesSlug ? slugToTitle(result.seriesSlug) : null,
          };

        case EntityType.SERIES:
          return {
            title: result.seriesSlug ? slugToTitle(result.seriesSlug) : "Series",
            subtitle: "Series",
          };

        case EntityType.MOVIE:
          return {
            title: result.movieSlug ? slugToTitle(result.movieSlug) : "Movie",
            subtitle: "Movie",
          };

        default:
          return { title: "Unknown", subtitle: null };
      }
    }

    /**
     * Convert slug to title case
     */
    function slugToTitle(slug) {
      return slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
    }

    /**
     * Format series name from ID or path
     * @param {string} idOrPath
     * @returns {string|null}
     */
    function formatSeriesName(idOrPath) {
      const info = analyze(idOrPath);
      if (!info.isValid || info.type !== EntityType.SERIES) {
        return null;
      }
      return info.seriesSlug ? slugToTitle(info.seriesSlug) : null;
    }

    /**
     * Format season name from ID or path
     * @param {string} idOrPath
     * @returns {string|null}
     */
    function formatSeasonName(idOrPath) {
      const info = analyze(idOrPath);
      if (!info.isValid || info.type !== EntityType.SEASON) {
        return null;
      }
      const series = info.seriesSlug ? slugToTitle(info.seriesSlug) : null;
      if (series && Number.isInteger(info.seasonNumber)) {
        return `${series} - ${info.seasonNumber}`;
      }
      return series;
    }

    // Public API
    return {
      // Main functions
      analyze,
      analyzeBatch,
      formatSeriesName,
      formatSeasonName,

      // Helper functions
      getParent,
      getAncestors,
      isType,
      getDisplayInfo,

      // Type checkers
      isEpisode: (pathname) => isType(pathname, EntityType.EPISODE),
      isMovie: (pathname) => isType(pathname, EntityType.MOVIE),
      isSeries: (pathname) => isType(pathname, EntityType.SERIES),
      isSeason: (pathname) => isType(pathname, EntityType.SEASON),

      // Constants
      EntityType,

      // Utility
      extractPathname,
    };
  })();

  /**
   * @module Utils
   * @description Provides utility functions for DOM manipulation and data parsing.
   */
  const Utils = {
    /**
     * Selects the first element matching the selector.
     * @param {string} sel
     * @param {Document|Element} root
     * @returns {Element|null}
     */
    $: (sel, root = document) => root.querySelector(sel),

    /**
     * Selects all elements matching the selector.
     * @param {string} sel
     * @param {Document|Element} root
     * @returns {Element[]}
     */
    $$: (sel, root = document) => Array.from(root.querySelectorAll(sel)),

    /**
     * Finds the series name for a given seriesId by searching the DOM.
     * @param {string} seriesId
     * @returns {string}
     */
    getSeriesNameForId: (seriesId) => {
      if (typeof seriesId !== "string") {
        return "Unknown Series";
      }
      // Look for a link that starts with the seriesId
      const link = document.querySelector(`a[href^='${seriesId}']`);
      if (link && link.textContent) {
        return link.textContent.trim();
      }
      // Fallback: look for main page title/header
      const header = document.querySelector(
        ".page-title, h1.title, h1, .entry-title, .titulo, .title, header h1",
      );
      if (header && header.textContent) {
        return header.textContent.trim();
      }
      return "Unknown Series";
    },

    /**
     * Finds the season name for a given seasonId by searching the DOM.
     * @param {string} seasonId
     * @returns {string}
     */
    getSeasonNameForId: (seasonId) => {
      if (typeof seasonId !== "string") {
        return "Unknown Season";
      }
      // Look for a link that starts with the seasonId
      const link = document.querySelector(`a[href^='${seasonId}']`);
      if (link && link.textContent) {
        return link.textContent.trim();
      }
      // Fallback: look for main page title/header
      const header = document.querySelector(
        ".season-title, h2.title, h1, .entry-title, .titulo, .title, header h1",
      );
      if (header && header.textContent) {
        return header.textContent.trim();
      }
      return "Unknown Season";
    },

    /**
     * Finds the series title from a root element.
     * @param {Element|Document} root
     * @returns {string|null}
     */
    getSeriesTitleFromElement: (root) => {
      const cands = [
        ".page-title",
        "h1.title",
        "h1",
        ".entry-title",
        ".titulo",
        ".title",
        "header h1",
      ];
      for (const sel of cands) {
        const t = root.querySelector(sel)?.textContent?.trim();
        if (t) {
          return t;
        }
      }
      return null;
    },

    /**
     * Finds the season title from a root element.
     * @param {Element|Document} root
     * @returns {string|null}
     */
    getSeasonTitleFromElement: (root) => {
      const cands = [
        ".season-title",
        "h2.title",
        "h2",
        ".entry-title",
        ".titulo",
        ".title",
        "header h2",
      ];
      for (const sel of cands) {
        const t = root.querySelector(sel)?.textContent?.trim();
        if (t) {
          return t;
        }
      }
      return null;
    },

    /**
     * Debounces a function.
     * @param {Function} fn
     * @param {number} ms
     * @returns {Function}
     */
    debounce: (fn, ms) => {
      let timeoutId;
      return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), ms);
      };
    },

    /**
     * Centralized async error handling (store, db, etc).
     * @param {Function} task - async function performing the operation
     * @param {Object} options - { errorMessageKey, logContext }
     * @returns {Promise<any|null>} Result or null if error occurs
     */
    async withErrorHandling(task, { errorMessageKey, logContext = "" } = {}) {
      try {
        return await task();
      } catch (error) {
        console.error(`[DonghuaLife] ${logContext}:`, error);
        if (errorMessageKey) {
          UIManager.showToast(I18n.t(errorMessageKey));
        }
        return null;
      }
    },
  };

  /**
   * @module I18n
   * @description Handles internationalization and provides translation strings.
   */
  const I18n = (() => {
    const locales = {
      en: {
        // Buttons & Labels
        accept: "Accept",
        cancel: "Cancel",
        close: "Close",
        seen: "Seen",
        mark: "Mark",
        watching: "Watching",
        completed: "Completed",
        btnToggleWatching: "Toggle following state",
        btnTitleWatching: "Following. Click to set Completed.",
        btnTitleCompleted: "Completed. Click to untrack.",
        btnTitleNotWatching: "Not following. Click to follow.",

        // Settings Menu
        settingsTitle: "Script Settings",
        changeLanguage: "Change Language",
        selectLanguage: "Select Language",
        enableHighlight: 'Enable "Seen" item highlight',
        disableHighlight: 'Disable "Seen" item highlight',
        resetDisplayPrefs: "Reset display preferences",
        exportJson: "Export seen (JSON)",
        importJson: "Import seen (JSON)",
        resetAllData: "Reset all seen data",

        // Toasts
        toastErrorLoading: "Error loading user data.",
        toastErrorSaving: "Error saving state.",
        toastErrorExporting: "Error exporting data.",
        toastErrorImporting: "Error: Invalid JSON data provided.",
        toastErrorResetting: "Error resetting data.",
        toastErrorRemoving: "Error removing items.",
        toastErrorClearing: "Error clearing items.",
        toastHighlightEnabled: "Row highlight enabled.",
        toastHighlightDisabled: "Row highlight disabled.",
        toastPrefsReset: "Display preferences have been reset.",
        toastLangChanged: "Language changed. Reloading...",
        toastImportSuccess: "Successfully imported {count} records. Reloading...",
        toastDataReset: "Data reset. Reloading...",
        toastAutoTrackSeason: "Now tracking {seasonName}.",
        toastAutoTrackSeries: "Now tracking {seriesName}.",

        // Modals & Prompts
        exportTitle: "Export Backup",
        exportText: "Copy this text to save a backup of your seen episodes.",
        importTitle: "Import Backup",
        importText: "Paste the backup JSON you saved previously.",
        confirmImportTitle: "Confirm Import",
        confirmImportText:
          "Found {count} records. This will overwrite your current data. Continue?",
        confirmImportOk: "Yes, import",
        resetConfirmTitle: "Confirm Reset",
        resetConfirmText:
          "Are you sure you want to delete all seen episode data? This cannot be undone.",
        resetConfirmOk: "Yes, delete all",

        // ARIA & Titles
        fabTitle: "Script Settings",
        fabAriaLabel: "Open userscript settings",
        btnToggleSeen: "Toggle seen status",
        btnTitleSeen: "Marked as seen. Click to unmark.",
        btnTitleNotSeen: "Not seen. Click to mark.",
      },
      es: {
        // Buttons & Labels
        accept: "Aceptar",
        cancel: "Cancelar",
        close: "Cerrar",
        seen: "Visto",
        mark: "Marcar",
        watching: "Viendo",
        completed: "Completado",
        btnToggleWatching: "Alternar estado de seguimiento",
        btnTitleWatching: "Siguiendo. Clic para marcar Completado.",
        btnTitleCompleted: "Completado. Clic para dejar de seguir.",
        btnTitleNotWatching: "No seguido. Clic para seguir.",

        // Settings Menu
        settingsTitle: "Configuración del Script",
        changeLanguage: "Cambiar Idioma",
        selectLanguage: "Seleccionar Idioma",
        enableHighlight: 'Activar resaltado de "Visto"',
        disableHighlight: 'Desactivar resaltado de "Visto"',
        resetDisplayPrefs: "Restablecer preferencias de visualización",
        exportJson: "Exportar vistos (JSON)",
        importJson: "Importar vistos (JSON)",
        resetAllData: "Restablecer todos los datos",

        // Toasts
        toastErrorLoading: "Error al cargar los datos del usuario.",
        toastErrorSaving: "Error al guardar el estado.",
        toastErrorExporting: "Error al exportar los datos.",
        toastErrorImporting: "Error: El formato JSON proporcionado no es válido.",
        toastErrorResetting: "Error al restablecer los datos.",
        toastErrorRemoving: "Error al eliminar los elementos.",
        toastErrorClearing: "Error al limpiar los elementos.",
        toastHighlightEnabled: "Resaltado de fila activado.",
        toastHighlightDisabled: "Resaltado de fila desactivado.",
        toastPrefsReset: "Las preferencias de visualización han sido restablecidas.",
        toastLangChanged: "Idioma cambiado. Recargando...",
        toastImportSuccess: "Se importaron {count} registros correctamente. Recargando...",
        toastDataReset: "Datos restablecidos. Recargando...",
        toastAutoTrackSeason: "Ahora siguiendo {seasonName}.",
        toastAutoTrackSeries: "Ahora siguiendo {seriesName}.",

        // Modals & Prompts
        exportTitle: "Copia de Seguridad",
        exportText: "Copia este texto para guardar una copia de seguridad de tus episodios vistos.",
        importTitle: "Importar Copia de Seguridad",
        importText: "Pega la copia de seguridad en formato JSON que guardaste.",
        confirmImportTitle: "Confirmar Importación",
        confirmImportText:
          "Se encontraron {count} registros. Esto sobrescribirá tus datos actuales. ¿Continuar?",
        confirmImportOk: "Sí, importar",
        resetConfirmTitle: "Confirmar Restablecimiento",
        resetConfirmText:
          "Estás a punto de borrar todos los datos de episodios vistos. Esta acción no se puede deshacer.",
        resetConfirmOk: "Sí, borrar todo",

        // ARIA & Titles
        fabTitle: "Configuración del Script",
        fabAriaLabel: "Abrir la configuración del userscript",
        btnToggleSeen: "Alternar estado de visto",
        btnTitleSeen: "Marcado como visto. Haz clic para desmarcar.",
        btnTitleNotSeen: "No visto. Haz clic para marcar.",
      },
    };

    let currentTranslations = locales[Constants.DEFAULT_LANG];

    const init = (lang) => {
      const language = lang?.startsWith("es") ? "es" : "en";
      currentTranslations = locales[language];
    };

    const t = (key, replacements = {}) => {
      let translation = currentTranslations[key] || locales[Constants.DEFAULT_LANG][key] || key;
      Object.entries(replacements).forEach(([placeholder, value]) => {
        translation = translation.replace(`{${placeholder}}`, String(value));
      });
      return translation;
    };

    return { init, t, locales };
  })();

  /**
   * @module DatabaseManager
   * @description Handles all interactions with the IndexedDB.
   */
  const DatabaseManager = (() => {
    let dbInstance = null;

    function openDB() {
      return new Promise((resolve, reject) => {
        if (dbInstance) {
          return resolve(dbInstance);
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = function (event) {
          const db = event.target.result;
          for (const store of STORE_LIST) {
            if (!db.objectStoreNames.contains(store)) {
              db.createObjectStore(store, { keyPath: "id" });
            }
          }
          // Add the Preferences store if it doesn't exist
          if (!db.objectStoreNames.contains(DB_STORE_PREFS)) {
            db.createObjectStore(DB_STORE_PREFS, { keyPath: "id" });
          }
        };
        request.onsuccess = function () {
          dbInstance = request.result;
          resolve(dbInstance);
        };
        request.onerror = function () {
          reject(request.error);
        };
        return null;
      });
    }

    function perform(store, mode, fn) {
      return openDB().then(
        (db) =>
          new Promise((resolve, reject) => {
            const tx = db.transaction(store, mode);
            const s = tx.objectStore(store);
            const req = fn(s);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          }),
      );
    }

    return {
      set: (store, key, value) => perform(store, "readwrite", (s) => s.put({ ...value, id: key })),
      delete: (store, key) => perform(store, "readwrite", (s) => s.delete(key)),
      clear: (store) => perform(store, "readwrite", (s) => s.clear()),
      getAll: (store) => perform(store, "readonly", (s) => s.getAll()),
      get: (store, key) => perform(store, "readonly", (s) => s.get(key)),
      getAllKeys: (store) => perform(store, "readonly", (s) => s.getAllKeys()),
      count: (store) => perform(store, "readonly", (s) => s.count()),
    };
  })();

  /**
   * @module UIManager
   * @description Handles all direct DOM manipulations for UI elements like toasts and modals.
   */
  const UIManager = (() => {
    const getToastContainer = () => {
      let container = Utils.$("#us-dhl-toast-container");
      if (!container) {
        container = document.createElement("div");
        container.id = "us-dhl-toast-container";
        container.className = "us-dhl-toast-container";
        document.body.appendChild(container);
      }
      return container;
    };
    const createModal = (content) => {
      const overlay = document.createElement("div");
      overlay.className = "us-dhl-modal-overlay";
      overlay.innerHTML = `<div class="us-dhl-modal" role="dialog" aria-modal="true">${content}</div>`;
      document.body.appendChild(overlay);
      return overlay;
    };
    return {
      injectCSS: () => {
        if (Utils.$("#us-dhl-seen-style")) {
          return;
        }
        const style = document.createElement("style");
        style.id = "us-dhl-seen-style";
        style.textContent = CSS;
        document.head.appendChild(style);
      },
      showToast: (message, duration = 3000) => {
        const toast = document.createElement("div");
        toast.className = "us-dhl-toast";
        toast.textContent = message;
        getToastContainer().appendChild(toast);
        setTimeout(() => toast.remove(), duration);
      },
      showConfirm: ({ title, text, okLabel = I18n.t("accept"), cancelLabel = I18n.t("cancel") }) =>
        new Promise((resolve) => {
          const modalHTML = `<div class="us-dhl-modal-header">${title}</div><div class="us-dhl-modal-body"><p>${text}</p></div><div class="us-dhl-modal-footer"><button class="us-dhl-modal-btn secondary">${cancelLabel}</button><button class="us-dhl-modal-btn primary">${okLabel}</button></div>`;
          const overlay = createModal(modalHTML);
          const close = (value) => {
            overlay.remove();
            resolve(value);
          };
          Utils.$(".primary", overlay).addEventListener("click", () => close(true));
          Utils.$(".secondary", overlay).addEventListener("click", () => close(false));
          overlay.addEventListener("click", () => close(false));
          Utils.$(".us-dhl-modal", overlay).addEventListener("click", (e) => e.stopPropagation());
        }),
      showPrompt: ({ title, text, okLabel = I18n.t("accept"), cancelLabel = I18n.t("cancel") }) =>
        new Promise((resolve) => {
          const modalHTML = `<div class="us-dhl-modal-header">${title}</div><div class="us-dhl-modal-body"><p>${text}</p><textarea></textarea></div><div class="us-dhl-modal-footer"><button class="us-dhl-modal-btn secondary">${cancelLabel}</button><button class="us-dhl-modal-btn primary">${okLabel}</button></div>`;
          const overlay = createModal(modalHTML);
          const input = Utils.$("textarea", overlay);
          const close = (value) => {
            overlay.remove();
            resolve(value);
          };
          Utils.$(".primary", overlay).addEventListener("click", () => close(input.value));
          Utils.$(".secondary", overlay).addEventListener("click", () => close(null));
          overlay.addEventListener("click", () => close(null));
          Utils.$(".us-dhl-modal", overlay).addEventListener("click", (e) => e.stopPropagation());
          input.focus();
        }),
      showExport: ({ title, text, data }) => {
        const modalHTML = `<div class="us-dhl-modal-header">${title}</div><div class="us-dhl-modal-body"><p>${text}</p><textarea readonly></textarea></div><div class="us-dhl-modal-footer"><button class="us-dhl-modal-btn primary">${I18n.t(
          "close",
        )}</button></div>`;
        const overlay = createModal(modalHTML);
        const textarea = Utils.$("textarea", overlay);
        textarea.value = data;
        const close = () => overlay.remove();
        Utils.$(".primary", overlay).addEventListener("click", close);
        overlay.addEventListener("click", close);
        Utils.$(".us-dhl-modal", overlay).addEventListener("click", (e) => e.stopPropagation());
        textarea.select();
      },
      showSettingsMenu: ({ title, actions }) => {
        const actionButtons = actions
          .map(
            (action, index) =>
              `<button class="us-dhl-modal-btn ${
                action.isDestructive ? "secondary" : "primary"
              }" data-action-index="${index}">${action.label}</button>`,
          )
          .join("");
        const modalHTML = `<div class="us-dhl-modal-header">${title}</div><div class="us-dhl-modal-body"><div class="us-dhl-settings-menu">${actionButtons}</div></div>`;
        const overlay = createModal(modalHTML);
        const close = () => overlay.remove();
        Utils.$(".us-dhl-modal", overlay).addEventListener("click", (e) => {
          e.stopPropagation();
          const button = e.target.closest("[data-action-index]");
          if (button) {
            const actionIndex = parseInt(button.dataset.actionIndex, 10);
            if (actions[actionIndex]?.onClick) {
              actions[actionIndex].onClick();
            }
            if (!actions[actionIndex]?.keepOpen) {
              close();
            }
          }
        });
        overlay.addEventListener("click", close);
      },
      showProgress: (message) => {
        const toast = document.createElement("div");
        toast.className = "us-dhl-toast";
        toast.innerHTML = `<div>${message}</div><progress value="0" max="100" class="us-dhl-progress"></progress>`;
        getToastContainer().appendChild(toast);
        return {
          update: (value) => {
            const progress = toast.querySelector("progress");
            if (progress) {
              progress.value = value;
            }
          },
          close: (delay = 1000) => {
            setTimeout(() => toast.remove(), delay);
          },
        };
      },
    };
  })();

  /**
   * @module Store
   * @description Manages the application's state, including seen/watching sets and preferences.
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
      if (prefs) {
        caches.prefs.set("userPreferences", prefs);
      } else {
        caches.prefs.set("userPreferences", {});
      }
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

      return Utils.withErrorHandling(
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
      return Utils.withErrorHandling(
        async () => {
          await DatabaseManager.delete(store, id);
          caches[store].delete(id);
          notify && notify({ type: entityType.toUpperCase() + "_REMOVE", payload: { id } });
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
      return caches.prefs.get("userPreferences") || {};
    }

    // Set user preferences
    async function setPrefs(newPrefs) {
      const mergedPrefs = { ...getPrefs(), ...newPrefs };
      caches.prefs.set("userPreferences", mergedPrefs);
      await DatabaseManager.set(DB_STORE_PREFS, "userPreferences", mergedPrefs).catch(
        console.error,
      );
      return mergedPrefs;
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
      return Utils.withErrorHandling(
        async () => {
          await DatabaseManager.clear(store);
          caches[store].clear();
          notify && notify({ type: entityType.toUpperCase() + "_CLEAR" });
        },
        { errorMessageKey: "toastErrorClearing", logContext: `Error clearing store=${store}` },
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
          console.error(e);
        }
      }
    }

    /**
     * Handles synchronization events from other tabs (BroadcastChannel).
     * Only used for episodes and movies.
     * @param {string} id - The unique identifier of the item.
     * @param {boolean} seen - Whether the item is marked as seen.
     */
    function receiveSync(id, seen) {
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

      if (seen) {
        setState(pathInfo.type, id, "seen");
      } else {
        remove(pathInfo.type, id);
      }
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

  /**
   * @module ContentDecorator
   * @description Unified decorator for episode, season, and series items.
   */
  const ContentDecorator = (() => {
    /**
     * Computes the unique ID for the given item.
     * Supports different strategies based on the target type.
     */
    const computeId = (element, selector, preferKind = null) => {
      let link = null;

      // Find the most specific link according to the preferred type
      if (preferKind === "season") {
        link = Utils.$("a[href^='/season/']", element);
      } else if (preferKind === "series") {
        link = Utils.$("a[href^='/series/']", element);
      }

      if (!link) {
        link = Utils.$(selector, element);
      }

      if (!link?.href) {
        return null;
      }

      const result = PathAnalyzer.analyze(link.href);
      return result.isValid ? result.id : null;
    };

    /**
     * Updates the button text, ARIA, and state based on type and logical status.
     */
    const updateButtonState = (btn, type, status) => {
      let textKey;
      let titleKey;
      let ariaLabelKey;

      if (type === "episode" || type === "movie") {
        const isSet = status === "seen";
        textKey = isSet ? "seen" : "mark";
        titleKey = isSet ? "btnTitleSeen" : "btnTitleNotSeen";
        ariaLabelKey = "btnToggleSeen";
        btn.setAttribute("aria-pressed", String(isSet));
      } else if (type === "series" || type === "season") {
        switch (status) {
          case STATE_COMPLETED:
            textKey = "completed";
            titleKey = "btnTitleCompleted";
            break;
          case STATE_WATCHING:
            textKey = "watching";
            titleKey = "btnTitleWatching";
            break;
          default:
            textKey = "mark";
            titleKey = "btnTitleNotWatching";
        }
        ariaLabelKey = "btnToggleWatching";
        btn.setAttribute("aria-pressed", String(status === STATE_COMPLETED));
      } else {
        console.error(`Unhandled type: ${type}`);
        return;
      }

      btn.textContent = I18n.t(textKey);
      btn.title = I18n.t(titleKey);
      btn.setAttribute("aria-label", I18n.t(ariaLabelKey));
      btn.setAttribute(Constants.ITEM_STATE_ATTR, status);
    };

    /**
     * Creates and returns a state button for the given type and status.
     */
    const makeButton = (type, status, isCard) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = isCard
        ? `${Constants.BTN_CLASS} ${Constants.CARD_BTN_CLASS}`
        : Constants.BTN_CLASS;
      b.setAttribute(Constants.BTN_TYPE_ATTR, type);
      updateButtonState(b, type, status);
      return b;
    };

    /**
     * Adds control column to a table if not present.
     */
    const prepareTable = (table) => {
      if (!table || table.hasAttribute(Constants.TABLE_MARK_ATTR)) {
        return;
      }
      const headerRow = table.tHead?.rows?.[0];
      if (headerRow) {
        const th = document.createElement("th");
        th.className = Constants.CTRL_CELL_CLASS;
        headerRow.appendChild(th);
      }
      table.setAttribute(Constants.TABLE_MARK_ATTR, "1");
    };

    /**
     * Returns the td container to insert the button in a table row.
     */
    const getButtonContainerForRow = (row) => {
      const c = document.createElement("td");
      c.className = Constants.CTRL_CELL_CLASS;
      row.appendChild(c);
      return c;
    };

    /**
     * Applies or removes visual classes for state.
     */
    const updateItem = (item, type, status) => {
      if (type === "episode" || type === "movie") {
        item.classList.toggle(Constants.ITEM_SEEN_CLASS, status === "seen");
      } else if (type === "series" || type === "season") {
        item.classList.toggle(Constants.ITEM_WATCHING_CLASS, status === STATE_WATCHING);
        item.classList.toggle(Constants.ITEM_COMPLETED_CLASS, status === STATE_COMPLETED);
      } else {
        console.error(`Unhandled type in updateItem: ${type}`);
        return;
      }
      const btn =
        item.querySelector(`.${Constants.BTN_CLASS}[${Constants.BTN_TYPE_ATTR}="${type}"]`) ||
        item.querySelector(`.${Constants.BTN_CLASS}`);
      if (btn) {
        updateButtonState(btn, type, status);
      }
    };

    /**
     * Decorates the item (row or card) with the button and state.
     */
    const decorateItem = (item, { type, selector, onToggle, preferKind = null }) => {
      if (item.getAttribute(Constants.ITEM_DECORATED_ATTR) === type) {
        return;
      }
      // Store kind if relevant
      if ((type === "series" || type === "season") && preferKind) {
        item.setAttribute(Constants.KIND_ATTR, preferKind);
      }

      const id = computeId(item, selector, type === "series" ? preferKind : null);
      if (!id) {
        return;
      }

      item.setAttribute(Constants.ITEM_DECORATED_ATTR, type);

      const status = Store.getStatus(type, id);

      updateItem(item, type, status);

      const isCard = !item.matches("tr");
      const btn = makeButton(type, status, isCard);

      let container = item;
      if (!isCard) {
        const table = item.closest("table");
        prepareTable(table);
        container = getButtonContainerForRow(item);
      }
      if (isCard) {
        const cs = window.getComputedStyle(container);
        if (cs.position === "static") {
          container.style.position = "relative";
        }
      }
      container.appendChild(btn);

      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const currentStatus = btn.getAttribute(Constants.ITEM_STATE_ATTR);
        onToggle(type, id, currentStatus, item);
      });
    };

    /**
     * Refreshes UI for the given id.
     */
    const updateItemUI = (id, { type }) => {
      for (const item of Utils.$$(`[${Constants.ITEM_DECORATED_ATTR}="${type}"]`)) {
        const preferKind =
          type === "series" || type === "season" ? item.getAttribute(Constants.KIND_ATTR) : null;

        // Use internal computeId
        const itemId = computeId(item, Constants.LINK_SELECTOR, preferKind);

        if (itemId !== id) {
          continue;
        }
        const status = Store.getStatus(type, id);

        // This method updates the button's text, class, and attributes
        updateItem(item, type, status);
      }
    };

    return { decorateItem, updateItemUI, computeId };
  })();

  /**
   * @module DOMObserver
   * @description Observes the DOM for changes and triggers callbacks.
   */
  const DOMObserver = (() => {
    let observer = null;
    const observe = (callback) => {
      if (observer) {
        observer.disconnect();
      }
      const debouncedCallback = Utils.debounce(callback, 150);
      observer = new MutationObserver((mutationsList) => {
        const hasAddedNodes = mutationsList.some((m) => m.addedNodes.length > 0);
        if (hasAddedNodes) {
          debouncedCallback();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    };
    return { observe };
  })();

  /**
   * @module Settings
   * @description Manages the settings menu and its actions (import, export, etc.).
   */
  const Settings = (() => {
    const exportJSON = async () => {
      try {
        const exportObj = {};
        for (const type of ["episode", "movie", "series", "season"]) {
          // Change these types if you have more or fewer
          exportObj[type] = await Store.getAll(type); // Should return an array of objects with id and state
        }
        UIManager.showExport({
          title: I18n.t("exportTitle"),
          text: I18n.t("exportText"),
          data: JSON.stringify(exportObj, null, 2),
        });
      } catch (error) {
        console.error("Failed to export data:", error);
        UIManager.showToast(I18n.t("toastErrorExporting"));
      }
    };

    const importJSON = async () => {
      const txt = await UIManager.showPrompt({
        title: I18n.t("importTitle"),
        text: I18n.t("importText"),
      });
      if (!txt) {
        return;
      }

      try {
        const parsed = JSON.parse(txt);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          throw new Error("Invalid JSON format.");
        }
        // Simple validation: expects an object by type, each an array of items {id, state}
        const validTypes = ["episode", "movie", "series", "season"];
        let total = 0;
        for (const type of validTypes) {
          if (!parsed[type]) {
            continue;
          }
          total += parsed[type].length;
        }

        const confirmed = await UIManager.showConfirm({
          title: I18n.t("confirmImportTitle"),
          text: I18n.t("confirmImportText", { count: total }),
          okLabel: I18n.t("confirmImportOk"),
        });
        if (!confirmed) {
          return;
        }

        const progress = UIManager.showProgress("Importing...");
        // Clear all types first
        for (const type of validTypes) {
          await Store.clear(type);
        }
        let importedCount = 0;
        for (const type of validTypes) {
          if (!parsed[type]) {
            continue;
          }
          for (const entry of parsed[type]) {
            await Store.setState(type, entry.id, entry.state);
            importedCount += 1;
            progress.update((importedCount / total) * 100);
          }
        }
        progress.close();
        UIManager.showToast(I18n.t("toastImportSuccess", { count: importedCount }));
        setTimeout(() => location.reload(), 1500);
      } catch (error) {
        console.error("Failed to import data:", error);
        UIManager.showToast(I18n.t("toastErrorImporting"));
      }
    };

    const resetAll = async () => {
      const confirmed = await UIManager.showConfirm({
        title: I18n.t("resetConfirmTitle"),
        text: I18n.t("resetConfirmText"),
        okLabel: I18n.t("resetConfirmOk"),
        isDestructive: true,
      });
      if (!confirmed) {
        return;
      }

      try {
        for (const type of ["episode", "movie", "series", "season"]) {
          await Store.clear(type);
        }
        UIManager.showToast(I18n.t("toastDataReset"));
        setTimeout(() => location.reload(), 1500);
      } catch (error) {
        console.error("Failed to reset data:", error);
        UIManager.showToast(I18n.t("toastErrorResetting"));
      }
    };

    const openLanguageMenu = () => {
      const langActions = [
        {
          label: "English",
          onClick: () => changeLanguage("en"),
        },
        {
          label: "Español",
          onClick: () => changeLanguage("es"),
        },
      ];
      UIManager.showSettingsMenu({
        title: I18n.t("selectLanguage"),
        actions: langActions,
      });
    };

    const changeLanguage = async (lang) => {
      await Store.setPrefs({ ...Store.getPrefs(), userLang: lang });
    };

    const openMenu = () => {
      const isHlOn = Store.isRowHighlightOn();
      const actions = [
        {
          label: I18n.t("changeLanguage"),
          onClick: openLanguageMenu,
          keepOpen: true,
        },
        {
          label: isHlOn ? I18n.t("disableHighlight") : I18n.t("enableHighlight"),
          onClick: async () => {
            const currentPrefs = Store.getPrefs();
            const newHighlightState = !isHlOn;
            await Store.setPrefs({ ...currentPrefs, rowHighlight: newHighlightState });
            UIManager.showToast(
              newHighlightState
                ? I18n.t("toastHighlightEnabled")
                : I18n.t("toastHighlightDisabled"),
            );
          },
        },
        {
          label: I18n.t("resetDisplayPrefs"),
          isDestructive: true,
          onClick: async () => {
            await Store.setPrefs({});
            UIManager.showToast(I18n.t("toastPrefsReset"));
          },
        },
        {
          label: I18n.t("exportJson"),
          onClick: exportJSON,
          keepOpen: true,
        },
        {
          label: I18n.t("importJson"),
          onClick: importJSON,
          keepOpen: true,
        },
        {
          label: I18n.t("resetAllData"),
          onClick: resetAll,
          isDestructive: true,
          keepOpen: true,
        },
      ];
      UIManager.showSettingsMenu({ title: I18n.t("settingsTitle"), actions });
    };
    const createButton = () => {
      if (Utils.$(`.${Constants.FAB_CLASS}`)) {
        return;
      }
      const fab = document.createElement("button");
      fab.className = Constants.FAB_CLASS;
      fab.title = I18n.t("fabTitle");
      fab.setAttribute("aria-label", I18n.t("fabAriaLabel"));
      fab.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.44,0.17-0.48,0.41L9.22,5.72C8.63,5.96,8.1,6.29,7.6,6.67L5.22,5.71C5,5.64,4.75,5.7,4.63,5.92L2.71,9.24 c-0.12,0.2-0.07,0.47,0.12,0.61l2.03,1.58C4.8,11.66,4.78,11.98,4.78,12.3c0,0.32,0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.38,2.91 c0.04,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.48,0.41l0.38-2.91c0.59-0.24,1.12-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0.02,0.59-0.22l1.92-3.32c0.12-0.2,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/></svg>';
      fab.addEventListener("click", openMenu);
      document.body.appendChild(fab);
    };
    return { createButton };
  })();

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
      // Decorate episode items (table rows and cards)
      for (const item of Utils.$$(Constants.EPISODE_ITEM_SELECTOR, root)) {
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
      for (const item of Utils.$$(Constants.SERIES_ITEM_SELECTOR, root)) {
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
      for (const item of Utils.$$(Constants.SEASON_ITEM_SELECTOR, root)) {
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
      for (const item of Utils.$$(Constants.MOVIE_ITEM_SELECTOR, root)) {
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
        syncChannel.onmessage = (event) => {
          const { id, seen } = event.data;
          Store.receiveSync(id, seen);
        };
      } else {
        // Fallback to localStorage events
        window.addEventListener("storage", (event) => {
          if (event.key === Constants.SYNC_CHANNEL_NAME && event.newValue) {
            try {
              const data = JSON.parse(event.newValue);
              Store.receiveSync(data.id, data.seen);
            } catch (e) {
              console.error("Error parsing sync data from localStorage", e);
            }
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
      DOMObserver.observe(() => applyAll());

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

  // --- Entry Point ---
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", AppController.init);
  } else {
    AppController.init();
  }

  // Expose Utils to the global scope
  window.Utils = Utils;
})();
