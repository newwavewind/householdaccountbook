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

it("uses the verified app SKU to associate Apple in-app subjects without guessing names", () => {
  const catalog = [{...apps[0], id:"apple:6814271261", name:"봄기출 소방공무원", bundleId:"com.sanghyun.firefighter", sku:"BOMGICHUL-FIRE-001"}];
  const subject = row({appId:"apple:BOMGICHUL-FIRE-001", productId:"premium_unlock_fire_sobang_national", productName:"소방학개론 프리미엄 잠금해제"});
  const [resolved] = enrichRowsWithApps([subject], catalog);
  expect(resolved.appId).toBe(catalog[0].id);
  expect(resolved.productName).toBe(subject.productName);
  expect(rowsForApp(catalog[0], [subject])).toEqual([subject]);
  expect(findAppForRowKey("apple:unknown-sku", catalog,"apple")).toBeUndefined();
});
