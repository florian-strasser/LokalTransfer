import { describe, expect, it } from 'vitest'
import {
  renderExpiryWarningEmail,
  renderMagicLinkEmail,
  renderPasswordResetEmail,
  renderReceiptEmail,
  renderTransferEmail,
  type EmailContext
} from '../../server/utils/emailTemplates'
import { t } from '../../server/utils/emailStrings'

// Mail is the one output nobody sees fail: it is rendered on a server, sent to
// somebody else's inbox, and a broken link or an unescaped apostrophe is only
// discovered by the recipient. These tests pin the parts that matter — the link
// is present and correct, user-supplied text is escaped, and both languages
// render at all.

const ctx: EmailContext = {
  appName: 'LokalTransfer',
  appUrl: 'https://transfer.example.com',
  language: 'en',
  timezone: 'UTC',
  theme: { primary: '#CC0030', primaryDark: '#DE0F3B' }
}

const de: EmailContext = { ...ctx, language: 'de' }

const files = [
  { filename: 'brief.pdf', size: 1024 * 1024 },
  { filename: 'foto.jpg', size: 3 * 1024 * 1024 }
]

const DOWNLOAD_URL = 'https://transfer.example.com/d/abc123'

describe('renderTransferEmail', () => {
  it('carries the download link in both the button and the fallback', () => {
    const mail = renderTransferEmail(ctx, {
      senderName: 'Florian',
      subject: 'Logos',
      message: null,
      files,
      downloadUrl: DOWNLOAD_URL,
      expiresAt: new Date('2026-09-01T10:00:00Z')
    })

    // Twice: once as the button href, once as the copyable fallback for clients
    // that strip buttons.
    const occurrences = mail.html.split(DOWNLOAD_URL).length - 1
    expect(occurrences).toBeGreaterThanOrEqual(2)
  })

  it('names every file so the recipient knows what is waiting', () => {
    const mail = renderTransferEmail(ctx, {
      senderName: 'Florian',
      subject: null,
      message: null,
      files,
      downloadUrl: DOWNLOAD_URL,
      expiresAt: null
    })

    expect(mail.html).toContain('brief.pdf')
    expect(mail.html).toContain('foto.jpg')
  })

  it('puts the subject in the subject line when there is one', () => {
    const withSubject = renderTransferEmail(ctx, {
      senderName: 'Florian',
      subject: 'Logos',
      message: null,
      files,
      downloadUrl: DOWNLOAD_URL,
      expiresAt: null
    })
    const without = renderTransferEmail(ctx, {
      senderName: 'Florian',
      subject: null,
      message: null,
      files,
      downloadUrl: DOWNLOAD_URL,
      expiresAt: null
    })

    expect(withSubject.subject).toContain('Logos')
    expect(without.subject).not.toContain('Logos')
    expect(without.subject).toContain('Florian')
  })

  it('escapes a message rather than letting it become markup', () => {
    // The message is free text typed by a sender. Unescaped, it would be an
    // injection point into every recipient's mail client.
    const mail = renderTransferEmail(ctx, {
      senderName: '<script>alert(1)</script>',
      subject: null,
      message: '<img src=x onerror=alert(1)>',
      files,
      downloadUrl: DOWNLOAD_URL,
      expiresAt: null
    })

    expect(mail.html).not.toContain('<script>')
    expect(mail.html).not.toContain('<img src=x')
    expect(mail.html).toContain('&lt;script&gt;')
  })

  it('says the files never expire when there is no expiry', () => {
    const unlimited = renderTransferEmail(ctx, {
      senderName: 'Florian',
      subject: null,
      message: null,
      files,
      downloadUrl: DOWNLOAD_URL,
      expiresAt: null
    })

    expect(unlimited.html).toContain(t('en', 'transferExpiryUnlimited'))
  })
})

describe('renderExpiryWarningEmail', () => {
  const base = {
    subject: 'Logos' as string | null,
    recipients: ['client@example.com'],
    files,
    downloadUrl: DOWNLOAD_URL,
    expiresAt: new Date('2026-09-01T10:00:00Z'),
    sentAt: new Date('2026-08-18T10:00:00Z'),
    downloadCount: 0
  }

  it('states the deadline and links the transfer', () => {
    const mail = renderExpiryWarningEmail(ctx, base)

    expect(mail.subject).toContain('Logos')
    expect(mail.html).toContain(DOWNLOAD_URL)
    // The date the sender has to act before.
    expect(mail.html).toContain('1 September 2026')
  })

  it('leads with "not downloaded", which is the case worth acting on', () => {
    const untouched = renderExpiryWarningEmail(ctx, base)
    expect(untouched.html).toContain(t('en', 'expiryWarningNotDownloaded'))

    const fetched = renderExpiryWarningEmail(ctx, { ...base, downloadCount: 3 })
    expect(fetched.html).not.toContain(t('en', 'expiryWarningNotDownloaded'))
    expect(fetched.html).toContain(t('en', 'expiryWarningDownloaded', { count: 3 }))
  })

  it('lists the recipients when there are any', () => {
    const mail = renderExpiryWarningEmail(ctx, base)
    expect(mail.html).toContain('client@example.com')
  })

  it('explains the link-only case instead of showing an empty recipient list', () => {
    const mail = renderExpiryWarningEmail(ctx, { ...base, recipients: [] })
    expect(mail.html).toContain(t('en', 'expiryWarningLinkOnly'))
    expect(mail.html).not.toContain('<strong></strong>')
  })

  it('falls back to a generic subject when the transfer has none', () => {
    const mail = renderExpiryWarningEmail(ctx, { ...base, subject: null })
    expect(mail.subject).toBe(t('en', 'expiryWarningSubject'))
  })

  it('escapes a subject supplied by the sender', () => {
    const mail = renderExpiryWarningEmail(ctx, {
      ...base,
      recipients: ['<script>bad</script>@example.com']
    })
    expect(mail.html).not.toContain('<script>')
  })

  it('renders in German too', () => {
    const mail = renderExpiryWarningEmail(de, base)
    expect(mail.subject).toContain('läuft bald ab')
    expect(mail.html).toContain('1. September 2026')
  })
})

describe('renderReceiptEmail', () => {
  it('tells the sender who it went to', () => {
    const mail = renderReceiptEmail(ctx, {
      recipients: ['a@example.com', 'b@example.com'],
      files,
      transferUrl: DOWNLOAD_URL,
      expiresAt: null
    })

    expect(mail.html).toContain('a@example.com')
    expect(mail.html).toContain('b@example.com')
  })
})

describe('renderMagicLinkEmail', () => {
  it('carries the sign-in link and how long it lasts', () => {
    const url = 'https://transfer.example.com/magic/xyz'
    const mail = renderMagicLinkEmail(ctx, { url, minutes: 30 })

    expect(mail.html).toContain(url)
    expect(mail.html).toContain('30')
  })
})

describe('renderPasswordResetEmail', () => {
  it('carries the reset link', () => {
    const url = 'https://transfer.example.com/reset-password/xyz'
    const mail = renderPasswordResetEmail(ctx, { url })
    expect(mail.html).toContain(url)
  })
})

describe('every template', () => {
  it('produces a complete HTML document with a subject, in both languages', () => {
    for (const context of [ctx, de]) {
      const mails = [
        renderTransferEmail(context, {
          senderName: 'Florian',
          subject: 'Hi',
          message: 'Hello',
          files,
          downloadUrl: DOWNLOAD_URL,
          expiresAt: new Date()
        }),
        renderReceiptEmail(context, {
          recipients: ['a@example.com'],
          files,
          transferUrl: DOWNLOAD_URL,
          expiresAt: new Date()
        }),
        renderExpiryWarningEmail(context, {
          subject: null,
          recipients: [],
          files,
          downloadUrl: DOWNLOAD_URL,
          expiresAt: new Date(),
          sentAt: new Date(),
          downloadCount: 0
        }),
        renderMagicLinkEmail(context, { url: DOWNLOAD_URL, minutes: 30 })
      ]

      for (const mail of mails) {
        expect(mail.subject.length).toBeGreaterThan(0)
        expect(mail.html).toContain('<html')
        expect(mail.html).toContain('</html>')
        // An unresolved placeholder means a template referenced a value the
        // caller never passed — invisible in review, glaring in an inbox.
        expect(mail.html).not.toMatch(/\{[a-zA-Z]+\}/)
        expect(mail.subject).not.toMatch(/\{[a-zA-Z]+\}/)
      }
    }
  })
})
