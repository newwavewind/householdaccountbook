import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isUserAllowed } from './auth.js'

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
