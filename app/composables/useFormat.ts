/** Formatting helpers shared by the transfer lists, the composer and the download page. */
export function useFormat() {
  const { locale } = useI18n()
  const config = useRuntimeConfig().public

  /**
   * Human-readable byte size.
   *
   * Uses binary units (1 KB = 1024 B) to match what the operating system's file
   * browser reports, so a file the user sees as "4.2 MB" doesn't show up here as
   * "4.4 MB".
   */
  function formatBytes(bytes: number | string): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let value = Number(bytes) || 0
    let unit = 0

    while (value >= 1024 && unit < units.length - 1) {
      value /= 1024
      unit++
    }

    return `${unit === 0 ? value : value.toFixed(1)} ${units[unit]}`
  }

  /**
   * Format a stored instant as a date and time.
   *
   * Rendered in the configured timezone rather than the browser's: an expiry is a
   * statement about the service ("your files go on Friday evening"), and it
   * should read the same to the sender and to a recipient in another country.
   */
  function formatDateTime(value: string | Date | null | undefined): string {
    if (!value) return ''
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return ''

    return new Intl.DateTimeFormat(locale.value === 'de' ? 'de-DE' : 'en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: String(config.timezone || 'UTC')
    }).format(date)
  }

  /** Date only — for list rows, where the time of day is noise. */
  function formatDate(value: string | Date | null | undefined): string {
    if (!value) return ''
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return ''

    return new Intl.DateTimeFormat(locale.value === 'de' ? 'de-DE' : 'en-GB', {
      dateStyle: 'medium',
      timeZone: String(config.timezone || 'UTC')
    }).format(date)
  }

  /** Whether an expiry has already passed. Null means unlimited retention. */
  function isExpired(value: string | Date | null | undefined): boolean {
    if (!value) return false
    const date = value instanceof Date ? value : new Date(value)
    return !Number.isNaN(date.getTime()) && date.getTime() <= Date.now()
  }

  return { formatBytes, formatDateTime, formatDate, isExpired }
}
