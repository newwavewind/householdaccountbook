import { describe, expect, it } from "vitest";
import { enrichRowsWithApps, findAppForRowKey, rowsForApp } from "./appMatch";
import type { AppProduct, RevenueRow } from "./types";

const apps: AppProduct[] = [
  {
    id: "apple:6798675892",
    name: "봄기출 경찰공무원",
    platform: "apple",
    bundleId: "com.sanghyun.police",
    version: "1",
    build: "1",
    status: "READY",
    updatedAt: "2026-09-01T00:00:00.000Z",
    source: "api",
  },
];

const row = (override: Partial<RevenueRow> = {}): RevenueRow => ({
  id: "r1",
  reportKey: "a",
  date: "2026-09-10",
  period: "2026-09",
  appId: "apple:bomgichul-police",
  appName: "형사법 프리미엄 잠금해제",
  platform: "apple",
  country: "KR",
  currency: "KRW",
  proceedsCurrency: "KRW",
  gross: 4900,
  refunds: 0,
  fee: null,
  tax: null,
  proceeds: 3500,
  units: 1,
  basis: "estimate",
  taxClass: "unreviewed",
  ...override,
});

describe("appMatch", () => {
  it("maps bomgichul-police SKU to police app", () => {
    const hit = findAppForRowKey("apple:bomgichul-police", apps, "apple");
    expect(hit?.id).toBe("apple:6798675892");
  });
  it("enriches rows onto ASC app id", () => {
    const [r] = enrichRowsWithApps([row()], apps);
    expect(r.appId).toBe("apple:6798675892");
    expect(r.appName).toBe("봄기출 경찰공무원");
  });
  it("rowsForApp includes SKU-aliased sales", () => {
    const matched = rowsForApp(apps[0], [row()]);
    expect(matched).toHaveLength(1);
  });
});
