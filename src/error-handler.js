import UIManager from "./ui-manager.js";
import I18n from "./i18n.js";

/**
 * Higher-order async function for centralized error handling.
 * Logs errors, displays a toast via UIManager, and returns null on failure.
 *
 * @param {Function} task - An async function to execute.
 * @param {Object} [options] - Optional configuration.
 * @param {string} [options.errorMessageKey] - i18n key for error toast message.
 * @param {string} [options.logContext] - Context string for error logging.
 * @returns {Promise<*>} Result of the task, or null if an error occurred.
 */
const withErrorHandling = async (task, { errorMessageKey, logContext = "" } = {}) => {
  try {
    return await task();
  } catch (error) {
    console.error(`[DonghuaLife] ${logContext}:`, error);
    if (errorMessageKey) {
      UIManager.showToast(I18n.t(errorMessageKey));
    }
    return null;
  }
};

export default withErrorHandling;
