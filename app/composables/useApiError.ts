/**
 * Turn a failed `$fetch` into a message worth showing someone.
 *
 * The API answers with a stable code (`INVALID_EMAIL_OR_PASSWORD`,
 * `EMAIL_ALREADY_EXISTS`, …) rather than prose, so that the wording lives in the
 * locale files and the server never has to know which language the caller reads.
 * Each page looks its codes up under its own namespace.
 *
 * Anything unrecognised — a network failure, a proxy error page, a code with no
 * translation yet — falls back to the generic message rather than leaking an
 * internal identifier into the interface.
 */
export function useApiError() {
  const { t } = useI18n()

  function errorCode(error: unknown): string | undefined {
    // `$fetch` puts the parsed response body on `.data`.
    const data = (error as { data?: { error?: string } } | undefined)?.data
    return typeof data?.error === 'string' ? data.error : undefined
  }

  function apiErrorMessage(error: unknown, namespace: string): string {
    const code = errorCode(error)
    if (!code) return t('common.unknownError')

    const key = `${namespace}.${code}`
    const translated = t(key)
    // vue-i18n echoes the key back when there is no message for it.
    return translated === key ? t('common.unknownError') : translated
  }

  return { errorCode, apiErrorMessage }
}
