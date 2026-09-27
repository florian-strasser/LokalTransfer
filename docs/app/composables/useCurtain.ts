/**
 * Whether the page is visible, or hidden under the curtain of a page change.
 *
 * The new page mounts while the curtain still covers it, and the reveals on it
 * are triggered by coming into view — which a covered element does, as far as
 * an IntersectionObserver can tell. Left alone the headline would rise and the
 * tiles fade in behind the curtain, and the page would be finished animating by
 * the time anyone could see it. So they wait for this instead.
 *
 * The reveals that run in CSS alone (`--immediate`) cannot wait on a promise;
 * they are held by `[data-curtain]` on the document element, in main.css.
 */
export const useCurtain = () => {
  const open = useState('curtain-open', () => true)

  /** Resolves at once when nothing covers the page, or as the curtain lifts. */
  const whenOpen = () => open.value
    ? Promise.resolve()
    : new Promise<void>((resolve) => {
        const stop = watch(open, (value) => {
          if (!value) return
          stop()
          resolve()
        })
      })

  return { open, whenOpen }
}
