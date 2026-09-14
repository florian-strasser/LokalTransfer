// Plural rules for the languages whose grammar has more than "one" and "other".
//
// A count string in a locale file carries its forms separated by ` | `, and
// vue-i18n picks one by the count. Its built-in rule knows two shapes: two
// forms are one/other, three are zero/one/other. Polish, Ukrainian and Czech
// are neither — they have one/few/many — and without these rules "5 plików"
// would render as "5 pliki". The rules themselves live in app/utils/locales.ts,
// shared with the mail renderer on the server, so the interface and the mail
// cannot disagree about a plural.
//
// The other seven languages are left to the built-in rule, which is correct
// for them. @nuxtjs/i18n loads this file by convention from the i18n directory.
import { pluralIndex } from '../app/utils/locales'

export default defineI18nConfig(() => ({
  pluralRules: {
    pl: (choice: number, choicesLength: number) => pluralIndex('pl', choice, choicesLength),
    uk: (choice: number, choicesLength: number) => pluralIndex('uk', choice, choicesLength),
    cs: (choice: number, choicesLength: number) => pluralIndex('cs', choice, choicesLength)
  }
}))
