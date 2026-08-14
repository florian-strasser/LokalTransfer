import {
  emailButton,
  emailDivider,
  emailFallbackLink,
  emailFileList,
  emailHeading,
  emailLayout,
  emailParagraph,
  emailQuote,
  escapeHtml,
  formatBytes,
  type EmailFile,
  type EmailTheme
} from './emailLayout'
import type { H3Event } from 'h3'
import { formatEmailDate, resolveLanguage, t, type EmailLanguage } from './emailStrings'

// Every template returns `{ subject, html }`. Callers hand that straight to
// sendEmail, so the shape of a mail is decided here and nowhere else.

export interface RenderedEmail {
  subject: string
  html: string
}

/**
 * Everything a template needs about the instance. Assembled once per request by
 * `emailContext(event)` rather than each template reaching into runtimeConfig,
 * which keeps them pure and testable.
 */
export interface EmailContext {
  appName: string
  appUrl: string
  language: EmailLanguage
  timezone: string
  theme: EmailTheme
}

/** Build the mail context from runtimeConfig. */
export function emailContext(event?: H3Event): EmailContext {
  const config = useRuntimeConfig(event)
  return {
    appName: String(config.appName),
    appUrl: String(config.appUrl).replace(/\/+$/, ''),
    language: resolveLanguage(config.language),
    timezone: String(config.timezone || 'UTC'),
    theme: {
      primary: String(config.public.colorPrimary),
      primaryDark: String(config.public.colorPrimaryDark)
    }
  }
}

/** Render an expiry instant, or null for a transfer that never expires. */
function expiryText(ctx: EmailContext, expiresAt: Date | null): string {
  return expiresAt
    ? t(ctx.language, 'transferExpiry', {
        expiry: formatEmailDate(expiresAt, ctx.language, ctx.timezone)
      })
    : t(ctx.language, 'transferExpiryUnlimited')
}

/** The "N files · 24.1 MB" summary line. */
function summaryLine(ctx: EmailContext, files: EmailFile[]): string {
  const total = files.reduce((sum, file) => sum + Number(file.size || 0), 0)
  return t(ctx.language, 'totalSize', { count: files.length, size: formatBytes(total) })
}

export interface TransferEmailInput {
  senderName: string
  subject?: string | null
  message?: string | null
  files: EmailFile[]
  downloadUrl: string
  expiresAt: Date | null
}

/**
 * The main event: a transfer has arrived, here is the download button.
 * Sent to each recipient of an outgoing transfer.
 */
export function renderTransferEmail(
  ctx: EmailContext,
  input: TransferEmailInput
): RenderedEmail {
  const { language } = ctx
  const { senderName, subject, message, files, downloadUrl, expiresAt } = input

  const subjectLine = subject
    ? t(language, 'transferSubjectNamed', { sender: senderName, subject })
    : t(language, 'transferSubject', { sender: senderName })

  const preheader = expiresAt
    ? t(language, 'transferPreheader', {
        count: files.length,
        expiry: formatEmailDate(expiresAt, language, ctx.timezone)
      })
    : t(language, 'transferPreheaderUnlimited', { count: files.length })

  const body = [
    emailHeading(t(language, 'transferHeading')),
    emailParagraph(
      t(language, 'transferIntro', {
        sender: escapeHtml(senderName),
        count: files.length,
        appName: escapeHtml(ctx.appName)
      })
    ),
    message
      ? emailQuote(
          `<strong>${escapeHtml(t(language, 'messageFrom', { sender: senderName }))}</strong><br>${escapeHtml(message)}`
        )
      : '',
    emailParagraph(
      `<span style="color:#71717a;" class="lt-muted">${escapeHtml(summaryLine(ctx, files))}</span>`
    ),
    emailFileList(files),
    emailButton(downloadUrl, t(language, 'transferButton'), ctx.theme),
    emailFallbackLink(downloadUrl),
    emailDivider(),
    emailParagraph(
      `<span style="font-size:13px;color:#71717a;" class="lt-muted">${expiryText(ctx, expiresAt)}</span>`
    )
  ].join('')

  return {
    subject: subjectLine,
    html: emailLayout(body, {
      appName: ctx.appName,
      appUrl: ctx.appUrl,
      preheader,
      theme: ctx.theme,
      footerNote: escapeHtml(
        t(language, 'transferFooter', { sender: senderName, appName: ctx.appName })
      )
    })
  }
}

export interface GuestTransferEmailInput extends TransferEmailInput {
  senderCompany?: string | null
  senderEmail: string
}

/**
 * A guest has dropped files off for a team member. Same shape as a normal
 * transfer, but the wording makes clear it came from outside and the guest's
 * address is offered as a reply-to.
 */
export function renderGuestTransferEmail(
  ctx: EmailContext,
  input: GuestTransferEmailInput
): RenderedEmail {
  const { language } = ctx
  const { senderName, senderCompany, message, files, downloadUrl, expiresAt } = input

  const body = [
    emailHeading(t(language, 'guestHeading')),
    emailParagraph(
      t(language, 'guestIntro', {
        sender: escapeHtml(senderName),
        company: senderCompany ? ` (${escapeHtml(senderCompany)})` : '',
        count: files.length
      })
    ),
    message
      ? emailQuote(
          `<strong>${escapeHtml(t(language, 'messageFrom', { sender: senderName }))}</strong><br>${escapeHtml(message)}`
        )
      : '',
    emailParagraph(
      `<span style="color:#71717a;" class="lt-muted">${escapeHtml(summaryLine(ctx, files))}</span>`
    ),
    emailFileList(files),
    emailButton(downloadUrl, t(language, 'transferButton'), ctx.theme),
    emailFallbackLink(downloadUrl),
    emailDivider(),
    emailParagraph(
      `<span style="font-size:13px;color:#71717a;" class="lt-muted">${expiryText(ctx, expiresAt)}</span>`
    )
  ].join('')

  return {
    subject: t(language, 'guestSubject', { sender: senderName }),
    html: emailLayout(body, {
      appName: ctx.appName,
      appUrl: ctx.appUrl,
      preheader: t(language, 'guestPreheader', { count: files.length, sender: senderName }),
      theme: ctx.theme,
      footerNote: escapeHtml(t(language, 'guestFooter'))
    })
  }
}

export interface ReceiptEmailInput {
  recipients: string[]
  files: EmailFile[]
  transferUrl: string
  expiresAt: Date | null
}

/** Confirmation to the sender that their transfer went out. */
export function renderReceiptEmail(ctx: EmailContext, input: ReceiptEmailInput): RenderedEmail {
  const { language } = ctx
  const recipientList = input.recipients.join(', ')

  const body = [
    emailHeading(t(language, 'receiptHeading')),
    emailParagraph(
      t(language, 'receiptIntro', {
        count: input.files.length,
        recipients: escapeHtml(recipientList)
      })
    ),
    emailParagraph(
      `<span style="color:#71717a;" class="lt-muted">${escapeHtml(summaryLine(ctx, input.files))}</span>`
    ),
    emailFileList(input.files),
    emailButton(input.transferUrl, t(language, 'receiptButton'), ctx.theme),
    emailDivider(),
    emailParagraph(
      `<span style="font-size:13px;color:#71717a;" class="lt-muted">${expiryText(ctx, input.expiresAt)}</span>`
    )
  ].join('')

  return {
    subject: t(language, 'receiptSubject'),
    html: emailLayout(body, {
      appName: ctx.appName,
      appUrl: ctx.appUrl,
      preheader: t(language, 'receiptPreheader', { recipients: recipientList }),
      theme: ctx.theme,
      footerNote: escapeHtml(t(language, 'receiptFooter'))
    })
  }
}

export interface ExpiryWarningEmailInput {
  subject?: string | null
  recipients: string[]
  files: EmailFile[]
  downloadUrl: string
  expiresAt: Date
  sentAt: Date
  downloadCount: number
}

/**
 * A last call before the files are deleted.
 *
 * Goes to the sender, not the recipients. The sender is the one who can act on
 * it — download the files again, or re-send the transfer — and they are the
 * account holder here. Recipients are often people with no relationship to this
 * instance at all, and a transfer addressed to 25 of them would turn one expiry
 * into 25 more outbound mails, which is the kind of amplification the recipient
 * cap elsewhere exists to avoid.
 *
 * The download count is included because it answers the question the warning
 * actually raises: has anyone picked these up yet? "Not downloaded" the day
 * before deletion is the case worth acting on.
 */
export function renderExpiryWarningEmail(
  ctx: EmailContext,
  input: ExpiryWarningEmailInput
): RenderedEmail {
  const { language } = ctx
  const { subject, recipients, files, downloadUrl, expiresAt, sentAt, downloadCount } = input

  const expiry = formatEmailDate(expiresAt, language, ctx.timezone)

  const body = [
    emailHeading(t(language, 'expiryWarningHeading')),
    emailParagraph(
      t(language, 'expiryWarningIntro', {
        count: files.length,
        sent: formatEmailDate(sentAt, language, ctx.timezone)
      })
    ),
    emailParagraph(
      recipients.length > 0
        ? t(language, 'expiryWarningRecipients', { recipients: escapeHtml(recipients.join(', ')) })
        : escapeHtml(t(language, 'expiryWarningLinkOnly'))
    ),
    emailParagraph(
      `<span style="color:#71717a;" class="lt-muted">${escapeHtml(
        downloadCount > 0
          ? t(language, 'expiryWarningDownloaded', { count: downloadCount })
          : t(language, 'expiryWarningNotDownloaded')
      )} ${escapeHtml(summaryLine(ctx, files))}</span>`
    ),
    emailFileList(files),
    emailButton(downloadUrl, t(language, 'expiryWarningButton'), ctx.theme),
    emailFallbackLink(downloadUrl),
    emailDivider(),
    emailParagraph(t(language, 'expiryWarningDeadline', { expiry })),
    emailParagraph(
      `<span style="font-size:13px;color:#71717a;" class="lt-muted">${escapeHtml(t(language, 'expiryWarningAction'))}</span>`
    )
  ].join('')

  return {
    subject: subject
      ? t(language, 'expiryWarningSubjectNamed', { subject })
      : t(language, 'expiryWarningSubject'),
    html: emailLayout(body, {
      appName: ctx.appName,
      appUrl: ctx.appUrl,
      preheader: t(language, 'expiryWarningPreheader', { expiry }),
      theme: ctx.theme,
      footerNote: escapeHtml(t(language, 'expiryWarningFooter'))
    })
  }
}

/** The guest's one-time sign-in link. */
export function renderMagicLinkEmail(
  ctx: EmailContext,
  input: { url: string, minutes: number }
): RenderedEmail {
  const { language } = ctx

  const body = [
    emailHeading(t(language, 'magicHeading')),
    emailParagraph(
      t(language, 'magicIntro', {
        appName: escapeHtml(ctx.appName),
        minutes: input.minutes
      })
    ),
    emailButton(input.url, t(language, 'magicButton'), ctx.theme),
    emailFallbackLink(input.url),
    emailDivider(),
    emailParagraph(
      `<span style="font-size:13px;color:#71717a;" class="lt-muted">${escapeHtml(t(language, 'magicIgnore'))}</span>`
    )
  ].join('')

  return {
    subject: t(language, 'magicSubject', { appName: ctx.appName }),
    html: emailLayout(body, {
      appName: ctx.appName,
      appUrl: ctx.appUrl,
      preheader: t(language, 'magicPreheader', { minutes: input.minutes }),
      theme: ctx.theme
    })
  }
}

/** Credentials for a member account an admin just created. */
export function renderWelcomeEmail(
  ctx: EmailContext,
  input: { name: string, adminName: string, email: string, password: string }
): RenderedEmail {
  const { language } = ctx

  const body = [
    emailHeading(t(language, 'welcomeHeading', { appName: ctx.appName })),
    emailParagraph(
      t(language, 'welcomeIntro', {
        name: escapeHtml(input.name),
        adminName: escapeHtml(input.adminName)
      })
    ),
    emailQuote(
      t(language, 'welcomeCredentials', {
        email: escapeHtml(input.email),
        password: escapeHtml(input.password)
      })
    ),
    emailParagraph(
      `<span style="font-size:13px;color:#71717a;" class="lt-muted">${escapeHtml(t(language, 'welcomeChange'))}</span>`
    ),
    emailButton(ctx.appUrl, t(language, 'welcomeButton'), ctx.theme)
  ].join('')

  return {
    subject: t(language, 'welcomeSubject', { appName: ctx.appName }),
    html: emailLayout(body, {
      appName: ctx.appName,
      appUrl: ctx.appUrl,
      preheader: t(language, 'welcomePreheader'),
      theme: ctx.theme
    })
  }
}

/** Tells a newly added guest that they can now send files, and how. */
export function renderGuestWelcomeEmail(
  ctx: EmailContext,
  input: { name: string }
): RenderedEmail {
  const { language } = ctx
  const sendUrl = `${ctx.appUrl}/`

  const body = [
    emailHeading(t(language, 'guestWelcomeHeading')),
    emailParagraph(t(language, 'guestWelcomeIntro', { name: escapeHtml(input.name) })),
    emailButton(sendUrl, t(language, 'guestWelcomeButton'), ctx.theme),
    emailFallbackLink(sendUrl)
  ].join('')

  return {
    subject: t(language, 'guestWelcomeSubject', { appName: ctx.appName }),
    html: emailLayout(body, {
      appName: ctx.appName,
      appUrl: ctx.appUrl,
      preheader: t(language, 'guestWelcomePreheader'),
      theme: ctx.theme
    })
  }
}

/** Password reset link for a member. */
export function renderPasswordResetEmail(
  ctx: EmailContext,
  input: { url: string }
): RenderedEmail {
  const { language } = ctx

  const body = [
    emailHeading(t(language, 'resetHeading')),
    emailParagraph(t(language, 'resetIntro', { appName: escapeHtml(ctx.appName) })),
    emailButton(input.url, t(language, 'resetButton'), ctx.theme),
    emailFallbackLink(input.url),
    emailDivider(),
    emailParagraph(
      `<span style="font-size:13px;color:#71717a;" class="lt-muted">${escapeHtml(t(language, 'resetIgnore'))}</span>`
    )
  ].join('')

  return {
    subject: t(language, 'resetSubject'),
    html: emailLayout(body, {
      appName: ctx.appName,
      appUrl: ctx.appUrl,
      preheader: t(language, 'resetPreheader'),
      theme: ctx.theme
    })
  }
}
