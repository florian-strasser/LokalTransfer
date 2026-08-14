import type { RowDataPacket } from 'mysql2'
import { setupDatabase } from '../../../app/lib/databaseSetup'
import { deleteTransfers } from '../../utils/transfers'
import {
  McpError,
  requireMcpMember,
  requireMcpWrite,
  transferIdInput
} from '../../utils/mcpHelpers'

export default defineMcpTool({
  name: 'deleteTransfer',
  title: 'Delete a transfer',
  description:
    'Revoke a transfer immediately — the manual version of expiry. The files are erased from '
    + 'the server and the record is removed, so any link already sitting in someone\'s inbox '
    + 'stops working. This cannot be undone and the files cannot be recovered. '
    + 'Confirm with the user before calling it.',
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  inputSchema: transferIdInput,
  inputExamples: [{ transferId: 12 }],
  handler: async ({ transferId }) => {
    const user = requireMcpMember()
    requireMcpWrite()

    const db = setupDatabase()
    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT id, senderId, subject FROM `transfers` WHERE `id` = ?',
      [transferId]
    )
    const transfer = rows[0]

    // Only the sender, even for an admin. Admins can clear up anyone's transfer
    // from the web interface, where a person is looking at what they are about to
    // erase; an agent holding a long-lived key gets no such reach.
    if (!transfer || transfer.senderId !== user.id) {
      throw new McpError(
        'NOT_FOUND',
        `No transfer with id ${transferId} that you sent.`
      )
    }

    await deleteTransfers(db, [transferId], useEvent())

    return jsonResult({
      transferId,
      deleted: true,
      subject: transfer.subject ?? null,
      note: 'The files are gone from the server and the download link no longer works.'
    })
  }
})
