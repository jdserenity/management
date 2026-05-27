let audioCtx: AudioContext | null = null;

const ctx = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
  }
  return audioCtx;
};

const beep = (frequency: number, durationSec: number, gainPeak: number) => {
  const ac = ctx();
  if (!ac) return;
  const resume = ac.state === 'suspended' ? ac.resume() : Promise.resolve();
  void resume.then(() => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequency;
    const t0 = ac.currentTime;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(gainPeak, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationSec);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + durationSec + 0.02);
  });
};

export const playCountdownTick = (): void => beep(880, 0.08, 0.12);

export const playPhaseChangeChime = (): void => {
  beep(523.25, 0.12, 0.14);
  window.setTimeout(() => beep(659.25, 0.18, 0.12), 120);
};
