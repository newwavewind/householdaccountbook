import assert from 'node:assert/strict'
import { test } from 'node:test'
import { generateKeyPairSync } from 'node:crypto'
import { signRefreshResult } from './refreshProof.js'
// The deployed verifier is tested against the exact server signature format.
import { verifyRefreshProof } from '../../../supabase/functions/app-revenue-refresh/verify.ts'
import type { RevenueJob } from './jobs.js'

test('signed refresh rejects changed financial data, wrong users/owners, and forged proofs', async () => {
  const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048})
  const key=privateKey.export({type:'pkcs8',format:'pem'}).toString()
  const job:RevenueJob={id:'test-job',state:'done',progress:'',apps:[],documents:[],errors:[],completed:[],started:Date.now(),userId:'viewer',sharedOwnerId:'owner'}
  job.refreshProof=signRefreshResult(job,key)
  const jwk=publicKey.export({format:'jwk'})
  await verifyRefreshProof(job,'viewer','owner',jwk)
  await assert.rejects(verifyRefreshProof({...job,errors:['tampered']},'viewer','owner',jwk))
  await assert.rejects(verifyRefreshProof(job,'another','owner',jwk))
  await assert.rejects(verifyRefreshProof(job,'viewer','another',jwk))
  await assert.rejects(verifyRefreshProof({...job,id:'other'},'viewer','owner',jwk))
  await assert.rejects(verifyRefreshProof({...job,refreshProof:'fake.signature'},'viewer','owner',jwk))
})
