import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyData } from "./model";
const mocks = vi.hoisted(() => ({ from: vi.fn(), select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(), pull: vi.fn() }));
vi.mock("../lib/supabaseClient", () => ({ getSupabase: () => ({ from: mocks.from }) }));
vi.mock("./cloudStore", () => ({ pullRevenueSnapshot: mocks.pull }));
import { readSharedRevenueWorkspace } from "./sharedWorkspace";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.from.mockReturnValue({ select: mocks.select });
  mocks.select.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
});
describe("explicit revenue sharing", () => {
  it("leaves unshared accounts in their own workspace", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await readSharedRevenueWorkspace("viewer")).toBeNull();
    expect(mocks.eq).toHaveBeenCalledWith("viewer_id", "viewer");
    expect(mocks.pull).not.toHaveBeenCalled();
  });
  it("loads every part of the authorized owner's snapshot", async () => {
    const data = { ...emptyData(), goal: 1234, business: { ...emptyData().business, name: "Shared business" } };
    mocks.maybeSingle.mockResolvedValue({ data: { owner_id: "owner" }, error: null });
    mocks.pull.mockResolvedValue({ data, updatedAt: "2026-10-29T00:00:00Z" });
    expect(await readSharedRevenueWorkspace("viewer")).toEqual({ ownerId: "owner", canRefresh: false, data, updatedAt: "2026-10-29T00:00:00Z" });
    expect(mocks.pull).toHaveBeenCalledWith("owner");
  });
  it("exposes refresh only for an explicit current grant", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { owner_id: "owner", can_refresh: true }, error: null });
    mocks.pull.mockResolvedValue({ data: emptyData(), updatedAt: null });
    expect((await readSharedRevenueWorkspace("viewer"))?.canRefresh).toBe(true);
  });
  it("does not fall back to another account when permission lookup fails", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: { message: "denied" } });
    await expect(readSharedRevenueWorkspace("viewer")).rejects.toThrow("denied");
    expect(mocks.pull).not.toHaveBeenCalled();
  });
  it("does not display an older cached snapshot after a read error", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { owner_id: "owner" }, error: null });
    mocks.pull.mockResolvedValue({ data: null, updatedAt: null, error: "network" });
    await expect(readSharedRevenueWorkspace("viewer")).rejects.toThrow("network");
  });
  it("rechecks revocation rather than reusing a prior grant", async () => {
    mocks.maybeSingle.mockResolvedValueOnce({ data: { owner_id: "owner" }, error: null }).mockResolvedValueOnce({ data: null, error: null });
    mocks.pull.mockResolvedValue({ data: emptyData(), updatedAt: null });
    expect(await readSharedRevenueWorkspace("viewer")).not.toBeNull();
    expect(await readSharedRevenueWorkspace("viewer")).toBeNull();
    expect(mocks.pull).toHaveBeenCalledTimes(1);
  });
  it("does not look up shares for a logged-out device", async () => {
    expect(await readSharedRevenueWorkspace("device")).toBeNull();
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
