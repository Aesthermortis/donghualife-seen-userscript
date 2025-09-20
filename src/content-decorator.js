import { Constants, STATE_WATCHING, STATE_COMPLETED } from "./constants.js";
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
  let fallbackIdSeq = 0;

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

    fallbackIdSeq += 1;
    const fallbackId = `no-link-${fallbackIdSeq}`;
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
   * Creates and returns a state button for the given type and status.
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
      th.setAttribute(Constants.OWNED_ATTR, "1");
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
    c.setAttribute(Constants.OWNED_ATTR, "1");
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
   * Refreshes UI for the given id.
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

    if (mark) {
      await Promise.all(targets.map((id) => Store.setState("episode", id, "seen")));
    } else {
      const removeFn =
        typeof Store.remove === "function"
          ? (episodeId) => Store.remove("episode", episodeId)
          : (episodeId) => Store.setState("episode", episodeId, "untracked");
      await Promise.all(targets.map((id) => removeFn(id)));
    }

    for (const id of targets) {
      updateItemUI(id, { type: "episode" });
    }

    const successKey = mark ? "toastBulkMarkVisibleSuccess" : "toastBulkUnmarkVisibleSuccess";
    UIManager.showToast(I18n.t(successKey, { count: targets.length }));
  }

  const computeId = (element) => {
    const elementType = element.getAttribute(Constants.ITEM_DECORATED_ATTR);
    if (!elementType) {
      return null;
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
