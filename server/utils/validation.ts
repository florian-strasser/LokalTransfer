// Shared input validation. Deliberately small and strict — every value that
// reaches the database or an email goes through one of these first.

// Pragmatic address check: rejects the obviously malformed without trying to
// implement RFC 5322. Anything that passes still has to survive actual delivery.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const MAX_EMAIL_LENGTH = 255

export function isValidEmail(value: unknown): value is string {
  return (
    typeof value === 'string'
    && value.length <= MAX_EMAIL_LENGTH
    && EMAIL_REGEX.test(value)
  )
}

/** Lowercase and trim an address so lookups and uniqueness behave predictably. */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

// UUID v4, used for session tokens and one-time verification tokens.
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value)
}

// Download tokens are 32 random bytes rendered as hex.
const DOWNLOAD_TOKEN_REGEX = /^[0-9a-f]{64}$/i

export function isDownloadToken(value: unknown): value is string {
  return typeof value === 'string' && DOWNLOAD_TOKEN_REGEX.test(value)
}

/**
 * Minimum password length. Long-but-simple beats short-but-complex, so length is
 * the only rule enforced here rather than a character-class checklist.
 */
export const MIN_PASSWORD_LENGTH = 8
export const MAX_PASSWORD_LENGTH = 255

export function isValidPassword(value: unknown): value is string {
  return (
    typeof value === 'string'
    && value.length >= MIN_PASSWORD_LENGTH
    && value.length <= MAX_PASSWORD_LENGTH
  )
}

/**
 * Trim a string and enforce a maximum length, returning null when it is empty or
 * not a string at all. Used for optional free-text fields.
 */
export function cleanString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, maxLength)
}

/** A positive integer id from a route parameter or body field. */
export function toPositiveInt(value: unknown): number | null {
  const num = Number(value)
  if (!Number.isInteger(num) || num <= 0) return null
  return num
}

/**
 * Minimum length for a transfer's share password.
 *
 * Deliberately shorter than an account password. This one guards a link that
 * already carries 256 bits of entropy in its token — it exists so a forwarded
 * link isn't enough on its own, and it gets typed by people reading it off a
 * text message. Online guessing is handled by the download rate limiter instead
 * of by demanding a long password.
 */
export const MIN_TRANSFER_PASSWORD_LENGTH = 4
export const MAX_TRANSFER_PASSWORD_LENGTH = 128

export function isValidTransferPassword(value: unknown): value is string {
  return (
    typeof value === 'string'
    && value.length >= MIN_TRANSFER_PASSWORD_LENGTH
    && value.length <= MAX_TRANSFER_PASSWORD_LENGTH
  )
}

/** How the download page presents the files. */
export const LAYOUT_OPTIONS = ['list', 'gallery'] as const
export type TransferLayout = typeof LAYOUT_OPTIONS[number]

export function isValidLayout(value: unknown): value is TransferLayout {
  return typeof value === 'string' && (LAYOUT_OPTIONS as readonly string[]).includes(value)
}

// Retention choices offered in the UI, in days. 0 means "keep forever" and is
// stored as a NULL expiry. Validated server-side so an arbitrary value can't be
// posted to get, say, a ten-year retention.
export const RETENTION_OPTIONS = [1, 3, 7, 14, 30, 60, 90, 0] as const

export function isValidRetention(value: unknown): boolean {
  // Only a number or a numeric string counts. `Number()` alone would be too
  // generous in the one direction that matters: it turns null, "", false and []
  // all into 0 — which is the "keep forever" option. A client that omitted the
  // field, or sent an empty form value, would silently get a transfer that is
  // never deleted, which is the opposite of what this app promises. Anything
  // that isn't plainly a number is rejected so the caller gets a 400 instead.
  if (typeof value !== 'number' && typeof value !== 'string') return false
  if (typeof value === 'string' && value.trim() === '') return false

  const num = Number(value)
  return Number.isInteger(num) && (RETENTION_OPTIONS as readonly number[]).includes(num)
}

/**
 * Turn a retention in days into an absolute expiry instant, or null for
 * unlimited. Centralised so "0 means forever" is decided in exactly one place.
 */
export function retentionToExpiry(days: number): Date | null {
  if (!days) return null
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
}
