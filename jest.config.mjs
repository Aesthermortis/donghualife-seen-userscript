export default {
  // Use a DOM-like environment for tests that touch document, window, or location.
  testEnvironment: "jsdom",

  // Make jsdom's URL stable to avoid hostname-origin flakiness in tests.
  testEnvironmentOptions: {
    url: "https://example.test/",
  },

  // Discover both *.test.* and *.spec.* in JS/MJS across the repo (src/ and tests/).
  testMatch: [
    "<rootDir>/tests/**/*.{spec,test}.js",
    "<rootDir>/tests/**/*.{spec,test}.mjs",
    "<rootDir>/tests/**/*.{spec,test}.cjs",
  ],

  // Auto-clear and restore spies/mocks between tests.
  clearMocks: true,
  restoreMocks: true,

  // (Optional) Limit discovery roots if you prefer a narrower search.
  // roots: ["<rootDir>/src", "<rootDir>/tests"],

  // (Optional) Enable V8 coverage and basic include patterns.
  // coverageProvider: "v8",
  // collectCoverageFrom: ["src/**/*.js", "!src/**/*.test.js"]
};
