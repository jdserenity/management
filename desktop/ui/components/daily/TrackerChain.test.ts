import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { buildTrackerChain, withChainConnectors } from '@/components/daily/TrackerChain';

describe('TrackerChain helpers', () => {
  it('withChainConnectors inserts connectors between chips', () => {
    const a = createElement('span', { key: 'a' }, 'a');
    const b = createElement('span', { key: 'b' }, 'b');
    const joined = withChainConnectors([a, b]);
    expect(joined).toHaveLength(3);
  });

  it('buildTrackerChain ends with plus and optional connector', () => {
    const chip = createElement('button', { key: 'c' }, 'chip');
    const plus = createElement('button', { key: 'p' }, '+');
    const chain = buildTrackerChain({ chips: [chip], plus });
    expect(chain.length).toBe(3); // chip, connector, plus
    const empty = buildTrackerChain({ chips: [], plus, connectorBeforePlus: true });
    expect(empty).toHaveLength(1); // plus only
  });
});
