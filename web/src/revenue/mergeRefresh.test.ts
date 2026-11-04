import { describe,it,expect } from 'vitest';
import { mergeSharedRefresh } from './mergeRefresh';
import { emptyData } from './model';
import { parseReport } from './imports';
import type { SyncResult } from './types';
const document={key:'fixture',name:'report.csv',period:'2026-09',source:'api' as const,fetchedAt:'2026-10-29T00:00:00Z',text:'date,app_id,app_name,platform,country,currency,gross,refunds,fee,tax,proceeds,units,basis\n2026-09-01,1,App,apple,KR,KRW,100,0,30,0,70,1,settled'};
const job:SyncResult={id:'one',state:'done',progress:'',apps:[],documents:[document],errors:[],completed:[]};
describe('shared source report refresh',()=>{
 it('preserves owner tax review, expenses, payout records and settings while refreshing reports',async()=>{
  const base=emptyData();
  base.rows=(await parseReport(document)).map(row=>({...row,taxClass:'zero' as const,supplyAmount:777,evidence:'owner reviewed',taxDate:'2026-09-02'}));
  base.goal=123; base.business.name='Owner business';base.checklist.reviewed=true;
  const next=await mergeSharedRefresh(base,job,'2026-10-29T01:00:00Z');
  expect(next.rows[0]).toMatchObject({proceeds:70,taxClass:'zero',supplyAmount:777,evidence:'owner reviewed',taxDate:'2026-09-02'});
  expect(next.expenses).toEqual(base.expenses);expect(next.payouts).toEqual(base.payouts);
  expect(next.goal).toBe(123);expect(next.business).toEqual(base.business);expect(next.checklist).toEqual(base.checklist);
  expect(next.logs[0].id).toBe('shared-refresh:one');
  expect(await mergeSharedRefresh(next,job)).toBe(next);
 });
 it('keeps existing reports when parsing fails and rejects unfinished jobs',async()=>{
  const base=await mergeSharedRefresh(emptyData(),job);
  const next=await mergeSharedRefresh(base,{...job,id:'two',documents:[{...document,text:'bad'}]});
  expect(next.rows).toEqual(base.rows);expect(next.logs[0].status).toBe('error');
  await expect(mergeSharedRefresh(base,{...job,state:'running'})).rejects.toThrow();
 });
 it('does not replace newer source data with a stale completed job',async()=>{
  const base=await mergeSharedRefresh(emptyData(),job);
  base.imports[0].fetchedAt='2026-10-29T05:00:00Z';
  const next=await mergeSharedRefresh(base,{...job,id:'stale',documents:[{...document,text:document.text.replace(',70,',',10,')}]});
  expect(next.rows).toEqual(base.rows);
 });
});
