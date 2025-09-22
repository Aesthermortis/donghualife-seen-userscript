import { afterEach, describe, expect, jest, test } from "@jest/globals";
import Utils from "./utils";

describe("Utils", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    jest.useRealTimers();
  });

  test("$ returns the first matching element", () => {
    document.body.innerHTML = `
      <section>
        <span class="item">first</span>
        <span class="item">second</span>
      </section>
    `;
    const firstItem = Utils.$(".item");
    expect(firstItem).not.toBeNull();
    expect(firstItem?.textContent?.trim()).toBe("first");
  });

  test("$$ returns all matching elements as an array", () => {
    document.body.innerHTML = `
      <section>
        <span class="item">alpha</span>
        <span class="item">beta</span>
        <span class="item">gamma</span>
      </section>
    `;
    const items = Utils.$$(".item");
    expect(Array.isArray(items)).toBe(true);
    expect(items).toHaveLength(3);
    expect(items.map((el) => el.textContent?.trim())).toEqual(["alpha", "beta", "gamma"]);
  });

  test("getSeriesNameForId returns the matching link text", () => {
    document.body.innerHTML = `
      <main>
        <a href="/series/abc123/details">  Example Series </a>
      </main>
    `;
    expect(Utils.getSeriesNameForId("/series/abc123")).toBe("Example Series");
  });

  test("getSeriesNameForId falls back to page header", () => {
    document.body.innerHTML = `
      <header>
        <h1 class="title">Fallback Title</h1>
      </header>
    `;
    expect(Utils.getSeriesNameForId("/series/missing")).toBe("Fallback Title");
  });

  test("debounce triggers only once after the wait period", () => {
    jest.useFakeTimers();
    const spy = jest.fn();
    const debounced = Utils.debounce(spy, 50);
    debounced();
    debounced();
    debounced();

    jest.advanceTimersByTime(49);
    expect(spy).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
