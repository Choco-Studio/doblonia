import { settings, onSettingsChange } from '../settings.js'

export type SoundName =
  | 'cannon'
  | 'heavyCannon'
  | 'coin'
  | 'gem'
  | 'hit'
  | 'hurt'
  | 'explosion'
  | 'splash'
  | 'levelUp'
  | 'buy'
  | 'ram'
  | 'mine'
  | 'click'
  | 'error'
  | 'bossDown'
  | 'equip'
  | 'mortar'
  | 'mortarBlast'
  | 'fire'
  | 'chain'
  | 'chest'

const HEARING_RANGE = 1500

/**
 * Sonido 100% procedural con WebAudio: no hay archivos de audio que licenciar
 * ni descargar. El contexto se crea tras la primera interacción del usuario.
 */
class SoundEngine {
  private ctx: AudioContext | null = null
  private master!: GainNode
  private sfx!: GainNode
  private ambient!: GainNode
  private noise!: AudioBuffer
  private listenerX = 0
  private listenerY = 0
  private recent = new Map<SoundName, number[]>()

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return
    }
    const Ctx = window.AudioContext
    if (!Ctx) return
    this.ctx = new Ctx()
    this.master = this.ctx.createGain()
    this.master.connect(this.ctx.destination)
    this.sfx = this.ctx.createGain()
    this.sfx.connect(this.master)
    this.ambient = this.ctx.createGain()
    this.ambient.connect(this.master)
    this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate)
    const data = this.noise.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    this.applyVolumes()
    onSettingsChange(() => this.applyVolumes())
    this.startOcean()
  }

  private applyVolumes(): void {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    this.master.gain.setTargetAtTime(settings.masterVolume, t, 0.05)
    this.sfx.gain.setTargetAtTime(settings.sfxVolume, t, 0.05)
    this.ambient.gain.setTargetAtTime(settings.ambientVolume * 0.35, t, 0.2)
  }

  setListener(x: number, y: number): void {
    this.listenerX = x
    this.listenerY = y
  }

  private startOcean(): void {
    const ctx = this.ctx!
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.loop = true
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 520
    const gain = ctx.createGain()
    gain.gain.value = 0.35
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.12
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 0.18
    lfo.connect(lfoGain)
    lfoGain.connect(gain.gain)
    const lfo2 = ctx.createOscillator()
    lfo2.frequency.value = 0.07
    const lfo2Gain = ctx.createGain()
    lfo2Gain.gain.value = 220
    lfo2.connect(lfo2Gain)
    lfo2Gain.connect(lp.frequency)
    src.connect(lp)
    lp.connect(gain)
    gain.connect(this.ambient)
    src.start()
    lfo.start()
    lfo2.start()
  }

  /** Limita cuántas veces suena lo mismo en 120 ms para no saturar en combates grandes. */
  private throttle(name: SoundName, max: number): boolean {
    const now = performance.now()
    const list = (this.recent.get(name) ?? []).filter((t) => now - t < 120)
    if (list.length >= max) {
      this.recent.set(name, list)
      return false
    }
    list.push(now)
    this.recent.set(name, list)
    return true
  }

  play(name: SoundName, opts: { x?: number; y?: number; volume?: number; pitch?: number } = {}): void {
    const ctx = this.ctx
    if (!ctx || ctx.state !== 'running') return
    let vol = opts.volume ?? 1
    let pan = 0
    if (opts.x !== undefined && opts.y !== undefined) {
      const dx = opts.x - this.listenerX
      const dy = opts.y - this.listenerY
      const d = Math.hypot(dx, dy)
      if (d > HEARING_RANGE) return
      vol *= Math.pow(1 - d / HEARING_RANGE, 1.6)
      pan = Math.max(-0.8, Math.min(0.8, dx / 700))
    }
    if (vol < 0.02) return
    if (!this.throttle(name, name === 'coin' ? 3 : 4)) return

    const out = ctx.createGain()
    out.gain.value = vol
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null
    if (panner) {
      panner.pan.value = pan
      out.connect(panner)
      panner.connect(this.sfx)
    } else {
      out.connect(this.sfx)
    }
    const t = ctx.currentTime
    const pitch = opts.pitch ?? 1

    switch (name) {
      case 'cannon':
      case 'heavyCannon': {
        const heavy = name === 'heavyCannon'
        this.noiseBurst(
          out,
          t,
          heavy ? 0.55 : 0.32,
          heavy ? 1400 : 2000,
          heavy ? 90 : 160,
          heavy ? 0.9 : 0.55,
        )
        this.tone(
          out,
          t,
          'sine',
          (heavy ? 55 : 85) * pitch,
          (heavy ? 32 : 45) * pitch,
          heavy ? 0.35 : 0.2,
          heavy ? 0.9 : 0.6,
        )
        break
      }
      case 'coin':
        this.tone(out, t, 'sine', 1320 * pitch, 1320 * pitch, 0.09, 0.18)
        this.tone(out, t + 0.06, 'sine', 1975 * pitch, 1975 * pitch, 0.14, 0.14)
        break
      case 'gem':
        ;[880, 1320, 1760, 2637].forEach((f, i) => this.tone(out, t + i * 0.05, 'triangle', f, f, 0.18, 0.12))
        break
      case 'hit':
        this.noiseBurst(out, t, 0.09, 2400, 700, 0.35, 'bandpass')
        this.tone(out, t, 'triangle', 220 * pitch, 110 * pitch, 0.08, 0.2)
        break
      case 'hurt':
        this.noiseBurst(out, t, 0.14, 1600, 300, 0.5, 'bandpass')
        this.tone(out, t, 'sawtooth', 140, 70, 0.12, 0.18)
        break
      case 'explosion':
        this.noiseBurst(out, t, 1.1, 1800, 60, 1)
        this.tone(out, t, 'sine', 60, 25, 0.8, 1)
        break
      case 'bossDown':
        this.noiseBurst(out, t, 1.8, 1500, 40, 1)
        this.tone(out, t, 'sine', 45, 20, 1.5, 1)
        ;[392, 523, 659, 784].forEach((f, i) =>
          this.tone(out, t + 0.3 + i * 0.12, 'triangle', f, f, 0.35, 0.18),
        )
        break
      case 'splash':
        this.noiseBurst(out, t, 0.25, 3000, 900, 0.25, 'highpass')
        break
      case 'levelUp':
        ;[523, 659, 784, 1046].forEach((f, i) => this.tone(out, t + i * 0.07, 'triangle', f, f, 0.2, 0.22))
        break
      case 'buy':
        this.tone(out, t, 'triangle', 660, 990, 0.1, 0.2)
        break
      case 'equip':
        ;[440, 660, 880].forEach((f, i) => this.tone(out, t + i * 0.05, 'square', f, f, 0.08, 0.06))
        this.noiseBurst(out, t, 0.15, 5000, 2000, 0.12, 'highpass')
        break
      case 'ram':
        this.noiseBurst(out, t, 0.3, 700, 120, 0.8)
        this.tone(out, t, 'sine', 95, 50, 0.25, 0.8)
        break
      case 'mine':
        this.noiseBurst(out, t, 0.8, 1200, 80, 0.9)
        this.noiseBurst(out, t + 0.05, 0.6, 4000, 1200, 0.3, 'highpass')
        break
      case 'mortar':
        // Golpe hueco y grave, seguido del silbido del proyectil subiendo
        this.noiseBurst(out, t, 0.45, 900, 70, 0.8)
        this.tone(out, t, 'sine', 70 * pitch, 38 * pitch, 0.3, 0.9)
        this.tone(out, t + 0.1, 'sine', 900, 1500, 0.5, 0.05)
        break
      case 'mortarBlast':
        this.noiseBurst(out, t, 0.9, 2200, 70, 1)
        this.tone(out, t, 'sine', 70, 28, 0.6, 1)
        this.noiseBurst(out, t + 0.08, 0.7, 5000, 1500, 0.25, 'highpass')
        break
      case 'fire':
        this.noiseBurst(out, t, 0.4, 3200, 500, 0.4, 'bandpass')
        this.tone(out, t, 'sawtooth', 120 * pitch, 60 * pitch, 0.25, 0.12)
        break
      case 'chain':
        this.noiseBurst(out, t, 0.3, 1800, 120, 0.45)
        ;[1500, 1900, 1300].forEach((f, i) =>
          this.tone(out, t + 0.02 + i * 0.035, 'square', f, f * 0.9, 0.04, 0.04),
        )
        break
      case 'chest':
        ;[523, 784, 1046, 1318, 1568].forEach((f, i) =>
          this.tone(out, t + i * 0.06, 'triangle', f, f, 0.25, 0.16),
        )
        this.noiseBurst(out, t, 0.3, 6000, 2500, 0.15, 'highpass')
        break
      case 'click':
        this.tone(out, t, 'sine', 900, 700, 0.04, 0.12)
        break
      case 'error':
        this.tone(out, t, 'square', 180, 150, 0.12, 0.08)
        break
    }
  }

  private tone(
    dest: AudioNode,
    t: number,
    type: OscillatorType,
    f0: number,
    f1: number,
    dur: number,
    vol: number,
  ): void {
    const ctx = this.ctx!
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(f0, t)
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(g)
    g.connect(dest)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }

  private noiseBurst(
    dest: AudioNode,
    t: number,
    dur: number,
    f0: number,
    f1: number,
    vol: number,
    type: BiquadFilterType = 'lowpass',
  ): void {
    const ctx = this.ctx!
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.playbackRate.value = 0.8 + Math.random() * 0.4
    const filter = ctx.createBiquadFilter()
    filter.type = type
    filter.frequency.setValueAtTime(f0, t)
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(filter)
    filter.connect(g)
    g.connect(dest)
    src.start(t, Math.random() * 1.5)
    src.stop(t + dur + 0.05)
  }
}

export const sound = new SoundEngine()
