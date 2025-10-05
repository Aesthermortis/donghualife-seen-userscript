import { Constants, STATE_UNTRACKED, STATE_WATCHING, STATE_COMPLETED } from "./constants.js";
import PathAnalyzer from "./path-analyzer.js";
import Store from "./store.js";
import Utils from "./utils.js";
import I18n from "./i18n.js";
import UIManager from "./ui-manager.js";

/**
 * @module ContentDecorator
 * @description Unified decorator for episode, season, and series items.
 */
const ContentDecorator = (() => {
  /**
   * Computes the unique ID for the given item.
   * Supports different strategies based on the target type.
   */
  const fallbackIdMap = new WeakMap();
  const sessionFallbackIdPrefix =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  let fallbackLocalSeq = 0;
  /**
   * Generates a collision-resistant fallback identifier within the current session.
   * @returns {string}
   */
  function makeFallbackId() {
    fallbackLocalSeq += 1;
    return `no-link:${sessionFallbackIdPrefix}:${fallbackLocalSeq}`;
  }

  const getPrimaryLink = (item, type) => {
    let selector = null;
    switch (type) {
      case "episode":
        selector = Constants.EPISODE_LINK_SELECTOR;
        break;
      case "season":
        selector = Constants.SEASON_LINK_SELECTOR;
        break;
      case "series":
        selector = Constants.SERIES_LINK_SELECTOR;
        break;
      case "movie":
        selector = Constants.MOVIE_LINK_SELECTOR;
        break;
      default:
        selector = null;
    }
    if (selector) {
      const link = item.querySelector(selector);
      if (link) {
        return link;
      }
    }
    return item.querySelector(Constants.LINK_SELECTOR) || null;
  };

  const computeStableId = (item, type) => {
    const existing = item.getAttribute(Constants.ITEM_ID_ATTR);
    if (existing) {
      return existing;
    }

    const link = type ? getPrimaryLink(item, type) : null;
    if (link) {
      const href = link.getAttribute("href");
      if (href) {
        const result = PathAnalyzer.analyze(href);
        if (result.isValid) {
          return result.id;
        }
        return href;
      }
    }

    if (fallbackIdMap.has(item)) {
      return fallbackIdMap.get(item);
    }

    const fallbackId = makeFallbackId();
    fallbackIdMap.set(item, fallbackId);
    return fallbackId;
  };

  const ensureItemIdentifiers = (item, type) => {
    const normalizedType = type ?? item.getAttribute(Constants.ITEM_DECORATED_ATTR);

    if (!normalizedType) {
      return null;
    }

    if (item.getAttribute(Constants.ITEM_DECORATED_ATTR) !== normalizedType) {
      item.setAttribute(Constants.ITEM_DECORATED_ATTR, normalizedType);
    }

    let id = item.getAttribute(Constants.ITEM_ID_ATTR);
    if (!id) {
      id = computeStableId(item, normalizedType);
      if (!id) {
        return null;
      }
      item.setAttribute(Constants.ITEM_ID_ATTR, id);
    }

    return id;
  };

  const collectVisibleEpisodeIds = (card) => {
    const body = Utils.$(".card-body", card) || card;
    const selector = `[${Constants.ITEM_DECORATED_ATTR}="episode"]`;
    const items = Utils.$$(selector, body);
    const ids = [];
    const seen = new Set();

    for (const element of items) {
      if (!Utils.isElementVisible(element)) {
        continue;
      }
      const id = ensureItemIdentifiers(element, "episode");
      if (!id || seen.has(id)) {
        continue;
      }
      seen.add(id);
      ids.push(id);
    }

    return ids;
  };

  /**
   * Ensures that bulk action controls (mark/unmark all visible episodes)
   * are present in the episode card header. Adds accessible buttons for
   * bulk marking and unmarking, and wires up click handlers to perform
   * the corresponding bulk actions.
   *
   * @param {Element} item - The episode element for which to ensure bulk controls.
   */
  function ensureBulkControls(item) {
    if (!item || item.getAttribute(Constants.ITEM_DECORATED_ATTR) !== "episode") {
      return;
    }
    const card = item.closest(".card");
    if (!card) {
      return;
    }
    const header = Utils.$(".card-header", card);
    const table = Utils.$("table[data-us-dhl-ctrlcol]", card);
    if (!header || !table || header.getAttribute(Constants.BULK_READY_ATTR) === "1") {
      return;
    }

    header.setAttribute(Constants.BULK_READY_ATTR, "1");
    header.classList.add(Constants.BULK_HEADER_CLASS);

    const controls = document.createElement("div");
    controls.className = Constants.BULK_ACTIONS_CLASS;
    controls.setAttribute(Constants.BULK_ACTIONS_ATTR, "1");
    controls.setAttribute("role", "group");
    controls.setAttribute("aria-label", I18n.t("bulkActionsGroupLabel"));

    const markButton = document.createElement("button");
    markButton.type = "button";
    markButton.className = `${Constants.BTN_CLASS} ${Constants.BULK_BTN_CLASS}`;
    markButton.textContent = I18n.t("bulkMarkVisibleEpisodes");
    markButton.title = I18n.t("bulkMarkVisibleEpisodesLabel");
    markButton.setAttribute("aria-label", I18n.t("bulkMarkVisibleEpisodesLabel"));
    markButton.addEventListener("click", () => {
      void handleBulkToggle(card, { mark: true });
    });

    const unmarkButton = document.createElement("button");
    unmarkButton.type = "button";
    unmarkButton.className = `${Constants.BTN_CLASS} ${Constants.BULK_BTN_CLASS}`;
    unmarkButton.textContent = I18n.t("bulkUnmarkVisibleEpisodes");
    unmarkButton.title = I18n.t("bulkUnmarkVisibleEpisodesLabel");
    unmarkButton.setAttribute("aria-label", I18n.t("bulkUnmarkVisibleEpisodesLabel"));
    unmarkButton.addEventListener("click", () => {
      void handleBulkToggle(card, { mark: false });
    });

    controls.append(markButton, unmarkButton);
    header.appendChild(controls);
  }

  /**
   * Updates the visual state and ARIA attributes of a toggle button
   * based on the item type and current status.
   *
   * @param {HTMLButtonElement} btn - The button element to update.
   * @param {string} type - The type of item ("episode", "movie", "series", "season").
   * @param {string} status - The current status ("seen", STATE_WATCHING, STATE_COMPLETED, etc.).
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
      const isFollowed = status === STATE_COMPLETED || status === STATE_WATCHING;
      ariaLabelKey = "btnToggleWatching";
      btn.setAttribute("aria-pressed", String(isFollowed));
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
   * Creates a toggle button for marking an item as seen/watching/completed.
   * The button is styled and configured according to the item type and status.
   * Used for both card and table row contexts.
   *
   * @param {string} type - The type of item ("episode", "movie", "series", "season").
   * @param {string} status - The current status of the item.
   * @param {boolean} isCard - Whether the button is for a card (true) or a table row (false).
   * @returns {HTMLButtonElement} The configured button element.
   */
  const makeButton = (type, status, isCard) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = isCard
      ? `${Constants.BTN_CLASS} ${Constants.CARD_BTN_CLASS}`
      : Constants.BTN_CLASS;
    b.setAttribute(Constants.BTN_TYPE_ATTR, type);
    b.setAttribute(Constants.OWNED_ATTR, "1");
    updateButtonState(b, type, status);
    return b;
  };

  /**
   * Prepares a table for episode controls by adding a control cell to the header row.
   * Ensures the table is only marked up once per session.
   *
   * @param {HTMLTableElement} table - The table element to prepare.
   */
  const prepareTable = (table) => {
    if (!table || table.hasAttribute(Constants.TABLE_MARK_ATTR)) {
      return;
    }
    const headerRow = table.tHead?.rows?.[0];
    if (headerRow) {
      const th = document.createElement("th");
      th.className = Constants.CTRL_CELL_CLASS;
      th.setAttribute(Constants.OWNED_ATTR, "1");
      headerRow.appendChild(th);
    }
    table.setAttribute(Constants.TABLE_MARK_ATTR, "1");
  };

  /**
   * Creates and appends a table cell (<td>) to the given row for episode control buttons.
   * The cell is assigned the appropriate class and attribute for identification.
   *
   * @param {HTMLTableRowElement} row - The table row to which the control cell will be appended.
   * @returns {HTMLTableCellElement} The newly created control cell element.
   */
  const getButtonContainerForRow = (row) => {
    const c = document.createElement("td");
    c.className = Constants.CTRL_CELL_CLASS;
    c.setAttribute(Constants.OWNED_ATTR, "1");
    row.appendChild(c);
    return c;
  };

  /**
   * Updates the visual state and CSS classes of a content item based on its type and status.
   * For episodes and movies, toggles the "seen" class. For series and seasons, toggles
   * "watching" and "completed" classes. Also updates the corresponding toggle button state.
   *
   * @param {Element} item - The DOM element representing the content item.
   * @param {string} type - The type of the item ("episode", "movie", "series", "season").
   * @param {string} status - The current status of the item ("seen", STATE_WATCHING, STATE_COMPLETED, etc.).
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
   * Decorates a content item (episode, movie, series, or season) with a toggle button
   * for marking its state (seen, watching, completed). Ensures the item is only decorated once,
   * sets up bulk controls for episodes, and wires up the toggle handler.
   *
   * @param {Element} item - The DOM element representing the content item.
   * @param {Object} options - Options for decoration.
   * @param {string} options.type - The type of item ("episode", "movie", "series", "season").
   * @param {Function} options.onToggle - Callback invoked when the toggle button is clicked.
   * @param {string|null} [options.preferKind=null] - Optional override for the decorated kind.
   */
  const decorateItem = (item, { type, onToggle, preferKind = null }) => {
    if (item.getAttribute(Constants.ITEM_DECORATED_ATTR) === type) {
      return;
    }

    const ancestorWithSameType = item.closest(`[${Constants.ITEM_DECORATED_ATTR}="${type}"]`);
    if (ancestorWithSameType && ancestorWithSameType !== item) {
      return;
    }
    // Store kind if relevant
    if ((type === "series" || type === "season") && preferKind) {
      item.setAttribute(Constants.KIND_ATTR, preferKind);
    }

    const id = ensureItemIdentifiers(item, type);
    if (!id) {
      return;
    }

    if (type === "episode") {
      ensureBulkControls(item);
    }

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
   * Ensures that the given series is marked as "watching" in the persistent store.
   * If the series is not already tracked as "watching", updates its state and optionally shows a toast notification.
   * Also refreshes the UI for the series.
   *
   * @async
   * @function ensureSeriesWatching
   * @param {string} seriesId - The unique identifier for the series.
   * @param {Object} [options={}] - Optional configuration object.
   * @param {boolean} [options.showToast=false] - Whether to show a toast notification when auto-tracking.
   * @returns {Promise<void>}
   */
  async function ensureSeriesWatching(seriesId, { showToast = false } = {}) {
    if (!seriesId) {
      return;
    }
    const currentStatus = Store.getStatus("series", seriesId);
    if (currentStatus === STATE_WATCHING) {
      updateItemUI(seriesId, { type: "series" });
      return;
    }

    const seriesName = PathAnalyzer.formatSeriesName(seriesId) || "Unknown Series";
    await Store.setState("series", seriesId, STATE_WATCHING, { name: seriesName });
    if (showToast && currentStatus === STATE_UNTRACKED) {
      UIManager.showToast(I18n.t("toastAutoTrackSeries", { seriesName }));
    }
    updateItemUI(seriesId, { type: "series" });
  }

  /**
   * Ensures that the given season is marked as "watching" in the persistent store.
   * If the season is not already tracked as "watching", updates its state and optionally shows a toast notification.
   * Also refreshes the UI for the season and ensures the parent series is tracked as "watching".
   *
   * @async
   * @function ensureSeasonWatching
   * @param {string} seasonId - The unique identifier for the season.
   * @param {Object} [options={}] - Optional configuration object.
   * @param {boolean} [options.showToast=false] - Whether to show a toast notification when auto-tracking.
   * @returns {Promise<void>}
   */
  async function ensureSeasonWatching(seasonId, { showToast = false } = {}) {
    if (!seasonId) {
      return;
    }
    const currentStatus = Store.getStatus("season", seasonId);
    if (currentStatus === STATE_WATCHING) {
      updateItemUI(seasonId, { type: "season" });
      return;
    }

    const info = PathAnalyzer.analyze(seasonId);
    const payload = {};
    const seasonName = PathAnalyzer.formatSeasonName(seasonId) || "Unknown Season";
    payload.name = seasonName;
    const seriesId = info.isValid ? info.hierarchy?.seriesId || null : null;
    if (seriesId) {
      payload.series_id = seriesId;
    }

    await Store.setState("season", seasonId, STATE_WATCHING, payload);
    if (showToast && currentStatus === STATE_UNTRACKED) {
      UIManager.showToast(I18n.t("toastAutoTrackSeason", { seasonName }));
    }
    updateItemUI(seasonId, { type: "season" });
    if (seriesId) {
      await ensureSeriesWatching(seriesId, { showToast });
    }
  }

  /**
   * Cleans up the season tracking state if all episodes are unmarked ("seen" state is empty).
   * If no episodes remain marked as "seen" and the season is currently tracked as "watching",
   * removes the season from the persistent store and updates the UI.
   *
   * @async
   * @function maybeCleanupSeason
   * @param {string} seasonId - The unique identifier for the season.
   * @returns {Promise<void>}
   */
  async function maybeCleanupSeason(seasonId) {
    if (!seasonId) {
      return;
    }
    const remaining = Store.getEpisodesBySeasonAndState(seasonId, "seen");
    const currentStatus = Store.getStatus("season", seasonId);
    if (remaining.length === 0 && currentStatus === STATE_WATCHING) {
      await Store.remove("season", seasonId);
    }
    updateItemUI(seasonId, { type: "season" });
  }

  /**
   * Cleans up the series tracking state if no seasons or episodes are marked as tracked.
   * If the series has no tracked seasons (watching or completed) and no episodes marked as "seen",
   * removes the series from the persistent store and updates the UI.
   *
   * @async
   * @function maybeCleanupSeries
   * @param {string} seriesId - The unique identifier for the series.
   * @returns {Promise<void>}
   */
  async function maybeCleanupSeries(seriesId) {
    if (!seriesId) {
      return;
    }
    const currentStatus = Store.getStatus("series", seriesId);
    if (currentStatus !== STATE_UNTRACKED) {
      const watchingSeasons = Store.getSeasonsBySeriesAndState(seriesId, STATE_WATCHING);
      const completedSeasons = Store.getSeasonsBySeriesAndState(seriesId, STATE_COMPLETED);
      const hasTrackedSeasons = watchingSeasons.length > 0 || completedSeasons.length > 0;
      if (!hasTrackedSeasons) {
        const hasEpisodes = Store.getEpisodesBySeriesAndState(seriesId, "seen").length > 0;
        if (!hasEpisodes) {
          await Store.remove("series", seriesId);
        }
      }
    }
    updateItemUI(seriesId, { type: "series" });
  }

  /**
   * Handles bulk marking or unmarking of all visible episodes within a card.
   * Collects all visible episode IDs, determines which should be marked or unmarked,
   * updates their state in the persistent store, updates related season and series tracking,
   * refreshes the UI for affected items, and displays a toast notification summarizing the action.
   *
   * @async
   * @function handleBulkToggle
   * @param {Element} card - The card element containing episode items.
   * @param {Object} options - Bulk action options.
   * @param {boolean} options.mark - If true, mark all visible episodes as "seen"; if false, unmark them.
   * @returns {Promise<void>}
   */
  async function handleBulkToggle(card, { mark }) {
    const ids = collectVisibleEpisodeIds(card);
    const emptyKey = mark ? "toastBulkMarkVisibleNone" : "toastBulkUnmarkVisibleNone";

    if (ids.length === 0) {
      UIManager.showToast(I18n.t(emptyKey));
      return;
    }

    const targets = ids.filter((id) => {
      const status = Store.getStatus("episode", id);
      return mark ? status !== "seen" : status === "seen";
    });

    if (targets.length === 0) {
      UIManager.showToast(I18n.t(emptyKey));
      return;
    }

    const seasonIds = new Set();
    const seriesIds = new Set();
    for (const episodeId of targets) {
      const info = PathAnalyzer.analyze(episodeId);
      if (!info.isValid || info.type !== PathAnalyzer.EntityType.EPISODE) {
        continue;
      }
      const { seasonId, seriesId } = info.hierarchy;
      if (seasonId) {
        seasonIds.add(seasonId);
      }
      if (seriesId) {
        seriesIds.add(seriesId);
      }
    }

    if (mark) {
      await Promise.all(targets.map((id) => Store.setState("episode", id, "seen")));
      for (const seasonId of seasonIds) {
        await ensureSeasonWatching(seasonId);
      }
      for (const seriesId of seriesIds) {
        await ensureSeriesWatching(seriesId);
      }
    } else {
      await Promise.all(targets.map((id) => Store.clearState("episode", id)));
      for (const seasonId of seasonIds) {
        await maybeCleanupSeason(seasonId);
      }
      for (const seriesId of seriesIds) {
        await maybeCleanupSeries(seriesId);
      }
    }

    for (const id of targets) {
      updateItemUI(id, { type: "episode" });
    }

    const successKey = mark ? "toastBulkMarkVisibleSuccess" : "toastBulkUnmarkVisibleSuccess";
    UIManager.showToast(I18n.t(successKey, { count: targets.length }));
  }

  /**
   * Computes a stable identifier for a decorated element.
   * If a `selector` is provided, requires a matching link or returns null.
   * The `preferKind` parameter overrides the inferred decorated type.
   *
   * @function computeId
   * @param {Element} element - The DOM element to compute the ID for.
   * @param {string|null} selector - Optional CSS selector for the primary link.
   * @param {string|null} preferKind - Optional override for the decorated kind/type.
   * @returns {string|null} The computed stable identifier, or null if not found.
   */
  const computeId = (element, selector = null, preferKind = null) => {
    if (!element) {
      return null;
    }
    const elementType = preferKind || element.getAttribute(Constants.ITEM_DECORATED_ATTR);
    if (!elementType) {
      return null;
    }
    if (selector) {
      const link = element.querySelector(selector);
      if (!link) {
        const fallbackLink = element.querySelector(Constants.LINK_SELECTOR);
        if (!fallbackLink) {
          return null;
        }
      }
    }
    return ensureItemIdentifiers(element, elementType);
  };

  const updateItemUI = (id, { type }) => {
    const items = Utils.$$(`[${Constants.ITEM_DECORATED_ATTR}="${type}"]`);
    for (const item of items) {
      const nodeId = ensureItemIdentifiers(item, type);
      if (nodeId !== id) {
        continue;
      }
      const status = Store.getStatus(type, id);
      updateItem(item, type, status);
    }
  };

  return { decorateItem, updateItemUI, computeId };
})();

export default ContentDecorator;
