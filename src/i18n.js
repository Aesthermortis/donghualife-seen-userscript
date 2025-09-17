import { Constants } from './constants.js';

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

export default I18n;
