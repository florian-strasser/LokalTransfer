/**
 * Toasts that say whether something worked.
 *
 * Every call site used to pass `color: 'primary'` by hand, including the failure
 * branches — so "User deleted" and "Something went wrong" arrived looking
 * identical, in the accent colour, and the only thing distinguishing them was
 * reading the sentence.
 *
 * A second hue is not available to fix that: the whole interface is neutral plus
 * exactly one accent. So the two are told apart by weight and by icon instead.
 *
 * - **Success** is quiet: a neutral toast with a check. It confirms something the
 *   user already expected to happen, and shouldn't compete for attention.
 * - **Failure** takes the accent and an alert icon. In a single-accent palette
 *   the accent is the "look at this" signal, and an error is the one thing in
 *   the app that has earned it.
 *
 * Deciding that here rather than at each call site is what keeps it true — a new
 * toast added later can't quietly get it wrong, and changing the treatment is
 * one edit rather than eighteen.
 */
export function useNotify() {
  const toast = useToast()

  return {
    /** Something the user asked for happened. */
    success(title: string, description?: string) {
      toast.add({
        title,
        description,
        icon: 'i-lucide-check',
        color: 'neutral'
      })
    },

    /** Something failed. Held longer, because it may need acting on. */
    error(title: string, description?: string) {
      toast.add({
        title,
        description,
        icon: 'i-lucide-alert-triangle',
        color: 'primary',
        duration: 8000
      })
    }
  }
}
