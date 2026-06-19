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

    const osc = c.createOscillator()
    const filter = c.createBiquadFilter()
    const gain = c.createGain()
    osc.connect(filter)
    filter.connect(gain)
    gain.connect(c.destination)

    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(1200, t)
    osc.frequency.exponentialRampToValueAtTime(280, t + 0.32)

    filter.type = 'bandpass'
    filter.frequency.value = 900
    filter.Q.value = 2

    gain.gain.setValueAtTime(0.1, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32)

    osc.start(t)
    osc.stop(t + 0.32)
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
