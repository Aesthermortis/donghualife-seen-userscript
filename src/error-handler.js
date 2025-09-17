import UIManager from './ui-manager.js';
import I18n from './i18n.js';

/**
 * Provides centralized error handling for async operations.
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

