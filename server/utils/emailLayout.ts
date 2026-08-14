// The shared shell for every e-mail this app sends.
//
// Mail clients are not browsers. The rules this file is built around:
//
//   * External and <style>-block CSS is unreliable (Gmail strips <style> in some
//     configurations, Outlook ignores much of it), so every visual property that
//     matters is inlined on the element. The <style> block carries only
//     progressive enhancement — the responsive tweak and dark mode — and the mail
//     is fully legible without it.
//   * Outlook (Word rendering engine) ignores padding on <a> and margin on many
//     elements, so structure comes from nested tables with cell padding, and the
//     call-to-action button is a single-cell table rather than a styled link.
//   * `max-width` is unsupported in Outlook, hence the MSO conditional wrapper
//     that pins the width to 600px there while everyone else stays fluid.
//   * Dark mode: colours are declared explicitly rather than left to inherit,
//     because a client that inverts an undeclared background can otherwise land
//     dark grey text on a dark grey card.
//
// Colours follow the same rule as the app itself: neutrals plus exactly one
// accent, which is passed in from runtimeConfig so mail matches the instance.

// Inter leads the stack so a recipient who already has it installed sees the
// same typeface as the app. Web fonts are deliberately NOT loaded here: most
// mail clients strip @font-face or block the request outright, and a blocked
// font request is also a tracking signal. Everyone else falls back to their
// system UI font, which is what mail should look like anyway.
export const EMAIL_FONT
  = 'Inter, -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif'

export const EMAIL_WIDTH = 600

/** Anything interpolated into e-mail HTML is user input somewhere upstream. */
export const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

export interface EmailTheme {
  primary: string
  primaryDark: string
}

export interface EmailLayoutOptions {
  appName: string
  /** The one-line summary shown in the inbox list next to the subject. */
  preheader?: string
  theme: EmailTheme
  /** Optional small print under the card (privacy link, "you got this because…"). */
  footerNote?: string
  appUrl?: string
}

/** The primary call to action. Padded <a> collapses in Outlook, so it rides in a table. */
export const emailButton = (url: string, label: string, theme: EmailTheme): string => {
  const href = escapeHtml(url)
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;margin:0 auto;">
  <tr>
    <td align="center" bgcolor="${theme.primary}" style="border-radius:8px;background-color:${theme.primary};">
      <a href="${href}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:${EMAIL_FONT};font-size:16px;font-weight:600;line-height:20px;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a>
    </td>
  </tr>
</table>`
}

/**
 * The same destination repeated as selectable text under the button — for
 * clients that strip the button, and for anyone who would rather copy the link
 * than trust it.
 */
export const emailFallbackLink = (url: string): string => `
<p style="margin:16px 0 0 0;font-family:${EMAIL_FONT};font-size:12px;line-height:18px;color:#71717a;word-break:break-all;">
  ${escapeHtml(url)}
</p>`

export const emailHeading = (text: string): string => `
<h1 style="margin:0 0 12px 0;font-family:${EMAIL_FONT};font-size:22px;line-height:28px;font-weight:700;color:#18181b;" class="lt-heading">${escapeHtml(text)}</h1>`

/**
 * A paragraph in the shared style. `html` is inserted as-is, so callers pass
 * already-escaped content; single newlines become line breaks.
 */
export const emailParagraph = (html: string): string => `
<p style="margin:0 0 16px 0;font-family:${EMAIL_FONT};font-size:15px;line-height:23px;color:#3f3f46;" class="lt-text">${html.replace(/\n/g, '<br>')}</p>`

/** A quiet, boxed block — used for the sender's personal message. */
export const emailQuote = (html: string): string => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;">
  <tr>
    <td style="padding:16px 18px;background-color:#f4f4f5;border-radius:8px;font-family:${EMAIL_FONT};font-size:15px;line-height:23px;color:#3f3f46;" class="lt-quote">${html.replace(/\n/g, '<br>')}</td>
  </tr>
</table>`

/** A horizontal rule that survives Outlook (which ignores border on <hr>). */
export const emailDivider = (): string => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td style="padding:8px 0;"><div style="height:1px;line-height:1px;font-size:0;background-color:#e4e4e7;" class="lt-divider">&nbsp;</div></td></tr>
</table>`

export interface EmailFile {
  filename: string
  size: number
}

/** Human-readable byte size. Kept here so mail doesn't depend on client code. */
export const formatBytes = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = Number(bytes) || 0
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  // Whole bytes read oddly with a decimal; everything else gets one.
  return `${unit === 0 ? value : value.toFixed(1)} ${units[unit]}`
}

/** The list of files in a transfer, as a two-column table. */
export const emailFileList = (files: EmailFile[]): string => {
  const rows = files
    .map(
      file => `
  <tr>
    <td style="padding:10px 0;font-family:${EMAIL_FONT};font-size:14px;line-height:20px;color:#3f3f46;border-bottom:1px solid #e4e4e7;word-break:break-word;" class="lt-file">${escapeHtml(file.filename)}</td>
    <td align="right" style="padding:10px 0 10px 16px;font-family:${EMAIL_FONT};font-size:13px;line-height:20px;color:#71717a;border-bottom:1px solid #e4e4e7;white-space:nowrap;" class="lt-file-size">${escapeHtml(formatBytes(file.size))}</td>
  </tr>`
    )
    .join('')

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;border-collapse:collapse;">
  ${rows}
</table>`
}

/**
 * Wrap a body in the full document shell.
 *
 * Everything client-specific lives here: the preheader trick, the MSO width
 * wrapper, and the dark-mode overrides.
 */
export const emailLayout = (bodyHtml: string, options: EmailLayoutOptions): string => {
  const { appName, preheader, theme, footerNote, appUrl } = options

  // Zero-height, zero-opacity text that inbox lists show as the preview line.
  // The trailing entities stop the client from padding the preview with the
  // start of the actual body.
  const preheaderBlock = preheader
    ? `<div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(preheader)}${'&#847;&zwnj;&nbsp;'.repeat(60)}</div>`
    : ''

  const footerLink = appUrl
    ? `<a href="${escapeHtml(appUrl)}" style="color:#71717a;text-decoration:underline;">${escapeHtml(appName)}</a>`
    : escapeHtml(appName)

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<!-- Tell clients the mail is designed for both schemes, so they use our dark
     styles instead of algorithmically inverting the light ones. -->
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<title>${escapeHtml(appName)}</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<style type="text/css">
  /* Progressive enhancement only — the mail is complete without any of this. */
  body { margin:0 !important; padding:0 !important; width:100% !important; }
  table { border-spacing:0; }
  img { border:0; line-height:100%; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
  /* Stop iOS from auto-linking dates and addresses in its own blue. */
  a[x-apple-data-detectors] { color:inherit !important; text-decoration:none !important; }

  @media only screen and (max-width:${EMAIL_WIDTH}px) {
    .lt-container { width:100% !important; }
    .lt-pad { padding-left:24px !important; padding-right:24px !important; }
    .lt-heading { font-size:20px !important; line-height:26px !important; }
  }

  @media (prefers-color-scheme: dark) {
    .lt-body { background-color:#18181b !important; }
    .lt-card { background-color:#27272a !important; }
    .lt-heading { color:#fafafa !important; }
    .lt-text, .lt-file { color:#d4d4d8 !important; }
    .lt-muted, .lt-file-size { color:#a1a1aa !important; }
    .lt-quote { background-color:#3f3f46 !important; color:#e4e4e7 !important; }
    .lt-divider { background-color:#3f3f46 !important; }
    .lt-file, .lt-file-size { border-bottom-color:#3f3f46 !important; }
    .lt-accent { color:${theme.primaryDark} !important; }
  }
</style>
</head>
<body class="lt-body" style="margin:0;padding:0;background-color:#f4f4f5;">
${preheaderBlock}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="lt-body" style="background-color:#f4f4f5;">
  <tr>
    <td align="center" style="padding:32px 12px;">
      <!--[if mso]>
      <table role="presentation" width="${EMAIL_WIDTH}" cellpadding="0" cellspacing="0" border="0"><tr><td>
      <![endif]-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="lt-container" style="max-width:${EMAIL_WIDTH}px;margin:0 auto;">

        <!-- No wordmark above the card. The message itself is what the reader
             came for, and naming the software at the top of every mail tells
             whoever receives one what is running on this server — the same
             reasoning that removed the header from the sign-in page. The app
             name still appears in the footer, where it explains where the mail
             came from rather than announcing a product. -->

        <tr>
          <td class="lt-card lt-pad" style="background-color:#ffffff;border-radius:12px;padding:32px;">
            ${bodyHtml}
          </td>
        </tr>

        <tr>
          <td style="padding:20px 8px 0 8px;font-family:${EMAIL_FONT};font-size:12px;line-height:18px;color:#71717a;" class="lt-muted">
            ${footerNote ? `${footerNote}<br><br>` : ''}${footerLink}
          </td>
        </tr>

      </table>
      <!--[if mso]>
      </td></tr></table>
      <![endif]-->
    </td>
  </tr>
</table>
</body>
</html>`
}
