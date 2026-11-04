import { test } from "node:test";
import assert from "node:assert/strict";
import { calendarDailyReportDates } from "./reportPolicy.js";
test("daily collection includes each day in a closed month, at most 31 calls",()=>{assert.equal(calendarDailyReportDates("2026-08","2026-10-29").length,31);assert.equal(calendarDailyReportDates("2028-02","2028-03-01").length,29)});
test("daily collection excludes today and future reports",()=>{const dates=calendarDailyReportDates("2026-10","2026-10-29");assert.equal(dates.at(-1),"2026-10-28");assert.equal(dates.length,28);assert.deepEqual(calendarDailyReportDates("2026-10","2026-10-01"),[])});
test("rejects invalid, pre-launch and future months",()=>{for(const month of ["2026-13","2025-12","2026-11"]) assert.throws(()=>calendarDailyReportDates(month,"2026-10-29"))});
