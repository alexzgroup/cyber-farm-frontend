import { useGameStore } from '../../store/gameStore'

let _ctx: AudioContext | null = null

function ac(): AudioContext {
  if (!_ctx) _ctx = new AudioContext()
  if (_ctx.state === 'suspended') _ctx.resume()
  return _ctx
}

function isOn(): boolean {
  return useGameStore.getState().soundEnabled
}

export const soundManager = {
  tap() {
    if (!isOn()) return
    const c = ac()
    const t = c.currentTime

    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.connect(gain)
    gain.connect(c.destination)

    osc.type = 'square'
    osc.frequency.setValueAtTime(520, t)
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.07)

    gain.gain.setValueAtTime(0.12, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07)

    osc.start(t)
    osc.stop(t + 0.07)
  },

  laser() {
    if (!isOn()) return
    const c = ac()
    const t = c.currentTime

    // Short, snappy blaster "pew". Trimmed the whole envelope to ~130 ms so
    // rapid-fire feels tight — the previous 300 ms tail overlapped and made
    // burst-fire sound like a hum. Same three layers as before:
    //
    //   1. Square-wave sweep 2400→220 Hz through resonant bandpass (100 ms)
    //   2. High-pass noise crack (18 ms)   — barrel spark
    //   3. Sine sub-thump 70→30 Hz (100 ms) — weight on speakers

    // Layer 1 — sweep tone
    const osc = c.createOscillator()
    const bandpass = c.createBiquadFilter()
    const shape = c.createGain()
    const master = c.createGain()
    osc.connect(bandpass); bandpass.connect(shape); shape.connect(master); master.connect(c.destination)

    osc.type = 'square'
    osc.frequency.setValueAtTime(2400, t)
    osc.frequency.exponentialRampToValueAtTime(220, t + 0.10)

    bandpass.type = 'bandpass'
    bandpass.frequency.setValueAtTime(1800, t)
    bandpass.frequency.exponentialRampToValueAtTime(400, t + 0.10)
    bandpass.Q.value = 6

    shape.gain.setValueAtTime(0.0001, t)
    shape.gain.exponentialRampToValueAtTime(0.24, t + 0.005)
    shape.gain.exponentialRampToValueAtTime(0.001, t + 0.12)

    master.gain.setValueAtTime(0.9, t)
    osc.start(t); osc.stop(t + 0.13)

    // Layer 2 — noise crack
    const nBufSize = Math.ceil(c.sampleRate * 0.02)
    const nBuf = c.createBuffer(1, nBufSize, c.sampleRate)
    const nData = nBuf.getChannelData(0)
    for (let i = 0; i < nBufSize; i++) nData[i] = (Math.random() * 2 - 1) * (1 - i / nBufSize)
    const noise = c.createBufferSource()
    noise.buffer = nBuf
    const nHp = c.createBiquadFilter()
    nHp.type = 'highpass'; nHp.frequency.value = 1800
    const nGain = c.createGain()
    nGain.gain.setValueAtTime(0.20, t)
    nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.025)
    noise.connect(nHp); nHp.connect(nGain); nGain.connect(c.destination)
    noise.start(t); noise.stop(t + 0.03)

    // Layer 3 — sub thump
    const sub = c.createOscillator()
    const subGain = c.createGain()
    sub.type = 'sine'
    sub.frequency.setValueAtTime(70, t)
    sub.frequency.exponentialRampToValueAtTime(30, t + 0.09)
    subGain.gain.setValueAtTime(0.16, t)
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.10)
    sub.connect(subGain); subGain.connect(c.destination)
    sub.start(t); sub.stop(t + 0.11)
  },

  explosion() {
    if (!isOn()) return
    const c = ac()
    const t = c.currentTime
    const duration = 0.45

    const bufSize = Math.ceil(c.sampleRate * duration)
    const buf = c.createBuffer(1, bufSize, c.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1

    const src = c.createBufferSource()
    src.buffer = buf

    const filter = c.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(1400, t)
    filter.frequency.exponentialRampToValueAtTime(60, t + duration)

    const gain = c.createGain()
    gain.gain.setValueAtTime(0.28, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration)

    src.connect(filter)
    filter.connect(gain)
    gain.connect(c.destination)

    src.start(t)
    src.stop(t + duration)
  },

  beep(high = false) {
    if (!isOn()) return
    const c = ac()
    const t = c.currentTime
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.connect(gain); gain.connect(c.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(high ? 880 : 440, t)
    gain.gain.setValueAtTime(0.22, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18)
    osc.start(t); osc.stop(t + 0.18)
  },

  fight() {
    if (!isOn()) return
    const c = ac()
    const t = c.currentTime
    // Two-tone "fight" hit
    for (const [freq, delay] of [[220, 0], [440, 0.04], [880, 0.08]] as const) {
      const osc = c.createOscillator()
      const gain = c.createGain()
      osc.connect(gain); gain.connect(c.destination)
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(freq, t + delay)
      gain.gain.setValueAtTime(0.3, t + delay)
      gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.35)
      osc.start(t + delay); osc.stop(t + delay + 0.35)
    }
  },

  coin() {
    if (!isOn()) return
    const c = ac()
    const t = c.currentTime

    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.connect(gain)
    gain.connect(c.destination)

    osc.type = 'sine'
    osc.frequency.setValueAtTime(1200, t)
    osc.frequency.exponentialRampToValueAtTime(1800, t + 0.04)
    osc.frequency.exponentialRampToValueAtTime(900, t + 0.12)

    gain.gain.setValueAtTime(0.08, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12)

    osc.start(t)
    osc.stop(t + 0.12)
  },
}
