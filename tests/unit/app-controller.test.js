import { jest } from "@jest/globals";
import { STATE_COMPLETED, STATE_UNTRACKED, STATE_WATCHING } from "../../src/constants.js";

const utilsModuleMock = {
  default: {
    $: jest.fn(() => null),
    $$: jest.fn(() => []),
  },
};

const storeModuleMock = {
  default: {
    getStatus: jest.fn(),
    setState: jest.fn(() => Promise.resolve()),
    clearState: jest.fn(() => Promise.resolve()),
    remove: jest.fn(() => Promise.resolve()),
    getEpisodesBySeasonAndState: jest.fn(() => []),
    getSeasonsBySeriesAndState: jest.fn(() => []),
    getEpisodesBySeriesAndState: jest.fn(() => []),
    getSeasonsForSeries: jest.fn(() => []),
    getEpisodesForSeason: jest.fn(() => []),
    get: jest.fn(() => ({})),
    subscribe: jest.fn(),
    load: jest.fn(() => Promise.resolve()),
    getUserLang: jest.fn(() => "en"),
    isRowHighlightOn: jest.fn(() => false),
    receiveSync: jest.fn(() => Promise.resolve()),
  },
};

const settingsModuleMock = {
  default: {
    createButton: jest.fn(),
  },
};

const contentDecoratorModuleMock = {
  default: {
    decorateItem: jest.fn(),
    updateItemUI: jest.fn(),
    computeId: jest.fn(() => null),
  },
};

const domObserverModuleMock = {
  default: {
    observe: jest.fn(),
    disconnect: jest.fn(),
  },
};

const pathAnalyzerEntityType = {
  EPISODE: "episode",
  SERIES: "series",
  SEASON: "season",
  MOVIE: "movie",
};

const pathAnalyzerModuleMock = {
  default: {
    analyze: jest.fn(),
    EntityType: pathAnalyzerEntityType,
    formatSeasonName: jest.fn(() => "Test Season"),
    formatSeriesName: jest.fn(() => "Test Series"),
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

const errorHandlerModuleMock = {
  default: jest.fn((fn) => fn()),
};

await jest.unstable_mockModule("../../src/utils.js", () => utilsModuleMock);
await jest.unstable_mockModule("../../src/store.js", () => storeModuleMock);
await jest.unstable_mockModule("../../src/settings.js", () => settingsModuleMock);
await jest.unstable_mockModule("../../src/content-decorator.js", () => contentDecoratorModuleMock);
await jest.unstable_mockModule("../../src/dom-observer.js", () => domObserverModuleMock);
await jest.unstable_mockModule("../../src/path-analyzer.js", () => pathAnalyzerModuleMock);
await jest.unstable_mockModule("../../src/ui-manager.js", () => uiManagerModuleMock);
await jest.unstable_mockModule("../../src/i18n.js", () => i18nModuleMock);
await jest.unstable_mockModule("../../src/error-handler.js", () => errorHandlerModuleMock);

const { default: AppController } = await import("../../src/app-controller.js");

const { propagateWatchingState, handleToggle } = AppController.__testables;

const Store = storeModuleMock.default;
const PathAnalyzer = pathAnalyzerModuleMock.default;
const UIManager = uiManagerModuleMock.default;
const I18n = i18nModuleMock.default;

describe("propagateWatchingState", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("keeps completed parents untouched", async () => {
    PathAnalyzer.analyze.mockReturnValue({
      isValid: true,
      type: PathAnalyzer.EntityType.EPISODE,
      hierarchy: {
        seasonId: "season-1",
        seriesId: "series-1",
      },
    });

    Store.getStatus.mockImplementation((type) => {
      if (type === "season") {
        return STATE_COMPLETED;
      }
      if (type === "series") {
        return STATE_COMPLETED;
      }
      return STATE_UNTRACKED;
    });

    await propagateWatchingState("/episode/foo");

    expect(Store.setState).not.toHaveBeenCalled();
    expect(UIManager.showToast).not.toHaveBeenCalled();
  });

  test("auto-tracks only untracked parents", async () => {
    PathAnalyzer.analyze.mockReturnValue({
      isValid: true,
      type: PathAnalyzer.EntityType.EPISODE,
      hierarchy: {
        seasonId: "season-2",
        seriesId: "series-2",
      },
    });

    PathAnalyzer.formatSeasonName.mockReturnValue("Season Two");
    PathAnalyzer.formatSeriesName.mockReturnValue("Series Two");

    Store.getStatus.mockImplementation((type) => {
      if (type === "season") {
        return STATE_UNTRACKED;
      }
      if (type === "series") {
        return STATE_UNTRACKED;
      }
      return STATE_UNTRACKED;
    });

    await propagateWatchingState("/episode/bar");

    expect(Store.setState).toHaveBeenCalledTimes(2);
    expect(Store.setState).toHaveBeenNthCalledWith(1, "season", "season-2", STATE_WATCHING, {
      series_id: "series-2",
      name: "Season Two",
    });
    expect(Store.setState).toHaveBeenNthCalledWith(2, "series", "series-2", STATE_WATCHING, {
      name: "Series Two",
    });
    expect(UIManager.showToast).toHaveBeenCalledTimes(2);
    expect(I18n.t).toHaveBeenCalledWith("toastAutoTrackSeason", { seasonName: "Season Two" });
    expect(I18n.t).toHaveBeenCalledWith("toastAutoTrackSeries", { seriesName: "Series Two" });
  });
});

describe("handleToggle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Store.getEpisodesForSeason.mockReturnValue([]);
    Store.getSeasonsForSeries.mockReturnValue([]);
    Object.defineProperty(global, "localStorage", {
      value: {
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    delete global.localStorage;
  });

  test("completing a season does not emit per-episode sync updates", async () => {
    Store.getEpisodesForSeason.mockReturnValue(["episode-1", "episode-2"]);

    await handleToggle("season", "season-123", STATE_WATCHING);

    expect(Store.setState).toHaveBeenCalledWith("episode", "episode-1", "seen");
    expect(Store.setState).toHaveBeenCalledWith("episode", "episode-2", "seen");
    expect(global.localStorage.setItem).not.toHaveBeenCalled();
    expect(global.localStorage.removeItem).not.toHaveBeenCalled();
  });

  test("completing a series does not emit per-episode sync updates", async () => {
    Store.getSeasonsForSeries.mockReturnValue(["season-1"]);
    Store.getEpisodesForSeason.mockReturnValue(["episode-1", "episode-2"]);

    await handleToggle("series", "series-123", STATE_WATCHING);

    expect(Store.setState).toHaveBeenCalledWith("episode", "episode-1", "seen");
    expect(global.localStorage.setItem).not.toHaveBeenCalled();
    expect(global.localStorage.removeItem).not.toHaveBeenCalled();
  });
});
