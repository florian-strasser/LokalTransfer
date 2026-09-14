<template>
  <!-- One transfer, told left to right: a shoot far too big for an attachment
       goes up, and the same files then run down to their own deletion. Both
       halves are read off one clock, so a file only joins the transfer once it
       has finished uploading, and the retention can only start counting once
       the last one is up — the order the app itself works in. -->
  <div
    class="ui flow"
    aria-hidden="true"
  >
    <div class="ui-panel flow__upload">
      <UiProgressRing :value="progress" />

      <p class="flow__caption">
        {{ phase === 'upload' ? current.name : 'Transfer sent' }}
      </p>
      <p class="ui-muted">
        <template v-if="phase === 'upload'">
          File {{ currentIndex + 1 }} of {{ files.length }} · {{ current.size }}
        </template>
        <template v-else>
          {{ files.length }} files · {{ TOTAL }}
        </template>
      </p>
    </div>

    <!-- The hand-over. It fills when the last file is up, which is the moment
         the transfer on the right starts to count. -->
    <span class="flow__link">
      <span
        class="flow__fill"
        :class="{ 'flow__fill--on': phase !== 'upload' }"
      />
    </span>

    <div class="ui-panel flow__expiry">
      <p class="ui-head">
        <span>Studio shoot</span>
        <span
          class="ui-chip flow__chip"
          :class="{ 'flow__chip--muted': phase !== 'sent' }"
        >
          <UiIcon :name="phase === 'expired' ? 'check' : phase === 'sent' ? 'clock' : 'upload'" />
          <span class="flow__label">
            <template v-if="phase === 'expired'">Expired</template>
            <template v-else-if="phase === 'sent'">
              <AnimatedNumber
                :value="days"
                direction="down"
              />
              <span>{{ days === 1 ? 'day' : 'days' }} left</span>
            </template>
            <template v-else>Uploading</template>
          </span>
        </span>
      </p>

      <div class="flow__files">
        <Motion
          v-for="(file, i) in files"
          :key="file.name"
          class="ui-file ui-row"
          :animate="{ opacity: rowShown(i) ? 1 : 0, x: phase === 'expired' ? -12 : 0 }"
          :transition="{
            duration: 0.45,
            // Going: staggered, so the list empties rather than blinking out.
            delay: phase === 'expired' ? i * 0.12 : 0,
            ease: [0.16, 1, 0.3, 1]
          }"
        >
          <UiIcon name="file" />
          <span class="ui-file__name">{{ file.name }}</span>
          <span class="ui-file__size ui-muted">{{ file.size }}</span>
        </Motion>

        <!-- Both notes sit over the list rather than after it, so the panel
             keeps its height through the whole loop — a tile that changed size
             would pull the grid around with it. -->
        <Motion
          class="flow__note ui-muted"
          :animate="{ opacity: phase === 'upload' && done === 0 ? 1 : 0 }"
          :transition="{ duration: 0.2 }"
        >
          Waiting for the upload
        </Motion>
        <Motion
          class="flow__note flow__note--gone"
          :animate="{ opacity: phase === 'expired' ? 1 : 0 }"
          :transition="{ duration: phase === 'expired' ? 0.4 : 0.15, delay: phase === 'expired' ? 0.45 : 0 }"
        >
          Files deleted from disk
        </Motion>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { animate, useMotionValue } from 'motion-v'

const files = [
  { name: 'shoot-raw-01.zip', size: '1.3 GB' },
  { name: 'shoot-raw-02.zip', size: '1.1 GB' },
  { name: 'contact-sheet.pdf', size: '12 MB' }
]
const TOTAL = '2.4 GB'

// The loop, in seconds. Upload, a beat on the full retention once it is sent,
// the countdown itself, and the expired state held long enough to read.
const UPLOAD = 6
const HANDOVER = 0.8
const COUNTDOWN = 7
const HOLD = 2.5
const SENT = UPLOAD + HANDOVER
const EXPIRES = SENT + COUNTDOWN
const CYCLE = EXPIRES + HOLD

// The app's own default retention, so the tile shows the number a fresh
// instance would.
const DEFAULT_DAYS = 14

// Chunked, not continuous — progress events arrive per chunk of the stream, and
// the spring inside the ring turns each step into movement. Twelve chunks over
// three files is four a file, which keeps "which file is this" integer maths.
const CHUNKS = 12
const PER_FILE = CHUNKS / files.length

type Phase = 'upload' | 'sent' | 'expired'

// These start on the frame just after the upload finishes: complete, fourteen
// days left, all three files in the transfer. That is what the static page is
// generated with, what a reduced-motion visitor keeps, and where the loop picks
// up once it starts — so there is no jump when the client takes over.
const chunk = ref(CHUNKS)
const days = ref(DEFAULT_DAYS)
const phase = ref<Phase>('sent')

const progress = computed(() => (chunk.value / CHUNKS) * 100)
const done = computed(() => Math.floor(chunk.value / PER_FILE))
const currentIndex = computed(() => Math.min(done.value, files.length - 1))
const current = computed(() => files[currentIndex.value]!)

function rowShown(i: number): boolean {
  if (phase.value === 'upload') return i < done.value
  return phase.value === 'sent'
}

// Everything on the tile from one position on the loop. Only primitives are
// written, so a frame that changes nothing visible re-renders nothing.
function seek(t: number) {
  if (t < UPLOAD) {
    phase.value = 'upload'
    chunk.value = Math.floor((t / UPLOAD) * CHUNKS)
    days.value = DEFAULT_DAYS
  } else if (t < EXPIRES) {
    phase.value = 'sent'
    chunk.value = CHUNKS
    // Held on the full retention through the hand-over, then linear — time is.
    // A part-day still reads as that day remaining, so ceil, as the app does.
    const remaining = t < SENT ? 1 : 1 - (t - SENT) / COUNTDOWN
    days.value = Math.max(1, Math.ceil(DEFAULT_DAYS * remaining - 0.0001))
  } else {
    phase.value = 'expired'
    chunk.value = CHUNKS
    days.value = 0
  }
}

onMounted(() => {
  // A counting number is a value, not a transform, so Motion will not stop it
  // for someone who has asked for less motion — it has to be asked here.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  // Offset by SENT so the first frame the loop draws is the one already on
  // screen, then round and round from there.
  const clock = useMotionValue(0)
  const unwatch = clock.on('change', (v: number) => seek((v + SENT) % CYCLE))
  const controls = animate(clock, CYCLE, { duration: CYCLE, ease: 'linear', repeat: Infinity })

  onUnmounted(() => {
    controls.stop()
    unwatch()
  })
})
</script>

<style scoped>
/* Stacked on a phone, where the tile is one column and two panels side by side
   would leave neither readable; a row from `sm`, where the tile spans two. */
.flow {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: center;
  gap: 0.9em;
  width: 100%;
}
.flow__upload,
.flow__expiry {
  justify-self: center;
  width: 100%;
  max-width: 20em;
  min-width: 0;
}
.flow__upload {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15em;
}
.flow__caption {
  margin-top: 0.7em;
  max-width: 100%;
  overflow: hidden;
  color: var(--color-dark);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.flow__link {
  position: relative;
  justify-self: center;
  width: 2px;
  height: 1.6em;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in oklab, var(--color-dark) 12%, transparent);
}
.flow__fill {
  position: absolute;
  inset: 0;
  background: var(--color-primary);
  transform: scaleY(0);
  transform-origin: top;
  transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}
.flow__fill--on {
  transform: scaleY(1);
}

@media (min-width: 40rem) {
  .flow {
    /* The whole width of the tile: each card at its own width against one edge,
       and the line taking everything left between them — so a wider tile
       lengthens the hand-over instead of stretching the cards. */
    grid-template-columns: minmax(0, 20em) minmax(3em, 1fr) minmax(0, 20em);
  }
  .flow__link {
    justify-self: stretch;
    width: auto;
    height: 2px;
  }
  .flow__fill {
    transform: scaleX(0);
    transform-origin: left;
  }
  .flow__fill--on {
    transform: scaleX(1);
  }
}

.flow__chip {
  transition: background-color 0.4s ease, color 0.4s ease;
}
.flow__chip--muted {
  background: color-mix(in oklab, var(--color-gray) 12%, transparent);
  color: var(--color-gray);
}
.flow__label {
  display: inline-flex;
  align-items: center;
  gap: 0.3em;
}

.flow__files {
  position: relative;
}
.flow__note {
  position: absolute;
  inset: 0;
  /* Zero in the stylesheet, not only in Motion's first frame: the page is
     statically generated, so without it both notes are painted over the file
     list on first render and blink away once the client takes over. */
  opacity: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.flow__note--gone {
  color: var(--color-primary);
  font-weight: 600;
}
</style>
