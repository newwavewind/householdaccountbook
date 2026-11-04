import { describe, expect, it, vi } from "vitest";
import { latestCollectedLog, collectionIssues, canPublishRevenue, createRevenueSaveQueue } from "./connectionState";
import type { SyncLog } from "./types";

describe("revenue connection and sharing safeguards", () => {
  it("does not present a failed attempt or app-only lookup as a report update", () => {
    const logs: SyncLog[] = [
      { id: "failed", at: "2026-10-29", status: "error", message: "failed", detail: { documents: 0 } },
      { id: "apps", at: "2026-10-28", status: "partial", message: "apps", detail: { documents: 0, apps: 5 } },
      { id: "reports", at: "2026-10-27", status: "partial", message: "reports", detail: { documents: 3 } },
    ];
    expect(latestCollectedLog(logs)?.id).toBe("reports");
    expect(latestCollectedLog(logs.slice(0, 2))).toBeUndefined();
  });
  it("separates permissions, missing apps, incomplete orders and missing reports", () => {
    const issues = collectionIssues(["Google 앱 검색 (403)", "앱 A: Google 요청 실패 (404)", "앱 B: Google 요청 실패 (404)", "Google 주문 수익 6건 미반영", "Apple 일별 보고서 1일 미제공"]);
    expect(issues).toHaveLength(4);
    expect(issues.find(i => i.title === "등록된 앱 정보 확인")?.count).toBe(2);
    expect(issues.find(i => i.title === "아직 제공되지 않은 보고서")?.description).toContain("0원으로 처리하지 않습니다");
    expect(collectionIssues(["Apple 요청 실패 (403)"])[0].title).not.toContain("Google");
  });
  it("keeps cloud writes closed for viewers, failed hydration, guest mode and storage errors", () => {
    const valid = { readOnly: false, demo: false, owner: "owner", cloudReady: true, blocked: false };
    expect(canPublishRevenue(valid)).toBe(true);
    for (const override of [{ readOnly: true }, { demo: true }, { owner: "device" }, { cloudReady: false }, { blocked: true }]) {
      expect(canPublishRevenue({ ...valid, ...override })).toBe(false);
    }
  });
  it("serializes saves so newer manual edits cannot be overwritten by a slow older save", async () => {
    let release!: () => void;
    const first = new Promise<void>(resolve => { release = resolve; });
    const published: number[] = [];
    const write = vi.fn(async (value: number) => { if (value === 1) await first; published.push(value); return value; });
    const save = createRevenueSaveQueue(write);
    const one = save(1); const two = save(2);
    await Promise.resolve();
    expect(write).toHaveBeenCalledTimes(1);
    release();
    await Promise.all([one, two]);
    expect(published).toEqual([1, 2]);
  });
  it("allows a later save after an earlier request rejects", async () => {
    const write = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ ok: true });
    const save = createRevenueSaveQueue(write);
    await expect(save(1)).rejects.toThrow("offline");
    await expect(save(2)).resolves.toEqual({ ok: true });
  });
});
