import type { RowDataPacket } from 'mysql2'
import { setupDatabase } from '../../../app/lib/databaseSetup'
import { loadTransferFiles, loadTransferRecipients } from '../../utils/transfers'
import {
  McpError,
  appUrl,
  requireMcpUser,
  serializeTransfer,
  transferIdInput
} from '../../utils/mcpHelpers'

export default defineMcpTool({
  name: 'getTransfer',
  title: 'Get a transfer',
  description:
    'Return one transfer in full: its files, status, expiry and download link. '
    + 'You can read a transfer you sent, or one that was sent to you.',
  annotations: { readOnlyHint: true, openWorldHint: false },
  inputSchema: transferIdInput,
  inputExamples: [{ transferId: 12 }],
  handler: async ({ transferId }) => {
    const user = requireMcpUser()
    const db = setupDatabase()

    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT * FROM `transfers` WHERE `id` = ?',
      [transferId]
    )
    const transfer = rows[0]
    if (!transfer) throw new McpError('NOT_FOUND', `No transfer with id ${transferId}.`)

    const recipients = await loadTransferRecipients(db, transferId)
    const isSender = transfer.senderId === user.id
    const isRecipient = recipients.some((r: RowDataPacket) => r.email === user.email)

    // Anyone else gets NOT_FOUND rather than FORBIDDEN, so ids can't be probed
    // for existence. A draft is only ever visible to its sender, since it isn't
    // a transfer yet as far as the recipient is concerned.
    if (!isSender && !(isRecipient && transfer.status === 'sent')) {
      throw new McpError('NOT_FOUND', `No transfer with id ${transferId}.`)
    }

    const files = await loadTransferFiles(db, transferId)

    return jsonResult({
      ...serializeTransfer(
        {
          id: transfer.id,
          // The download token is the whole credential for the link, so a
          // recipient reading their own transfer gets it too — they were sent it.
          token: transfer.token,
          subject: transfer.subject,
          message: transfer.message,
          status: transfer.status,
          kind: transfer.kind,
          layout: transfer.layout,
          expiresAt: transfer.expiresAt,
          downloadCount: transfer.downloadCount,
          createdAt: transfer.createdAt,
          sentAt: transfer.sentAt,
          hasPassword: !!transfer.passwordHash,
          fileCount: files.length,
          totalSize: files.reduce((sum, file) => sum + file.size, 0),
          // Only the sender sees who else it went to, so one recipient can't
          // harvest the others.
          recipients: isSender
            ? recipients.map((r: RowDataPacket) => r.email).join(', ')
            : null
        },
        appUrl()
      ),
      from: { name: transfer.senderName, email: transfer.senderEmail },
      youAre: isSender ? 'sender' : 'recipient',
      files: files.map(file => ({
        filename: file.filename,
        size: file.size,
        mimeType: file.mimeType
      }))
    })
  }
})
