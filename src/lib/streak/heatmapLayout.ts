export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const monthIndexFromDateStr = (dateStr: string | null | undefined): number => {
  if (!dateStr) return -1;
  return parseInt(dateStr.slice(5, 7), 10) - 1;
};

export const weekColumnMonthFromDates = (dateStrs: (string | null | undefined)[]): number => {
  for (const d of dateStrs) {
    const m = monthIndexFromDateStr(d);
    if (m >= 0) return m;
  }
  return -1;
};

export const heatmapMonthSpans = (weekMonths: number[]): { name: string; weekCount: number }[] => {
  const spans: { name: string; weekCount: number }[] = [];
  let i = 0;
  while (i < weekMonths.length) {
    const m = weekMonths[i];
    if (m < 0) { i++; continue; }
    const start = i;
    while (i < weekMonths.length && weekMonths[i] === m) i++;
    spans.push({ name: MONTH_NAMES[m], weekCount: i - start });
  }
  return spans;
};
