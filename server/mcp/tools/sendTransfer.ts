import { setupDatabase } from '../../../app/lib/databaseSetup'
import { sendTransferById } from '../../utils/transferActions'
import {
  McpError,
  requireMcpMember,
  requireMcpWrite,
  transferIdInput
} from '../../utils/mcpHelpers'

export default defineMcpTool({
  name: 'sendTransfer',
  title: 'Send a transfer',
  description:
    'Deliver a draft transfer. This mails every recipient a download link, starts the '
    + 'retention countdown and makes the link work. Call it after the files are uploaded. '
    + 'A transfer with no recipients mails nobody — you get the link back to pass on yourself.',
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  inputSchema: transferIdInput,
  inputExamples: [{ transferId: 12 }],
  handler: async ({ transferId }) => {
    const user = requireMcpMember()
    requireMcpWrite()

    const db = setupDatabase()
    const result = await sendTransferById(useEvent(), db, transferId, user)

    if (!result.ok) {
      if (result.reason === 'ALREADY_SENT') {
        throw new McpError(
          'VALIDATION',
          `Transfer ${transferId} has already been sent. Use getTransfer to read its download link.`
        )
      }
      if (result.reason === 'NO_FILES') {
        throw new McpError(
          'VALIDATION',
          `Transfer ${transferId} has no files yet. Upload at least one file to `
          + `/api/transfers/${transferId}/files before sending.`
        )
      }
      // Someone else's transfer reads as missing, so ids can't be probed.
      throw new McpError('NOT_FOUND', `No draft transfer with id ${transferId}.`)
    }

    return jsonResult({
      transferId: result.transferId,
      status: 'sent',
      downloadUrl: result.downloadUrl,
      expiresAt: result.expiresAt,
      recipientCount: result.recipientCount,
      // Mail is best-effort once the files are live: the transfer is downloadable
      // even if a notification bounced, and the caller should say so rather than
      // report a clean send.
      notified: result.notified,
      warning: result.notified < result.recipientCount
        ? `Only ${result.notified} of ${result.recipientCount} notification e-mails went out. `
        + 'The transfer is live — pass the download link on directly.'
        : undefined
    })
  }
})
