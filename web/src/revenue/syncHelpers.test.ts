import { describe, expect, it } from "vitest";
import {
  countDocsByStore,
  formatSyncToast,
  syncLogStatus,
} from "./syncHelpers";
import type { StoreDocument } from "./types";

const docs = (keys: string[]): StoreDocument[] =>
  keys.map((key) => ({
    key,
    name: key,
    text: "",
    period: "2026-09",
  }));

describe("syncHelpers", () => {
  it("counts apple and google documents", () => {
    expect(
      countDocsByStore(
        docs(["apple:daily:1", "apple:daily:2", "google:sales:2026-09"]),
      ),
    ).toEqual({ apple: 2, google: 1 });
  });

  it("formats a short success toast", () => {
    expect(
      formatSyncToast({
        apps: 3,
        documents: docs(["apple:a", "google:b"]),
        errors: [],
      }),
    ).toBe("Apple 1 · Google 1 · 완료");
  });

  it("formats auto sync with failure count", () => {
    expect(
      formatSyncToast({
        apps: 0,
        documents: docs(["google:b"]),
        errors: ["GCS 403", "패키지 404"],
        auto: true,
      }),
    ).toBe("자동 · Google 1 · 확인 2");
  });

  it("picks log status", () => {
    expect(syncLogStatus(2, 1, 0)).toBe("success");
    expect(syncLogStatus(1, 0, 2)).toBe("partial");
    expect(syncLogStatus(0, 0, 1)).toBe("error");
  });
});
