import confetti from 'canvas-confetti';

/** True when single-line ellipsis clipping hides part of the label. */
export const isElementTruncated = (el: HTMLElement): boolean => el.scrollWidth > el.clientWidth + 1;

const RESET_COUNT_WORDS = ['Once', 'Twice', 'Thrice'] as const;

export const resetButtonLabel = (resetCount: number): string => {
  if (resetCount <= 0) return 'Reset';
  if (resetCount <= RESET_COUNT_WORDS.length) return `Reset (${RESET_COUNT_WORDS[resetCount - 1]})`;
  return `Reset (${resetCount} times)`;
};

export const streakDisplayTier = (value: number, kind: 'current' | 'longest'): 'none' | 'mid' | 'gold' | 'silver' => {
  const n = Number(value) || 0;
  if (n <= 5) return 'none';
  if (n <= 9) return 'mid';
  return kind === 'current' ? 'gold' : 'silver';
};

export const currentStreakFireEmojiClass = (value: number): string | null => {
  const n = Number(value) || 0;
  if (n <= 4) return null;
  if (n <= 9) return 'streak-streak-emoji streak-streak-emoji-small';
  return 'streak-streak-emoji';
};

export const fireDayCompleteConfetti = (): void => {
  if (typeof window === 'undefined') return;
  const end = Date.now() + 800;
  const frame = () => {
    confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0, y: 0.65 }, zIndex: 10000 });
    confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1, y: 0.65 }, zIndex: 10000 });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();
  confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 }, zIndex: 10000 });
};
