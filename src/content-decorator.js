import { Constants, STATE_WATCHING, STATE_COMPLETED } from './constants.js';
import PathAnalyzer from './path-analyzer.js';
import Store from './store.js';
import Utils from './utils.js';
import I18n from './i18n.js';

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
  const decorateItem = (item, { type, selector, onToggle, preferKind = null }) => {
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

export default ContentDecorator;
