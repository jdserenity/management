const RESET_COUNT_WORDS = ['Once', 'Twice', 'Thrice'] as const;

export const resetButtonLabel = (resetCount: number): string => {
  if (resetCount <= 0) return 'Reset';
  if (resetCount <= RESET_COUNT_WORDS.length) return `Reset (${RESET_COUNT_WORDS[resetCount - 1]})`;
  return `Reset (${resetCount} times)`;
};
