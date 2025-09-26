import Store from "../../src/store.js";
import PathAnalyzer from "../../src/path-analyzer.js";

describe("test environment smoke", () => {
  it("loads store and can persist an episode using fake-indexeddb", async () => {
    await Store.load();

    const id = "/episode/demo-series-1-episodio-1";
    await Store.setState("episode", id, "seen");
    expect(Store.getStatus("episode", id)).toBe("seen");

    await Store.remove("episode", id);
    expect(Store.getStatus("episode", id)).toBe("untracked");
  });

  it("PathAnalyzer recognizes episode/season/series shapes", () => {
    const ep = PathAnalyzer.analyze("/episode/demo-series-3-episodio-12");
    expect(ep.isValid).toBe(true);
    expect(ep.type).toBe(PathAnalyzer.EntityType.EPISODE);
    expect(ep.hierarchy.seasonId).toBe("/season/demo-series-3");
    expect(ep.hierarchy.seriesId).toBe("/series/demo-series");

    const season = PathAnalyzer.analyze("/season/demo-series-3");
    expect(season.type).toBe(PathAnalyzer.EntityType.SEASON);

    const series = PathAnalyzer.analyze("/series/demo-series");
    expect(series.type).toBe(PathAnalyzer.EntityType.SERIES);
  });
});
