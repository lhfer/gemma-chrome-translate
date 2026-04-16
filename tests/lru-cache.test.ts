import { LruCache } from "../src/background/lru-cache";

describe("LruCache", () => {
  it("evicts the least recently used value when over capacity", () => {
    const cache = new LruCache<string, string>(2);

    cache.set("a", "one");
    cache.set("b", "two");
    cache.get("a");
    cache.set("c", "three");

    expect(cache.get("a")).toBe("one");
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("c")).toBe("three");
  });
});
