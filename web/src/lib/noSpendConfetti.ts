type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  color: string
  size: number
  rot: number
  vr: number
  life: number
  decay: number
  shape: 'rect' | 'circle' | 'star' | 'ribbon'
  wobble: number
}

const COLORS = [
  '#00754A',
  '#00C896',
  '#FFD700',
  '#FFEB3B',
  '#FF6B35',
  '#FF1493',
  '#FF69B4',
  '#00CED1',
  '#7B68EE',
  '#FFA500',
  '#FFFFFF',
  '#32CD32',
]

function spawnBurst(
  cx: number,
  cy: number,
  count: number,
  power: number,
): Particle[] {
  return Array.from({ length: count }, () => {
    const angle = Math.random() * Math.PI * 2
    const speed = power * (0.45 + Math.random() * 0.85)
    const shapes: Particle['shape'][] = ['rect', 'circle', 'star', 'ribbon']
    return {
      x: cx + (Math.random() - 0.5) * 12,
      y: cy + (Math.random() - 0.5) * 8,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - power * 0.35,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
      size: 3 + Math.random() * 7,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.45,
      life: 0.85 + Math.random() * 0.15,
      decay: 0.006 + Math.random() * 0.008,
      shape: shapes[Math.floor(Math.random() * shapes.length)]!,
      wobble: Math.random() * Math.PI * 2,
    }
  })
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  r: number,
  spikes: number,
) {
  const step = Math.PI / spikes
  ctx.beginPath()
  for (let i = 0; i < spikes * 2; i++) {
    const rad = i % 2 === 0 ? r : r * 0.42
    const a = i * step - Math.PI / 2
    const x = Math.cos(a) * rad
    const y = Math.sin(a) * rad
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fill()
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle) {
  const alpha = Math.max(0, p.life)
  if (alpha <= 0) return
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.rotate(p.rot)
  ctx.globalAlpha = alpha
  ctx.fillStyle = p.color
  if (p.shape === 'circle') {
    ctx.beginPath()
    ctx.arc(0, 0, p.size * 0.45, 0, Math.PI * 2)
    ctx.fill()
  } else if (p.shape === 'star') {
    drawStar(ctx, p.size * 0.55, 5)
  } else if (p.shape === 'ribbon') {
    ctx.fillRect(-p.size * 0.15, -p.size * 0.55, p.size * 0.3, p.size * 1.1)
  } else {
    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
  }
  ctx.restore()
}

function drawFlash(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  strength: number,
) {
  if (strength <= 0) return
  const g = ctx.createRadialGradient(w * 0.5, h * 0.32, 0, w * 0.5, h * 0.32, w * 0.55)
  g.addColorStop(0, `rgba(255, 240, 150, ${strength * 0.35})`)
  g.addColorStop(0.4, `rgba(0, 200, 130, ${strength * 0.12})`)
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
}

/** 배너 클릭 시 화려한 축하 폭죽 (다중 연발 + 섬광) */
export function burstNoSpendConfetti(): void {
  if (typeof window === 'undefined') return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const canvas = document.createElement('canvas')
  const w = window.innerWidth
  const h = window.innerHeight
  canvas.width = w
  canvas.height = h
  canvas.style.cssText =
    'position:fixed;inset:0;pointer-events:none;z-index:85;width:100%;height:100%'
  document.body.appendChild(canvas)
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    canvas.remove()
    return
  }

  const bursts: { at: number; particles: Particle[] }[] = [
    { at: 0, particles: spawnBurst(w * 0.5, h * 0.3, 140, 16) },
    { at: 8, particles: spawnBurst(w * 0.28, h * 0.38, 90, 13) },
    { at: 8, particles: spawnBurst(w * 0.72, h * 0.38, 90, 13) },
    { at: 18, particles: spawnBurst(w * 0.5, h * 0.22, 110, 18) },
    { at: 32, particles: spawnBurst(w * 0.15, h * 0.45, 70, 11) },
    { at: 32, particles: spawnBurst(w * 0.85, h * 0.45, 70, 11) },
    { at: 48, particles: spawnBurst(w * 0.5, h * 0.35, 120, 15) },
  ]

  let frame = 0
  const maxFrames = 200
  let flash = 1.2
  const all: Particle[] = []

  const tick = () => {
    for (const b of bursts) {
      if (frame === b.at) all.push(...b.particles)
    }

    ctx.clearRect(0, 0, w, h)
    if (flash > 0) {
      drawFlash(ctx, w, h, flash)
      flash -= 0.06
    }

    for (const p of all) {
      p.x += p.vx + Math.sin(frame * 0.08 + p.wobble) * 0.35
      p.y += p.vy
      p.vy += 0.14
      p.vx *= 0.992
      p.rot += p.vr
      p.life -= p.decay
      drawParticle(ctx, p)
    }

    frame++
    if (frame < maxFrames && all.some((p) => p.life > 0)) {
      requestAnimationFrame(tick)
    } else {
      canvas.remove()
    }
  }
  requestAnimationFrame(tick)
}
