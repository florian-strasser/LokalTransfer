import type { RowDataPacket } from 'mysql2'
import { v4 as uuidv4 } from 'uuid'
import { setupDatabase } from '../../../../app/lib/databaseSetup'
import { fail, requireSessionMember } from '../../../utils/auth'
import { apiKeyStart, generateApiKey, hashApiKey } from '../../../utils/apiKey'
import { cleanString } from '../../../utils/validation'
import { logger } from '../../../utils/logger'

// Mint an API key for the signed-in member.
//
// Session-only on purpose: a key must never be able to mint another key, or a
// single leaked read-only key could bootstrap itself into a permanent write one.
//
// Guests can't have keys at all — they exist to drop files off through the
// browser, and a long-lived credential for an outside contact is a liability
// with no matching use.

// A year. Long enough for a CI job, short enough that an abandoned key expires.
const MAX_EXPIRY_DAYS = 365

// Keys are cheap to make and easy to forget; a ceiling keeps an automated caller
// from filling the table.
const MAX_KEYS_PER_USER = 25

export default defineEventHandler(async (event) => {
  const auth = await requireSessionMember(event)
  if (!auth.ok) return fail(event, auth)

  try {
    const body = await readBody(event)

    const name = cleanString(body?.name, 255)
    if (!name) {
      setResponseStatus(event, 400)
      return { error: 'INVALID_NAME' }
    }

    // Scope is requested as a boolean, not as a scope list. Rejecting a
    // `permissions` field rather than ignoring it matters: silently dropping it
    // would hand back a full write key to a caller who believed they had asked
    // for a restricted one, and guessing the field name wrong would fail open.
    if (body?.permissions !== undefined) {
      setResponseStatus(event, 400)
      return { error: 'USE_READ_ONLY_FLAG' }
    }

    const readOnly = body?.readOnly === true

    // Days rather than seconds: it's what the UI offers and what a human means.
    let expiresAt: Date | null = null
    if (body?.expiresInDays !== undefined && body?.expiresInDays !== null) {
      const days = Number(body.expiresInDays)
      if (!Number.isInteger(days) || days <= 0 || days > MAX_EXPIRY_DAYS) {
        setResponseStatus(event, 400)
        return { error: 'INVALID_EXPIRY' }
      }
      expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    }

    const db = setupDatabase()

    const [existing] = await db.execute<RowDataPacket[]>(
      'SELECT COUNT(*) AS count FROM `apikey` WHERE `userId` = ?',
      [auth.user.id]
    )
    if (Number(existing[0]?.count ?? 0) >= MAX_KEYS_PER_USER) {
      setResponseStatus(event, 400)
      return { error: 'TOO_MANY_KEYS' }
    }

    const key = generateApiKey()
    const id = uuidv4()

    // A read-only key is scoped to ["read"]; a full key stores ["read","write"].
    // Both are written explicitly rather than leaving NULL, so the scopes of a
    // key are always readable from the row.
    const permissions = JSON.stringify(readOnly ? ['read'] : ['read', 'write'])

    await db.execute(
      'INSERT INTO `apikey` (`id`, `name`, `start`, `key`, `userId`, `permissions`, `expiresAt`) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, name, apiKeyStart(key), hashApiKey(key), auth.user.id, permissions, expiresAt]
    )

    logger.info('API key created', { keyId: id, userId: auth.user.id, readOnly })

    return {
      data: {
        id,
        name,
        // The only time the plaintext exists outside the caller's hands. The
        // database holds a hash, so this cannot be shown again.
        key,
        start: apiKeyStart(key),
        readOnly,
        expiresAt
      }
    }
  } catch (error) {
    logger.error('Create API key error', error)
    setResponseStatus(event, 500)
    return { error: 'INTERNAL_SERVER_ERROR' }
  }
})
