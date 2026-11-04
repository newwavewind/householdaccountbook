import { describe, expect, it } from "vitest";
import { emptyData } from "./model";
import { reconcileCorrectedApps } from "./reconcileApps";
import type { AppProduct, RevenueRow } from "./types";
const app = (pkg: string): AppProduct => ({ id: `google:${pkg}`, bundleId: pkg, name: "행정사", platform: "google", source: "api", version: "", build: "", status: "", updatedAt: "" });
const old = app("com.sanghyun.haengjung"), current = app("com.sanghyun.haengjeongsa");
describe("verified package corrections", () => {
  it("replaces an empty API placeholder while preserving favorites and grouping", () => {
    const data = { ...emptyData(), apps: [{ ...old, favorite: true }], appGroups: [{ id: "group", name: "행정사", appleAppIds: [], googlePackages: [old.bundleId] }] };
    const result = reconcileCorrectedApps(data, [current]);
    expect(result.apps).toEqual([{ ...current, favorite: true }]);
    expect(result.appGroups?.[0].googlePackages).toEqual([current.bundleId]);
    expect(data.apps[0].id).toBe(old.id);
  });
  it("preserves any app referenced by historical financial rows", () => {
    const data = { ...emptyData(), apps: [old], rows: [{ appId: old.id } as RevenueRow] };
    expect(reconcileCorrectedApps(data, [current])).toBe(data);
  });
  it("keeps manual apps and waits for a verified replacement", () => {
    const manual = { ...emptyData(), apps: [{ ...old, source: "manual" as const }] };
    expect(reconcileCorrectedApps(manual, [current])).toBe(manual);
    const data = { ...emptyData(), apps: [old] };
    expect(reconcileCorrectedApps(data, [])).toBe(data);
  });
});
