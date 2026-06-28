import './syncBoot.css';

export type SyncBootPhase = 'local' | 'sync' | 'ready' | 'error';

type Props = {
  phase: SyncBootPhase;
  error?: string | null;
};

export default function SyncBootScreen({ phase, error }: Props) {
  if (phase === 'error') {
    return (
      <div className="sync-boot sync-boot--error" role="alert">
        <p className="sync-boot__title">Could not start</p>
        <p className="sync-boot__detail">{error}</p>
      </div>
    );
  }

  const detail = phase === 'sync' ? 'Getting data from server…' : 'Opening local storage…';
  return (
    <div className="sync-boot" aria-busy="true" aria-live="polite">
      <div className="sync-boot__spinner" aria-hidden="true" />
      <p className="sync-boot__title">Management</p>
      <p className="sync-boot__detail">{detail}</p>
    </div>
  );
}
