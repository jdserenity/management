import type { PostureMetricsSnapshot } from '@/posture/batesPostureScore';
import { MetricBars } from '@/posture/postureUi';
import { postureTipLabel } from '@/lib/postureTipLabels';
import { Camera, CameraOff, Activity, Target, StopCircle, Lightbulb, Cpu, ZoomIn, X } from 'lucide-react';

type LiveAnalysis = {
  posture_score: number;
  recommendations: string[];
  confidence?: number;
  metrics?: PostureMetricsSnapshot;
};

export default function PostureLiveSidebar({
  isMonitoring,
  isWebcamReady,
  isModelInitialized,
  analysisResult,
  error,
  initializationProgress,
  isReadyForUI,
  calibrationStatus,
  calibratedImage,
  poorThreshold,
  onCalibrate,
  onRemoveBaseline,
  onOpenPreview
}: {
  isMonitoring: boolean;
  isWebcamReady: boolean;
  isModelInitialized: boolean;
  analysisResult: LiveAnalysis | null;
  error: string;
  initializationProgress: string;
  isReadyForUI: boolean;
  calibrationStatus: 'idle' | 'calibrating' | 'success' | 'error';
  calibratedImage: string | null;
  poorThreshold: number;
  onCalibrate: () => void;
  onRemoveBaseline: () => void;
  onOpenPreview: () => void;
}) {
  return (
    <div className="space-y-4">
      <section className="plugin-panel space-y-3">
        <div>
          <h2 className="plugin-panel-title">Tracking</h2>
          <p className="plugin-muted text-sm">Use the system tray to start or stop posture tracking.</p>
        </div>
        <div
          className={`w-full rounded-lg p-4 text-center font-semibold ${
            isMonitoring ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-muted text-muted-foreground'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            {isMonitoring ? <Activity className="h-5 w-5" /> : <StopCircle className="h-5 w-5" />}
            <span>{isMonitoring ? 'Tracking on' : 'Tracking off'}</span>
          </div>
        </div>
        <div className="flex justify-around text-sm">
          <span className={`flex items-center gap-1.5 ${isWebcamReady ? 'text-green-600 dark:text-green-400' : 'plugin-muted'}`}>
            <Camera className="h-4 w-4" />Camera {isWebcamReady ? 'ON' : 'OFF'}
          </span>
          <span className={`flex items-center gap-1.5 ${isModelInitialized ? 'text-green-600 dark:text-green-400' : 'plugin-muted'}`}>
            <Cpu className="h-4 w-4" />Model {isModelInitialized ? 'ON' : 'OFF'}
          </span>
        </div>
        {(error || initializationProgress) && (
          <div className="space-y-1 text-xs">
            {error ? <div className="rounded border border-destructive/20 bg-destructive/10 px-2 py-1 font-medium text-destructive">{error}</div> : null}
            {initializationProgress ? <div className="rounded border bg-muted px-2 py-1 plugin-muted">{initializationProgress}</div> : null}
          </div>
        )}
      </section>

      <section className="plugin-panel space-y-3">
        <div>
          <h2 className="plugin-panel-title">Live components</h2>
          <p className="plugin-muted text-sm">Seven weighted signals (Bates-style). Shown when a pose is visible.</p>
        </div>
        {analysisResult?.metrics ? (
          <MetricBars m={analysisResult.metrics} />
        ) : (
          <p className="plugin-muted flex items-center gap-2 text-sm">
            <CameraOff className="h-4 w-4" />
            Start tracking or show your upper body to see metrics.
          </p>
        )}
      </section>

      <section className="plugin-panel space-y-3">
        <div>
          <h2 className="plugin-panel-title flex items-center gap-2"><Lightbulb className="h-4 w-4" />Tips</h2>
          <p className="plugin-muted text-sm">Based on your latest score and component breakdown.</p>
        </div>
        {isMonitoring && analysisResult?.recommendations?.length ? (
          <ul className="list-inside list-disc space-y-1 text-sm plugin-muted">
            {analysisResult.recommendations.map((rec) => (
              <li key={rec}>{postureTipLabel(rec)}</li>
            ))}
          </ul>
        ) : (
          <p className="plugin-muted text-sm">Tips appear while tracking is on.</p>
        )}
      </section>

      <section className="plugin-panel space-y-3">
        <div>
          <h2 className="plugin-panel-title flex items-center gap-2"><Target className="h-4 w-4" />Baseline snapshot</h2>
          <p className="plugin-muted text-sm">Save a reference image and metric snapshot while sitting well.</p>
        </div>
        <button
          type="button"
          className="plugin-btn w-full"
          onClick={onCalibrate}
          disabled={!isReadyForUI || calibrationStatus === 'calibrating'}
        >
          {calibrationStatus === 'calibrating' ? 'Saving…' : 'Capture baseline'}
        </button>
        <p className="plugin-muted text-xs">
          Flags use your poor-posture threshold from Settings (default 60). Current: {poorThreshold}.
        </p>
        {calibrationStatus === 'success' ? <p className="text-xs text-green-600 dark:text-green-400">Saved.</p> : null}
        {calibrationStatus === 'error' ? <p className="text-xs text-destructive">Save failed.</p> : null}
        {calibratedImage ? (
          <div className="relative w-28 shrink-0">
            <button
              type="button"
              className="group relative aspect-[4/3] w-full overflow-hidden rounded-lg border-2 border-border"
              onClick={onOpenPreview}
            >
              <img src={calibratedImage} alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-opacity group-hover:bg-black/40 group-hover:opacity-100">
                <ZoomIn className="h-8 w-8 text-white" />
              </div>
            </button>
            <button
              type="button"
              className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-md"
              aria-label="Remove baseline photo"
              onClick={onRemoveBaseline}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
