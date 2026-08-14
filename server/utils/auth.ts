import type { RowDataPacket } from 'mysql2'
import type { H3Event } from 'h3'
import { setupDatabase } from '../../app/lib/databaseSetup'
import { apiKeyAllowsWrite, hashApiKey } from './apiKey'
import { v4 as uuidv4 } from 'uuid'
import { setCookie, getCookie } from 'h3'
import { logger } from './logger'

export const SESSION_COOKIE = 'session_token'

export type UserType = 'member' | 'guest'

export interface SessionUser {
  id: string
  name: string
  email: string
  role: string
  type: UserType
  company: string | null
}

/**
 * Issue a session and set its cookie.
 *
 * Guest sessions are deliberately much shorter than member ones: a magic link is
 * a one-off errand (drop off some files), not a standing login, so the window in
 * which a leaked link or an unattended browser is useful stays small.
 */
export async function createSession(event: H3Event, userId: string, type: UserType = 'member') {
  const userIdStr = String(userId)

  if (!userIdStr) {
    logger.error('Invalid userId for session creation')
    return { error: 'INVALID_USER_ID' }
  }

  try {
    const db = setupDatabase()
    const config = useRuntimeConfig(event)

    let maxAgeSeconds: number
    if (type === 'guest') {
      const hours = Number(config.guestSessionMaxAgeHours)
      maxAgeSeconds = Math.floor((Number.isFinite(hours) && hours > 0 ? hours : 12) * 60 * 60)
    } else {
      const days = Number(config.sessionMaxAgeDays)
      maxAgeSeconds = Math.floor((Number.isFinite(days) && days > 0 ? days : 7) * 24 * 60 * 60)
    }

    const sessionToken = uuidv4()

    await db.execute(
      'INSERT INTO `session` (`id`, `expiresAt`, `token`, `userId`, `ipAddress`, `userAgent`) VALUES (?, ?, ?, ?, ?, ?)',
      [
        uuidv4(),
        new Date(Date.now() + maxAgeSeconds * 1000),
        sessionToken,
        userIdStr,
        getRequestIP(event, { xForwardedFor: true }) || null,
        getRequestHeader(event, 'user-agent')?.slice(0, 255) || null
      ]
    )

    // `secure` can't just key off NODE_ENV: in the usual deployment this runs
    // behind a TLS-terminating proxy, so the app itself speaks plain HTTP and
    // only the forwarded header reveals the real scheme.
    const isSecureContext
      = process.env.NODE_ENV === 'production'
        || process.env.SSL === 'true'
        || getRequestHeader(event, 'x-forwarded-proto') === 'https'

    setCookie(event, SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: isSecureContext,
      sameSite: 'lax',
      maxAge: maxAgeSeconds,
      path: '/'
    })

    return { sessionToken, user: { id: userIdStr } }
  } catch (error) {
    logger.error('Session creation error', error)
    return { error: 'SESSION_CREATION_FAILED' }
  }
}

// The discriminated result lets the get-session endpoint tell "no session" (401)
// from "banned" (403) apart, while internal callers can treat both as
// "not authenticated" without caring which.
export interface SessionInfo {
  id: string
  expiresAt: Date
  createdAt: Date
}

export type SessionResult
  = | { status: 'ok', session: SessionInfo, user: SessionUser }
    | { status: 'banned' }
    | { status: 'invalid' }

export async function resolveSession(event: H3Event): Promise<SessionResult> {
  const sessionToken
    = getRequestHeader(event, 'authorization')?.replace('Bearer ', '')
      || getCookie(event, SESSION_COOKIE)

  return resolveSessionToken(sessionToken)
}

/** Resolve a session straight from its token, for callers without an h3 event. */
export async function resolveSessionToken(sessionToken: unknown): Promise<SessionResult> {
  if (!sessionToken || typeof sessionToken !== 'string' || sessionToken.length < 10) {
    return { status: 'invalid' }
  }

  const db = setupDatabase()

  const [sessions] = await db.execute<RowDataPacket[]>(
    'SELECT * FROM `session` WHERE `token` = ? AND `expiresAt` > NOW()',
    [sessionToken]
  )
  const session = sessions[0]
  if (!session) return { status: 'invalid' }

  const [users] = await db.execute<RowDataPacket[]>(
    'SELECT id, name, email, role, type, company, banned FROM `user` WHERE `id` = ?',
    [session.userId]
  )
  const user = users[0]
  if (!user) return { status: 'invalid' }

  // Don't leak ban details; a banned user has no access either way.
  if (user.banned) return { status: 'banned' }

  return {
    status: 'ok',
    session: {
      id: session.id,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt
    },
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      type: user.type || 'member',
      company: user.company || null
    }
  }
}

export async function getUserSession(event: H3Event) {
  try {
    const result = await resolveSession(event)
    if (result.status === 'ok') {
      return { session: result.session, user: result.user }
    }
    return null
  } catch (error) {
    logger.error('Session fetch error', error)
    return null
  }
}

// --- API keys ----------------------------------------------------------------
//
// The second way in, for the REST API and the MCP server. A key authenticates as
// exactly one user and carries the same permissions that user has — it is a
// delegated credential, never an escalation.

export interface ApiKeyIdentity {
  user: SessionUser
  /** Parsed scopes, or null for an unrestricted key. */
  permissions: string[] | null
  keyId: string
}

/**
 * Resolve an `x-api-key` header to the user it acts for.
 *
 * Returns null for anything unusable — missing, unknown, disabled, expired, or
 * belonging to a banned user — so callers can't tell those cases apart.
 */
export async function getApiKeyUser(event: H3Event): Promise<ApiKeyIdentity | null> {
  const presented = getRequestHeader(event, 'x-api-key')
  // Keys are fixed-length hex; anything else can't match and isn't worth a query.
  if (!presented || !/^[0-9a-f]{64}$/i.test(presented)) return null

  try {
    const db = setupDatabase()

    // Looked up by hash: the plaintext is never stored, so this is both the
    // verification and the index lookup.
    const [keys] = await db.execute<RowDataPacket[]>(
      'SELECT id, userId, permissions, enabled, expiresAt FROM `apikey` WHERE `key` = ?',
      [hashApiKey(presented)]
    )
    const key = keys[0]
    if (!key || !key.enabled) return null

    if (key.expiresAt && new Date(key.expiresAt).getTime() <= Date.now()) return null

    const [users] = await db.execute<RowDataPacket[]>(
      'SELECT id, name, email, role, type, company, banned FROM `user` WHERE `id` = ?',
      [key.userId]
    )
    const user = users[0]
    if (!user || user.banned) return null

    // Best-effort: a failed write here must not cost the caller their request.
    db.execute('UPDATE `apikey` SET `lastUsedAt` = CURRENT_TIMESTAMP WHERE `id` = ?', [key.id])
      .catch(() => {})

    let permissions: string[] | null = null
    if (key.permissions) {
      try {
        const parsed = JSON.parse(String(key.permissions))
        if (Array.isArray(parsed)) permissions = parsed.map(String)
      } catch {
        // A malformed scope list must not silently become "unrestricted".
        logger.error('API key has unparseable permissions', { keyId: key.id })
        return null
      }
    }

    return {
      keyId: String(key.id),
      permissions,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        type: user.type || 'member',
        company: user.company || null
      }
    }
  } catch (error) {
    logger.error('API key lookup error', error)
    return null
  }
}

// A failed authorization check carries the HTTP status and a deliberately
// generic message the caller returns verbatim.
export type AuthFailure = { ok: false, status: number, error: string }

const UNAUTHENTICATED: AuthFailure = { ok: false, status: 401, error: 'UNAUTHORIZED' }
const FORBIDDEN: AuthFailure = { ok: false, status: 403, error: 'FORBIDDEN' }
const READ_ONLY_KEY: AuthFailure = { ok: false, status: 403, error: 'API_KEY_READ_ONLY' }
const API_KEY_CANNOT_MANAGE_KEYS: AuthFailure
  = { ok: false, status: 403, error: 'API_KEY_CANNOT_MANAGE_KEYS' }

export type UserResolution
  = AuthFailure
    | { ok: true, user: SessionUser, viaApiKey?: boolean }

/**
 * Require any authenticated caller — a signed-in user (member or guest) or a
 * valid API key.
 *
 * This is the boilerplate every data endpoint would otherwise repeat inline.
 * Returns the exact status and message the endpoint should hand back on denial,
 * so error shapes stay identical across the API.
 *
 * The read-only scope is enforced here, at the single choke point every endpoint
 * already passes through, keyed on the HTTP method. Putting it anywhere else
 * would mean remembering to add it to each new endpoint.
 */
export async function requireUser(event: H3Event): Promise<UserResolution> {
  const identity = await getApiKeyUser(event)
  if (identity) {
    if (!apiKeyAllowsWrite(identity.permissions, event.method)) return READ_ONLY_KEY
    return { ok: true, user: identity.user, viaApiKey: true }
  }

  const session = await getUserSession(event)
  if (!session?.user?.id) return UNAUTHENTICATED
  return { ok: true, user: session.user }
}

/**
 * Require an internal team member. Guests authenticate through the same session
 * machinery, so every member-only endpoint has to say so explicitly — otherwise
 * a guest's magic-link session would be accepted anywhere a member's is.
 */
export async function requireMember(event: H3Event): Promise<UserResolution> {
  const auth = await requireUser(event)
  if (!auth.ok) return auth
  if (auth.user.type !== 'member') return FORBIDDEN
  return auth
}

/**
 * Require a member signed in through the browser, refusing API keys.
 *
 * This is what guards key management itself. `requireMember` is not enough:
 * it accepts a key, so a leaked full key could mint a second one — and revoking
 * the original would then achieve nothing — or revoke the owner's other keys.
 * A credential must not be able to extend or curtail its own account's access;
 * that is a decision a person makes while signed in.
 */
export async function requireSessionMember(event: H3Event): Promise<UserResolution> {
  if (await getApiKeyUser(event)) return API_KEY_CANNOT_MANAGE_KEYS

  const session = await getUserSession(event)
  if (!session?.user?.id) return UNAUTHENTICATED
  if (session.user.type !== 'member') return FORBIDDEN
  return { ok: true, user: session.user }
}

/**
 * Require an admin, signed in through the browser.
 *
 * API keys are deliberately refused here even when they belong to an admin. A
 * key is a long-lived credential that tends to end up in a CI job or an agent's
 * config, and the endpoints behind this guard create accounts and delete users —
 * deleting a user takes every transfer they ever sent with them. Account
 * administration stays something a person does while signed in.
 *
 * This is the one place the API is deliberately narrower than the UI; the
 * transfer endpoints are fully available to keys.
 */
export async function requireAdmin(event: H3Event): Promise<UserResolution> {
  if (await getApiKeyUser(event)) {
    return { ok: false, status: 403, error: 'API_KEY_CANNOT_ADMINISTER' }
  }

  const auth = await requireMember(event)
  if (!auth.ok) return auth
  if (auth.user.role !== 'admin') return FORBIDDEN
  return auth
}

/**
 * Apply an `AuthFailure` to the response and return its body. Keeps the
 * `if (!auth.ok) return fail(event, auth)` line in handlers down to one call.
 */
export function fail(event: H3Event, failure: AuthFailure) {
  setResponseStatus(event, failure.status)
  return { error: failure.error }
}
