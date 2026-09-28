import { emptyData, shiftMonth } from "./model";
import type { RevenueData } from "./types";

export function demoData(month: string): RevenueData {
  const data = emptyData();
  const names = [
    "봄기출 공무원국어",
    "봄기출 공인중개사",
    "봄기출 공무원영어",
    "MJ가계부",
  ];
  data.apps = names.flatMap((name, index) =>
    (["apple", "google"] as const).map((platform) => ({
      id: `${platform}:demo-${index}`,
      name,
      platform,
      bundleId: `com.example.demo${index}`,
      version: `1.${index + 1}.2`,
      build: String(21 + index),
      status: index === 3 ? "심사 중" : "배포 중",
      updatedAt: `${month}-01`,
      source: "demo" as const,
      favorite: index === 0,
    })),
  );
  for (let offset = -2; offset <= 0; offset++) {
    const period = shiftMonth(month, offset);
    const lastDay = offset === 0 ? Math.min(new Date().getDate(), 28) : 28;
    for (let day = 1; day <= lastDay; day++) {
      for (const [i, app] of data.apps.entries()) {
        const units = Math.round(
          (6 + ((day * 7 + i * 3) % 13)) *
            (i < 4 ? 1.4 : 0.6) *
            (1 + offset * 0.15),
        );
        const gross = units * 3900;
        const refunds = day % 9 === i % 9 ? 3900 : 0;
        const supply = Math.round((gross - refunds) / 1.1);
        const tax = gross - refunds - supply,
          fee = Math.round(supply * 0.15);
        data.rows.push({
          id: `demo-${period}-${day}-${i}`,
          reportKey: `demo-${period}`,
          date: `${period}-${String(day).padStart(2, "0")}`,
          period,
          appId: app.id,
          appName: app.name,
          platform: app.platform,
          country: "KR",
          currency: "KRW",
          proceedsCurrency: "KRW",
          gross,
          refunds,
          fee,
          tax,
          proceeds: gross - refunds - fee - tax,
          units,
          basis: offset === 0 ? "estimate" : "settled",
          taxClass: offset === 0 ? "unreviewed" : "taxable",
          supplyAmount: supply,
          outputVat: tax,
          evidence: offset === 0 ? "" : "샘플 정산 명세서",
          taxDate: `${period}-${String(day).padStart(2, "0")}`,
        });
      }
    }
  }
  data.goal = 10000000;
  data.expenses = [
    {
      id: "demo-host",
      date: `${month}-02`,
      name: "서버·스토리지",
      category: "서버",
      amount: 187000,
      inputVat: 17000,
      deductible: true,
      evidence: "샘플 세금계산서",
    },
    {
      id: "demo-ad",
      date: `${month}-05`,
      name: "앱 검색 광고",
      category: "광고",
      amount: 330000,
      inputVat: 30000,
      deductible: true,
      evidence: "샘플 세금계산서",
    },
  ];
  data.payouts = [
    {
      id: "demo-payout1",
      platform: "apple",
      month: shiftMonth(month, -1),
      dueDate: `${month}-28`,
      expected: 4200000,
      received: 4200000,
      receivedDate: `${month}-28`,
      memo: "샘플 입금",
    },
    {
      id: "demo-payout2",
      platform: "google",
      month: shiftMonth(month, -1),
      dueDate: `${month}-15`,
      expected: 3180000,
      received: 3158000,
      receivedDate: `${month}-15`,
      memo: "샘플 환전·은행 수수료 확인",
    },
  ];
  return data;
}
