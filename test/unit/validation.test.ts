import { describe, expect, it } from 'vitest'
import {
  RETENTION_OPTIONS,
  cleanString,
  isDownloadToken,
  isUuid,
  isValidEmail,
  isValidLayout,
  isValidPassword,
  isValidRetention,
  isValidTransferPassword,
  normalizeEmail,
  retentionToExpiry,
  toPositiveInt
} from '../../server/utils/validation'

// These are the gate every value passes on its way to the database or an e-mail,
// so the cases worth pinning down are the rejections, not the happy path.

describe('isValidEmail', () => {
  it('accepts ordinary addresses', () => {
    expect(isValidEmail('someone@example.com')).toBe(true)
    expect(isValidEmail('first.last+tag@sub.example.co.uk')).toBe(true)
  })

  it('rejects malformed input', () => {
    for (const value of ['', 'no-at-sign', 'no@tld', 'two@@example.com', 'spa ce@example.com']) {
      expect(isValidEmail(value), value).toBe(false)
    }
  })

  it('rejects non-strings rather than coercing them', () => {
    for (const value of [null, undefined, 42, {}, ['a@b.co']]) {
      expect(isValidEmail(value)).toBe(false)
    }
  })

  it('rejects an address longer than the column', () => {
    expect(isValidEmail(`${'a'.repeat(250)}@example.com`)).toBe(false)
  })
})

describe('normalizeEmail', () => {
  it('lowercases and trims so lookups and uniqueness agree', () => {
    expect(normalizeEmail('  Someone@Example.COM ')).toBe('someone@example.com')
  })
})

describe('retentionToExpiry', () => {
  it('treats 0 as no expiry', () => {
    // The whole unlimited-retention feature rests on this returning null: the
    // sweep skips rows with a NULL expiresAt.
    expect(retentionToExpiry(0)).toBeNull()
  })

  it('returns an instant the given number of days out', () => {
    const before = Date.now()
    const expiry = retentionToExpiry(14)
    expect(expiry).toBeInstanceOf(Date)

    const days = (expiry!.getTime() - before) / (24 * 60 * 60 * 1000)
    expect(days).toBeGreaterThan(13.99)
    expect(days).toBeLessThan(14.01)
  })

  it('produces an expiry for every option the UI offers', () => {
    for (const days of RETENTION_OPTIONS) {
      const expiry = retentionToExpiry(days)
      if (days === 0) expect(expiry).toBeNull()
      else expect(expiry!.getTime()).toBeGreaterThan(Date.now())
    }
  })
})

describe('isValidRetention', () => {
  it('accepts only the offered options', () => {
    for (const days of RETENTION_OPTIONS) expect(isValidRetention(days)).toBe(true)
  })

  it('rejects a value someone posted by hand', () => {
    // The point of the whitelist: not being able to pin a transfer for a decade.
    for (const value of [2, 3650, -1, 0.5, 'many', null]) {
      expect(isValidRetention(value), String(value)).toBe(false)
    }
  })
})

describe('password rules', () => {
  it('requires 8 characters for an account', () => {
    expect(isValidPassword('short7!')).toBe(false)
    expect(isValidPassword('longenough')).toBe(true)
  })

  it('allows a shorter share password, which guards an already-secret link', () => {
    expect(isValidTransferPassword('abc')).toBe(false)
    expect(isValidTransferPassword('abcd')).toBe(true)
  })

  it('rejects one longer than the column', () => {
    expect(isValidTransferPassword('a'.repeat(129))).toBe(false)
    expect(isValidPassword('a'.repeat(256))).toBe(false)
  })
})

describe('token shapes', () => {
  it('recognises a download token and rejects near misses', () => {
    expect(isDownloadToken('0123456789abcdef'.repeat(4))).toBe(true)
    expect(isDownloadToken('f'.repeat(64))).toBe(true)
    expect(isDownloadToken('f'.repeat(63))).toBe(false)
    expect(isDownloadToken('f'.repeat(65))).toBe(false)
    expect(isDownloadToken(`${'f'.repeat(63)}z`)).toBe(false)
  })

  it('recognises a uuid', () => {
    expect(isUuid('3f2504e0-4f89-41d3-9a0c-0305e82c3301')).toBe(true)
    expect(isUuid('3f2504e0-4f89-41d3-9a0c')).toBe(false)
  })
})

describe('cleanString', () => {
  it('trims, truncates and nulls out the empty case', () => {
    expect(cleanString('  hello  ', 50)).toBe('hello')
    expect(cleanString('   ', 50)).toBeNull()
    expect(cleanString(123, 50)).toBeNull()
    expect(cleanString('abcdef', 3)).toBe('abc')
  })
})

describe('toPositiveInt', () => {
  it('accepts a positive integer from a route parameter', () => {
    expect(toPositiveInt('42')).toBe(42)
  })

  it('rejects anything that would make a nonsense id', () => {
    for (const value of ['0', '-1', '1.5', 'abc', '', null, undefined]) {
      expect(toPositiveInt(value), String(value)).toBeNull()
    }
  })
})

describe('isValidLayout', () => {
  it('accepts the two layouts and nothing else', () => {
    expect(isValidLayout('list')).toBe(true)
    expect(isValidLayout('gallery')).toBe(true)
    expect(isValidLayout('grid')).toBe(false)
  })
})
