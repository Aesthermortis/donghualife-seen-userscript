import UIManager from "./ui-manager.js";
import I18n from "./i18n.js";
import { logError } from "./core/errors.js";

/**
 * Higher-order async function for centralized error handling.
 * Logs errors, displays a toast via UIManager, and returns a controlled value on failure.
 *
 * @param {Function} task - An async function to execute.
 * @param {Object} [options] - Optional configuration.
 * @param {string} [options.errorMessageKey] - i18n key for error toast message.
 * @param {string} [options.logContext] - Context string for error logging.
 * @param {*} [options.fallback] - Value returned when the task fails. Defaults to null.
 * @param {boolean} [options.rethrow=false] - Whether to propagate the error after handling.
 * @param {string} [options.onceKey] - De-duplication key passed to logError.
 * @returns {Promise<*>} Result of the task, or the fallback/null if an error occurred.
 */
const withErrorHandling = async (
  task,
  { errorMessageKey, logContext = "", fallback, rethrow = false, onceKey } = {},
) => {
  try {
    return await task();
  } catch (error) {
    const message = logContext || "Task failed";
    logError(message, error, { onceKey });
    if (errorMessageKey) {
      UIManager.showToast(I18n.t(errorMessageKey));
    }
    if (rethrow) {
      throw error;
    }
    return typeof fallback !== "undefined" ? fallback : null;
  }
};

export default withErrorHandling;
