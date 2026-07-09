/** Round a wall-clock time to the nearest half hour and format for snack chips.
 * 12:07 → "12pm", 2:23 → "2:30pm", 11:45 → "12pm"
 */
export const formatNearestHalfHourLabel = (timestampMs: number): string => {
  const d = new Date(timestampMs);
  let hours = d.getHours();
  const minutes = d.getMinutes();
  let halfHourSlot: 0 | 30 = 0;

  if (minutes < 15) {
    halfHourSlot = 0;
  } else if (minutes < 45) {
    halfHourSlot = 30;
  } else {
    halfHourSlot = 0;
    hours = (hours + 1) % 24;
  }

  const isPm = hours >= 12;
  let hour12 = hours % 12;
  if (hour12 === 0) hour12 = 12;
  const suffix = isPm ? 'pm' : 'am';
  if (halfHourSlot === 0) return `${hour12}${suffix}`;
  return `${hour12}:30${suffix}`;
};
