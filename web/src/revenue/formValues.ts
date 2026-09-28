export const fieldText = (f: FormData, key: string) =>
  String(f.get(key) || "").trim();
export function fieldNumber(f: FormData, key: string, signed = false) {
  const raw = fieldText(f, key);
  const n = Number(raw);
  if (!raw || !Number.isFinite(n) || (!signed && n < 0) || Math.abs(n) > 1e13)
    throw new Error("금액을 올바르게 입력해 주세요.");
  return n;
}
