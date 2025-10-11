import { afterEach, describe, expect, jest, test } from "@jest/globals";
import { select, selectAll } from "../../src/dom/select.js";
import { getSeriesNameForId } from "../../src/dom/titles.js";
import { debounce } from "../../src/timing/debounce.js";

afterEach(() => {
  document.body.innerHTML = "";
  jest.useRealTimers();
});

describe("dom/select", () => {
  test("select returns the first matching element", () => {
    document.body.innerHTML = `
      <section>
        <span class="item">first</span>
        <span class="item">second</span>
      </section>
    `;
    const firstItem = select(".item");
    expect(firstItem).not.toBeNull();
    expect(firstItem?.textContent?.trim()).toBe("first");
  });

  test("selectAll returns all matching elements as an array", () => {
    document.body.innerHTML = `
      <section>
        <span class="item">alpha</span>
        <span class="item">beta</span>
        <span class="item">gamma</span>
      </section>
    `;
    const items = selectAll(".item");
    expect(Array.isArray(items)).toBe(true);
    expect(items).toHaveLength(3);
    expect(items.map((el) => el.textContent?.trim())).toEqual(["alpha", "beta", "gamma"]);
  });
});

describe("dom/titles", () => {
  test("getSeriesNameForId returns the matching link text", () => {
    document.body.innerHTML = `
      <main>
        <a href="/series/abc123/details">  Example Series </a>
      </main>
    `;
    expect(getSeriesNameForId("/series/abc123")).toBe("Example Series");
  });

  test("getSeriesNameForId falls back to page header", () => {
    document.body.innerHTML = `
      <header>
        <h1 class="title">Fallback Title</h1>
      </header>
    `;
    expect(getSeriesNameForId("/series/missing")).toBe("Fallback Title");
  });
});

describe("timing/debounce", () => {
  test("debounce triggers only once after the wait period", () => {
    jest.useFakeTimers();
    const spy = jest.fn();
    const debounced = debounce(spy, 50);
    debounced();
    debounced();
    debounced();

    jest.advanceTimersByTime(49);
    expect(spy).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(spy).toHaveBeenCalledOnce();
  });
});
