import Store from './store.js';
import UIManager from './ui-manager.js';
import I18n from './i18n.js';
import Utils from './utils.js';
import { Constants } from './constants.js';

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

export default Settings;
