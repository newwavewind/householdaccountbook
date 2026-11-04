import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchProviderReport} from './providerRetry.js';
test('recovers transient failures with bounded read retries',async()=>{
 let calls=0;const delays:number[]=[];
 const result=await fetchProviderReport('https://example.com/report',{}, {fetcher:(async()=>{calls++;if(calls===1)throw new TypeError('network');return new Response('',{status:calls===2?503:200})}) as typeof fetch,wait:async ms=>{delays.push(ms)}});
 assert.equal(result.status,200);assert.equal(calls,3);assert.deepEqual(delays,[500,1000]);
});
test('does not retry permissions, absent reports, writes or long rate limits',async()=>{
 for(const [status,method,retry] of [[403,'GET',''],[404,'GET',''],[503,'POST',''],[429,'GET','60']] as const){
  let calls=0;await fetchProviderReport('https://example.com/report',{method},{fetcher:(async()=>{calls++;return new Response('',{status,headers:retry?{'Retry-After':retry}:{}})}) as typeof fetch,wait:async()=>assert.fail()});assert.equal(calls,1);
 }
});
test('honors cancellation and stops after three failures',async()=>{
 let calls=0;const fetcher=(async()=>{calls++;return new Response('',{status:503})}) as typeof fetch;
 assert.equal((await fetchProviderReport('https://example.com/report',{}, {fetcher,wait:async()=>{}})).status,503);assert.equal(calls,3);
 const controller=new AbortController();controller.abort();await assert.rejects(fetchProviderReport('https://example.com/report',{signal:controller.signal},{fetcher}));assert.equal(calls,3);
});
