import type { RowDataPacket } from 'mysql2'
import { setupDatabase } from '../../../app/lib/databaseSetup'
import { requireMcpMember } from '../../utils/mcpHelpers'

export default defineMcpTool({
  name: 'listRecipients',
  title: 'List team members',
  description:
    'List the team members on this instance, with their e-mail addresses. Use it to resolve '
    + 'a name the user mentioned ("send it to Anna") into an address for createTransfer. '
    + 'This is the team, not an address book — outside recipients are simply typed in.',
  annotations: { readOnlyHint: true, openWorldHint: false },
  inputSchema: {},
  inputExamples: [{}],
  handler: async () => {
    const user = requireMcpMember()
    const db = setupDatabase()

    const [members] = await db.execute<RowDataPacket[]>(
      `SELECT id, name, email FROM \`user\`
       WHERE \`type\` = 'member' AND (\`banned\` IS NULL OR \`banned\` = 0)
       ORDER BY \`name\` ASC`
    )

    return jsonResult({
      count: members.length,
      members: members.map((member: RowDataPacket) => ({
        name: member.name,
        email: member.email,
        // Marked so an agent doesn't offer to mail the user their own files.
        isYou: member.id === user.id
      }))
    })
  }
})
