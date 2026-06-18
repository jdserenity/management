export const pausedStateFromVault = (
  vaultPaused: Record<string, string> | undefined,
  vaultUnpaused: Record<string, string> | undefined
): Record<string, string> => {
  const paused: Record<string, string> = {};
  for (const [id, date] of Object.entries(vaultPaused || {})) {
    const unpausedAt = (vaultUnpaused || {})[id];
    if (unpausedAt && unpausedAt >= date) continue;
    paused[id] = date;
  }
  return paused;
};

export const mergePausedOnIncoming = (
  memPaused: Record<string, string> | undefined,
  memUnpaused: Record<string, string> | undefined,
  filePaused: Record<string, string> | undefined,
  fileUnpaused: Record<string, string> | undefined
): { pausedActivities: Record<string, string>; unpausedActivities: Record<string, string> } => {
  const paused = { ...(memPaused || {}) };
  const unpaused = { ...(fileUnpaused || {}), ...(memUnpaused || {}) };
  for (const [id, date] of Object.entries(filePaused || {})) {
    const unpausedAt = unpaused[id];
    if (unpausedAt && unpausedAt >= date) continue;
    if (!paused[id] || date < paused[id]) paused[id] = date;
  }
  for (const [id, unpausedAt] of Object.entries(unpaused)) {
    if (paused[id] && unpausedAt >= paused[id]) delete paused[id];
  }
  return { pausedActivities: paused, unpausedActivities: unpaused };
};
