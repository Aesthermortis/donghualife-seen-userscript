import { beforeAll, describe, expect, test } from "@jest/globals";
import PathAnalyzer from "../../src/path-analyzer.js";

describe("PathAnalyzer", () => {
  beforeAll(() => {
    if (globalThis.location?.href === "about:blank") {
      try {
        delete globalThis.location;
      } catch {
        // Ignore if the runtime does not allow deletion.
      }
      globalThis.location = new URL("http://localhost/series/test-series");
    }
  });

  test("analyzes relative episode paths without a leading slash", () => {
    const result = PathAnalyzer.analyze("episode/test-series-2-episodio-5");

    expect(result.isValid).toBe(true);
    expect(result.type).toBe(PathAnalyzer.EntityType.EPISODE);
    expect(result.id).toBe("/episode/test-series-2-episodio-5");
    expect(result.hierarchy.seasonId).toBe("/season/test-series-2");
    expect(result.hierarchy.seriesId).toBe("/series/test-series");
  });

  describe("extractPathname robustness", () => {
    test("trims input and resolves dot segments", () => {
      expect(PathAnalyzer.analyze("  ./episode/test-series-2-episodio-6  ").id).toBe(
        "/episode/test-series-2-episodio-6",
      );
      expect(PathAnalyzer.analyze("../episode/test-series-2-episodio-7").id).toBe(
        "/episode/test-series-2-episodio-7",
      );
    });

    test("ignores non-http(s) schemes", () => {
      expect(PathAnalyzer.analyze("javascript:void(0)").isValid).toBe(false);
      expect(PathAnalyzer.analyze("mailto:foo@bar.com").isValid).toBe(false);
    });

    test("extracts pathname from absolute HTTPS URL", () => {
      const result = PathAnalyzer.analyze("HTTPS://example.com/episode/test-series-2-episodio-8");

      expect(result.isValid).toBe(true);
      expect(result.id).toBe("/episode/test-series-2-episodio-8");
    });

    test("handles anchor-like elements across realms", () => {
      const anchor = document.createElement("a");
      anchor.setAttribute("href", "episode/test-series-2-episodio-9");

      const result = PathAnalyzer.analyze(anchor);

      expect(result.isValid).toBe(true);
      expect(result.id).toBe("/episode/test-series-2-episodio-9");
    });

    test("strips query parameters and hash fragments", () => {
      const result = PathAnalyzer.analyze("/episode/test-series-2-episodio-10?utm=1#part");

      expect(result.isValid).toBe(true);
      expect(result.id).toBe("/episode/test-series-2-episodio-10");
    });

    test("rejects empty or whitespace-only inputs", () => {
      expect(PathAnalyzer.analyze(" ").isValid).toBe(false);
      expect(PathAnalyzer.analyze("").isValid).toBe(false);
    });

    test("extracts pathname from absolute HTTP URL", () => {
      const r = PathAnalyzer.analyze("http://example.com/episode/test-series-2-episodio-11");
      expect(r.isValid).toBe(true);
      expect(r.id).toBe("/episode/test-series-2-episodio-11");
    });
  });
});
