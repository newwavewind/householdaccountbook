import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isUserAllowed, isSharedRefreshRoute, authenticateRevenueRequest } from './auth.js'

test('configured allowlists apply by default, deny unlisted accounts, and require explicit all-user opt-in', () => {
  const keys = ['REVENUE_ALLOW_ANY_AUTH_USER', 'REVENUE_ALLOWED_EMAILS', 'REVENUE_ALLOWED_USER_IDS']
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]))
  try {
    for (const key of keys) delete process.env[key]
    const owner = { id: 'fixture-owner', email: 'owner@example.invalid' }
    const other = { id: 'fixture-other', email: 'other@example.invalid' }
    assert.equal(isUserAllowed(owner), false)
    process.env.REVENUE_ALLOWED_EMAILS = ' OWNER@example.invalid ; another@example.invalid '
    assert.equal(isUserAllowed(owner), true)
    assert.equal(isUserAllowed(other), false)
    delete process.env.REVENUE_ALLOWED_EMAILS
    process.env.REVENUE_ALLOWED_USER_IDS = 'fixture-owner'
    assert.equal(isUserAllowed(owner), true)
    assert.equal(isUserAllowed(other), false)
    process.env.REVENUE_ALLOW_ANY_AUTH_USER = '0'
    assert.equal(isUserAllowed(owner), true)
    assert.equal(isUserAllowed(other), false)
    process.env.REVENUE_ALLOW_ANY_AUTH_USER = 'true'
    assert.equal(isUserAllowed(other), false)
    process.env.REVENUE_ALLOW_ANY_AUTH_USER = '1'
    assert.equal(isUserAllowed(other), true)
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key]
      else process.env[key] = previous[key]
    }
  }
})

test('shared refresh routes deny settings, discovery, setup and unknown methods', () => {
  for (const path of ['status','job']) assert.equal(isSharedRefreshRoute('GET',`/api/app-revenue/${path}`),true)
  assert.equal(isSharedRefreshRoute('POST','/api/app-revenue/sync'),true)
  for (const path of ['settings','discover','google-setup','sync/other'])
    for (const method of ['GET','POST','PUT','DELETE']) assert.equal(isSharedRefreshRoute(method,`/api/app-revenue/${path}`),false)
  assert.equal(isSharedRefreshRoute('DELETE','/api/app-revenue/sync'),false)
})

test('live grant checks admit linked refresh only and revoke access on missing grant', async () => {
  const keys=['SUPABASE_URL','SUPABASE_ANON_KEY','REVENUE_REFRESH_OWNER_ID','REVENUE_ALLOWED_USER_IDS','REVENUE_ALLOWED_EMAILS','REVENUE_ALLOW_ANY_AUTH_USER']
  const old=Object.fromEntries(keys.map(k=>[k,process.env[k]])),originalFetch=globalThis.fetch
  let grant:unknown={owner_id:'owner',can_refresh:true}
  try {
    for(const key of keys) delete process.env[key]
    Object.assign(process.env,{SUPABASE_URL:'https://test.supabase.co',SUPABASE_ANON_KEY:'test',REVENUE_REFRESH_OWNER_ID:'owner'})
    globalThis.fetch=async (url:any)=>new Response(JSON.stringify(String(url).includes('/auth/v1/user') ? {id:'viewer',email:'viewer@example.invalid',app_metadata:{},user_metadata:{},aud:'authenticated',created_at:''} : grant),{status:200,headers:{'Content-Type':'application/json'}})
    const req=(method:string,url:string)=>({method,url,headers:{authorization:'Bearer test-token','x-revenue-shared':'1','x-revenue-local-token':'local'}} as any)
    const allowed=await authenticateRevenueRequest(req('POST','/api/app-revenue/sync'),'local')
    assert.equal(allowed.ok,true)
    if(allowed.ok) assert.equal(allowed.auth.mode==='user' && allowed.auth.sharedOwnerId,'owner')
    assert.equal((await authenticateRevenueRequest(req('PUT','/api/app-revenue/settings'),'local')).ok,false)
    grant=null
    assert.equal((await authenticateRevenueRequest(req('POST','/api/app-revenue/sync'),'local')).ok,false)
    grant={owner_id:'unrelated',can_refresh:true}
    assert.equal((await authenticateRevenueRequest(req('POST','/api/app-revenue/sync'),'local')).ok,false)
  } finally {globalThis.fetch=originalFetch;for(const key of keys) {if(old[key]===undefined)delete process.env[key];else process.env[key]=old[key]}}
})
