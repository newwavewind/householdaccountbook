import { describe, expect, it } from "vitest";
import { parseReport } from "./imports";
import { emptyData, summarize } from "./model";

const header = "Start Date\tEnd Date\tTitle\tApple Identifier\tQuantity\tCustomer Price\tPartner Share\tExtended Partner Share\tCountry Of Sale\tCustomer Currency\tPartner Share Currency\tSales or Return";
const charge = "08/30/2026\t09/26/2026\tExample\t123\t2\t1100\t850\t1700\tKR\tKRW\tKRW\tS";
const document = (text: string) => ({ key: "apple-finance:2026-09", name: "Apple finance", period: "2026-09", text });

describe("Apple consolidated finance report", () => {
  it("imports the transaction table and excludes the repeated country/currency totals", async () => {
    const rows = await parseReport(document([header, charge, "Total_Rows\t1", "Country Of Sale\tPartner Share Currency\tQuantity\tExtended Partner Share", "KR\tKRW\t2\t1700"].join("\n")));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ period: "2026-09", date: "2026-08-30", endDate: "2026-09-26", periodKind: "fiscal", basis: "settled", proceeds: 1700 });
    expect(summarize(rows, emptyData()).proceeds).toBe(1700);
  });

  it("recognizes Apple's plural Sales or Return column even for a positive quantity", async () => {
    const refund = charge.replace(/\tS$/, "\tR");
    const rows = await parseReport(document([header, refund, "Total Rows\t1", "Country Of Sale\tPartner Share Currency\tQuantity\tExtended Partner Share", "KR\tKRW\t-2\t-1700"].join("\n")));
    expect(rows[0]).toMatchObject({ gross: 0, refunds: 2200, proceeds: -1700, units: -2 });
  });

  it("still rejects a malformed transaction before the totals boundary", async () => {
    await expect(parseReport(document([header, charge.replace("08/30/2026", "bad-date"), "Total_Rows\t1"].join("\n")))).rejects.toThrow("올바르지 않은 날짜");
  });
});
