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
