import nodemailer from 'nodemailer'
import { logger } from '../../server/utils/logger'

// One shared transporter: nodemailer pools connections internally, and building
// a new one per mail would re-do the SMTP handshake every time.
let transporter: nodemailer.Transporter | null = null

function getTransporter() {
  if (transporter) return transporter

  const config = useRuntimeConfig()
  const port = parseInt(String(config.emailPort), 10) || 465

  // Dry-run mode: render and hand back the message without opening a connection
  // to anything. This is what the test suite runs under — a test that sends a
  // magic link must not put mail in someone's inbox — and it also lets a
  // self-hoster start the app and click through it before they have SMTP set up,
  // instead of every mail-sending action failing.
  if (String(config.emailTransport).toLowerCase() === 'json') {
    transporter = nodemailer.createTransport({ jsonTransport: true })
    return transporter
  }

  transporter = nodemailer.createTransport({
    host: config.emailHost,
    port,
    // Implicit TLS on 465; STARTTLS on 587 and friends. Driven by config rather
    // than inferred from the port so an unusual setup can still be described.
    secure: String(config.emailSecure).toLowerCase() === 'true',
    auth: {
      user: config.emailUser,
      pass: config.emailPass
    }
  })

  return transporter
}

export interface SendEmailOptions {
  to: string | string[]
  subject: string
  html: string
  /** Plain-text alternative. Worth setting: it improves deliverability. */
  text?: string
  replyTo?: string
}

/**
 * Send one mail.
 *
 * Throws on failure — callers decide whether that should fail the request (a
 * magic link is useless if the mail never arrives) or merely be recorded (a
 * transfer's files are already safely stored, so a bounced notification
 * shouldn't undo the upload).
 */
export const sendEmail = async ({ to, subject, html, text, replyTo }: SendEmailOptions) => {
  const config = useRuntimeConfig()

  // A separate From address is supported because many providers require the
  // envelope sender to be the authenticated mailbox while you'd rather show a
  // friendlier address; falls back to the SMTP user.
  const from = config.emailFrom || config.emailUser

  try {
    const info = await getTransporter().sendMail({
      from,
      to,
      subject,
      html,
      ...(text ? { text } : {}),
      ...(replyTo ? { replyTo } : {})
    })
    logger.info('Email sent', { messageId: info.messageId, subject })
    return info
  } catch (error) {
    logger.error('Error sending email', error)
    throw error
  }
}
