import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyData } from "./model";
import { createRevenueStorage } from "./storage";
import { preferNewer } from "./cloudStore";
import type { RevenueData } from "./types";

vi.mock("../lib/supabaseClient", () => ({
  getSupabase: () => null,
  isCloudSyncEnabled: () => false,
}));
const key = "mj-app-revenue-v1:test-owner";
function memoryStorage(initial?: string) {
  const values = new Map<string, string>(initial === undefined ? [] : [[key, initial]]);
  return {
    values,
    getItem: vi.fn((name: string) => values.get(name) ?? null),
    setItem: vi.fn((name: string, value: string) => { values.set(name, value); }),
  };
}
function snapshot(updatedAt: string, goal = 1): RevenueData {
  return { ...emptyData(), goal, meta: { updatedAt } };
}
afterEach(() => vi.useRealTimers());

describe("revenue storage recovery", () => {
  it.each(["", "{unreadable", JSON.stringify({ schema: 1, rows: [] })])(
    "blocks automatic and cloud writes after a read failure", (original) => {
      const storage = memoryStorage(original);
      const store = createRevenueStorage("test-owner", storage);
      const updater = vi.fn(() => emptyData());
      expect(store.snapshot().blocked).toBe(true);
      expect(store.update(updater)).toBe(false);
      expect(updater).not.toHaveBeenCalled();
      expect(storage.setItem).not.toHaveBeenCalled();
      expect(storage.values.get(key)).toBe(original);
    },
  );
  it("preserves the original before explicit recovery and unlocks later edits", () => {
    const original = "{unreadable";
    const storage = memoryStorage(original);
    const store = createRevenueStorage("test-owner", storage);
    expect(store.restore({ ...emptyData(), goal: 2 })).toBe(true);
    const backups = [...storage.values].filter(([name]) => name.startsWith(key + ":recovery:"));
    expect(backups).toHaveLength(1);
    expect(backups[0][1]).toBe(original);
    expect(store.snapshot()).toMatchObject({ blocked: false, error: "", data: { goal: 2 } });
    expect(store.update((data) => ({ ...data, goal: 3 }))).toBe(true);
    expect(JSON.parse(storage.values.get(key)!).goal).toBe(3);
  });
  it("keeps the original and guard when recovery backup cannot be saved", () => {
    const storage = memoryStorage("{unreadable");
    storage.setItem.mockImplementation(() => { throw new Error("quota"); });
    const store = createRevenueStorage("test-owner", storage);
    expect(store.restore(emptyData())).toBe(false);
    expect(store.snapshot().blocked).toBe(true);
    expect(storage.values.get(key)).toBe("{unreadable");
  });
  it("rejects invalid recovery without writing anything", () => {
    const storage = memoryStorage("{unreadable");
    const store = createRevenueStorage("test-owner", storage);
    expect(store.restore({ rows: [] })).toBe(false);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(store.snapshot().blocked).toBe(true);
  });
  it("does not publish an edit when persistence fails", () => {
    const original = JSON.stringify({ ...emptyData(), goal: 4 });
    const storage = memoryStorage(original);
    const store = createRevenueStorage("test-owner", storage);
    storage.setItem.mockImplementation(() => { throw new Error("quota"); });
    expect(store.update((data) => ({ ...data, goal: 5 }))).toBe(false);
    expect(store.getData().goal).toBe(4);
    expect(storage.values.get(key)).toBe(original);
    expect(store.snapshot().error).not.toBe("");
  });
  it("stamps real edits while preserving no-op and hydration timestamps", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-08T10:00:00Z"));
    const initial = snapshot("2026-10-07T00:00:00Z");
    const storage = memoryStorage(JSON.stringify(initial));
    const store = createRevenueStorage("test-owner", storage);
    expect(store.update((data) => data)).toBe(true);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(store.getData().meta?.updatedAt).toBe(initial.meta?.updatedAt);
    const remote = snapshot("2026-10-08T01:00:00Z", 6);
    expect(store.update(remote, { touch: false })).toBe(true);
    expect(store.getData().meta?.updatedAt).toBe(remote.meta?.updatedAt);
    expect(store.update((data) => ({ ...data, goal: 7 }))).toBe(true);
    expect(store.getData().meta?.updatedAt).toBe("2026-10-08T10:00:00.000Z");
  });
  it("blocks writes if the browser denies reading storage", () => {
    const storage = memoryStorage();
    storage.getItem.mockImplementation(() => { throw new Error("denied"); });
    const store = createRevenueStorage("test-owner", storage);
    expect(store.update(emptyData())).toBe(false);
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});

describe("revenue cloud snapshot selection", () => {
  it("does not let an older report with more rows overwrite newer local changes", () => {
    const local = snapshot("2026-10-08T00:00:00Z");
    const remote = snapshot("2026-10-07T00:00:00Z");
    remote.rows = Array.from({ length: 5 }, () => ({} as RevenueData["rows"][number]));
    expect(preferNewer(local, remote)).toBe(local);
  });
  it("allows a proven newer remote deletion with fewer rows", () => {
    const local = snapshot("2026-10-07T00:00:00Z");
    local.rows = [{} as RevenueData["rows"][number]];
    const remote = snapshot("2026-10-08T00:00:00Z");
    expect(preferNewer(local, remote)).toBe(remote);
  });
  it("keeps local settings when freshness cannot be proved", () => {
    const local = { ...emptyData(), goal: 9 };
    const remote = snapshot("2026-10-08T00:00:00Z");
    expect(preferNewer(local, remote)).toBe(local);
    expect(preferNewer(remote, { ...local, meta: { updatedAt: "invalid" } })).toBe(remote);
    expect(preferNewer(remote, { ...local, meta: { updatedAt: remote.meta!.updatedAt } })).toBe(remote);
  });
  it("loads cloud data into a genuinely new empty device only", () => {
    const remote = { ...emptyData(), goal: 11 };
    expect(preferNewer(emptyData(), remote)).toBe(remote);
    const configured = { ...emptyData(), business: { ...emptyData().business, name: "Sample" } };
    expect(preferNewer(configured, remote)).toBe(configured);
    expect(preferNewer(snapshot("2026-10-08T00:00:00Z", 0), remote)).not.toBe(remote);
  });
});
