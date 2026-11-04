import test from 'node:test'
import assert from 'node:assert/strict'
import {collectGoogleInstalls} from './googleInstalls.js'
const job=()=>({documents:[] as any[],errors:[] as string[],completed:[] as string[],progress:''})
test('fetches only the selected month, known package and country dimension, decoding UTF16',async()=>{
 const result=job();let reads=0
 const report='Date,Package Name,Country,Daily User Installs\n2026-10-20,com.example.app,KR,4'
 const bytes=Buffer.concat([Buffer.from([255,254]),Buffer.from(report,'utf16le')])
 await collectGoogleInstalls({job:result,bucket:'test',month:'2026-10',packages:['com.example.app'],errorMessage:String,request:async url=>{
  if(url.endsWith('alt=media')) {reads++;return {arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),json:async()=>({})}}
  return {json:async()=>({items:[{name:'stats/installs/installs_com.example.app_202610_country.csv'},{name:'stats/installs/installs_com.example.app_202610_device.csv'},{name:'stats/installs/installs_com.example.app_202609_country.csv'},{name:'stats/installs/installs_com.other_202610_country.csv'}]}),arrayBuffer:async()=>new ArrayBuffer(0)}
 }})
 assert.equal(reads,1);assert.equal(result.documents[0].text,report);assert.equal(result.documents[0].key,'google-installs:com.example.app:2026-10');assert.equal(result.errors.length,0)
})
test('missing or failed reports are explicit and never fabricate zero installation rows',async()=>{
 for(const fail of [false,true]) {
  const result=job()
  await collectGoogleInstalls({job:result,bucket:'test',month:'2026-10',packages:['com.example.app'],errorMessage:String,request:async()=>{if(fail)throw new Error('denied');return{json:async()=>({items:[]}),arrayBuffer:async()=>new ArrayBuffer(0)}}})
  assert.equal(result.documents.length,0);assert.equal(result.errors.length,1)
 }
})
