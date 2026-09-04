<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const props = withDefaults(defineProps<{
  /** 每秒噴發的紙片數量 */
  rate?: number
  /** 紙片顏色陣列 */
  colors?: string[]
  /** 是否啟用 */
  active?: boolean
}>(), {
  rate: 60,
  colors: () => ['#FCD34D', '#F97316', '#EF4444', '#EC4899', '#A855F7', '#3B82F6', '#14B8A6', '#22C55E'],
  active: true,
})

const canvas = ref<HTMLCanvasElement | null>(null)

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  vr: number
  size: number
  color: string
  shape: 'rect' | 'circle'
  life: number
}

const particles: Particle[] = []
let rafId: number | null = null
let spawnAcc = 0
let lastTs = 0

function createParticle(): Particle {
  const w = canvas.value?.width ?? 800
  return {
    x: Math.random() * w,
    y: -20,
    vx: (Math.random() - 0.5) * 4,
    vy: 2 + Math.random() * 3,
    rot: Math.random() * Math.PI * 2,
    vr: (Math.random() - 0.5) * 0.3,
    size: 6 + Math.random() * 8,
    color: props.colors[Math.floor(Math.random() * props.colors.length)],
    shape: Math.random() < 0.5 ? 'rect' : 'circle',
    life: 0,
  }
}

function loop(ts: number) {
  if (!canvas.value) return
  const ctx = canvas.value.getContext('2d')
  if (!ctx) return

  const delta = lastTs === 0 ? 16 : ts - lastTs
  lastTs = ts

  if (props.active) {
    spawnAcc += (props.rate * delta) / 1000
    while (spawnAcc >= 1) {
      particles.push(createParticle())
      spawnAcc -= 1
    }
  }

  ctx.clearRect(0, 0, canvas.value.width, canvas.value.height)

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.x += p.vx
    p.y += p.vy
    p.vy += 0.08
    p.rot += p.vr
    p.life += delta

    if (p.y > canvas.value.height + 30 || p.life > 8000) {
      particles.splice(i, 1)
      continue
    }

    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(p.rot)
    ctx.fillStyle = p.color
    if (p.shape === 'rect') {
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
    } else {
      ctx.beginPath()
      ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  rafId = requestAnimationFrame(loop)
}

function handleResize() {
  if (!canvas.value) return
  canvas.value.width = window.innerWidth
  canvas.value.height = window.innerHeight
}

onMounted(() => {
  handleResize()
  window.addEventListener('resize', handleResize)
  rafId = requestAnimationFrame(loop)
})

onUnmounted(() => {
  if (rafId !== null) cancelAnimationFrame(rafId)
  window.removeEventListener('resize', handleResize)
})

defineExpose({
  /** 立即爆發一批紙片（煙花） */
  burst(count = 80, origin?: { x: number; y: number }) {
    const w = canvas.value?.width ?? 800
    const h = canvas.value?.height ?? 600
    const ox = origin?.x ?? w / 2
    const oy = origin?.y ?? h / 2
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 4 + Math.random() * 8
      particles.push({
        x: ox,
        y: oy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.4,
        size: 6 + Math.random() * 10,
        color: props.colors[Math.floor(Math.random() * props.colors.length)],
        shape: Math.random() < 0.5 ? 'rect' : 'circle',
        life: 0,
      })
    }
  },
})
</script>

<template>
  <canvas
    ref="canvas"
    class="fixed inset-0 pointer-events-none z-[100]"
  />
</template>
