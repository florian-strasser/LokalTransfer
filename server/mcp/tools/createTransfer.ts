import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { setupDatabase } from '../../../app/lib/databaseSetup'
import { createTransferDraft } from '../../utils/transferActions'
import {
  LAYOUT_OPTIONS,
  RETENTION_OPTIONS,
  isValidEmail,
  isValidTransferPassword,
  normalizeEmail
} from '../../utils/validation'
import { McpError, appUrl, requireMcpMember, requireMcpWrite } from '../../utils/mcpHelpers'

export default defineMcpTool({
  name: 'createTransfer',
  title: 'Create a transfer',
  description:
    'Start a transfer. It is created as a draft — no files attached yet and nothing e-mailed. '
    + 'The response includes `uploadUrl`: POST each file there as multipart/form-data with the '
    + 'same `x-api-key` header, then call `sendTransfer` to deliver it. '
    + 'Leave `recipients` out for a link-only transfer that mails nobody.',
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  inputSchema: {
    recipients: z
      .array(z.string())
      .max(25)
      .optional()
      .describe(
        'E-mail addresses to deliver to. Omit, or pass an empty array, for a link-only '
        + 'transfer: nothing is e-mailed and the link is yours to pass on. At most 25.'
      ),
    subject: z.string().max(255).optional().describe('A short title for the transfer.'),
    message: z
      .string()
      .max(5000)
      .optional()
      .describe('A note shown on the download page and in the e-mail.'),
    retentionDays: z
      .number()
      .int()
      .optional()
      .describe(
        `How long the files stay available. One of ${RETENTION_OPTIONS.join(', ')}, `
        + 'where 0 means no expiry. Defaults to 14. Prefer a short retention.'
      ),
    password: z
      .string()
      .optional()
      .describe(
        'Optional password the recipient must enter before downloading. It is deliberately '
        + 'NOT included in the e-mail, so tell the user to pass it on by another channel.'
      ),
    layout: z
      .enum(LAYOUT_OPTIONS)
      .optional()
      .describe(
        'How the download page presents the files. "gallery" shows image thumbnails and '
        + 'suits photo sets; "list" (the default) suits documents.'
      )
  },
  inputExamples: [
    { recipients: ['client@example.com'], subject: 'Logo files', retentionDays: 7 },
    { subject: 'Draft for review', retentionDays: 1 }
  ],
  handler: async (input) => {
    const user = requireMcpMember()
    requireMcpWrite()

    const retentionDays = input.retentionDays ?? 14
    if (!(RETENTION_OPTIONS as readonly number[]).includes(retentionDays)) {
      throw new McpError(
        'VALIDATION',
        `retentionDays must be one of ${RETENTION_OPTIONS.join(', ')} (0 means no expiry).`
      )
    }

    // Recipients are resolved and de-duplicated before anything is written, so a
    // typo fails outright instead of leaving a draft the sweeper has to collect.
    const recipients: { userId: null, email: string, name: null }[] = []
    const seen = new Set<string>()
    for (const entry of input.recipients ?? []) {
      if (!isValidEmail(entry)) {
        throw new McpError('VALIDATION', `"${entry}" is not a valid e-mail address.`)
      }
      const email = normalizeEmail(entry)
      if (seen.has(email)) continue
      seen.add(email)
      recipients.push({ userId: null, email, name: null })
    }

    // The same cap the web composer enforces — each recipient is one outbound
    // mail, and this is the easiest place to turn the server into a relay.
    if (recipients.length > 25) {
      throw new McpError('VALIDATION', 'A transfer can address at most 25 recipients.')
    }

    let passwordHash: string | null = null
    if (input.password) {
      if (!isValidTransferPassword(input.password)) {
        throw new McpError(
          'VALIDATION',
          'A share password must be between 4 and 128 characters.'
        )
      }
      passwordHash = await bcrypt.hash(input.password, 10)
    }

    const db = setupDatabase()
    const { transferId } = await createTransferDraft(db, {
      user,
      kind: 'outgoing',
      subject: input.subject?.trim() || null,
      message: input.message?.trim() || null,
      retentionDays,
      layout: input.layout ?? 'list',
      passwordHash,
      recipients
    })

    return jsonResult({
      transferId,
      status: 'draft',
      recipients: recipients.map(r => r.email),
      linkOnly: recipients.length === 0,
      passwordProtected: passwordHash !== null,
      retentionDays,
      // Spelled out, because file bytes cannot travel through a tool call and an
      // agent otherwise has no way to know where they go.
      uploadUrl: `${appUrl()}/api/transfers/${transferId}/files`,
      uploadHint:
        'POST each file to uploadUrl as multipart/form-data with a `file` field, sending your '
        + 'x-api-key header. One file per request. Then call sendTransfer.',
      nextStep: 'Upload the files, then call sendTransfer with this transferId.'
    })
  }
})
