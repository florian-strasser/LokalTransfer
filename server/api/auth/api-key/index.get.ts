import type { RowDataPacket } from 'mysql2'
import { setupDatabase } from '../../../../app/lib/databaseSetup'
import { fail, requireSessionMember } from '../../../utils/auth'
import { logger } from '../../../utils/logger'

// The signed-in member's own keys.
//
// `key` is never selected — the column holds a hash, and even that is not worth
// handing back. Only the `start` prefix, so a row is recognisable against the
// copy the caller saved.
export default defineEventHandler(async (event) => {
  const auth = await requireSessionMember(event)
  if (!auth.ok) return fail(event, auth)

  try {
    const db = setupDatabase()

    const [keys] = await db.execute<RowDataPacket[]>(
      `SELECT id, name, start, permissions, enabled, expiresAt, lastUsedAt, createdAt
       FROM \`apikey\`
       WHERE \`userId\` = ?
       ORDER BY \`createdAt\` DESC`,
      [auth.user.id]
    )

    return {
      data: keys.map((key: RowDataPacket) => {
        let permissions: string[] | null = null
        try {
          const parsed = key.permissions ? JSON.parse(String(key.permissions)) : null
          if (Array.isArray(parsed)) permissions = parsed.map(String)
        } catch {
          permissions = null
        }

        return {
          id: key.id,
          name: key.name,
          start: key.start,
          // Derived rather than stored, so the UI and the enforcement in
          // `apiKeyAllowsWrite` can't drift apart.
          readOnly: Array.isArray(permissions) && !permissions.includes('write'),
          enabled: !!key.enabled,
          expiresAt: key.expiresAt,
          expired: !!key.expiresAt && new Date(key.expiresAt).getTime() <= Date.now(),
          lastUsedAt: key.lastUsedAt,
          createdAt: key.createdAt
        }
      })
    }
  } catch (error) {
    logger.error('List API keys error', error)
    setResponseStatus(event, 500)
    return { error: 'INTERNAL_SERVER_ERROR' }
  }
})
