import React, { useRef, useCallback, useState, useEffect, useMemo } from 'react';
import Webcam from 'react-webcam';
import { postureTipLabel } from '@/lib/postureTipLabels';
import { listen } from '@tauri-apps/api/event';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { platform } from '@tauri-apps/plugin-os';
import { load, Store } from '@tauri-apps/plugin-store';
import { isPostureMonitoringEnabledPref, setPostureMonitoringEnabledPref } from '@/lib/postureMonitoringPref';
import { clearPostureBaselineMetrics, POSTURE_BASELINE_IMAGE_STORE_KEY, POSTURE_BASELINE_METRICS_KEY } from '@/lib/postureBaseline';
import { analyzeDataUrl, initPoseLandmarker } from '@/posture/postureEngine';
import type { PostureMetricsSnapshot } from '@/posture/batesPostureScore';
import { usePostureSession } from '@/context/PostureSessionContext';
import { fetchPostureLogsLastDays, type PostureLogRow } from '@/posture/postureLogDb';
import {
  getPostureRingClass,
  isValidPreviewFramePayload,
  MetricBars,
  resolveSelectedCameraDeviceId
} from '@/posture/postureUi';
import { MGMT_LS } from '@/lib/mgmtLocalStorage';
import PostureHistoryPanel from '@/components/posture/PostureHistoryPanel';
import PostureSessionPanel from '@/components/posture/PostureSessionPanel';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Camera, CameraOff, Activity, Target, StopCircle, Lightbulb, Cpu, ZoomIn, X } from 'lucide-react';

interface MonitoringStatus {
  active: boolean;
  camera_yield_paused?: boolean;
}

interface LiveAnalysis {
  turtle_neck: boolean;
  shoulder_misalignment: boolean;
  posture_score: number;
  recommendations: string[];
  confidence?: number;
  metrics?: PostureMetricsSnapshot;
}

const PosturePage: React.FC = () => {
  const { scoreHistory, monitoringSinceSec } = usePostureSession();
  const [store, setStore] = useState<Store | null>(null);
  const webcamRef = useRef<Webcam>(null);
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [isWebcamReady, setIsWebcamReady] = useState(false);
  const [isModelInitialized, setIsModelInitialized] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<LiveAnalysis | null>(null);
  const [error, setError] = useState<string>('');
  const [initializationProgress, setInitializationProgress] = useState<string>('');
  const [calibrationStatus, setCalibrationStatus] = useState<'idle' | 'calibrating' | 'success' | 'error'>('idle');
  const [calibratedImage, setCalibratedImage] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(undefined);
  const [currentPlatform, setCurrentPlatform] = useState<string>('unknown');
  const [backendPreviewFrame, setBackendPreviewFrame] = useState<string | null>(null);
  const [useBackendPreview, setUseBackendPreview] = useState(false);
  const [historyRows, setHistoryRows] = useState<PostureLogRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [cameraYieldPaused, setCameraYieldPaused] = useState(false);
  const [monitoringBusy, setMonitoringBusy] = useState(false);

  const shouldUseBackendPreview = useBackendPreview || (isMonitoring && currentPlatform === 'windows');

  const videoConstraints = useMemo(
    () => ({ facingMode: 'user', deviceId: selectedDeviceId }),
    [selectedDeviceId],
  );

  const refreshHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const rows = await fetchPostureLogsLastDays(30);
      setHistoryRows(rows);
    } catch (e) {
      console.error(e);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  useEffect(() => {
    let cancelled = false;
    const resolve = async () => {
      try {
        const id = await resolveSelectedCameraDeviceId();
        if (!cancelled) setSelectedDeviceId(id);
      } catch (deviceError) {
        if (!cancelled) setSelectedDeviceId(undefined);
        console.error(deviceError);
      }
    };
    void resolve();
    const handleDeviceChange = () => { void resolve(); };
    navigator.mediaDevices?.addEventListener?.('devicechange', handleDeviceChange);
    return () => {
      cancelled = true;
      navigator.mediaDevices?.removeEventListener?.('devicechange', handleDeviceChange);
    };
  }, []);

  const initializeModel = useCallback(async () => {
    if (isModelInitialized) return;
    try {
      setInitializationProgress('Loading pose model…');
      await invoke('initialize_pose_model');
      await initPoseLandmarker();
      setIsModelInitialized(true);
      setInitializationProgress('');
    } catch (err) {
      console.error(err);
      setError('Could not load the pose model. Check your network for first-time WASM download.');
      setInitializationProgress('');
    }
  }, [isModelInitialized]);

  const handleCalibrate = useCallback(async () => {
    const hasCaptureSource = Boolean(webcamRef.current) || Boolean(shouldUseBackendPreview && backendPreviewFrame);
    if (!hasCaptureSource || !isModelInitialized || !store) {
      setError('Camera, model, or storage is not ready.');
      return;
    }
    setCalibrationStatus('calibrating');
    setError('');
    try {
      const imageSrc =
        shouldUseBackendPreview && backendPreviewFrame ? backendPreviewFrame : webcamRef.current?.getScreenshot();
      if (!imageSrc) throw new Error('Could not capture an image.');
      const snapshot = await analyzeDataUrl(imageSrc);
      if (!snapshot) throw new Error('No pose detected in this frame.');
      localStorage.setItem(POSTURE_BASELINE_METRICS_KEY, JSON.stringify({ capturedAt: Date.now(), metrics: snapshot.metrics }));
      const filePath = await invoke<string>('save_calibrated_image', { imageData: imageSrc });
      await invoke('clear_posture_debouncer');
      const imageUrl = convertFileSrc(filePath);
      const cacheBustedUrl = `${imageUrl}?t=${new Date().getTime()}`;
      await store.set(POSTURE_BASELINE_IMAGE_STORE_KEY, filePath);
      await store.save();
      setCalibratedImage(cacheBustedUrl);
      setCalibrationStatus('success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Calibration failed: ${errorMessage}`);
      setCalibrationStatus('error');
    } finally {
      setTimeout(() => setCalibrationStatus('idle'), 3000);
    }
  }, [backendPreviewFrame, isModelInitialized, shouldUseBackendPreview, store]);

  const handleRemoveBaseline = useCallback(async () => {
    if (!store) {
      setError('Camera, model, or storage is not ready.');
      return;
    }
    setError('');
    try {
      const savedImagePath = await store.get<string>(POSTURE_BASELINE_IMAGE_STORE_KEY);
      if (savedImagePath) await invoke('delete_calibrated_image', { filePath: savedImagePath });
      await store.delete(POSTURE_BASELINE_IMAGE_STORE_KEY);
      await store.save();
      clearPostureBaselineMetrics();
      setCalibratedImage(null);
      setIsPreviewOpen(false);
      setCalibrationStatus('idle');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Could not remove baseline: ${errorMessage}`);
      setCalibrationStatus('error');
    }
  }, [store]);

  useEffect(() => {
    try {
      setCurrentPlatform(platform());
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    void isPostureMonitoringEnabledPref().then(setIsMonitoring);
  }, []);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const storeInstance = await load('.settings.dat');
        setStore(storeInstance);
        const savedImagePath = await storeInstance.get<string>(POSTURE_BASELINE_IMAGE_STORE_KEY);
        if (savedImagePath) {
          const imageUrl = convertFileSrc(savedImagePath);
          setCalibratedImage(`${imageUrl}?t=${new Date().getTime()}`);
        }
        const status = await invoke<MonitoringStatus>('get_monitoring_status');
        setIsMonitoring(status.active);
        setCameraYieldPaused(Boolean(status.camera_yield_paused));
        if (!status.active) setAnalysisResult(null);
      } catch (err) {
        console.error(err);
      }
    };
    void loadInitialData();

    const unlistenPromises = Promise.all([
      listen<string>('posture-alert', (event) => {
        window.dispatchEvent(new CustomEvent('mgmt-posture-toast', { detail: event.payload }));
      }),
      listen<{ active: boolean }>('monitoring-state-changed', (event) => {
        const nextActive = event.payload.active;
        setIsMonitoring(nextActive);
        if (!nextActive) {
          setCameraYieldPaused(false);
          setAnalysisResult(null);
          setBackendPreviewFrame(null);
          setUseBackendPreview(false);
        }
      }),
      listen<{ paused: boolean }>('camera-yield-changed', (event) => {
        setCameraYieldPaused(Boolean(event.payload?.paused));
      }),
      listen<string>('camera-preview-frame', (event) => {
        const framePayload = event.payload?.trim();
        if (!framePayload || !isValidPreviewFramePayload(framePayload)) return;
        setBackendPreviewFrame(framePayload);
        setIsWebcamReady(true);
        setError('');
      }),
      listen<Record<string, unknown>>('analysis-update', (event) => {
        const p = event.payload;
        setAnalysisResult({
          turtle_neck: Boolean(p.turtle_neck),
          shoulder_misalignment: Boolean(p.shoulder_misalignment),
          posture_score: Number(p.posture_score ?? 0),
          recommendations: (p.recommendations as string[]) ?? [],
          confidence: typeof p.confidence === 'number' ? p.confidence : undefined,
          metrics: p.metrics && typeof p.metrics === 'object' ? (p.metrics as PostureMetricsSnapshot) : undefined,
        });
        void refreshHistory();
      }),
    ]);

    return () => {
      void unlistenPromises.then((uns) => uns.forEach((u) => u()));
    };
  }, [refreshHistory]);

  useEffect(() => {
    if (isWebcamReady && !isModelInitialized) void initializeModel();
  }, [isWebcamReady, isModelInitialized, initializeModel]);

  useEffect(() => {
    if (!isMonitoring) {
      setAnalysisResult(null);
      setBackendPreviewFrame(null);
      setUseBackendPreview(false);
    }
  }, [isMonitoring]);

  useEffect(() => {
    if (!isMonitoring || !shouldUseBackendPreview || backendPreviewFrame) return;
    invoke('request_preview_frame').catch(console.error);
  }, [backendPreviewFrame, isMonitoring, shouldUseBackendPreview]);

  const onUserMedia = useCallback(() => {
    setIsWebcamReady(true);
    setUseBackendPreview(false);
    setError('');
  }, []);

  const onUserMediaError = useCallback(async () => {
    setIsWebcamReady(false);
    setAnalysisResult(null);
    setUseBackendPreview(isMonitoring);
    if (isMonitoring) {
      setError('Using the tray camera preview instead.');
      return;
    }
    try {
      if ((await platform()) === 'linux') {
        setError('Failed to access the webcam on Linux. Make sure no other app is using the camera and re-select the camera in Settings.');
        return;
      }
    } catch (e) {
      console.error(e);
    }
    setError('Could not access the webcam.');
  }, [isMonitoring]);

  const isReadyForUI = isWebcamReady && isModelInitialized;

  const poorThreshold = Number.parseInt(localStorage.getItem(MGMT_LS.poorPostureThreshold) || '60', 10);

  const togglePostureMonitoring = useCallback(async () => {
    setMonitoringBusy(true);
    try {
      if (isMonitoring) {
        await invoke('stop_monitoring');
        await setPostureMonitoringEnabledPref(false);
        setIsMonitoring(false);
        setCameraYieldPaused(false);
      } else {
        await invoke('start_monitoring');
        await setPostureMonitoringEnabledPref(true);
        setIsMonitoring(true);
      }
    } catch (err) {
      console.error(err);
      setError('Could not change posture tracking.');
    } finally {
      setMonitoringBusy(false);
    }
  }, [isMonitoring]);

  return (
    <div className="plugin-page plugin-page-wide space-y-4 pb-4">
      <div>
        <h1 className="plugin-section-title text-xl">{'Posture'}</h1>
        <p className="plugin-muted mt-1">{'Live score, detailed metrics, session stats, and history from your posture log.'}</p>
        {isMonitoring && cameraYieldPaused && (
          <p className="text-sm text-amber-700 dark:text-amber-400 mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
            {'Tracking is paused while another app uses the camera (e.g. a video call). It will resume automatically.'}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <Card className="overflow-hidden">
            <div className="relative group">
              {shouldUseBackendPreview ? (
                backendPreviewFrame ? (
                  <img
                    src={backendPreviewFrame}
                    alt={'Camera preview'}
                    className="w-full h-full object-contain aspect-video transition-all bg-muted"
                  />
                ) : (
                  <div className="w-full aspect-video flex items-center justify-center bg-muted text-muted-foreground text-sm">
                    {'Waiting for camera frame…'}
                  </div>
                )
              ) : (
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  videoConstraints={videoConstraints}
                  onUserMedia={onUserMedia}
                  onUserMediaError={onUserMediaError}
                  className="w-full h-full object-contain aspect-video transition-all bg-muted"
                  screenshotFormat="image/jpeg"
                />
              )}
              <div className={`absolute inset-0 transition-all ring-4 ring-inset pointer-events-none ${getPostureRingClass(isMonitoring ? analysisResult?.posture_score : null)}`} />
              {isMonitoring && analysisResult && (
                <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm text-white p-4 rounded-lg text-left min-w-[8rem]">
                  <p className="text-xs font-medium opacity-90">{'Score'}</p>
                  <p className="text-4xl font-bold tabular-nums">
                    {analysisResult.posture_score}
                    <span className="text-xl font-normal">{'/100'}</span>
                  </p>
                  {analysisResult.confidence != null && (
                    <p className="text-xs mt-1 opacity-80">
                      {'Confidence'}: {Math.round((analysisResult.confidence ?? 0) * 100)}%
                    </p>
                  )}
                </div>
              )}
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <PostureSessionPanel
              isMonitoring={isMonitoring}
              historyRows={historyRows}
              monitoringSinceSec={monitoringSinceSec}
              scoreHistory={scoreHistory}
            />
            <PostureHistoryPanel
              historyRows={historyRows}
              historyLoading={historyLoading}
              onRefresh={() => void refreshHistory()}
            />
          </div>

          {isMonitoring && scoreHistory.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle>{'Recent samples'}</CardTitle>
                <CardDescription>{'Short-term score strip for this run.'}</CardDescription>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{'Tracking'}</CardTitle>
              <CardDescription>{'Use the system tray to start or stop posture tracking.'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className={`w-full p-4 rounded-lg text-center font-semibold ${
                  isMonitoring ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-muted text-muted-foreground'
                }`}
              >
                {isMonitoring ? (
                  <div className="flex items-center justify-center gap-2">
                    <Activity className="h-5 w-5" />
                    <span>{'Tracking on'}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <StopCircle className="h-5 w-5" />
                    <span>{'Tracking off'}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-around text-sm">
                <span className={`flex items-center gap-1.5 ${isWebcamReady ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                  <Camera className="h-4 w-4" />
                  {'Camera'} {isWebcamReady ? 'ON' : 'OFF'}
                </span>
                <span className={`flex items-center gap-1.5 ${isModelInitialized ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                  <Cpu className="h-4 w-4" />
                  {'Model'} {isModelInitialized ? 'ON' : 'OFF'}
                </span>
              </div>
              {(error || initializationProgress) && (
                <div className="space-y-1 text-xs">
                  {error && <div className="text-destructive font-medium px-2 py-1 rounded bg-destructive/10 border border-destructive/20">{error}</div>}
                  {initializationProgress && <div className="text-muted-foreground px-2 py-1 rounded bg-muted border">{initializationProgress}</div>}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{'Live components'}</CardTitle>
              <CardDescription>{'Seven weighted signals (Bates-style). Shown when a pose is visible.'}</CardDescription>
            </CardHeader>
            <CardContent>
              {analysisResult?.metrics ? (
                <MetricBars m={analysisResult.metrics} />
              ) : (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <CameraOff className="h-4 w-4" />
                  {'Start tracking or show your upper body to see metrics.'}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                {'Tips'}
              </CardTitle>
              <CardDescription>
                {'Based on your latest score and component breakdown.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isMonitoring && analysisResult?.recommendations?.length ? (
                <ul className="space-y-1 text-sm list-disc list-inside text-muted-foreground">
                  {analysisResult.recommendations.map((rec) => (
                    <li key={rec}>
                      {postureTipLabel(rec)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">{'Tips appear while tracking is on.'}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                {'Baseline snapshot'}
              </CardTitle>
              <CardDescription>{'Save a reference image and metric snapshot while sitting well.'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={() => void handleCalibrate()} disabled={!isReadyForUI || calibrationStatus === 'calibrating'} className="w-full" variant="outline">
                {calibrationStatus === 'calibrating' ? 'Saving…' : 'Capture baseline'}
              </Button>
              <p className="text-xs text-muted-foreground">
                {`Flags use your poor-posture threshold from Settings (default 60). Current: ${poorThreshold}.`}
              </p>
              {calibrationStatus === 'success' && <p className="text-xs text-green-600 dark:text-green-400">{'Saved.'}</p>}
              {calibrationStatus === 'error' && <p className="text-xs text-destructive">{'Save failed.'}</p>}
              {calibratedImage && (
                <div className="relative w-28 shrink-0">
                  <button
                    type="button"
                    className="relative w-full aspect-[4/3] rounded-lg overflow-hidden border-2 border-border group"
                    onClick={() => setIsPreviewOpen(true)}
                  >
                    <img src={calibratedImage} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <ZoomIn className="h-8 w-8 text-white" />
                    </div>
                  </button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-7 w-7 rounded-full shadow-md"
                    aria-label='Remove baseline photo'
                    onClick={() => void handleRemoveBaseline()}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{'Baseline reference'}</DialogTitle>
          </DialogHeader>
          {calibratedImage && (
            <>
              <img src={calibratedImage} alt="" className="rounded-lg w-full aspect-video object-contain" />
              <Button type="button" variant="destructive" className="w-full" onClick={() => void handleRemoveBaseline()}>
                'Remove baseline photo'
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>

      <div className="pt-4 pb-2">
        <Button
          type="button"
          size="lg"
          disabled={monitoringBusy}
          onClick={() => void togglePostureMonitoring()}
          className={
            isMonitoring
              ? 'w-full h-12 text-base font-semibold bg-red-600 hover:bg-red-700 text-white shadow-md'
              : 'w-full h-12 text-base font-semibold shadow-md'
          }
        >
          {monitoringBusy
            ? 'Please wait…'
            : isMonitoring
              ? 'Stop posture tracking'
              : 'Start posture tracking'}
        </Button>
      </div>
    </div>
  );
};

export default PosturePage;
