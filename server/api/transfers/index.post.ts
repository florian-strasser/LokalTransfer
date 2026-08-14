import type { RowDataPacket } from 'mysql2'
import { setupDatabase } from '../../../app/lib/databaseSetup'
import { fail, requireUser } from '../../utils/auth'
import bcrypt from 'bcryptjs'
import { createTransferDraft } from '../../utils/transferActions'
import {
  cleanString,
  isValidEmail,
  isValidLayout,
  isValidRetention,
  isValidTransferPassword,
  normalizeEmail
} from '../../utils/validation'
import { logger } from '../../utils/logger'

// Start a transfer.
//
// Creating the row first, then uploading files against it, then sending, is what
// makes per-file progress and retrying a single failed file possible. A transfer
// stays a "draft" until it is sent: not downloadable, and swept by the cleanup
// task if the upload is abandoned.
//
// Both members and guests come through here. What differs is who they may send
// to, which is enforced below rather than trusted from the client.
export default defineEventHandler(async (event) => {
  const auth = await requireUser(event)
  if (!auth.ok) return fail(event, auth)

  try {
    const config = useRuntimeConfig(event)
    const body = await readBody(event)

    const subject = cleanString(body?.subject, 255)
    const message = cleanString(body?.message, 5000)

    const isGuest = auth.user.type === 'guest'

    // Retention: guests don't choose. They're depositing files for someone here,
    // so the instance's default applies rather than letting an outside contact
    // pin something on the server indefinitely.
    // Validated before it is coerced, not after: `Number(null)` is 0, and 0 is
    // the "keep forever" option, so coercing first would turn a missing or blank
    // field into a transfer that never expires.
    const rawRetention = isGuest ? config.defaultRetentionDays : body?.retentionDays

    if (!isValidRetention(rawRetention)) {
      setResponseStatus(event, 400)
      return { error: 'INVALID_RETENTION' }
    }

    const requestedRetention = Number(rawRetention)

    // --- Share options -------------------------------------------------------
    // An optional password, and how the download page presents the files.
    // Guests get neither: they are dropping files off for someone here, not
    // publishing a page, so there is nothing for them to configure.
    const layout = isGuest ? 'list' : (body?.layout ?? 'list')
    if (!isValidLayout(layout)) {
      setResponseStatus(event, 400)
      return { error: 'INVALID_LAYOUT' }
    }

    const rawPassword = isGuest ? null : body?.password
    let passwordHash: string | null = null

    // An empty string means "no password" — the field was simply left blank.
    if (rawPassword !== null && rawPassword !== undefined && rawPassword !== '') {
      if (!isValidTransferPassword(rawPassword)) {
        setResponseStatus(event, 400)
        return { error: 'INVALID_TRANSFER_PASSWORD' }
      }
      passwordHash = await bcrypt.hash(rawPassword, 10)
    }

    const db = setupDatabase()

    // --- Recipients ----------------------------------------------------------
    // A guest may only send to internal members, chosen from the list the
    // recipients endpoint offers. Resolving the ids against the database (rather
    // than accepting addresses from the request) means a guest can't use this to
    // mail an arbitrary third party from your server.
    const recipients: { userId: string | null, email: string, name: string | null }[] = []

    if (isGuest) {
      const ids: unknown[] = Array.isArray(body?.recipientUserIds) ? body.recipientUserIds : []
      const uniqueIds = [
        ...new Set(ids.filter((id): id is string => typeof id === 'string'))
      ]

      if (uniqueIds.length === 0) {
        setResponseStatus(event, 400)
        return { error: 'NO_RECIPIENTS' }
      }

      const placeholders = uniqueIds.map(() => '?').join(', ')
      const [members] = await db.execute<RowDataPacket[]>(
        `SELECT id, name, email FROM \`user\`
         WHERE \`id\` IN (${placeholders}) AND \`type\` = 'member' AND (\`banned\` IS NULL OR \`banned\` = 0)`,
        uniqueIds
      )

      if (members.length === 0) {
        setResponseStatus(event, 400)
        return { error: 'NO_RECIPIENTS' }
      }

      for (const member of members) {
        recipients.push({ userId: member.id, email: member.email, name: member.name })
      }
    } else {
      const emails = Array.isArray(body?.recipients) ? body.recipients : []
      const seen = new Set<string>()

      for (const entry of emails) {
        if (!isValidEmail(entry)) {
          setResponseStatus(event, 400)
          return { error: 'INVALID_RECIPIENT' }
        }
        const normalized = normalizeEmail(entry)
        if (seen.has(normalized)) continue
        seen.add(normalized)
        recipients.push({ userId: null, email: normalized, name: null })
      }

      // No recipients is a deliberate choice, not an error: the sender gets the
      // link on screen and passes it on themselves, by message, chat, or however
      // they like. Nothing is e-mailed for these, so the mail-relay cap below
      // isn't relevant either.
      //
      // A guest can't do this — their whole purpose is delivering files to
      // someone here, and a link only they hold delivers nothing.

      // A cap, because each recipient is one outbound mail and this is the
      // easiest place to turn the server into a mail relay.
      if (recipients.length > 25) {
        setResponseStatus(event, 400)
        return { error: 'TOO_MANY_RECIPIENTS' }
      }
    }

    const { transferId, token, expiresAt } = await createTransferDraft(db, {
      user: auth.user,
      kind: isGuest ? 'guest' : 'outgoing',
      subject,
      message,
      retentionDays: requestedRetention,
      layout,
      passwordHash,
      recipients
    })

    return {
      data: {
        id: transferId,
        // The download token is returned so the sender can copy the link
        // straight after sending, without a second round trip.
        token,
        status: 'draft',
        retentionDays: requestedRetention,
        expiresAt,
        layout,
        // The password itself is never echoed back — only whether one is set.
        hasPassword: passwordHash !== null,
        recipients: recipients.map(r => ({ email: r.email, name: r.name }))
      }
    }
  } catch (error) {
    logger.error('Create transfer error', error)
    setResponseStatus(event, 500)
    return { error: 'INTERNAL_SERVER_ERROR' }
  }
})
