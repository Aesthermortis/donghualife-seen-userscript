// Polyfills first
import "core-js/stable";
import "fake-indexeddb/auto";
import { jest } from "@jest/globals";
import "jest-extended/all";

// Quiet noisy logs but keep errors
beforeAll(() => {
  jest.spyOn(console, "debug").mockImplementation(() => {});
  jest.spyOn(console, "info").mockImplementation(() => {});
});

// Ensure console methods are restored after the full test run.
afterAll(() => {
  console.debug?.mockRestore?.();
  console.info?.mockRestore?.();
});

// Basic DOM helpers (optional but handy for components using absolute positioned buttons)
beforeEach(() => {
  const mount = document.createElement("div");
  mount.id = "test-root";
  document.body.appendChild(mount);
});

afterEach(() => {
  const mount = document.getElementById("test-root");
  if (mount?.parentNode) {
    mount.parentNode.removeChild(mount);
  }
});

// Minimal RAF/Idle polyfills used by the app controller batching
if (!globalThis.requestAnimationFrame) {
  globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
}
if (!globalThis.cancelAnimationFrame) {
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
}
if (!globalThis.requestIdleCallback) {
  globalThis.requestIdleCallback = (cb) =>
    setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 50 }), 0);
}
if (!globalThis.cancelIdleCallback) {
  globalThis.cancelIdleCallback = (id) => clearTimeout(id);
}
