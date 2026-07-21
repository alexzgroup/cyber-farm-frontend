// Duel background music — plain HTML5 <audio>. Loops the source file at low
// volume. Off by default; caller flips it on via the toggle in the top HUD.
//
// The source mp3 lives in src/game/sounds/ and is imported via Vite's ?url
// suffix — bundler adds a content hash, browser handles streaming.

import trackUrl from '../sounds/rpg-game-combat-sound.mp3?url'

const VOLUME = 0.30 // 30 % — background but audible, doesn't fight blaster SFX

let audio: HTMLAudioElement | null = null

function get(): HTMLAudioElement {
  if (audio) return audio
  audio = new Audio(trackUrl)
  audio.loop = true
  audio.preload = 'auto'
  audio.volume = VOLUME
  return audio
}

/** Start (or resume) the loop. Must be called from a user gesture on iOS/Safari. */
export async function startDuelMusic(): Promise<void> {
  const a = get()
  try {
    await a.play()
  } catch {
    // Autoplay blocked — caller usually retries on the next click.
  }
}

export function stopDuelMusic(): void {
  audio?.pause()
  if (audio) audio.currentTime = 0
}

export function isDuelMusicPlaying(): boolean {
  return !!audio && !audio.paused
}
