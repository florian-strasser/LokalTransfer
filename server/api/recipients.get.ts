import type { RowDataPacket } from 'mysql2'
import { setupDatabase } from '../../app/lib/databaseSetup'
import { fail, requireUser } from '../utils/auth'
import { logger } from '../utils/logger'

// The team members a transfer can be addressed to.
//
// This is what fills the recipient picker on the guest upload page: a guest
// chooses who at the company should receive their files, instead of the
// destination being fixed in configuration.
//
// It requires a session, so the list of who works here is only visible to someone
// already vouched for — an admin added their address, and they redeemed a magic
// link sent to it. Addresses are included because a guest picking a recipient
// reasonably wants to see where their files are going.
export default defineEventHandler(async (event) => {
  const auth = await requireUser(event)
  if (!auth.ok) return fail(event, auth)

  try {
    const db = setupDatabase()

    const [members] = await db.execute<RowDataPacket[]>(
      `SELECT id, name, email FROM \`user\`
       WHERE \`type\` = 'member' AND (\`banned\` IS NULL OR \`banned\` = 0)
       ORDER BY \`name\` ASC`
    )

    return {
      data: members.map((member: RowDataPacket) => ({
        id: member.id,
        name: member.name,
        email: member.email
      }))
    }
  } catch (error) {
    logger.error('List recipients error', error)
    setResponseStatus(event, 500)
    return { error: 'INTERNAL_SERVER_ERROR' }
  }
})
