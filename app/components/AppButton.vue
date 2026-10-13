<script setup lang="ts">
import type { Component } from 'vue'
import { LoaderCircle } from '@lucide/vue'

// The one button. LokalBoards writes its buttons out as classes at each call
// site; here there are enough of them, in enough states (loading, icon-only,
// a link that looks like a button), that one component is less to get wrong.
//
// Four variants and two colours, which is every combination the interface
// uses:
// - `solid`  the one thing on a screen you are meant to press
// - `subtle` a secondary action that still needs a visible edge
// - `ghost`  an action that should recede until pointed at
// - `link`   inline, text only
// The accent is `primary`; everything else is `neutral`.
//
// A button with an icon and no label is square, and needs an `aria-label`.
type Variant = 'solid' | 'subtle' | 'ghost' | 'link'
type Color = 'primary' | 'neutral'
type Size = 'xs' | 'sm' | 'md' | 'lg'

const props = withDefaults(defineProps<{
  label?: string
  icon?: Component
  trailingIcon?: Component
  variant?: Variant
  color?: Color
  size?: Size
  to?: string
  external?: boolean
  target?: string
  type?: 'button' | 'submit' | 'reset'
  loading?: boolean
  disabled?: boolean
  block?: boolean
}>(), {
  label: undefined,
  icon: undefined,
  trailingIcon: undefined,
  variant: 'solid',
  color: 'primary',
  size: 'md',
  to: undefined,
  external: false,
  target: undefined,
  type: 'button',
  loading: false,
  disabled: false,
  block: false
})

const slots = useSlots()
const NuxtLink = resolveComponent('NuxtLink')

const square = computed(() => !props.label && !slots.default)

// Heights are fixed rather than left to padding, so a button always lines up
// with a neighbour of the same size. `lg` is the height of a `.form-control`,
// which is what a submit button under a form stands next to.
const SIZES: Record<Size, { box: string, square: string, icon: string }> = {
  xs: { box: 'h-7 px-2 text-xs gap-1', square: 'size-7', icon: 'size-3.5' },
  sm: { box: 'h-8 px-2.5 text-xs gap-1.5', square: 'size-8', icon: 'size-4' },
  md: { box: 'h-9 px-3 text-sm gap-1.5', square: 'size-9', icon: 'size-5' },
  lg: { box: 'h-[2.625rem] px-4 text-sm gap-2', square: 'size-[2.625rem]', icon: 'size-5' }
}

// Hover is held back from a disabled button, so it doesn't answer a pointer it
// is refusing. `not-disabled` rather than `enabled`: a link is never `:enabled`,
// and would never hover at all.
const TONES: Record<Variant, Record<Color, string>> = {
  solid: {
    primary: 'bg-primary text-white hover:not-disabled:bg-primary-hover',
    neutral: 'bg-inverted text-inverted hover:not-disabled:bg-inverted/90'
  },
  subtle: {
    primary: 'bg-primary/10 text-primary ring-1 ring-inset ring-primary/25 hover:not-disabled:bg-primary/15',
    neutral: 'bg-elevated text-default ring-1 ring-inset ring-accented hover:not-disabled:bg-accented/75'
  },
  ghost: {
    primary: 'text-primary hover:not-disabled:bg-primary/10',
    neutral: 'text-default hover:not-disabled:bg-elevated hover:not-disabled:text-highlighted'
  },
  link: {
    primary: 'text-primary hover:not-disabled:text-primary-hover',
    neutral: 'text-muted hover:not-disabled:text-default'
  }
}

const classes = computed(() => {
  const size = SIZES[props.size]
  return [
    'inline-flex shrink-0 items-center rounded-lg font-medium transition-colors cursor-pointer',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
    'disabled:cursor-not-allowed disabled:opacity-75 aria-disabled:cursor-not-allowed aria-disabled:opacity-75',
    props.variant === 'link'
      ? 'gap-1.5 text-sm'
      : square.value ? `${size.square} justify-center` : size.box,
    props.block && 'w-full justify-center',
    TONES[props.variant][props.color]
  ]
})

const iconClass = computed(() => [SIZES[props.size].icon, 'shrink-0'])
</script>

<template>
  <component
    :is="to ? NuxtLink : 'button'"
    :to="to"
    :external="to ? external : undefined"
    :target="target"
    :type="to ? undefined : type"
    :disabled="to ? undefined : disabled || loading"
    :aria-disabled="to && disabled ? 'true' : undefined"
    :aria-busy="loading || undefined"
    :class="classes"
  >
    <LoaderCircle
      v-if="loading"
      :class="[iconClass, 'animate-spin']"
      aria-hidden="true"
    />
    <component
      :is="icon"
      v-else-if="icon"
      :class="iconClass"
      aria-hidden="true"
    />
    <span
      v-if="!square"
      class="truncate"
    ><slot>{{ label }}</slot></span>
    <component
      :is="trailingIcon"
      v-if="trailingIcon"
      :class="iconClass"
      aria-hidden="true"
    />
  </component>
</template>
