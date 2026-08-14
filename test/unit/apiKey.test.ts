import { describe, expect, it } from 'vitest'
import {
  API_SCOPES,
  apiKeyAllowsWrite,
  apiKeyStart,
  generateApiKey,
  hashApiKey
} from '../../server/utils/apiKey'

describe('generateApiKey', () => {
  it('produces the 64-hex-character shape the auth layer screens for', () => {
    // getApiKeyUser rejects anything that doesn't match /^[0-9a-f]{64}$/i before
    // it touches the database, so a generator that drifted from that shape would
    // mint keys that can never authenticate.
    for (let i = 0; i < 20; i++) {
      expect(generateApiKey()).toMatch(/^[0-9a-f]{64}$/)
    }
  })

  it('does not repeat', () => {
    const keys = new Set(Array.from({ length: 500 }, () => generateApiKey()))
    expect(keys.size).toBe(500)
  })
})

describe('hashApiKey', () => {
  it('is deterministic, so a key can be found by an indexed lookup', () => {
    const key = generateApiKey()
    expect(hashApiKey(key)).toBe(hashApiKey(key))
  })

  it('never returns the plaintext', () => {
    const key = generateApiKey()
    expect(hashApiKey(key)).not.toBe(key)
    expect(hashApiKey(key)).toMatch(/^[0-9a-f]{64}$/)
  })

  it('separates keys that differ by one character', () => {
    expect(hashApiKey('a'.repeat(64))).not.toBe(hashApiKey(`${'a'.repeat(63)}b`))
  })
})

describe('apiKeyStart', () => {
  it('keeps a recognisable prefix without revealing anything usable', () => {
    const key = generateApiKey()
    const start = apiKeyStart(key)
    expect(key.startsWith(start)).toBe(true)
    expect(start.length).toBeLessThanOrEqual(16)
    expect(start.length).toBeLessThan(key.length)
  })
})

describe('apiKeyAllowsWrite', () => {
  const READ_ONLY = ['read']
  const FULL = ['read', 'write']

  it('lets a full key do anything', () => {
    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
      expect(apiKeyAllowsWrite(FULL, method)).toBe(true)
    }
  })

  it('confines a read-only key to safe methods', () => {
    for (const method of ['GET', 'HEAD', 'OPTIONS']) {
      expect(apiKeyAllowsWrite(READ_ONLY, method), method).toBe(true)
    }
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      expect(apiKeyAllowsWrite(READ_ONLY, method), method).toBe(false)
    }
  })

  it('is case-insensitive about the method', () => {
    expect(apiKeyAllowsWrite(READ_ONLY, 'get')).toBe(true)
    expect(apiKeyAllowsWrite(READ_ONLY, 'post')).toBe(false)
  })

  it('treats a missing scope list as unrestricted', () => {
    // NULL permissions mean an unscoped key. Keys minted today always carry an
    // explicit list; this is the compatibility path.
    expect(apiKeyAllowsWrite(null, 'DELETE')).toBe(true)
    expect(apiKeyAllowsWrite(undefined, 'DELETE')).toBe(true)
  })

  it('refuses writes for a scope list that grants nothing', () => {
    // An empty array is a list, not an absent one — it must not read as
    // unrestricted, or a revoked-down key would regain write access.
    expect(apiKeyAllowsWrite([], 'POST')).toBe(false)
    expect(apiKeyAllowsWrite([], 'GET')).toBe(true)
  })

  it('defaults an unknown method to needing write', () => {
    expect(apiKeyAllowsWrite(READ_ONLY, 'FROBNICATE')).toBe(false)
  })

  it('exposes exactly the scopes the endpoints understand', () => {
    expect([...API_SCOPES].sort()).toEqual(['read', 'write'])
  })
})
