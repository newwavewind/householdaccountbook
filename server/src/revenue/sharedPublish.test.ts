import assert from 'node:assert/strict'
import { test } from 'node:test'
import { generateKeyPairSync } from 'node:crypto'
import { mkdtemp,writeFile,rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { signRefreshResult } from './refreshProof.js'

// Run the actual deployed handler with isolated database adapters; no production writes.
test('publish verifies source before privileged writes, rechecks revocation, and retries concurrent owner edits',async()=>{
 const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048})
 const viewer='viewer',owner='cf985c51-f258-494f-8a29-8cdcd490ebd6'
 const job:any={id:'11111111-1111-4111-8111-111111111111',state:'done',progress:'',apps:[],documents:[],errors:[],completed:[],started:Date.now(),userId:viewer,sharedOwnerId:owner}
 job.refreshProof=signRefreshResult(job,privateKey.export({type:'pkcs8',format:'pem'}).toString())
 const base=()=>({schema:1,apps:[],rows:[],expenses:[],payouts:[],imports:[],logs:[],rates:{},goal:123,business:{name:'owner',number:'',kind:'general',prepaid:{}},checklist:{reviewed:true},meta:{updatedAt:'2026-10-29T00:00:00Z'}})
 let grants=true,grantReads=0,adminCalls=0,saves:any[]=[],conflict=false,revoke=false,tamper=false
 let handler:(req:Request)=>Promise<Response>
 const chain=(finish:()=>any):any=>({select(){return this},eq(){return this},single:async()=>finish(),maybeSingle:async()=>finish()})
 const userClient={auth:{getUser:async()=>({data:{user:{id:viewer}},error:null})},from:(table:string)=>chain(()=>{
   if(table==='app_revenue_viewers') {grantReads++;return {data:grants && !(revoke && grantReads>1) ? {owner_id:owner,can_refresh:true}:null,error:null}}
   return {data:{id:job.id,state:'done',result:{...job,errors:tamper?['changed']:[]}},error:null}
 })}
 const admin={from:()=>({select:()=>chain(()=>({data:{payload:{...base(),goal:conflict?456:123},updated_at:conflict?'2026-10-29T01:00:00Z':'2026-10-29T00:00:00Z'},error:null})),update:(value:any)=>chain(()=>{saves.push(value);if(!conflict){conflict=true;return {data:null,error:null}}return {data:{updated_at:value.updated_at},error:null}})})}
 const global=globalThis as any
 const oldDeno=global.Deno,oldCreate=global.__refreshTestCreate
 global.Deno={env:{get:(name:string)=>name},serve:(fn:any)=>{handler=fn}}
 global.__refreshTestCreate=(_url:string,key:string)=>{if(key==='SUPABASE_SERVICE_ROLE_KEY'){adminCalls++;return admin}return userClient}
 const dir=await mkdtemp(join(tmpdir(),'refresh-handler-test-'))
 try {
  const bundled=await build({entryPoints:['../supabase/functions/app-revenue-refresh/index.ts'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'test-dependencies',setup(b){
   b.onResolve({filter:/^npm:@supabase/},()=>({path:'supabase-fixture',namespace:'test'}))
   b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const createClient=globalThis.__refreshTestCreate;',loader:'js'}))
   b.onLoad({filter:/public-key\.json$/},()=>({contents:JSON.stringify(publicKey.export({format:'jwk'})),loader:'json'}))
  }}]})
  const file=join(dir,'handler.mjs');await writeFile(file,bundled.outputFiles[0].text);await import(pathToFileURL(file).href)
  const call=()=>handler(new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer fixture','Content-Type':'application/json'},body:JSON.stringify({jobId:job.id})}))
  grants=false;assert.equal((await call()).status,403);assert.equal(adminCalls,0)
  grants=true;tamper=true;assert.equal((await call()).status,400);assert.equal(adminCalls,0)
  tamper=false;revoke=true;grantReads=0;assert.equal((await call()).status,403);assert.equal(saves.length,0)
  revoke=false;grantReads=0;const response=await call();assert.equal(response.status,200)
  assert.equal(saves.length,2);assert.equal(saves[1].payload.goal,456);assert.equal(saves[1].payload.business.name,'owner');assert.equal(saves[1].payload.checklist.reviewed,true)
 } finally {global.Deno=oldDeno;global.__refreshTestCreate=oldCreate;await rm(dir,{recursive:true,force:true})}
})
