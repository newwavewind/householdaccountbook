import { useCallback, useState } from "react";
import { normalizeAppGroups } from "./appGroups";
import { fillGoogleEstimatedShares } from "./googleFee";
import { withResolvedAppNames } from "./appDisplayNames";
import { emptyData, validDate } from "./model";
import type { RevenueData } from "./types";

export function validateBackup(value: unknown): RevenueData {
  if (!value || typeof value !== "object")
    throw new Error("백업 파일 형식이 올바르지 않습니다.");
  const d = value as RevenueData;
  if (
    d.schema !== 1 ||
    !Array.isArray(d.rows) ||
    !Array.isArray(d.apps) ||
    !Array.isArray(d.expenses) ||
    !Array.isArray(d.payouts) ||
    !Array.isArray(d.imports) ||
    !Array.isArray(d.logs) ||
    !d.rates ||
    !d.business ||
    !d.checklist
  )
    throw new Error("앱 수익 백업 파일을 선택해 주세요.");
  const finite = (x: unknown) =>
    typeof x === "number" && Number.isFinite(x) && Math.abs(x) <= 1e14;
  const str = (x: unknown) => typeof x === "string";
  for (const r of d.rows) {
    if (
      !str(r.id) ||
      !str(r.reportKey) ||
      !str(r.appName) ||
      !str(r.appId) ||
      !str(r.country) ||
      !validDate(r.date) ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(r.period) ||
      !["apple", "google"].includes(r.platform) ||
      !["estimate", "settled"].includes(r.basis) ||
      !["unreviewed", "taxable", "zero", "exempt", "excluded"].includes(
        r.taxClass,
      ) ||
      !/^[A-Z]{3}$/.test(r.currency) ||
      !/^[A-Z]{3}$/.test(r.proceedsCurrency) ||
      ![r.gross, r.refunds, r.units].every(finite) ||
      ![r.fee, r.tax, r.proceeds].every((x) => x === null || finite(x)) ||
      (r.supplyAmount !== undefined && !finite(r.supplyAmount)) ||
      (r.outputVat !== undefined && !finite(r.outputVat)) ||
      (r.evidence !== undefined && !str(r.evidence)) ||
      (r.taxDate !== undefined && !validDate(r.taxDate)) ||
      (r.proceedsSource !== undefined && (r.proceedsSource !== "google-orders" || r.platform !== "google" || r.basis !== "estimate" || r.source !== "google-sales" || !finite(r.proceeds) || !str(r.proceedsFetchedAt) || !Number.isFinite(Date.parse(r.proceedsFetchedAt!)))) ||
      (r.proceedsFetchedAt !== undefined && (!str(r.proceedsFetchedAt) || !Number.isFinite(Date.parse(r.proceedsFetchedAt))))
    )
      throw new Error("백업에 잘못된 거래 데이터가 있습니다.");
  }
  for (const a of d.apps)
    if (
      ![
        a.id,
        a.name,
        a.bundleId,
        a.version,
        a.build,
        a.status,
        a.updatedAt,
      ].every(str) ||
      !["apple", "google"].includes(a.platform) ||
      !["manual", "api", "demo"].includes(a.source)
    )
      throw new Error("백업 앱 형식 오류");
  for (const e of d.expenses)
    if (
      ![e.id, e.name, e.category, e.evidence].every(str) ||
      !validDate(e.date) ||
      !finite(e.amount) ||
      !finite(e.inputVat) ||
      e.amount < 0 ||
      e.inputVat < 0 ||
      e.inputVat > e.amount ||
      typeof e.deductible !== "boolean"
    )
      throw new Error("백업 비용 형식 오류");
  for (const p of d.payouts)
    if (
      ![p.id, p.memo, p.month, p.receivedDate].every(str) ||
      !validDate(p.dueDate) ||
      ![p.expected, p.received].every(finite) ||
      !["apple", "google"].includes(p.platform)
    )
      throw new Error("백업 정산 형식 오류");
  for (const [k, v] of Object.entries(d.rates))
    if (
      !/^\d{4}-\d{2}:[A-Z]{3}$/.test(k) ||
      !finite(v.value) ||
      v.value <= 0 ||
      !str(v.note)
    )
      throw new Error("백업 환율 형식 오류");
  if (
    !finite(d.goal) ||
    d.goal < 0 ||
    !str(d.business.name) ||
    !str(d.business.number) ||
    !["general", "simplified"].includes(d.business.kind) ||
    !d.business.prepaid ||
    !Object.entries(d.business.prepaid).every(
      ([k, v]) => /^\d{4}-[12]$/.test(k) && finite(v) && v >= 0,
    ) ||
    !Object.values(d.checklist).every((v) => typeof v === "boolean")
  )
    throw new Error("백업 설정 형식 오류");
  for (const i of d.imports)
    if (![i.key, i.name, i.importedAt].every(str) || !finite(i.rows))
      throw new Error("백업 가져오기 기록 오류");
  for (const l of d.logs)
    if (
      ![l.id, l.at, l.message].every(str) ||
      !["success", "partial", "error"].includes(l.status) ||
      (l.detail !== undefined &&
        (typeof l.detail !== "object" ||
          (l.detail.completed !== undefined && !Array.isArray(l.detail.completed)) ||
          (l.detail.errors !== undefined && !Array.isArray(l.detail.errors))))
    )
      throw new Error("백업 동기화 기록 오류");
  if (new Set(d.rows.map((r) => r.id)).size !== d.rows.length)
    throw new Error("백업에 중복 거래가 있습니다.");
  if (d.appGroups !== undefined) {
    if (!Array.isArray(d.appGroups)) throw new Error("백업 앱 그룹 형식 오류");
    for (const g of d.appGroups) {
      if (!str(g.id) || !str(g.name) || !Array.isArray(g.appleAppIds) || !Array.isArray(g.googlePackages))
        throw new Error("백업 앱 그룹 형식 오류");
    }
  }
  const normalized = normalizeAppGroups(d);
  const apps = withResolvedAppNames(normalized.apps);
  const rows = fillGoogleEstimatedShares(normalized.rows);
  if (apps === normalized.apps && rows === normalized.rows) return normalized;
  return { ...normalized, apps, rows };
}
type RevenueStorage = Pick<Storage, "getItem" | "setItem">;
type RevenueUpdate = RevenueData | ((previous: RevenueData) => RevenueData);
type UpdateOptions = { touch?: boolean };
const READ_ERROR =
  "저장된 앱 수익 자료를 읽지 못해 자동 저장을 중단했습니다. 원본은 보존되어 있으며 백업 복원 후 다시 저장할 수 있습니다.";
const WRITE_ERROR =
  "저장 공간이 부족하거나 저장 권한이 없어 변경 내용을 보관하지 못했습니다. 기존 자료는 유지됩니다.";

/** All writes share this guard, including automatic sync and cloud hydration. */
export function createRevenueStorage(
  owner: string,
  storage?: RevenueStorage,
) {
  const key = `mj-app-revenue-v1:${owner}`;
  let data = emptyData();
  let error = "";
  let blocked = false;
  try {
    storage ??= localStorage;
    const saved = storage.getItem(key);
    const parsed = saved !== null ? JSON.parse(saved) : emptyData();
    if (parsed.business?.prepaid === 0) parsed.business.prepaid = {};
    data = validateBackup(parsed);
  } catch {
    blocked = true;
    error = READ_ERROR;
  }
  const snapshot = () => ({ data, error, blocked });
  const stamp = (value: RevenueData): RevenueData => ({
    ...value,
    meta: { ...value.meta, updatedAt: new Date().toISOString() },
  });
  return {
    snapshot,
    getData: () => data,
    update(next: RevenueUpdate, options: UpdateOptions = {}): boolean {
      if (blocked) return false;
      try {
        const candidate = typeof next === "function" ? next(data) : next;
        if (candidate === data) return true;
        const valid = validateBackup(candidate);
        const value = options.touch === false ? valid : stamp(valid);
        storage!.setItem(key, JSON.stringify(value));
        data = value;
        error = "";
        return true;
      } catch {
        error = WRITE_ERROR;
        return false;
      }
    },
    restore(candidate: unknown): boolean {
      let value: RevenueData;
      try {
        value = stamp(validateBackup(candidate));
      } catch {
        error = "복원 파일 형식이 올바르지 않습니다. 기존 자료는 유지됩니다.";
        return false;
      }
      try {
        const original = storage!.getItem(key);
        if (original !== null) {
          // Never overwrite the only copy, even when the original is unreadable.
          const recoveryKey = `${key}:recovery:${crypto.randomUUID()}`;
          storage!.setItem(recoveryKey, original);
        }
        storage!.setItem(key, JSON.stringify(value));
        data = value;
        error = "";
        blocked = false;
        return true;
      } catch {
        error = "원본 보존 또는 백업 복원에 실패했습니다. 저장 공간과 권한을 확인해 주세요. 기존 자료는 유지됩니다.";
        return false;
      }
    },
  };
}

export function useRevenueData(owner: string) {
  // AppRevenuePage is keyed by owner, so each account gets its own store.
  const [store] = useState(() => createRevenueStorage(owner));
  const [state, setState] = useState(store.snapshot);
  const update = useCallback((next: RevenueUpdate, options?: UpdateOptions) => {
    const success = store.update(next, options);
    setState(store.snapshot());
    return success;
  }, [store]);
  const restore = useCallback((value: unknown) => {
    const success = store.restore(value);
    setState(store.snapshot());
    return success;
  }, [store]);
  return { ...state, update, restore, getData: store.getData };
}
