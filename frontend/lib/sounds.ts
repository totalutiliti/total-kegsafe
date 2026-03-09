/**
 * Central sound library — oscillator-based, no external files.
 * Reads user preference from localStorage key 'kegsafe-sounds-enabled'.
 */

const STORAGE_KEY = 'kegsafe-sounds-enabled';

function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEY) !== 'false'; // default ON
}

function playTone(
  frequency: number,
  durationMs: number,
  type: OscillatorType = 'sine',
  volume = 0.3,
) {
  if (!isSoundEnabled()) return;
  try {
    const ctx = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = frequency;
    osc.type = type;
    gain.gain.value = volume;
    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000);
  } catch {
    // Silenciar erros de AudioContext (ex: auto-play policy)
  }
}

/** Beep de sucesso — tom ascendente 800→1200 Hz */
export function playSuccess() {
  playTone(800, 100);
  setTimeout(() => playTone(1200, 150), 120);
}

/** Beep de erro — tom grave 400 Hz */
export function playError() {
  playTone(400, 300);
}

/** Beep de aviso — duplo 600 Hz */
export function playWarning() {
  playTone(600, 100);
  setTimeout(() => playTone(600, 100), 200);
}

/** Notificação — chime suave 1000 Hz */
export function playNotification() {
  playTone(1000, 100, 'sine', 0.2);
}

export function setSoundEnabled(enabled: boolean) {
  localStorage.setItem(STORAGE_KEY, String(enabled));
}

export function getSoundEnabled(): boolean {
  return isSoundEnabled();
}
