import Store from "./store.js";
import UIManager from "./ui-manager.js";
import I18n from "./i18n.js";
import Utils from "./utils.js";
import { Constants, STATE_WATCHING, STATE_COMPLETED } from "./constants.js";

/**
 * @module Settings
 * @description Manages the settings menu and its actions (import, export, etc.).
 */
const Settings = (() => {
  const SUPPORTED_TYPES = ["episode", "movie", "series", "season"];
  const ALLOWED_STATES = {
    episode: new Set(["seen"]),
    movie: new Set(["seen"]),
    series: new Set([STATE_WATCHING, STATE_COMPLETED]),
    season: new Set([STATE_WATCHING, STATE_COMPLETED]),
  };

  const parseBackupPayload = (rawText) => {
    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (error) {
      const err = new Error("Invalid JSON syntax.");
      err.code = "INVALID_JSON";
      err.cause = error;
      throw err;
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      const err = new Error("Backup root must be an object.");
      err.code = "INVALID_ROOT";
      throw err;
    }

    const sanitized = {};
    let total = 0;

    for (const type of SUPPORTED_TYPES) {
      const entries = parsed[type];
      if (entries == null) {
        continue;
      }
      if (!Array.isArray(entries)) {
        const err = new Error(`Backup entry for "${type}" must be an array.`);
        err.code = "INVALID_COLLECTION";
        throw err;
      }

      const allowedStates = ALLOWED_STATES[type];
      const cleaned = [];

      entries.forEach((entry, index) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
          const err = new Error(`Invalid record for "${type}" at index ${index}.`);
          err.code = "INVALID_ENTRY";
          throw err;
        }

        const { id, state } = entry;
        if (typeof id !== "string" || !id.trim()) {
          const err = new Error(`Invalid id for "${type}" at index ${index}.`);
          err.code = "INVALID_ID";
          throw err;
        }

        if (typeof state !== "string") {
          const err = new Error(`Invalid state for "${type}" at index ${index}.`);
          err.code = "INVALID_STATE";
          throw err;
        }

        const normalizedState = state.trim();
        if (!allowedStates.has(normalizedState)) {
          const err = new Error(`Unsupported state "${state}" for "${type}" at index ${index}.`);
          err.code = "INVALID_STATE";
          throw err;
        }

        cleaned.push({ ...entry, id: id.trim(), state: normalizedState });
      });

      if (cleaned.length) {
        sanitized[type] = cleaned;
        total += cleaned.length;
      }
    }

    if (total === 0) {
      const err = new Error("No valid records found in backup.");
      err.code = "NO_RECORDS";
      throw err;
    }

    return { data: sanitized, total };
  };
  const exportJSON = async () => {
    try {
      const exportObj = {};
      for (const type of SUPPORTED_TYPES) {
        exportObj[type] = await Store.getAll(type);
      }
      const jsonData = JSON.stringify(exportObj, null, 2);
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `donghualife-seen-backup-${timestamp}.json`;
      Utils.downloadTextFile(filename, jsonData);
      UIManager.showToast(I18n.t("toastExportSuccess"));
    } catch (error) {
      console.error("Failed to export data:", error);
      UIManager.showToast(I18n.t("toastErrorExporting"));
    }
  };
  const importJSON = async () => {
    const file = await UIManager.showFilePicker({
      title: I18n.t("importTitle"),
      text: I18n.t("importText"),
      accept: ".json,application/json",
    });
    if (!file) {
      return;
    }

    try {
      const fileContents = await file.text();
      const { data, total } = parseBackupPayload(fileContents);

      const confirmed = await UIManager.showConfirm({
        title: I18n.t("confirmImportTitle"),
        text: I18n.t("confirmImportText", { count: total }),
        okLabel: I18n.t("confirmImportOk"),
      });
      if (!confirmed) {
        return;
      }

      const progress = UIManager.showProgress(I18n.t("importingProgress"));
      for (const type of SUPPORTED_TYPES) {
        await Store.clear(type);
      }

      let importedCount = 0;
      for (const type of SUPPORTED_TYPES) {
        const entries = data[type] || [];
        for (const entry of entries) {
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
      if (error?.code === "NO_RECORDS") {
        UIManager.showToast(I18n.t("toastImportEmpty"));
      } else {
        UIManager.showToast(I18n.t("toastErrorImporting"));
      }
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
      for (const type of SUPPORTED_TYPES) {
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
            newHighlightState ? I18n.t("toastHighlightEnabled") : I18n.t("toastHighlightDisabled"),
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
