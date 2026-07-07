import React, { useRef, useCallback, useState, useEffect, useMemo } from 'react';
import Webcam from 'react-webcam';
import { useTranslation } from 'react-i18next';
import { listen } from '@tauri-apps/api/event';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { platform } from '@tauri-apps/plugin-os';
import { load, Store } from '@tauri-apps/plugin-store';
import { MGMT_LS } from '@/lib/mgmtLocalStorage';
import { isPostureMonitoringEnabledPref, setPostureMonitoringEnabledPref } from '@/lib/postureMonitoringPref';
import { clearPostureBaselineMetrics, POSTURE_BASELINE_IMAGE_STORE_KEY, POSTURE_BASELINE_METRICS_KEY } from '@/lib/postureBaseline';
import { analyzeDataUrl, initPoseLandmarker } from '@/posture/postureEngine';
import type { PostureMetricsSnapshot } from '@/posture/batesPostureScore';
import { usePostureSession } from '@/context/PostureSessionContext';
import { fetchPostureLogsLastDays, rowsToCsv, type PostureLogRow } from '@/posture/postureLogDb';
import { dailyAverageScores, longestGoodStreakCount, sessionStats } from '@/posture/postureAggregates';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Camera, CameraOff, Activity, Target, StopCircle, Lightbulb, Cpu, ZoomIn, Download, RefreshCw, X } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const GOOD_STREAK_SCORE = 65;

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

const CAMERA_INDEX_KEY = MGMT_LS.cameraIndex;
const CAMERA_NAME_KEY = MGMT_LS.cameraName;
const LEGACY_CAMERA_DEVICE_KEY = MGMT_LS.cameraDeviceLegacy;

const normalizeCameraName = (value: string): string =>
  value.toLowerCase().replace(/\s+/g, ' ').trim();

const isValidPreviewFramePayload = (payload: string): boolean =>
  payload.startsWith('data:image/') && payload.includes('base64,') && payload.length > 'data:image/jpeg;base64,'.length;

function MetricBars({ m, t }: { m: PostureMetricsSnapshot; t: (k: string, d: string) => string }) {
  const rows: { key: string; def: string; v: number }[] = [
    { key: 'posture.metric.headTilt', def: 'Head tilt (depth)', v: m.head_tilt_score },
    { key: 'posture.metric.neckVertical', def: 'Neck vs vertical', v: m.neck_vertical_score },
    { key: 'posture.metric.shoulderLevel', def: 'Shoulder level', v: m.shoulder_level_score },
    { key: 'posture.metric.shoulderRoll', def: 'Shoulder roll (depth)', v: m.shoulder_roll_score },
    { key: 'posture.metric.spine', def: 'Spine alignment', v: m.spine_alignment_score },
    { key: 'posture.metric.headRotation', def: 'Head rotation', v: m.head_rotation_score },
    { key: 'posture.metric.headSideTilt', def: 'Head side tilt', v: m.head_side_tilt_score },
  ];
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.key}>
          <div className="flex justify-between text-xs text-muted-foreground mb-0.5">
            <span>{t(row.key, row.def)}</span>
            <span className="tabular-nums">{Math.round(row.v * 100)}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${Math.round(row.v * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

const PosturePage: React.FC = () => {
  const { t } = useTranslation();
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
    const resolveSelectedDeviceId = async () => {
      if (!navigator.mediaDevices?.enumerateDevices) {
        if (!cancelled) setSelectedDeviceId(undefined);
        return;
      }
      try {
        const savedIndexRaw = localStorage.getItem(CAMERA_INDEX_KEY);
        const savedCameraName = localStorage.getItem(CAMERA_NAME_KEY);
        const legacyDeviceId = localStorage.getItem(LEGACY_CAMERA_DEVICE_KEY);
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((device) => device.kind === 'videoinput');
        let nextDeviceId: string | undefined;
        if (savedCameraName) {
          const normalizedTarget = normalizeCameraName(savedCameraName);
          const matchedByName =
            normalizedTarget.length > 0
              ? videoInputs.find((device) => {
                  const nl = normalizeCameraName(device.label);
                  return nl.length > 0 && (nl.includes(normalizedTarget) || normalizedTarget.includes(nl));
                })
              : undefined;
          if (matchedByName) nextDeviceId = matchedByName.deviceId;
        }
        if (!nextDeviceId && legacyDeviceId && videoInputs.some((d) => d.deviceId === legacyDeviceId)) {
          nextDeviceId = legacyDeviceId;
        }
        if (savedIndexRaw !== null) {
          const parsedIndex = Number.parseInt(savedIndexRaw, 10);
          if (!nextDeviceId && !Number.isNaN(parsedIndex) && parsedIndex >= 0 && parsedIndex < videoInputs.length) {
            nextDeviceId = videoInputs[parsedIndex].deviceId;
          }
        }
        if (!nextDeviceId && videoInputs.length > 0) nextDeviceId = videoInputs[0].deviceId;
        if (cancelled) return;
        setSelectedDeviceId(nextDeviceId);
        if (nextDeviceId) localStorage.setItem(LEGACY_CAMERA_DEVICE_KEY, nextDeviceId);
      } catch (deviceError) {
        if (!cancelled) setSelectedDeviceId(undefined);
        console.error(deviceError);
      }
    };
    void resolveSelectedDeviceId();
    const handleDeviceChange = () => {
      void resolveSelectedDeviceId();
    };
    navigator.mediaDevices?.addEventListener?.('devicechange', handleDeviceChange);
    return () => {
      cancelled = true;
      navigator.mediaDevices?.removeEventListener?.('devicechange', handleDeviceChange);
    };
  }, []);

  const initializeModel = useCallback(async () => {
    if (isModelInitialized) return;
    try {
      setInitializationProgress(t('posture.initModel', 'Loading pose model…'));
      await invoke('initialize_pose_model');
      await initPoseLandmarker();
      setIsModelInitialized(true);
      setInitializationProgress('');
    } catch (err) {
      console.error(err);
      setError(t('posture.initModelError', 'Could not load the pose model. Check your network for first-time WASM download.'));
      setInitializationProgress('');
    }
  }, [isModelInitialized, t]);

  const handleCalibrate = useCallback(async () => {
    const hasCaptureSource = Boolean(webcamRef.current) || Boolean(shouldUseBackendPreview && backendPreviewFrame);
    if (!hasCaptureSource || !isModelInitialized || !store) {
      setError(t('posture.calibrationNotReady', 'Camera, model, or storage is not ready.'));
      return;
    }
    setCalibrationStatus('calibrating');
    setError('');
    try {
      const imageSrc =
        shouldUseBackendPreview && backendPreviewFrame ? backendPreviewFrame : webcamRef.current?.getScreenshot();
      if (!imageSrc) throw new Error(t('posture.captureError', 'Could not capture an image.'));
      const snapshot = await analyzeDataUrl(imageSrc);
      if (!snapshot) throw new Error(t('posture.calibrationNoPose', 'No pose detected in this frame.'));
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
      setError(t('posture.calibrationError', { error: errorMessage }));
      setCalibrationStatus('error');
    } finally {
      setTimeout(() => setCalibrationStatus('idle'), 3000);
    }
  }, [backendPreviewFrame, isModelInitialized, shouldUseBackendPreview, store, t]);

  const handleRemoveBaseline = useCallback(async () => {
    if (!store) {
      setError(t('posture.calibrationNotReady', 'Camera, model, or storage is not ready.'));
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
      setError(t('posture.removeBaselineError', { error: errorMessage }));
      setCalibrationStatus('error');
    }
  }, [store, t]);

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
      setError(t('posture.previewFallback', 'Using the tray camera preview instead.'));
      return;
    }
    try {
      if ((await platform()) === 'linux') {
        setError(t('settings.cameraPermissionLinux'));
        return;
      }
    } catch (e) {
      console.error(e);
    }
    setError(t('posture.permissionError', 'Could not access the webcam.'));
  }, [isMonitoring, t]);

  const getPostureRingClass = (score?: number | null): string => {
    if (score == null) return 'ring-slate-300';
    if (score >= 80) return 'ring-emerald-500';
    if (score >= 60) return 'ring-amber-500';
    return 'ring-red-500';
  };

  const isReadyForUI = isWebcamReady && isModelInitialized;

  const sessionDbRows = useMemo(() => {
    if (!monitoringSinceSec) return [];
    return historyRows.filter((r) => r.timestamp >= monitoringSinceSec);
  }, [historyRows, monitoringSinceSec]);

  const sessionAgg = useMemo(() => {
    const fromDb = sessionStats(sessionDbRows.map((r) => ({ score: r.score })));
    if (fromDb && fromDb.count > 0) return fromDb;
    return sessionStats(scoreHistory.map((s) => ({ score: s })));
  }, [sessionDbRows, scoreHistory]);

  const streakSamples = useMemo(() => {
    if (sessionDbRows.length)
      return longestGoodStreakCount(sessionDbRows.map((r) => ({ score: r.score })), GOOD_STREAK_SCORE);
    return longestGoodStreakCount(scoreHistory.map((s) => ({ score: s })), GOOD_STREAK_SCORE);
  }, [sessionDbRows, scoreHistory]);

  const chartData = useMemo(() => {
    const pts = historyRows.map((r) => ({ score: r.score, timestamp: r.timestamp }));
    return dailyAverageScores(pts, 14).map((d) => ({ label: d.day.slice(5), avg: d.avg, n: d.count }));
  }, [historyRows]);

  const exportCsv = useCallback(() => {
    const csv = rowsToCsv(historyRows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `posture_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [historyRows]);

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
      setError(t('posture.monitoringToggleError', 'Could not change posture tracking.'));
    } finally {
      setMonitoringBusy(false);
    }
  }, [isMonitoring, t]);

  return (
    <div className="space-y-6 pb-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('posture.title', 'Posture')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('posture.subtitle', 'Live score, detailed metrics, session stats, and history from your posture log.')}</p>
        {isMonitoring && cameraYieldPaused && (
          <p className="text-sm text-amber-700 dark:text-amber-400 mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
            {t('posture.cameraYieldPaused', 'Tracking is paused while another app uses the camera (e.g. a video call). It will resume automatically.')}
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
                    alt={t('posture.previewAlt', 'Camera preview')}
                    className="w-full h-full object-contain aspect-video transition-all bg-muted"
                  />
                ) : (
                  <div className="w-full aspect-video flex items-center justify-center bg-muted text-muted-foreground text-sm">
                    {t('posture.waitingPreview', 'Waiting for camera frame…')}
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
                  <p className="text-xs font-medium opacity-90">{t('posture.scoreLabel', 'Score')}</p>
                  <p className="text-4xl font-bold tabular-nums">
                    {analysisResult.posture_score}
                    <span className="text-xl font-normal">{t('dashboard.scoreUnit', '/100')}</span>
                  </p>
                  {analysisResult.confidence != null && (
                    <p className="text-xs mt-1 opacity-80">
                      {t('posture.confidence', 'Confidence')}: {Math.round((analysisResult.confidence ?? 0) * 100)}%
                    </p>
                  )}
                </div>
              )}
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('posture.sessionTitle', 'This session')}</CardTitle>
                <CardDescription>{t('posture.sessionDesc', 'While tray tracking is on, samples are stored to your posture log.')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {!isMonitoring ? (
                  <p className="text-muted-foreground">{t('posture.sessionInactive', 'Use the button below to start posture tracking.')}</p>
                ) : sessionAgg ? (
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <dt className="text-muted-foreground">{t('posture.sessionAvg', 'Avg score')}</dt>
                    <dd className="font-semibold tabular-nums text-right">{sessionAgg.avg}</dd>
                    <dt className="text-muted-foreground">{t('posture.sessionMin', 'Min')}</dt>
                    <dd className="font-semibold tabular-nums text-right">{sessionAgg.min}</dd>
                    <dt className="text-muted-foreground">{t('posture.sessionMax', 'Max')}</dt>
                    <dd className="font-semibold tabular-nums text-right">{sessionAgg.max}</dd>
                    <dt className="text-muted-foreground">{t('posture.sessionCount', 'Samples')}</dt>
                    <dd className="font-semibold tabular-nums text-right">{sessionAgg.count}</dd>
                  </dl>
                ) : (
                  <p className="text-muted-foreground">{t('posture.noSamples', 'No samples yet.')}</p>
                )}
                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-1">{t('posture.streakTitle', 'Good-posture streak')}</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {streakSamples}{' '}
                    <span className="text-sm font-normal text-muted-foreground">
                      {t('posture.streakUnit', 'consecutive samples')} ≥ {GOOD_STREAK_SCORE}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{t('posture.streakDesc', 'Bates-style streak: consecutive stored samples at or above the good threshold.')}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                  <CardTitle>{t('posture.historyTitle', 'History')}</CardTitle>
                  <CardDescription>{t('posture.historyDesc', 'Daily average score (last 14 days with data).')}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => void refreshHistory()} disabled={historyLoading}>
                    <RefreshCw className={`h-4 w-4 mr-1 ${historyLoading ? 'animate-spin' : ''}`} />
                    {t('posture.refresh', 'Refresh')}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={exportCsv} disabled={!historyRows.length}>
                    <Download className="h-4 w-4 mr-1" />
                    {t('posture.exportCsv', 'Export CSV')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="h-56">
                {chartData.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">{t('posture.noHistory', 'No posture log data yet.')}</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} width={32} />
                      <Tooltip
                        formatter={(value) => {
                          const n = typeof value === 'number' ? value : Number(value);
                          return [`${Number.isFinite(n) ? n : '—'}`, t('posture.chartAvg', 'Daily avg')];
                        }}
                      />
                      <Line type="monotone" dataKey="avg" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name={t('posture.chartLine', 'Avg score')} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {isMonitoring && scoreHistory.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle>{t('posture.sparkTitle', 'Recent samples')}</CardTitle>
                <CardDescription>{t('posture.sparkDesc', 'Short-term score strip for this run.')}</CardDescription>
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
              <CardTitle>{t('posture.trackingTitle', 'Tracking')}</CardTitle>
              <CardDescription>{t('posture.trayHint', 'Use the system tray to start or stop posture tracking.')}</CardDescription>
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
                    <span>{t('posture.trackingOn', 'Tracking on')}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <StopCircle className="h-5 w-5" />
                    <span>{t('posture.trackingOff', 'Tracking off')}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-around text-sm">
                <span className={`flex items-center gap-1.5 ${isWebcamReady ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                  <Camera className="h-4 w-4" />
                  {t('posture.camera', 'Camera')} {isWebcamReady ? 'ON' : 'OFF'}
                </span>
                <span className={`flex items-center gap-1.5 ${isModelInitialized ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                  <Cpu className="h-4 w-4" />
                  {t('posture.model', 'Model')} {isModelInitialized ? 'ON' : 'OFF'}
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
              <CardTitle>{t('posture.metricsTitle', 'Live components')}</CardTitle>
              <CardDescription>{t('posture.metricsDesc', 'Seven weighted signals (Bates-style). Shown when a pose is visible.')}</CardDescription>
            </CardHeader>
            <CardContent>
              {analysisResult?.metrics ? (
                <MetricBars m={analysisResult.metrics} t={t} />
              ) : (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <CameraOff className="h-4 w-4" />
                  {t('posture.metricsWaiting', 'Start tracking or show your upper body to see metrics.')}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                {t('posture.insightsTitle', 'Tips')}
              </CardTitle>
              <CardDescription>
                {t('posture.insightsDesc', 'Based on your latest score and component breakdown.')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isMonitoring && analysisResult?.recommendations?.length ? (
                <ul className="space-y-1 text-sm list-disc list-inside text-muted-foreground">
                  {analysisResult.recommendations.map((rec) => (
                    <li key={rec}>
                      {t(rec.includes('.') ? `dashboard.${rec}` : `dashboard.tips.${rec}`)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">{t('posture.tipsIdle', 'Tips appear while tracking is on.')}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                {t('posture.calibrationTitle', 'Baseline snapshot')}
              </CardTitle>
              <CardDescription>{t('posture.calibrationDesc', 'Save a reference image and metric snapshot while sitting well.')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={() => void handleCalibrate()} disabled={!isReadyForUI || calibrationStatus === 'calibrating'} className="w-full" variant="outline">
                {calibrationStatus === 'calibrating' ? t('posture.saving', 'Saving…') : t('posture.calibrateButton', 'Capture baseline')}
              </Button>
              <p className="text-xs text-muted-foreground">
                {t('posture.poorThresholdHint', 'Flags use your poor-posture threshold from Settings (default 60). Current: {{n}}.', { n: poorThreshold })}
              </p>
              {calibrationStatus === 'success' && <p className="text-xs text-green-600 dark:text-green-400">{t('posture.saveOk', 'Saved.')}</p>}
              {calibrationStatus === 'error' && <p className="text-xs text-destructive">{t('posture.saveFail', 'Save failed.')}</p>}
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
                    aria-label={t('posture.removeBaseline', 'Remove baseline photo')}
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
            <DialogTitle>{t('posture.baselinePreview', 'Baseline reference')}</DialogTitle>
          </DialogHeader>
          {calibratedImage && (
            <>
              <img src={calibratedImage} alt="" className="rounded-lg w-full aspect-video object-contain" />
              <Button type="button" variant="destructive" className="w-full" onClick={() => void handleRemoveBaseline()}>
                {t('posture.removeBaseline', 'Remove baseline photo')}
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
            ? t('posture.monitoringBusy', 'Please wait…')
            : isMonitoring
              ? t('posture.stopTracking', 'Stop posture tracking')
              : t('posture.startTracking', 'Start posture tracking')}
        </Button>
      </div>
    </div>
  );
};

export default PosturePage;
