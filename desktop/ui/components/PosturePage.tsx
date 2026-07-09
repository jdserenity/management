import React from 'react';
import Webcam from 'react-webcam';
import { usePostureSession } from '@/context/PostureSessionContext';
import { getPostureRingClass } from '@/posture/postureUi';
import { usePosturePage } from '@/hooks/usePosturePage';
import PostureHistoryPanel from '@/components/posture/PostureHistoryPanel';
import PostureSessionPanel from '@/components/posture/PostureSessionPanel';
import PostureLiveSidebar from '@/components/posture/PostureLiveSidebar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const PosturePage: React.FC = () => {
  const { scoreHistory, monitoringSinceSec } = usePostureSession();
  const p = usePosturePage();

  return (
    <div className="plugin-page plugin-page-wide space-y-4 pb-4">
      <div>
        <h1 className="plugin-section-title text-xl">Posture</h1>
        <p className="plugin-muted mt-1">Live score, detailed metrics, session stats, and history from your posture log.</p>
        {p.isMonitoring && p.cameraYieldPaused && (
          <p className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
            Tracking is paused while another app uses the camera (e.g. a video call). It will resume automatically.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <div className="plugin-panel overflow-hidden !p-0">
            <div className="group relative">
              {p.shouldUseBackendPreview ? (
                p.backendPreviewFrame ? (
                  <img src={p.backendPreviewFrame} alt="Camera preview" className="aspect-video h-full w-full bg-muted object-contain transition-all" />
                ) : (
                  <div className="flex aspect-video w-full items-center justify-center bg-muted text-sm plugin-muted">Waiting for camera frame…</div>
                )
              ) : (
                <Webcam
                  ref={p.webcamRef}
                  audio={false}
                  videoConstraints={p.videoConstraints}
                  onUserMedia={p.onUserMedia}
                  onUserMediaError={p.onUserMediaError}
                  className="aspect-video h-full w-full bg-muted object-contain transition-all"
                  screenshotFormat="image/jpeg"
                />
              )}
              <div className={`pointer-events-none absolute inset-0 ring-4 ring-inset transition-all ${getPostureRingClass(p.isMonitoring ? p.analysisResult?.posture_score : null)}`} />
              {p.isMonitoring && p.analysisResult && (
                <div className="absolute bottom-4 left-4 min-w-[8rem] rounded-lg bg-black/60 p-4 text-left text-white backdrop-blur-sm">
                  <p className="text-xs font-medium opacity-90">Score</p>
                  <p className="text-4xl font-bold tabular-nums">
                    {p.analysisResult.posture_score}
                    <span className="text-xl font-normal">/100</span>
                  </p>
                  {p.analysisResult.confidence != null && (
                    <p className="mt-1 text-xs opacity-80">Confidence: {Math.round((p.analysisResult.confidence ?? 0) * 100)}%</p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <PostureSessionPanel
              isMonitoring={p.isMonitoring}
              historyRows={p.historyRows}
              monitoringSinceSec={monitoringSinceSec}
              scoreHistory={scoreHistory}
            />
            <PostureHistoryPanel
              historyRows={p.historyRows}
              historyLoading={p.historyLoading}
              onRefresh={() => void p.refreshHistory()}
            />
          </div>

          {p.isMonitoring && scoreHistory.length > 1 && (
            <section className="plugin-panel space-y-2">
              <div>
                <h2 className="plugin-panel-title">Recent samples</h2>
                <p className="plugin-muted text-sm">Short-term score strip for this run.</p>
              </div>
              <div className="flex h-16 items-end gap-px">
                {scoreHistory.map((s, i) => (
                  <div
                    key={`${i}-${s}`}
                    className="min-w-0 flex-1 rounded-sm bg-primary/75"
                    style={{ height: `${Math.max(4, (s / 100) * 100)}%` }}
                    title={`${s}`}
                  />
                ))}
              </div>
            </section>
          )}
        </div>

        <PostureLiveSidebar
          isMonitoring={p.isMonitoring}
          isWebcamReady={p.isWebcamReady}
          isModelInitialized={p.isModelInitialized}
          analysisResult={p.analysisResult}
          error={p.error}
          initializationProgress={p.initializationProgress}
          isReadyForUI={p.isReadyForUI}
          calibrationStatus={p.calibrationStatus}
          calibratedImage={p.calibratedImage}
          poorThreshold={p.poorThreshold}
          onCalibrate={() => void p.handleCalibrate()}
          onRemoveBaseline={() => void p.handleRemoveBaseline()}
          onOpenPreview={() => p.setIsPreviewOpen(true)}
        />
      </div>

      <Dialog open={p.isPreviewOpen} onOpenChange={p.setIsPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Baseline reference</DialogTitle>
          </DialogHeader>
          {p.calibratedImage && (
            <>
              <img src={p.calibratedImage} alt="" className="aspect-video w-full rounded-lg object-contain" />
              <button type="button" className="plugin-btn w-full text-destructive" onClick={() => void p.handleRemoveBaseline()}>
                Remove baseline photo
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>

      <div className="pb-2 pt-4">
        <button
          type="button"
          disabled={p.monitoringBusy}
          onClick={() => void p.togglePostureMonitoring()}
          className={
            p.isMonitoring
              ? 'plugin-btn h-12 w-full text-base font-semibold bg-red-600 text-white hover:bg-red-700'
              : 'plugin-btn plugin-btn-primary h-12 w-full text-base font-semibold'
          }
        >
          {p.monitoringBusy ? 'Please wait…' : p.isMonitoring ? 'Stop posture tracking' : 'Start posture tracking'}
        </button>
      </div>
    </div>
  );
};

export default PosturePage;
