/** True when single-line ellipsis clipping hides part of the label. */
export const isElementTruncated = (el: HTMLElement): boolean => el.scrollWidth > el.clientWidth + 1;
