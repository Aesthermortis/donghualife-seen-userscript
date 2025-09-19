import { DB_NAME, DB_VERSION, STORE_LIST, DB_STORE_PREFS } from "./constants.js";
import UIManager from "./ui-manager.js";
import I18n from "./i18n.js";

/**
 * @module DatabaseManager
 * @description Handles all interactions with the IndexedDB.
 */
const DatabaseManager = (() => {
  let dbInstance = null;
  let blockedNotified = false;
  let versionChangeNotified = false;
  const RELOAD_DELAY_MS = 1800;

  const ensureUiReady = () => {
    try {
      UIManager.injectCSS();
    } catch (error) {
      console.warn("DatabaseManager: failed to inject styles before showing notification.", error);
    }
  };

  const notifyBlocked = () => {
    if (blockedNotified) {
      return;
    }
    blockedNotified = true;
    ensureUiReady();
    try {
      Promise.resolve(
        UIManager.showConfirm({
          title: I18n.t("dbBlockedTitle"),
          text: I18n.t("dbBlockedText"),
          okLabel: I18n.t("dbBlockedReload"),
          cancelLabel: I18n.t("cancel"),
        }),
      )
        .then((shouldReload) => {
          if (shouldReload) {
            location.reload();
          }
        })
        .finally(() => {
          blockedNotified = false;
        });
    } catch (error) {
      blockedNotified = false;
      console.warn("DatabaseManager: failed to display blocked notification.", error);
    }
  };

  const notifyVersionChange = () => {
    if (versionChangeNotified) {
      return;
    }
    versionChangeNotified = true;
    ensureUiReady();
    try {
      UIManager.showToast(I18n.t("toastDbUpgradeReload"));
    } catch (error) {
      console.warn("DatabaseManager: failed to display version change notification.", error);
    }
    setTimeout(() => {
      location.reload();
    }, RELOAD_DELAY_MS);
  };

  function openDB() {
    return new Promise((resolve, reject) => {
      if (dbInstance) {
        return resolve(dbInstance);
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onblocked = () => {
        notifyBlocked();
      };
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
        if (dbInstance) {
          dbInstance.onversionchange = () => {
            if (dbInstance) {
              dbInstance.close();
              dbInstance = null;
            }
            notifyVersionChange();
          };
          dbInstance.onclose = () => {
            dbInstance = null;
          };
        }
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
export default DatabaseManager;
