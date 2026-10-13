/**
 * Copy text to the clipboard — and say what happened, either way.
 *
 * Each copy button used to await `navigator.clipboard.writeText()` and then show
 * its "copied" toast. Two things went wrong with that, both silently:
 *
 * - A browser that refuses the write (a permissions prompt declined, a page that
 *   is not focused) rejects the promise, so nothing was shown at all. The button
 *   simply appeared not to work.
 * - `navigator.clipboard` only exists on a secure origin. An instance reached
 *   over plain http — a first look at it on an internal address, before TLS is
 *   set up — has no such object, and the click threw.
 *
 * So the write goes through the modern API where there is one, falls back to the
 * older selection-based copy where there is not, and a failure of both is told
 * to the person, with the one thing that always works: copy it by hand.
 */
export function useCopy() {
  const notify = useNotify()
  const { t } = useI18n()

  /** The pre-clipboard-API way: select the text in a field and ask for a copy. */
  function copyBySelection(text: string): boolean {
    const field = document.createElement('textarea')
    field.value = text
    // Present, so it can be selected, but nowhere anyone would see it and not
    // somewhere that scrolls the page when it takes focus.
    field.setAttribute('readonly', '')
    field.style.position = 'fixed'
    field.style.top = '0'
    field.style.left = '0'
    field.style.opacity = '0'
    document.body.appendChild(field)

    const previous = document.activeElement as HTMLElement | null
    field.select()
    let copied: boolean
    try {
      copied = document.execCommand('copy')
    } catch {
      copied = false
    }
    field.remove()
    previous?.focus?.()
    return copied
  }

  async function write(text: string): Promise<boolean> {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        return true
      }
    } catch {
      // Refused — the older way may still be allowed.
    }
    return copyBySelection(text)
  }

  /**
   * Copy `text` and confirm it with `copiedMessage`; if it cannot be copied, say
   * so instead. Resolves to whether it worked.
   */
  return async function copy(text: string, copiedMessage: string): Promise<boolean> {
    const copied = await write(text)
    if (copied) notify.success(copiedMessage)
    else notify.error(t('common.copyFailed'), t('common.copyFailedHint'))
    return copied
  }
}
