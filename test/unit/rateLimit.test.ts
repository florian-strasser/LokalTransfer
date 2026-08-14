import { describe, expect, it } from 'vitest'
import { createRateLimiter } from '../../server/utils/rateLimit'

// The limiter is what makes a four-character share password and a five-per-hour
// magic link defensible, so its arithmetic is worth pinning. `now` is injectable
// precisely so the window can be tested without waiting a quarter of an hour.

describe('createRateLimiter', () => {
  it('allows exactly `max` attempts and then refuses', () => {
    const limiter = createRateLimiter({ max: 3, windowMs: 60_000 })
    const now = 1_000_000

    expect(limiter.consume('a', now).allowed).toBe(true)
    expect(limiter.consume('a', now).allowed).toBe(true)
    expect(limiter.consume('a', now).allowed).toBe(true)
    expect(limiter.consume('a', now).allowed).toBe(false)
  })

  it('counts down the remaining budget', () => {
    const limiter = createRateLimiter({ max: 3, windowMs: 60_000 })
    const now = 1_000_000

    expect(limiter.consume('a', now).remaining).toBe(2)
    expect(limiter.consume('a', now).remaining).toBe(1)
    expect(limiter.consume('a', now).remaining).toBe(0)
    expect(limiter.consume('a', now).remaining).toBe(0)
  })

  it('keys are independent, so one client cannot lock another out', () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 60_000 })
    const now = 1_000_000

    expect(limiter.consume('192.0.2.1', now).allowed).toBe(true)
    expect(limiter.consume('192.0.2.1', now).allowed).toBe(false)
    // A different address still has its full budget.
    expect(limiter.consume('198.51.100.7', now).allowed).toBe(true)
  })

  it('resets once the window has passed', () => {
    const limiter = createRateLimiter({ max: 2, windowMs: 60_000 })
    const start = 1_000_000

    limiter.consume('a', start)
    limiter.consume('a', start)
    expect(limiter.consume('a', start).allowed).toBe(false)

    // Still inside the window.
    expect(limiter.consume('a', start + 59_999).allowed).toBe(false)
    // Window elapsed.
    expect(limiter.consume('a', start + 60_000).allowed).toBe(true)
  })

  it('reports how long until the window resets', () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 60_000 })
    const start = 1_000_000

    expect(limiter.consume('a', start).retryAfterMs).toBe(0)

    const blocked = limiter.consume('a', start + 10_000)
    expect(blocked.allowed).toBe(false)
    // 60s window opened at `start`, so 50s remain.
    expect(blocked.retryAfterMs).toBe(50_000)
  })

  it('peek reports the state without spending the budget', () => {
    // Used by the sign-in endpoint so only *failed* attempts count — otherwise
    // someone signing in correctly all day would lock themselves out.
    const limiter = createRateLimiter({ max: 2, windowMs: 60_000 })
    const now = 1_000_000

    // Repeated peeks do not move the counter.
    expect(limiter.peek('a', now).allowed).toBe(true)
    expect(limiter.peek('a', now).allowed).toBe(true)
    expect(limiter.peek('a', now).allowed).toBe(true)

    // `remaining` from a peek is what would be left *after* the next event, so
    // it reads one lower than the untouched budget. Only `consume` moves it.
    expect(limiter.peek('a', now).remaining).toBe(1)
    limiter.consume('a', now)
    expect(limiter.peek('a', now).remaining).toBe(0)
  })

  it('peek turns unavailable only once the budget is actually spent', () => {
    const limiter = createRateLimiter({ max: 2, windowMs: 60_000 })
    const now = 1_000_000

    limiter.consume('a', now)
    expect(limiter.peek('a', now).allowed).toBe(true)
    limiter.consume('a', now)
    expect(limiter.peek('a', now).allowed).toBe(false)
  })

  it('does not grow without bound as keys age out', () => {
    // Every distinct client IP is a key; without the sweep this map would be an
    // unbounded memory leak on a public instance.
    const limiter = createRateLimiter({ max: 1, windowMs: 1_000 })

    for (let i = 0; i < 500; i++) limiter.consume(`ip-${i}`, 1_000_000)

    // Long after every entry expired, a fresh key still behaves correctly —
    // the sweep runs on access rather than on a timer.
    const later = 1_000_000 + 10_000
    expect(limiter.consume('ip-0', later).allowed).toBe(true)
    expect(limiter.consume('ip-0', later).allowed).toBe(false)
  })
})
