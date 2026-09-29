/** Fetch mid-market FX into KRW for a calendar month (Frankfurter / ECB). */
export async function fetchMonthRatesKrw(
  month: string,
  currencies: string[],
): Promise<Record<string, { value: number; note: string }>> {
  const needed = [
    ...new Set(
      currencies
        .map((c) => c.toUpperCase())
        .filter((c) => c && c !== "KRW"),
    ),
  ];
  if (!needed.length) return {};
  const [y, m] = month.split("-").map(Number);
  const end = new Date(Date.UTC(y, m, 0));
  const date = end.toISOString().slice(0, 10);
  const out: Record<string, { value: number; note: string }> = {};
  await Promise.all(
    needed.map(async (code) => {
      try {
        const res = await fetch(
          `https://api.frankfurter.app/${date}?from=${encodeURIComponent(code)}&to=KRW`,
        );
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as {
          rates?: { KRW?: number };
          date?: string;
        };
        const value = json.rates?.KRW;
        if (!value || !Number.isFinite(value) || value <= 0) return;
        out[`${month}:${code}`] = {
          value,
          note: `자동 · Frankfurter/ECB ${json.date || date}`,
        };
      } catch {
        /* leave missing; UI keeps manual entry */
      }
    }),
  );
  return out;
}
