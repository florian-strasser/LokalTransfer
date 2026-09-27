// `v-tooltip="'Label'"` — LokalBoards' tooltip directive.
//
// The tooltip element is rendered into <body> with position: fixed, NOT as a
// child of the hovered element. As a child it lived inside whatever `overflow`
// container the element was in and got clipped; and on WebKit an absolutely
// positioned child whose opacity animates inside an `overflow: auto` container
// makes that container drop its scrollbar until the next scroll.
//
// State is kept in a WeakMap rather than on the element, so nothing has to be
// bolted onto HTMLElement's type and nothing outlives the element.
interface TooltipState {
  tip: HTMLDivElement
  show: () => void
  hide: () => void
}

const GAP = 8 // px between the element and the tooltip
const states = new WeakMap<HTMLElement, TooltipState>()

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive<HTMLElement, string | undefined>('tooltip', {
    mounted(el, binding) {
      if (!binding.value) return

      const tip = document.createElement('div')
      tip.textContent = binding.value
      tip.className = 'fixed z-[100] text-xs bg-primary text-white px-2 py-1 rounded-lg pointer-events-none opacity-0 transition-opacity duration-200 whitespace-nowrap'
      tip.style.top = '-9999px'
      tip.style.left = '-9999px'
      document.body.appendChild(tip)

      const position = () => {
        const rect = el.getBoundingClientRect()
        // Centre on the element, then clamp to the viewport so a tooltip near
        // the edge isn't cut off.
        const halfWidth = tip.offsetWidth / 2
        const left = Math.min(
          Math.max(rect.left + rect.width / 2, halfWidth + 4),
          window.innerWidth - halfWidth - 4
        )
        tip.style.left = `${left}px`
        tip.style.transform = 'translateX(-50%)'

        // Above if there's room, otherwise below — and point the triangle the
        // right way.
        const above = rect.top >= tip.offsetHeight + GAP
        tip.style.top = above ? `${rect.top - GAP - tip.offsetHeight}px` : `${rect.bottom + GAP}px`
        tip.classList.toggle('has-triangle-bottom', above)
        tip.classList.toggle('has-triangle-top', !above)
      }

      // A tooltip explains the control you are pointing at, and a screen with no
      // pointer has nothing to point with. On iOS a tap also leaves the button
      // focused, and this shows on focus — so without the check the tooltip
      // appeared at the tap and stood over whatever the tap had just opened.
      const canHover = () => window.matchMedia?.('(hover: hover)')?.matches ?? true

      const show = () => {
        if (!tip.textContent || !canHover()) return
        position()
        tip.style.opacity = '1'
      }
      const hide = () => {
        tip.style.opacity = '0'
      }

      states.set(el, { tip, show, hide })
      el.addEventListener('mouseenter', show)
      el.addEventListener('mouseleave', hide)
      el.addEventListener('focus', show)
      el.addEventListener('blur', hide)
      // Pressing the control answers the question the tooltip was asking.
      el.addEventListener('pointerdown', hide)
      el.addEventListener('click', hide)
      // A fixed tooltip would linger where the element used to be, so it goes as
      // soon as anything scrolls; the next hover repositions it.
      window.addEventListener('scroll', hide, { passive: true, capture: true })
      window.addEventListener('resize', hide, { passive: true })
    },

    updated(el, binding) {
      const state = states.get(el)
      if (state) state.tip.textContent = binding.value || ''
    },

    unmounted(el) {
      const state = states.get(el)
      if (!state) return
      const { tip, show, hide } = state
      el.removeEventListener('mouseenter', show)
      el.removeEventListener('mouseleave', hide)
      el.removeEventListener('focus', show)
      el.removeEventListener('blur', hide)
      el.removeEventListener('pointerdown', hide)
      el.removeEventListener('click', hide)
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('resize', hide)
      tip.remove()
      states.delete(el)
    }
  })
})
