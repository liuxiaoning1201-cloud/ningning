<script setup lang="ts">
import { ref, watch, computed } from 'vue'

const props = defineProps<{
  active: boolean
}>()

interface Particle {
  id: number
  x: number
  y: number
  emoji: string
  delay: number
  duration: number
  dx: number
  dy: number
  scale: number
}

const effectTypes = [
  { emoji: '💣', label: 'bomb' },
  { emoji: '😭', label: 'cry' },
  { emoji: '⚡', label: 'lightning' },
  { emoji: '💔', label: 'heartbreak' },
  { emoji: '🌪️', label: 'tornado' },
]

const currentEffect = ref<typeof effectTypes[0] | null>(null)
const particles = ref<Particle[]>([])
const showFlash = ref(false)
const showShake = ref(false)
let counter = 0

const centerEmoji = computed(() => currentEffect.value?.emoji ?? '💣')

watch(() => props.active, (val) => {
  if (!val) return
  const effect = effectTypes[Math.floor(Math.random() * effectTypes.length)]
  currentEffect.value = effect
  generateParticles(effect)
  showShake.value = true
  if (effect.label === 'lightning') {
    showFlash.value = true
    setTimeout(() => { showFlash.value = false }, 150)
    setTimeout(() => { showFlash.value = true }, 250)
    setTimeout(() => { showFlash.value = false }, 350)
  }
  setTimeout(() => { showShake.value = false }, 600)
})

function generateParticles(effect: typeof effectTypes[0]) {
  const emojis: string[] = []
  switch (effect.label) {
    case 'bomb':
      emojis.push('💥', '🔥', '💣', '💨', '✨')
      break
    case 'cry':
      emojis.push('😭', '😢', '💧', '😿', '🥲')
      break
    case 'lightning':
      emojis.push('⚡', '🌩️', '💫', '✨', '⚡')
      break
    case 'heartbreak':
      emojis.push('💔', '😞', '💫', '🥀', '😢')
      break
    case 'tornado':
      emojis.push('🌪️', '💨', '🍃', '🌀', '✨')
      break
  }

  const newParticles: Particle[] = []
  for (let i = 0; i < 15; i++) {
    newParticles.push({
      id: ++counter,
      x: 50 + (Math.random() - 0.5) * 30,
      y: 50 + (Math.random() - 0.5) * 30,
      emoji: emojis[Math.floor(Math.random() * emojis.length)],
      delay: Math.random() * 0.3,
      duration: 0.6 + Math.random() * 0.8,
      dx: (Math.random() - 0.5) * 200,
      dy: (Math.random() - 0.5) * 200,
      scale: 0.6 + Math.random() * 1.2,
    })
  }
  particles.value = newParticles
}
</script>

<template>
  <Teleport to="body">
    <Transition name="effect-fade">
      <div
        v-if="active"
        class="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center overflow-hidden"
        :class="{ 'screen-shake': showShake }"
      >
        <!-- Flash overlay for lightning -->
        <div
          v-if="showFlash"
          class="absolute inset-0 bg-white/80 z-10"
        />

        <!-- Center emoji -->
        <div class="center-emoji text-8xl z-20">
          {{ centerEmoji }}
        </div>

        <!-- Particles -->
        <div
          v-for="p in particles"
          :key="p.id"
          class="particle absolute z-20"
          :style="{
            left: p.x + '%',
            top: p.y + '%',
            fontSize: (p.scale * 32) + 'px',
            animationDelay: p.delay + 's',
            animationDuration: p.duration + 's',
            '--dx': p.dx + 'px',
            '--dy': p.dy + 'px',
          }"
        >
          {{ p.emoji }}
        </div>

        <!-- Dim overlay -->
        <div class="absolute inset-0 bg-red-900/15 animate-pulse" />
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.center-emoji {
  animation: centerPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

@keyframes centerPop {
  0% { transform: scale(0.3); opacity: 0; }
  50% { transform: scale(1.8); opacity: 1; }
  100% { transform: scale(1.2); opacity: 0.7; }
}

.particle {
  animation: particleBurst var(--duration, 0.8s) ease-out forwards;
  opacity: 0;
}

@keyframes particleBurst {
  0% { transform: translate(0, 0) scale(0.3); opacity: 1; }
  60% { opacity: 1; }
  100% { transform: translate(var(--dx, 100px), var(--dy, -100px)) scale(1.2); opacity: 0; }
}

.screen-shake {
  animation: shake 0.5s ease-in-out;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10% { transform: translateX(-8px) rotate(-0.5deg); }
  20% { transform: translateX(8px) rotate(0.5deg); }
  30% { transform: translateX(-6px); }
  40% { transform: translateX(6px); }
  50% { transform: translateX(-4px); }
  60% { transform: translateX(4px); }
  70% { transform: translateX(-2px); }
  80% { transform: translateX(2px); }
}

.effect-fade-enter-active { transition: opacity 0.15s ease; }
.effect-fade-leave-active { transition: opacity 0.5s ease; }
.effect-fade-enter-from { opacity: 0; }
.effect-fade-leave-to { opacity: 0; }
</style>
