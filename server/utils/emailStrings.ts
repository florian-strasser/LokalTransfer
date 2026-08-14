// Translations for outgoing e-mail.
//
// Kept separate from the client-side i18n messages on purpose: mail is rendered
// on the server, often from a scheduled task with no request context, so it
// can't reach into the Vue i18n instance. The active language comes from
// NUXT_LANGUAGE, since a transfer's recipient is frequently someone who has
// never visited the app and has no locale preference of their own.

export type EmailLanguage = 'en' | 'de'

/** Placeholders are `{name}`; unknown keys are left untouched. */
export function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in values ? String(values[key]) : match)
}

const en = {
  // --- A transfer has arrived -------------------------------------------------
  transferSubject: '{sender} sent you files',
  transferSubjectNamed: '{sender} sent you files: {subject}',
  transferPreheader: '{count} file, available until {expiry} | {count} files, available until {expiry}',
  transferPreheaderUnlimited: '{count} file, no expiry date | {count} files, no expiry date',
  transferHeading: 'You have received files',
  transferIntro: '<strong>{sender}</strong> has sent you {count} file via {appName}. | <strong>{sender}</strong> has sent you {count} files via {appName}.',
  transferButton: 'Download files',
  transferExpiry: 'These files are available until <strong>{expiry}</strong>. After that they are permanently deleted from the server.',
  transferExpiryUnlimited: 'These files have no expiry date.',
  transferFooter: 'You received this e-mail because {sender} sent you files through {appName}.',

  // --- Copy to the sender -----------------------------------------------------
  receiptSubject: 'Your transfer has been sent',
  receiptPreheader: 'Sent to {recipients}',
  receiptHeading: 'Your transfer is on its way',
  receiptIntro: 'Your file has been sent to <strong>{recipients}</strong>. | Your {count} files have been sent to <strong>{recipients}</strong>.',
  receiptButton: 'View transfer',
  receiptFooter: 'You are receiving this because you created the transfer.',

  // --- The transfer is about to lapse ----------------------------------------
  expiryWarningSubject: 'Your transfer expires soon',
  expiryWarningSubjectNamed: 'Your transfer expires soon: {subject}',
  expiryWarningPreheader: 'Expires {expiry} — after that the files are gone',
  expiryWarningHeading: 'This transfer is about to expire',
  expiryWarningIntro: 'The file you sent on {sent} will stop being available shortly. | The {count} files you sent on {sent} will stop being available shortly.',
  expiryWarningRecipients: 'Sent to <strong>{recipients}</strong>.',
  expiryWarningLinkOnly: 'This is a link-only transfer, so nobody was notified by e-mail — only whoever you gave the link to can reach it.',
  expiryWarningNotDownloaded: 'It has not been downloaded yet.',
  expiryWarningDownloaded: 'It has been downloaded {count} time. | It has been downloaded {count} times.',
  expiryWarningDeadline: 'On <strong>{expiry}</strong> the link stops working and the files are permanently deleted from the server. This cannot be undone.',
  expiryWarningAction: 'If they are still needed, download them now or send them again.',
  expiryWarningButton: 'Open transfer',
  expiryWarningFooter: 'You are receiving this because you created the transfer. It is sent once, shortly before the files are deleted.',

  // --- A guest dropped files off ---------------------------------------------
  guestSubject: '{sender} sent you files',
  guestPreheader: '{count} file received from {sender} | {count} files received from {sender}',
  guestHeading: 'Files received',
  guestIntro: '<strong>{sender}</strong>{company} has uploaded {count} file for you. | <strong>{sender}</strong>{company} has uploaded {count} files for you.',
  guestFooter: 'You received this because you were chosen as the recipient of a guest upload.',

  // --- Magic link -------------------------------------------------------------
  magicSubject: 'Your sign-in link for {appName}',
  magicPreheader: 'The link is valid for {minutes} minutes',
  magicHeading: 'Your sign-in link',
  magicIntro: 'Use the button below to sign in to {appName} and upload files. The link is valid for {minutes} minutes and can only be used once.',
  magicButton: 'Sign in and upload',
  magicIgnore: 'If you did not request this link, you can simply ignore this e-mail.',

  // --- Account created by an admin -------------------------------------------
  welcomeSubject: 'Your access to {appName}',
  welcomePreheader: 'Your account has been created',
  welcomeHeading: 'Welcome to {appName}',
  welcomeIntro: 'Hello {name}, an account has been created for you by {adminName}.',
  welcomeCredentials: 'E-mail: <strong>{email}</strong>\nPassword: <strong>{password}</strong>',
  welcomeChange: 'Please change this password after your first sign-in.',
  welcomeButton: 'Sign in',

  // --- Guest account created --------------------------------------------------
  guestWelcomeSubject: 'You can now send files to {appName}',
  guestWelcomePreheader: 'Request a link any time to upload files',
  guestWelcomeHeading: 'Send us your files',
  guestWelcomeIntro: 'Hello {name}, you can now send files to us securely. You do not need a password: enter your e-mail address on the page below and you will receive a one-time sign-in link.',
  guestWelcomeButton: 'Send files',

  // --- Password reset ---------------------------------------------------------
  resetSubject: 'Reset your password',
  resetPreheader: 'The link is valid for 24 hours',
  resetHeading: 'Reset your password',
  resetIntro: 'A password reset was requested for your {appName} account. The link is valid for 24 hours.',
  resetButton: 'Choose a new password',
  resetIgnore: 'If you did not request this, you can ignore this e-mail — your password stays unchanged.',

  // --- Shared -----------------------------------------------------------------
  messageFrom: 'Message from {sender}:',
  totalSize: '{count} file · {size} | {count} files · {size}'
}

// Typed against the English table so a missing or misspelled key is a build
// error rather than a string that silently falls back at runtime.
const de: typeof en = {
  transferSubject: '{sender} hat Ihnen Dateien gesendet',
  transferSubjectNamed: '{sender} hat Ihnen Dateien gesendet: {subject}',
  transferPreheader: '{count} Datei, verfügbar bis {expiry} | {count} Dateien, verfügbar bis {expiry}',
  transferPreheaderUnlimited: '{count} Datei, ohne Ablaufdatum | {count} Dateien, ohne Ablaufdatum',
  transferHeading: 'Sie haben Dateien erhalten',
  transferIntro: '<strong>{sender}</strong> hat Ihnen {count} Datei über {appName} gesendet. | <strong>{sender}</strong> hat Ihnen {count} Dateien über {appName} gesendet.',
  transferButton: 'Dateien herunterladen',
  transferExpiry: 'Die Dateien stehen bis zum <strong>{expiry}</strong> zur Verfügung. Danach werden sie unwiderruflich vom Server gelöscht.',
  transferExpiryUnlimited: 'Diese Dateien haben kein Ablaufdatum.',
  transferFooter: 'Sie erhalten diese E-Mail, weil {sender} Ihnen Dateien über {appName} gesendet hat.',

  receiptSubject: 'Ihre Übertragung wurde versendet',
  receiptPreheader: 'Gesendet an {recipients}',
  receiptHeading: 'Ihre Übertragung ist unterwegs',
  receiptIntro: 'Ihre Datei wurde an <strong>{recipients}</strong> gesendet. | Ihre {count} Dateien wurden an <strong>{recipients}</strong> gesendet.',
  receiptButton: 'Übertragung ansehen',
  receiptFooter: 'Sie erhalten diese E-Mail, weil Sie die Übertragung erstellt haben.',

  expiryWarningSubject: 'Ihre Übertragung läuft bald ab',
  expiryWarningSubjectNamed: 'Ihre Übertragung läuft bald ab: {subject}',
  expiryWarningPreheader: 'Läuft am {expiry} ab — danach sind die Dateien gelöscht',
  expiryWarningHeading: 'Diese Übertragung läuft bald ab',
  expiryWarningIntro: 'Die Datei, die Sie am {sent} gesendet haben, ist bald nicht mehr verfügbar. | Die {count} Dateien, die Sie am {sent} gesendet haben, sind bald nicht mehr verfügbar.',
  expiryWarningRecipients: 'Gesendet an <strong>{recipients}</strong>.',
  expiryWarningLinkOnly: 'Dies ist eine Übertragung ohne Empfänger — es wurde niemand per E-Mail benachrichtigt. Nur wer den Link von Ihnen erhalten hat, kann darauf zugreifen.',
  expiryWarningNotDownloaded: 'Sie wurde bisher nicht heruntergeladen.',
  expiryWarningDownloaded: 'Sie wurde bisher {count}-mal heruntergeladen. | Sie wurde bisher {count}-mal heruntergeladen.',
  expiryWarningDeadline: 'Am <strong>{expiry}</strong> wird der Link ungültig und die Dateien werden endgültig vom Server gelöscht. Das lässt sich nicht rückgängig machen.',
  expiryWarningAction: 'Falls Sie die Dateien noch brauchen, laden Sie sie jetzt herunter oder senden Sie sie erneut.',
  expiryWarningButton: 'Übertragung öffnen',
  expiryWarningFooter: 'Sie erhalten diese E-Mail, weil Sie die Übertragung erstellt haben. Sie wird einmalig kurz vor dem Löschen der Dateien versendet.',

  guestSubject: '{sender} hat Ihnen Dateien gesendet',
  guestPreheader: '{count} Datei von {sender} erhalten | {count} Dateien von {sender} erhalten',
  guestHeading: 'Dateien erhalten',
  guestIntro: '<strong>{sender}</strong>{company} hat {count} Datei für Sie hochgeladen. | <strong>{sender}</strong>{company} hat {count} Dateien für Sie hochgeladen.',
  guestFooter: 'Sie erhalten diese E-Mail, weil Sie als Empfänger eines Gast-Uploads ausgewählt wurden.',

  magicSubject: 'Ihr Anmeldelink für {appName}',
  magicPreheader: 'Der Link ist {minutes} Minuten gültig',
  magicHeading: 'Ihr Anmeldelink',
  magicIntro: 'Melden Sie sich über die Schaltfläche unten bei {appName} an, um Dateien hochzuladen. Der Link ist {minutes} Minuten gültig und kann nur einmal verwendet werden.',
  magicButton: 'Anmelden und hochladen',
  magicIgnore: 'Wenn Sie diesen Link nicht angefordert haben, können Sie diese E-Mail ignorieren.',

  welcomeSubject: 'Ihr Zugang zu {appName}',
  welcomePreheader: 'Ihr Konto wurde angelegt',
  welcomeHeading: 'Willkommen bei {appName}',
  welcomeIntro: 'Hallo {name}, {adminName} hat ein Konto für Sie angelegt.',
  welcomeCredentials: 'E-Mail: <strong>{email}</strong>\nPasswort: <strong>{password}</strong>',
  welcomeChange: 'Bitte ändern Sie dieses Passwort nach der ersten Anmeldung.',
  welcomeButton: 'Anmelden',

  guestWelcomeSubject: 'Sie können ab sofort Dateien an {appName} senden',
  guestWelcomePreheader: 'Fordern Sie jederzeit einen Link zum Hochladen an',
  guestWelcomeHeading: 'Senden Sie uns Ihre Dateien',
  guestWelcomeIntro: 'Hallo {name}, Sie können uns ab sofort sicher Dateien senden. Sie benötigen kein Passwort: Geben Sie auf der folgenden Seite Ihre E-Mail-Adresse ein und Sie erhalten einen einmaligen Anmeldelink.',
  guestWelcomeButton: 'Dateien senden',

  resetSubject: 'Passwort zurücksetzen',
  resetPreheader: 'Der Link ist 24 Stunden gültig',
  resetHeading: 'Passwort zurücksetzen',
  resetIntro: 'Für Ihr Konto bei {appName} wurde ein neues Passwort angefordert. Der Link ist 24 Stunden gültig.',
  resetButton: 'Neues Passwort wählen',
  resetIgnore: 'Falls Sie das nicht angefordert haben, können Sie diese E-Mail ignorieren — Ihr Passwort bleibt unverändert.',

  messageFrom: 'Nachricht von {sender}:',
  totalSize: '{count} Datei · {size} | {count} Dateien · {size}'
}

const dictionaries: Record<EmailLanguage, typeof en> = { en, de }

export type EmailStringKey = keyof typeof en

/** Resolve the configured language, falling back to English for anything else. */
export function resolveLanguage(language: unknown): EmailLanguage {
  const code = String(language ?? '').toLowerCase().slice(0, 2)
  return code in dictionaries ? (code as EmailLanguage) : 'en'
}

/**
 * Look up one string and fill in its placeholders.
 *
 * A message may carry a singular and a plural form separated by ` | `, chosen by
 * the `count` value — the same convention the client-side locale files use. Both
 * languages here happen to need only two forms; a language with more would need
 * this replaced with a real plural-rule lookup.
 */
export function t(
  language: EmailLanguage,
  key: EmailStringKey,
  values: Record<string, string | number> = {}
): string {
  const message = dictionaries[language][key]
  const forms = message.split(' | ')

  const chosen = forms.length > 1 && Number(values.count) === 1
    ? forms[0]!
    : forms[forms.length - 1]!

  return interpolate(chosen, values)
}

/**
 * Format an instant for display in mail.
 *
 * Timestamps are stored and compared in UTC, but an expiry date shown to a
 * person has to read in the timezone they actually live in — so the display zone
 * is configurable (NUXT_TIMEZONE) and independent of whatever the server's clock
 * is set to.
 */
export function formatEmailDate(
  date: Date,
  language: EmailLanguage,
  timeZone = 'UTC'
): string {
  return new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-GB', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone
  }).format(date)
}
