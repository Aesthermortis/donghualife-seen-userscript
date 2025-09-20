import { Constants } from "./constants.js";

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
      exportJson: "Download seen data (.json)",
      importJson: "Restore seen data from file",
      resetAllData: "Reset all seen data",
      bulkMarkVisibleEpisodesLabel: "Mark visible episodes as seen",
      bulkUnmarkVisibleEpisodesLabel: "Clear seen state from visible episodes",
      bulkMarkVisibleEpisodes: "Mark visible",
      bulkUnmarkVisibleEpisodes: "Clear visible",
      bulkActionsGroupLabel: "Episode bulk actions",

      // Toasts
      toastErrorLoading: "Error loading user data.",
      toastErrorSaving: "Error saving state.",
      toastErrorExporting: "Error exporting data.",
      toastErrorImporting: "Error importing backup data.",
      toastErrorResetting: "Error resetting data.",
      toastErrorRemoving: "Error removing items.",
      toastErrorClearing: "Error clearing items.",
      toastHighlightEnabled: "Row highlight enabled.",
      toastHighlightDisabled: "Row highlight disabled.",
      toastPrefsReset: "Display preferences have been reset.",
      toastLangChanged: "Language changed. Reloading...",
      toastImportSuccess: "Successfully imported {count} records. Reloading...",
      toastExportSuccess: "Backup download started.",
      toastImportEmpty: "Backup file does not contain valid records.",
      toastDataReset: "Data reset. Reloading...",
      toastAutoTrackSeason: "Now tracking {seasonName}.",
      toastAutoTrackSeries: "Now tracking {seriesName}.",
      toastDbUpgradeReload: "Storage updated in another tab. Reloading...",
      toastBulkMarkVisibleSuccess: "Marked {count} visible episodes as seen.",
      toastBulkMarkVisibleNone: "No visible episodes to mark.",
      toastBulkUnmarkVisibleSuccess: "Cleared seen state for {count} visible episodes.",
      toastBulkUnmarkVisibleNone: "No visible episodes are marked as seen.",

      // Modals & Prompts
      exportTitle: "Export Backup",
      exportText: "A JSON backup file will be downloaded automatically.",
      importTitle: "Import Backup",
      importText: "Select the JSON backup file you saved previously.",
      importingProgress: "Importing backup...",
      confirmImportTitle: "Confirm Import",
      confirmImportText: "Found {count} records. This will overwrite your current data. Continue?",
      confirmImportOk: "Yes, import",
      resetConfirmTitle: "Confirm Reset",
      resetConfirmText:
        "Are you sure you want to delete all seen episode data? This cannot be undone.",
      resetConfirmOk: "Yes, delete all",
      dbBlockedTitle: "Finish update",
      dbBlockedText:
        "Close other DonguaLife tabs so the storage upgrade can complete, then reload this page.",
      dbBlockedReload: "Reload now",

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
      exportJson: "Descargar vistos (JSON)",
      importJson: "Restaurar vistos desde archivo",
      resetAllData: "Restablecer todos los datos",
      bulkMarkVisibleEpisodesLabel: "Marcar episodios visibles como vistos",
      bulkUnmarkVisibleEpisodesLabel: "Quitar visto a episodios visibles",
      bulkMarkVisibleEpisodes: "Marcar visibles",
      bulkUnmarkVisibleEpisodes: "Quitar visibles",
      bulkActionsGroupLabel: "Acciones masivas de episodios",

      // Toasts
      toastErrorLoading: "Error al cargar los datos del usuario.",
      toastErrorSaving: "Error al guardar el estado.",
      toastErrorExporting: "Error al exportar los datos.",
      toastErrorImporting: "Error al importar la copia de seguridad.",
      toastErrorResetting: "Error al restablecer los datos.",
      toastErrorRemoving: "Error al eliminar los elementos.",
      toastErrorClearing: "Error al limpiar los elementos.",
      toastHighlightEnabled: "Resaltado de fila activado.",
      toastHighlightDisabled: "Resaltado de fila desactivado.",
      toastPrefsReset: "Las preferencias de visualización han sido restablecidas.",
      toastLangChanged: "Idioma cambiado. Recargando...",
      toastImportSuccess: "Se importaron {count} registros correctamente. Recargando...",
      toastExportSuccess: "Descarga de copia de seguridad iniciada.",
      toastImportEmpty: "El archivo de copia de seguridad no contiene registros validos.",
      toastDataReset: "Datos restablecidos. Recargando...",
      toastAutoTrackSeason: "Ahora siguiendo {seasonName}.",
      toastAutoTrackSeries: "Ahora siguiendo {seriesName}.",
      toastDbUpgradeReload: "Almacenamiento actualizado. Recargando...",
      toastBulkMarkVisibleSuccess: "Se marcaron {count} episodios visibles como vistos.",
      toastBulkMarkVisibleNone: "No hay episodios visibles para marcar.",
      toastBulkUnmarkVisibleSuccess: "Se quitaron los vistos de {count} episodios visibles.",
      toastBulkUnmarkVisibleNone: "No hay episodios visibles marcados como vistos.",

      // Modals & Prompts
      exportTitle: "Copia de Seguridad",
      exportText: "Se descargara un archivo JSON con tu copia de seguridad.",
      importTitle: "Importar Copia de Seguridad",
      importText: "Selecciona el archivo JSON de respaldo que guardaste.",
      importingProgress: "Importando copia de seguridad...",
      confirmImportTitle: "Confirmar Importación",
      confirmImportText:
        "Se encontraron {count} registros. Esto sobrescribirá tus datos actuales. ¿Continuar?",
      confirmImportOk: "Sí, importar",
      resetConfirmTitle: "Confirmar Restablecimiento",
      resetConfirmText:
        "Estás a punto de borrar todos los datos de episodios vistos. Esta acción no se puede deshacer.",
      resetConfirmOk: "Sí, borrar todo",
      dbBlockedTitle: "Actualizacion pendiente",
      dbBlockedText:
        "Cierra las demas pestanas de DonguaLife para completar la actualizacion y luego recarga esta pagina.",
      dbBlockedReload: "Recargar ahora",

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

export default I18n;
