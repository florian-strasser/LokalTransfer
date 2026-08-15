import { createHash, randomBytes } from 'node:crypto'

// API keys are high-entropy random tokens, not passwords, and that changes which
// hash is correct.
//
// A single fast hash (SHA-256) is the right choice here: it makes a leaked
// database useless for impersonation — you cannot present a hash to authenticate
// — while keeping verification a deterministic, indexed equality lookup.
//
// A slow salted hash (bcrypt) would be actively worse. Its cost only buys
// anything against low-entropy secrets that can be guessed, which a 256-bit
// random token cannot be. And because every row would carry a different salt,
// verification could not use an index: the server would have to bcrypt the
// presented key against every stored row in turn.
//
// CodeQL flags this as `js/insufficient-password-hash`. The rule fires on any
// fast hash reaching something it has decided is a password; here the input is
// `generateApiKey()` — 32 bytes from the CSPRNG — so the premise it tests for
// does not hold, and switching to bcrypt would make the system worse for the
// reasons above.
//
// It is dismissed in the repository's code-scanning alerts, not suppressed here:
// GitHub's default setup does not honour `// codeql[...]` comments, and one left
// in the source reads as a working suppression while doing nothing. This comment
// is the record of why the dismissal is correct.

/** The token handed to the caller. 32 bytes of entropy, hex encoded. */
export function generateApiKey(): string {
  return randomBytes(32).toString('hex')
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex')
}

/**
 * The leading characters kept in the clear so a key stays recognisable in the
 * UI after the plaintext is gone. Short enough to be useless on its own.
 */
export function apiKeyStart(key: string): string {
  return key.slice(0, 8)
}

/** Scopes a key can carry. `null` on a key row means unrestricted. */
export const API_SCOPES = ['read', 'write'] as const
export type ApiScope = typeof API_SCOPES[number]

/**
 * Whether a key may perform this request.
 *
 * `permissions` is the parsed array stored with the key; `null` means a key with
 * no scope recorded, which stays unrestricted so older keys keep working.
 *
 * Read is decided by HTTP method rather than by listing endpoints, so a new
 * endpoint is covered the moment it exists — there is no list to forget to
 * update.
 */
export function apiKeyAllowsWrite(permissions: unknown, method: string): boolean {
  if (!Array.isArray(permissions)) return true
  if (permissions.includes('write')) return true

  const verb = String(method || 'GET').toUpperCase()
  return verb === 'GET' || verb === 'HEAD' || verb === 'OPTIONS'
}
