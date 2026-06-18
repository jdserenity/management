import type { ActiveFlowDocument } from '@mgmt/sync';
import { mergeActiveFlowDocument } from '@mgmt/sync';

export interface ActiveFlowStore {
  get(): Promise<ActiveFlowDocument | null>;
  put(doc: ActiveFlowDocument | null): Promise<ActiveFlowDocument | null>;
}

export class MemoryActiveFlowStore implements ActiveFlowStore {
  private doc: ActiveFlowDocument | null = null;

  async get(): Promise<ActiveFlowDocument | null> {
    return this.doc;
  }

  async put(doc: ActiveFlowDocument | null): Promise<ActiveFlowDocument | null> {
    if (!doc) {
      this.doc = null;
      return null;
    }
    this.doc = mergeActiveFlowDocument(this.doc, doc);
    return this.doc;
  }
}

export const parseActiveFlowDocument = (raw: string): ActiveFlowDocument | null => {
  try {
    const parsed = JSON.parse(raw) as ActiveFlowDocument;
    if (parsed?.version !== 1 || !parsed.flow || typeof parsed.phaseEndsAtMs !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
};
