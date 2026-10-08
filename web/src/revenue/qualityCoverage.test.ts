import { describe, expect, it } from "vitest";
import { detectAnomalies } from "./anomalies";
import { buildMonthCloseChecklist } from "./monthClose";
import { emptyData } from "./model";
import type { ConnectorStatus, Platform, RevenueRow } from "./types";

const row = (platform: Platform, basis: RevenueRow["basis"], patch: Partial<RevenueRow> = {}): RevenueRow => ({
  id: `${platform}:${basis}`, reportKey: `${platform}:${basis}`, date: "2026-09-01", period: "2026-09",
  appId: `${platform}:test`, appName: "테스트", platform, country: "KR", currency: "KRW", proceedsCurrency: "KRW",
  gross: 100, refunds: 0, fee: 20, tax: 10, proceeds: 70, units: 1, basis, taxClass: "unreviewed", ...patch,
});
const connected: ConnectorStatus = {
  apple: { configured: true, reports: true, missing: [] },
  google: { configured: true, reports: true, missing: [] },
};

describe("coverage-aware month closing and alerts", () => {
  it("does not mark report reflection complete when Apple final is missing from a two-store month", () => {
    const data = emptyData();
    data.rows = [row("apple", "estimate"), row("google", "estimate"), row("google", "settled")];
    const items = buildMonthCloseChecklist(data, "2026-09", connected, undefined);
    expect(items.find((item) => item.id === "sync")).toMatchObject({ done: false, hint: "App Store 확정 보고서 없음" });
    expect(items.find((item) => item.id === "apple-sales")?.done).toBe(false);
    expect(items.find((item) => item.id === "google-sales")?.done).toBe(true);
    expect(items.find((item) => item.id === "fx")?.done).toBe(false);
    expect(detectAnomalies(data, "2026-09", connected)).toContainEqual(expect.objectContaining({ id: "settled-missing:2026-09:apple", title: "App Store 확정 보고서 없음" }));
  });

  it("does not require Apple or create an Apple missing-report alert for a Google-only account", () => {
    const data = emptyData(); data.rows = [row("google", "settled")];
    const items = buildMonthCloseChecklist(data, "2026-09", connected, undefined);
    expect(items.some((item) => item.id === "apple-sales")).toBe(false);
    expect(items.find((item) => item.id === "sync")?.done).toBe(true);
    expect(items.find((item) => item.id === "fx")?.done).toBe(true);
    expect(detectAnomalies(data, "2026-09", connected).some((alert) => alert.id.startsWith("settled-missing:"))).toBe(false);
  });

  it("does not infer historical Google report requirements solely from a configured connector", () => {
    const data = emptyData(); data.rows = [row("apple", "settled")];
    const items = buildMonthCloseChecklist(data, "2026-09", connected, undefined);
    expect(items.some((item) => item.id === "google-sales" || item.id === "google-gcs")).toBe(false);
    expect(items.find((item) => item.id === "sync")?.done).toBe(true);
    expect(detectAnomalies(data, "2026-09", connected).some((alert) => alert.id === "google-empty-month" || alert.id === "settled-missing:2026-09:google")).toBe(false);
  });

  it("accepts a reported zero as a real completed report", () => {
    const data = emptyData(); data.rows = [row("google", "settled", { gross: 0, refunds: 0, fee: 0, tax: 0, proceeds: 0, currency: "AED", proceedsCurrency: "AED" })];
    const items = buildMonthCloseChecklist(data, "2026-09", connected, undefined);
    expect(items.find((item) => item.id === "sync")?.done).toBe(true);
    expect(items.find((item) => item.id === "fx")?.done).toBe(true);
  });

  it("keeps a previously observed store's missing month visible", () => {
    const data = emptyData(); data.rows = [row("apple", "settled", { id: "old-apple", period: "2026-08" }), row("google", "settled")];
    expect(buildMonthCloseChecklist(data, "2026-09", connected, undefined).find((item) => item.id === "sync")?.done).toBe(false);
    expect(detectAnomalies(data, "2026-09", connected).some((alert) => alert.id === "settled-missing:2026-09:apple")).toBe(true);
  });

  it("separates report arrival from an unavailable proceeds exchange rate", () => {
    const data = emptyData(); data.rows = [row("google", "settled", { proceedsCurrency: "USD" })];
    const items = buildMonthCloseChecklist(data, "2026-09", connected, undefined);
    expect(items.find((item) => item.id === "sync")?.done).toBe(true);
    expect(items.find((item) => item.id === "fx")?.done).toBe(false);
    const alerts = detectAnomalies(data, "2026-09", connected);
    expect(alerts.some((alert) => alert.id === "fx-missing")).toBe(true);
    expect(alerts.some((alert) => alert.id.startsWith("settled-missing:"))).toBe(false);
  });

  it("keeps known KRW net proceeds complete when only gross-sales FX is missing", () => {
    const data = emptyData(); data.rows = [row("apple", "settled", { currency: "USD" })];
    const items = buildMonthCloseChecklist(data, "2026-09", connected, undefined);
    expect(items.find((item) => item.id === "sync")?.done).toBe(true);
    expect(items.find((item) => item.id === "fx")?.done).toBe(true);
  });

  it("dismisses only the specific month and store's missing-report alert", () => {
    const data = emptyData(); data.rows = [row("apple", "estimate")];
    expect(detectAnomalies(data, "2026-09", connected, ["settled-missing:2026-08:apple"]).some((alert) => alert.id === "settled-missing:2026-09:apple")).toBe(true);
    expect(detectAnomalies(data, "2026-09", connected, ["settled-missing:2026-09:apple"]).some((alert) => alert.id === "settled-missing:2026-09:apple")).toBe(false);
  });
});
