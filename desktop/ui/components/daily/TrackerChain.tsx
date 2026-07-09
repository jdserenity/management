import type { ReactNode } from 'react';
import TdeeChainConnector from '@/components/daily/TdeeChainConnector';

/** Prefix for CSS classes: `tdee` | `water` | `movement`. */
export type TrackerPrefix = 'tdee' | 'water' | 'movement';

export function withChainConnectors(nodes: ReactNode[]): ReactNode[] {
  const out: ReactNode[] = [];
  nodes.forEach((node, i) => {
    if (i > 0) out.push(<TdeeChainConnector key={`c-${i}`} />);
    out.push(node);
  });
  return out;
}

export function TrackerPlusButton({
  prefix,
  addMode,
  onOpen,
  titleOpen = 'Close add menu first',
  titleClosed
}: {
  prefix: TrackerPrefix;
  addMode: boolean;
  onOpen: () => void;
  titleOpen?: string;
  titleClosed: string;
}) {
  return (
    <button
      type="button"
      className={`${prefix}-chain-btn ${prefix}-chain-plus${addMode ? ` ${prefix}-chain-plus-disabled` : ''}`}
      title={addMode ? titleOpen : titleClosed}
      disabled={addMode}
      onClick={onOpen}
    >
      +
    </button>
  );
}

export function TrackerAddPanel({
  prefix,
  title,
  onClose,
  children
}: {
  prefix: TrackerPrefix;
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className={`${prefix}-add-panel`}>
      <div className={`${prefix}-add-header`}>
        <span className={`${prefix}-add-title`}>{title}</span>
        <button type="button" className={`${prefix}-add-close`} title="Close" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </div>
      {children}
    </div>
  );
}

/** Summary header: counts + remaining line + optional progress bar. */
export function TrackerSummary({
  prefix,
  today,
  target,
  remainingText,
  remainingClass = '',
  progressRatio,
  showProgress
}: {
  prefix: TrackerPrefix;
  today: ReactNode;
  target?: ReactNode;
  remainingText: ReactNode;
  remainingClass?: string;
  progressRatio?: number;
  showProgress?: boolean;
}) {
  return (
    <div className={`${prefix}-summary`}>
      <div className={`${prefix}-counts`}>
        <span className={`${prefix}-today`}>{today}</span>
        {target != null ? (
          <>
            <span className={`${prefix}-sep`}> / </span>
            <span className={`${prefix}-target`}>{target}</span>
          </>
        ) : null}
      </div>
      <div className={`${prefix}-remaining${remainingClass}`}>{remainingText}</div>
      {showProgress && progressRatio != null ? (
        <div className={`${prefix}-progress`}>
          <div className={`${prefix}-progress-fill`} style={{ width: `${Math.round(progressRatio * 100)}%` }} />
        </div>
      ) : null}
    </div>
  );
}

/** Build chip row + optional trailing connector before plus, then plus button. */
export function buildTrackerChain(args: {
  chips: ReactNode[];
  plus: ReactNode;
  connectorBeforePlus?: boolean;
}): ReactNode[] {
  const items = withChainConnectors(args.chips);
  if (args.connectorBeforePlus !== false && items.length > 0) {
    items.push(<TdeeChainConnector key="c-plus" />);
  }
  items.push(args.plus);
  return items;
}
