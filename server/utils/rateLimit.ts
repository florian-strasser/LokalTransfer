import { getRequestIP, type H3Event } from 'h3'

// Simple in-memory fixed-window rate limiter.
//
// Scope note: state lives in the Node process, so limits are per-instance and
// reset on restart. That fits the single-container deployment this app targets.
// If it is ever scaled to several replicas behind a load balancer, this needs a
// shared store (DB/Redis) — the interface is kept small so the store can be
// swapped without touching any caller.

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  /** Milliseconds until the window resets (0 when allowed). */
  retryAfterMs: number
}

export interface RateLimiter {
  /**
   * Count this event against the budget and report whether it is allowed. Use
   * where every request should count, because each one does real work (sending
   * an email, say).
   */
  consume: (key: string, now?: number) => RateLimitResult
  /**
   * Report whether the key is currently under budget WITHOUT counting. Use to
   * block before doing work, then `consume` only on failure — so a successful
   * login doesn't burn the budget for everyone behind the same office IP.
   */
  peek: (key: string, now?: number) => RateLimitResult
}

export function createRateLimiter(options: { max: number, windowMs: number }): RateLimiter {
  const { max, windowMs } = options
  const hits = new Map<string, { count: number, resetAt: number }>()
  let lastSweep = 0

  function getEntry(key: string, now: number) {
    // Periodically drop expired entries so memory stays bounded to roughly the
    // number of distinct keys seen within one window.
    if (now - lastSweep > windowMs) {
      for (const [k, v] of hits) {
        if (now >= v.resetAt) hits.delete(k)
      }
      lastSweep = now
    }

    let entry = hits.get(key)
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs }
      hits.set(key, entry)
    }
    return entry
  }

  function result(count: number, resetAt: number, now: number): RateLimitResult {
    const allowed = count <= max
    return {
      allowed,
      remaining: Math.max(0, max - count),
      retryAfterMs: allowed ? 0 : resetAt - now
    }
  }

  function consume(key: string, now: number = Date.now()): RateLimitResult {
    const entry = getEntry(key, now)
    entry.count++
    return result(entry.count, entry.resetAt, now)
  }

  function peek(key: string, now: number = Date.now()): RateLimitResult {
    const entry = getEntry(key, now)
    // +1 reflects whether the *next* event would be allowed.
    return result(entry.count + 1, entry.resetAt, now)
  }

  return { consume, peek }
}

/**
 * Best-effort client IP, honouring X-Forwarded-For (this app is normally run
 * behind a reverse proxy). Falls back to a constant so the limiter still
 * functions when no IP can be determined.
 */
export function clientIp(event: H3Event): string {
  return getRequestIP(event, { xForwardedFor: true }) || 'unknown'
}

function set429(event: H3Event, result: RateLimitResult) {
  setResponseStatus(event, 429)
  setResponseHeader(event, 'Retry-After', Math.ceil(result.retryAfterMs / 1000))
}

/**
 * Count this request against the limiter (keyed by client IP). On limit, sets
 * 429 + `Retry-After` and returns false; the caller returns its own error body.
 */
export function enforceRateLimit(event: H3Event, limiter: RateLimiter): boolean {
  const result = limiter.consume(clientIp(event))
  if (!result.allowed) {
    set429(event, result)
    return false
  }
  return true
}

/**
 * Block (429) if the client IP is already at its limit, WITHOUT counting this
 * request. Returns true when blocked. Pair with `recordFailure` so only failed
 * attempts count.
 */
export function blockIfRateLimited(event: H3Event, limiter: RateLimiter): boolean {
  const result = limiter.peek(clientIp(event))
  if (!result.allowed) {
    set429(event, result)
    return true
  }
  return false
}

/** Count one failed attempt for the client IP against the limiter. */
export function recordFailure(event: H3Event, limiter: RateLimiter): void {
  limiter.consume(clientIp(event))
}

// Per-endpoint limiters (module singletons, shared across requests in this
// instance). Tuned for online brute-force and abuse protection without tripping
// up legitimate users.
export const signInLimiter = createRateLimiter({ max: 10, windowMs: 15 * 60 * 1000 })
export const passwordRequestLimiter = createRateLimiter({ max: 5, windowMs: 15 * 60 * 1000 })
export const passwordResetLimiter = createRateLimiter({ max: 10, windowMs: 15 * 60 * 1000 })
// Magic links are the guest's only way in, and each request sends an email, so
// this is both anti-spam and anti-enumeration.
export const magicLinkLimiter = createRateLimiter({ max: 5, windowMs: 15 * 60 * 1000 })
// Download tokens are 32 bytes of entropy; this just takes brute force off the
// table entirely and caps scraping.
export const downloadLimiter = createRateLimiter({ max: 120, windowMs: 15 * 60 * 1000 })
