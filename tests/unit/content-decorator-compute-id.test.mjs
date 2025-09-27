import { jest } from "@jest/globals";

const utilsModuleMock = {
  default: {
    $: jest.fn(() => null),
    $$: jest.fn(() => []),
    isElementVisible: jest.fn(() => true),
  },
};

const storeModuleMock = {
  default: {
    getStatus: jest.fn(() => "untracked"),
    setState: jest.fn(() => Promise.resolve()),
    remove: jest.fn(() => Promise.resolve()),
    getEpisodesBySeasonAndState: jest.fn(() => []),
    getSeasonsBySeriesAndState: jest.fn(() => []),
    getEpisodesBySeriesAndState: jest.fn(() => []),
    getSeasonsForSeries: jest.fn(() => Promise.resolve([])),
    getEpisodesForSeason: jest.fn(() => Promise.resolve([])),
    get: jest.fn(() => ({})),
    subscribe: jest.fn(),
    load: jest.fn(() => Promise.resolve()),
    getUserLang: jest.fn(() => "en"),
    isRowHighlightOn: jest.fn(() => false),
    receiveSync: jest.fn(() => Promise.resolve()),
  },
};

const uiManagerModuleMock = {
  default: {
    showToast: jest.fn(),
    injectCSS: jest.fn(),
  },
};

const i18nModuleMock = {
  default: {
    t: jest.fn((key) => key),
    init: jest.fn(),
  },
};

const pathAnalyzerModuleMock = {
  default: {
    analyze: jest.fn(() => ({ isValid: false })),
    EntityType: {
      EPISODE: "episode",
      SEASON: "season",
      SERIES: "series",
      MOVIE: "movie",
    },
  },
};

await jest.unstable_mockModule("../../src/utils.js", () => utilsModuleMock);
await jest.unstable_mockModule("../../src/store.js", () => storeModuleMock);
await jest.unstable_mockModule("../../src/ui-manager.js", () => uiManagerModuleMock);
await jest.unstable_mockModule("../../src/i18n.js", () => i18nModuleMock);
await jest.unstable_mockModule("../../src/path-analyzer.js", () => pathAnalyzerModuleMock);

const { Constants } = await import("../../src/constants.js");
const { default: ContentDecorator } = await import("../../src/content-decorator.js");

const PathAnalyzer = pathAnalyzerModuleMock.default;

beforeEach(() => {
  jest.clearAllMocks();
  PathAnalyzer.analyze.mockImplementation(() => ({ isValid: false }));
});

describe("ContentDecorator.computeId", () => {
  test("prefers provided kind when determining stable id", () => {
    PathAnalyzer.analyze.mockImplementation((href) => {
      if (href.includes("/series/")) {
        return { isValid: true, id: "series-5" };
      }
      if (href.includes("/season/")) {
        return { isValid: true, id: "season-3" };
      }
      return { isValid: false };
    });

    const element = document.createElement("div");
    element.innerHTML = `
      <a class="season-link" href="/season/3">Season</a>
      <a class="series-link" href="/series/5">Series</a>
    `;
    element.setAttribute(Constants.ITEM_DECORATED_ATTR, "season");

    const id = ContentDecorator.computeId(element, Constants.LINK_SELECTOR, "series");

    expect(id).toBe("series-5");
    expect(element.getAttribute(Constants.ITEM_DECORATED_ATTR)).toBe("series");
    expect(element.getAttribute(Constants.ITEM_ID_ATTR)).toBe("series-5");
    expect(PathAnalyzer.analyze).toHaveBeenCalledWith("/series/5");
  });

  test("returns null when selector has no matches or fallbacks", () => {
    const element = document.createElement("div");
    element.setAttribute(Constants.ITEM_DECORATED_ATTR, "series");

    const id = ContentDecorator.computeId(element, ".primary-link");

    expect(id).toBeNull();
    expect(element.hasAttribute(Constants.ITEM_ID_ATTR)).toBe(false);
    expect(PathAnalyzer.analyze).not.toHaveBeenCalled();
  });
});
