import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { LOCALES, LOCALE_TAGS, isLocale, pluralIndex } from '../../app/utils/locales'
import { resolveLanguage, t, type EmailStringKey } from '../../server/utils/emailStrings'

// Ten languages, each a file of two hundred and some strings. What goes wrong
// is never dramatic: a key missed in one locale falls back to English mid-page,
// a placeholder renamed in translation prints its own braces, a Polish count
// written with two forms says "5 pliki". None of that is visible in the language
// the developer reads. So every locale is held to the English one here, key by
// key.

const dir = fileURLToPath(new URL('../../i18n/locales/', import.meta.url))

type Flat = Record<string, string>
function flatten(value: unknown, prefix = ''): Flat {
  if (typeof value !== 'object' || value === null) return { [prefix.slice(0, -1)]: String(value) }
  return Object.entries(value).reduce<Flat>((acc, [k, v]) => Object.assign(acc, flatten(v, `${prefix}${k}.`)), {})
}

const files = Object.fromEntries(
  readdirSync(dir).filter(f => f.endsWith('.json'))
    .map(f => [f.replace('.json', ''), flatten(JSON.parse(readFileSync(dir + f, 'utf8')))])
) as Record<string, Flat>

const en = files.en!
const placeholders = (s: string) => [...new Set(s.match(/\{[^}]+\}/g) ?? [])].sort()

// one/few/many for the three Slavic languages, one/other for the rest.
const formsFor = (locale: string) => (['pl', 'uk', 'cs'].includes(locale) ? 3 : 2)

describe('interface locales', () => {
  it('ships exactly the ten languages LokalBoards does', () => {
    expect(Object.keys(files).sort()).toEqual([...LOCALES].sort())
  })

  it.each(LOCALES.filter(l => l !== 'en'))('%s carries every English key and nothing else', (locale) => {
    const keys = Object.keys(files[locale]!)
    expect(keys.filter(k => !(k in en)), 'keys not in en').toEqual([])
    expect(Object.keys(en).filter(k => !keys.includes(k)), 'keys missing').toEqual([])
  })

  it.each(LOCALES)('%s has no empty string', (locale) => {
    expect(Object.entries(files[locale]!).filter(([, v]) => !v.trim()).map(([k]) => k)).toEqual([])
  })

  it.each(LOCALES.filter(l => l !== 'en'))('%s keeps every placeholder the English has', (locale) => {
    const wrong = Object.keys(en).filter(k => JSON.stringify(placeholders(en[k]!)) !== JSON.stringify(placeholders(files[locale]![k]!)))
    expect(wrong).toEqual([])
  })

  it.each(LOCALES.filter(l => l !== 'en'))('%s writes count strings with the right number of forms', (locale) => {
    const forms = formsFor(locale)
    const wrong = Object.keys(en).filter((k) => {
      const plural = en[k]!.includes(' | ')
      const have = files[locale]![k]!.split(' | ').length
      return plural ? have !== forms : have !== 1
    })
    expect(wrong).toEqual([])
  })
})

describe('plural rules', () => {
  // The CLDR cases that separate the three Slavic rules from each other and
  // from one/other. 22 is "few" in Polish and Ukrainian but "many" in Czech;
  // 21 is "one" in Ukrainian alone; 12 is "many" everywhere.
  it.each([
    ['pl', [1, 2, 4, 5, 11, 12, 14, 21, 22, 25, 101], [0, 1, 1, 2, 2, 2, 2, 2, 1, 2, 2]],
    ['uk', [1, 2, 4, 5, 11, 12, 14, 21, 22, 25, 101], [0, 1, 1, 2, 2, 2, 2, 0, 1, 2, 0]],
    ['cs', [1, 2, 4, 5, 11, 12, 14, 21, 22, 25, 101], [0, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2]]
  ] as const)('%s picks one/few/many correctly', (locale, counts, expected) => {
    expect(counts.map(n => pluralIndex(locale, n, 3))).toEqual([...expected])
  })

  it('treats one/other languages as exactly that', () => {
    for (const locale of ['en', 'de', 'fr', 'es', 'it', 'nl', 'pt'] as const) {
      expect([0, 1, 2, 5, 21].map(n => pluralIndex(locale, n, 2))).toEqual([1, 0, 1, 1, 1])
    }
  })

  it('never returns an index outside the forms it was given', () => {
    for (const locale of LOCALES) {
      for (const n of [0, 1, 2, 5, 12, 22]) {
        expect(pluralIndex(locale, n, 2)).toBeLessThanOrEqual(1)
        expect(pluralIndex(locale, n, 3)).toBeLessThanOrEqual(2)
      }
    }
  })
})

describe('mail strings', () => {
  it('resolves every language, and falls back to English for anything else', () => {
    for (const locale of LOCALES) expect(resolveLanguage(locale)).toBe(locale)
    expect(resolveLanguage('de-AT')).toBe('de')
    expect(resolveLanguage('PL')).toBe('pl')
    for (const junk of ['xx', '', undefined, null, 42]) expect(resolveLanguage(junk)).toBe('en')
  })

  it('has a date locale for every language', () => {
    for (const locale of LOCALES) {
      expect(LOCALE_TAGS[locale]).toMatch(/^[a-z]{2}-[A-Z]{2}$/)
      expect(isLocale(locale)).toBe(true)
    }
  })

  // The keys the mail renders with a count, so the plural machinery is
  // exercised on the strings that actually use it.
  const counted: EmailStringKey[] = ['transferPreheader', 'transferIntro', 'receiptIntro', 'expiryWarningIntro', 'expiryWarningDownloaded', 'guestPreheader', 'guestIntro', 'totalSize']

  it.each(LOCALES)('%s renders every counted string for 1, 2 and 5 with no placeholder left', (locale) => {
    for (const key of counted) {
      for (const count of [1, 2, 5]) {
        const out = t(locale, key, { count, sender: 'A', appName: 'B', expiry: 'C', recipients: 'D', sent: 'E', company: '', size: '1 MB' })
        // The singular form of some strings names no number at all ("Your file
        // has been sent"), so the only thing every form must satisfy is that no
        // placeholder is left standing.
        expect(out, `${locale} ${key} ${count}`).not.toMatch(/\{\w+\}/)
      }
    }
  })

  it('picks the Polish "many" form for 5 and the "few" form for 2', () => {
    expect(t('pl', 'totalSize', { count: 5, size: '1 MB' })).toContain('plików')
    expect(t('pl', 'totalSize', { count: 2, size: '1 MB' })).toContain('pliki')
    expect(t('pl', 'totalSize', { count: 1, size: '1 MB' })).toContain('plik ·')
  })
})
