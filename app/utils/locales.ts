/**
 * The one place that knows which languages exist and how each of them counts.
 *
 * Imported by the interface (date formatting), by the mail renderer on the
 * server (plural forms, date formatting) and by the vue-i18n config (plural
 * rules), so all three agree — a language added here is added everywhere, and a
 * plural rule is written once.
 */

/** The same ten as LokalBoards, in the same order. */
export const LOCALES = ['en', 'de', 'fr', 'es', 'it', 'nl', 'pl', 'uk', 'pt', 'cs'] as const
export type Locale = (typeof LOCALES)[number]

/** The BCP 47 tag `Intl` wants for each language — the regional variant whose
    conventions the strings were written in. */
export const LOCALE_TAGS: Record<Locale, string> = {
  en: 'en-GB',
  de: 'de-DE',
  fr: 'fr-FR',
  es: 'es-ES',
  it: 'it-IT',
  nl: 'nl-NL',
  pl: 'pl-PL',
  uk: 'uk-UA',
  pt: 'pt-PT',
  cs: 'cs-CZ'
}

export function isLocale(value: unknown): value is Locale {
  return (LOCALES as readonly string[]).includes(String(value))
}

/**
 * Which of a message's plural forms a count selects.
 *
 * Forms are written one/other, or one/few/many for the three Slavic languages:
 * "few" is 2–4 (in Polish and Ukrainian only when those are not 12–14), and
 * everything else, including 5–21, is "many". Ukrainian differs in one more
 * way: 21, 31, … are singular there and plural in Polish.
 *
 * Handed a two-form message in a three-form language — or the other way round —
 * it still returns a valid index, so a string that was written with the wrong
 * number of forms degrades to a wrong word rather than an empty one.
 */
export function pluralIndex(locale: Locale, count: number, forms: number): number {
  const n = Math.abs(Math.trunc(Number(count) || 0))
  const last = n % 10
  const lastTwo = n % 100

  const one = locale === 'uk' ? last === 1 && lastTwo !== 11 : n === 1
  if (forms < 3) return one ? 0 : 1
  if (one) return 0

  const few = locale === 'cs'
    ? n >= 2 && n <= 4
    : last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)
  if ((locale === 'pl' || locale === 'uk' || locale === 'cs') && few) return 1

  // A three-form message in a language that has only one/other: everything
  // past "one" is the last form.
  return forms - 1
}
