# Copilot Instructions for DonghuaLife Seen Userscript

## Project Overview

- **Purpose:** Adds persistent "Mark as Seen" toggles to donghualife.com episodes, using IndexedDB for storage and a floating UI for settings.
- **Entry Point:** `src/index.js` initializes the app via `AppController.init()` on DOM ready.
- **Architecture:** Modular, with clear separation:
  - `app-controller.js`: Orchestrates all logic and UI decoration
  - `store.js`: Manages in-memory and persistent state (IndexedDB via `database-manager.js`)
  - `ui-manager.js`: Handles DOM UI (toasts, modals, CSS injection)
  - `content-decorator.js`: Adds seen/watching/completed toggles to episode/series/season/movie elements
  - `dom-observer.js`: Detects new content via `MutationObserver`
  - `settings.js`: User preferences and settings menu
  - `constants.js`: All selectors, attribute names, and DB constants
  - `utils.js`: DOM and general helpers

## Key Patterns & Conventions

- **ESLint enforced:** All code must pass linting (see `eslint.config.js`). Use curly braces for all control blocks.
- **English only:** All code, comments, and variables are in English.
- **Atomic changes:** Only edit code directly relevant to the task. Do not refactor unrelated code in the same commit.
- **Immutability:** Prefer immutable data structures and pure functions where possible.
- **Error handling:** Use `withErrorHandling` HOC for async operations and UI actions.
- **UI updates:** Always use `UIManager` for DOM changes, not direct DOM manipulation in business logic.
- **State:** Use `Store` for all state changes; do not access IndexedDB directly except via `database-manager.js`.
- **Selectors:** Use selectors from `constants.js` for all DOM queries.
- **Accessibility:** All UI must use ARIA attributes and be keyboard accessible.

## Developer Workflows

- **Build:** No build step required for userscript; edit files in `src/` and test directly in browser via userscript manager.
- **Lint:** Run `npm run lint` (uses ESLint, see config).
- **Test:** No formal test suite; manual testing in browser is required. (Add tests if you introduce new modules.)
- **Debug:** Use browser devtools; all major modules are exposed on `window` for debugging.

## Integration Points

- **IndexedDB:** All persistent data is stored in DB defined in `constants.js` and managed by `database-manager.js`.
- **MutationObserver:** New episode/series/season/movie elements are detected and decorated automatically.
- **Settings:** User preferences are stored in IndexedDB and managed via the floating settings menu.

## Examples

- To add a new UI feature, create a new module in `src/`, export a function, and call it from `app-controller.js`.
- To add a new persistent state, update `constants.js`, `store.js`, and `database-manager.js`.

## References

- See `AGENTS.md` for full coding standards and philosophy.
- See `README.md` for project purpose and install instructions.

---

If anything is unclear or missing, please ask for clarification or propose an update to this file.
