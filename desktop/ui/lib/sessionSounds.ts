let audioCtx: AudioContext | null = null;
let audioPrimed = false;

const ctx = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
  }
  return audioCtx;
};

/** Call once after user interaction so countdown ticks can play in the background. */
export const primeSessionAudio = (): void => {
  const ac = ctx();
  if (!ac || audioPrimed) return;
  audioPrimed = true;
  void ac.resume().catch(() => {});
};

const tone = (
  frequency: number,
  durationSec: number,
  gainPeak: number,
  type: OscillatorType
) => {
  const ac = ctx();
  if (!ac) return;
  void (audioPrimed ? Promise.resolve() : ac.resume()).then(() => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    const t0 = ac.currentTime;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(gainPeak, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationSec);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + durationSec + 0.02);
  });
};

/** Hz per countdown second (5 high → 1 low). */
export const countdownToneHz = (second: number): number => {
  const map: Record<number, number> = { 5: 988, 4: 784, 3: 659, 2: 523, 1: 392 };
  return map[second] ?? 392;
};

/** Short percussive tick — distinct from phase-change chime. */
export const playCountdownTick = (second: number): void => {
  primeSessionAudio();
  tone(countdownToneHz(second), 0.1, 0.18, 'square');
};

export const playPhaseChangeChime = (): void => {
  primeSessionAudio();
  tone(523.25, 0.14, 0.12, 'sine');
  window.setTimeout(() => tone(659.25, 0.22, 0.1, 'sine'), 130);
};

/** Schedule 5..1 ticks once per phase so throttled timers do not skip seconds. */
export const scheduleCountdownBeeps = (
  startSecond: number,
  onTick: (second: number) => void
): (() => void) => {
  const start = Math.min(5, Math.max(1, Math.floor(startSecond)));
  const timeouts: ReturnType<typeof setTimeout>[] = [];
  for (let s = start; s >= 1; s--) {
    const delayMs = (start - s) * 1000;
    timeouts.push(setTimeout(() => onTick(s), delayMs));
  }
  return () => timeouts.forEach((id) => clearTimeout(id));
};
