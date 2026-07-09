import { useRef, useCallback, useState, useEffect, useMemo } from 'react';
import type Webcam from 'react-webcam';
import { listen } from '@tauri-apps/api/event';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { platform } from '@tauri-apps/plugin-os';
import { load, type Store } from '@tauri-apps/plugin-store';
import { isPostureMonitoringEnabledPref, setPostureMonitoringEnabledPref } from '@/lib/postureMonitoringPref';
import { clearPostureBaselineMetrics, POSTURE_BASELINE_IMAGE_STORE_KEY, POSTURE_BASELINE_METRICS_KEY } from '@/lib/postureBaseline';
import { analyzeDataUrl, initPoseLandmarker } from '@/posture/postureEngine';
import type { PostureMetricsSnapshot } from '@/posture/batesPostureScore';
import { fetchPostureLogsLastDays, type PostureLogRow } from '@/posture/postureLogDb';
import { isValidPreviewFramePayload, resolveSelectedCameraDeviceId } from '@/posture/postureUi';
import { MGMT_LS } from '@/lib/mgmtLocalStorage';

type MonitoringStatus = { active: boolean; camera_yield_paused?: boolean };

export type LiveAnalysis = {
  turtle_neck: boolean;
  shoulder_misalignment: boolean;
  posture_score: number;
  recommendations: string[];
  confidence?: number;
  metrics?: PostureMetricsSnapshot;
};

/** Camera, monitoring, baseline, and history state for the Posture tab. */
export function usePosturePage() {
  const [store, setStore] = useState<Store | null>(null);
  const webcamRef = useRef<Webcam>(null);
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [isWebcamReady, setIsWebcamReady] = useState(false);
  const [isModelInitialized, setIsModelInitialized] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<LiveAnalysis | null>(null);
  const [error, setError] = useState('');
  const [initializationProgress, setInitializationProgress] = useState('');
  const [calibrationStatus, setCalibrationStatus] = useState<'idle' | 'calibrating' | 'success' | 'error'>('idle');
  const [calibratedImage, setCalibratedImage] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>();
  const [currentPlatform, setCurrentPlatform] = useState('unknown');
  const [backendPreviewFrame, setBackendPreviewFrame] = useState<string | null>(null);
  const [useBackendPreview, setUseBackendPreview] = useState(false);
  const [historyRows, setHistoryRows] = useState<PostureLogRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [cameraYieldPaused, setCameraYieldPaused] = useState(false);
  const [monitoringBusy, setMonitoringBusy] = useState(false);

  const shouldUseBackendPreview = useBackendPreview || (isMonitoring && currentPlatform === 'windows');
  const videoConstraints = useMemo(() => ({ facingMode: 'user' as const, deviceId: selectedDeviceId }), [selectedDeviceId]);
  const isReadyForUI = isWebcamReady && isModelInitialized;
  const poorThreshold = Number.parseInt(localStorage.getItem(MGMT_LS.poorPostureThreshold) || '60', 10);

  const refreshHistory = useCallback(async () => {
    setHistoryLoading(true);
    try { setHistoryRows(await fetchPostureLogsLastDays(30)); }
    catch (e) { console.error(e); }
    finally { setHistoryLoading(false); }
  }, []);

  useEffect(() => { void refreshHistory(); }, [refreshHistory]);

  useEffect(() => {
    let cancelled = false;
    const resolve = async () => {
      try {
        const id = await resolveSelectedCameraDeviceId();
        if (!cancelled) setSelectedDeviceId(id);
      } catch (e) {
        if (!cancelled) setSelectedDeviceId(undefined);
        console.error(e);
      }
    };
    void resolve();
    const onChange = () => { void resolve(); };
    navigator.mediaDevices?.addEventListener?.('devicechange', onChange);
    return () => {
      cancelled = true;
      navigator.mediaDevices?.removeEventListener?.('devicechange', onChange);
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
    const hasCapture = Boolean(webcamRef.current) || Boolean(shouldUseBackendPreview && backendPreviewFrame);
    if (!hasCapture || !isModelInitialized || !store) { setError('Camera, model, or storage is not ready.'); return; }
    setCalibrationStatus('calibrating');
    setError('');
    try {
      const imageSrc = shouldUseBackendPreview && backendPreviewFrame ? backendPreviewFrame : webcamRef.current?.getScreenshot();
      if (!imageSrc) throw new Error('Could not capture an image.');
      const snapshot = await analyzeDataUrl(imageSrc);
      if (!snapshot) throw new Error('No pose detected in this frame.');
      localStorage.setItem(POSTURE_BASELINE_METRICS_KEY, JSON.stringify({ capturedAt: Date.now(), metrics: snapshot.metrics }));
      const filePath = await invoke<string>('save_calibrated_image', { imageData: imageSrc });
      await invoke('clear_posture_debouncer');
      const cacheBustedUrl = `${convertFileSrc(filePath)}?t=${Date.now()}`;
      await store.set(POSTURE_BASELINE_IMAGE_STORE_KEY, filePath);
      await store.save();
      setCalibratedImage(cacheBustedUrl);
      setCalibrationStatus('success');
    } catch (err) {
      setError(`Calibration failed: ${err instanceof Error ? err.message : String(err)}`);
      setCalibrationStatus('error');
    } finally {
      setTimeout(() => setCalibrationStatus('idle'), 3000);
    }
  }, [backendPreviewFrame, isModelInitialized, shouldUseBackendPreview, store]);

  const handleRemoveBaseline = useCallback(async () => {
    if (!store) { setError('Camera, model, or storage is not ready.'); return; }
    setError('');
    try {
      const saved = await store.get<string>(POSTURE_BASELINE_IMAGE_STORE_KEY);
      if (saved) await invoke('delete_calibrated_image', { filePath: saved });
      await store.delete(POSTURE_BASELINE_IMAGE_STORE_KEY);
      await store.save();
      clearPostureBaselineMetrics();
      setCalibratedImage(null);
      setIsPreviewOpen(false);
      setCalibrationStatus('idle');
    } catch (err) {
      setError(`Could not remove baseline: ${err instanceof Error ? err.message : String(err)}`);
      setCalibrationStatus('error');
    }
  }, [store]);

  useEffect(() => { try { setCurrentPlatform(platform()); } catch (e) { console.error(e); } }, []);
  useEffect(() => { void isPostureMonitoringEnabledPref().then(setIsMonitoring); }, []);

  useEffect(() => {
    const boot = async () => {
      try {
        const storeInstance = await load('.settings.dat');
        setStore(storeInstance);
        const saved = await storeInstance.get<string>(POSTURE_BASELINE_IMAGE_STORE_KEY);
        if (saved) setCalibratedImage(`${convertFileSrc(saved)}?t=${Date.now()}`);
        const status = await invoke<MonitoringStatus>('get_monitoring_status');
        setIsMonitoring(status.active);
        setCameraYieldPaused(Boolean(status.camera_yield_paused));
        if (!status.active) setAnalysisResult(null);
      } catch (err) { console.error(err); }
    };
    void boot();
    const unlisten = Promise.all([
      listen<string>('posture-alert', (e) => {
        window.dispatchEvent(new CustomEvent('mgmt-posture-toast', { detail: e.payload }));
      }),
      listen<{ active: boolean }>('monitoring-state-changed', (e) => {
        setIsMonitoring(e.payload.active);
        if (!e.payload.active) {
          setCameraYieldPaused(false);
          setAnalysisResult(null);
          setBackendPreviewFrame(null);
          setUseBackendPreview(false);
        }
      }),
      listen<{ paused: boolean }>('camera-yield-changed', (e) => setCameraYieldPaused(Boolean(e.payload?.paused))),
      listen<string>('camera-preview-frame', (e) => {
        const frame = e.payload?.trim();
        if (!frame || !isValidPreviewFramePayload(frame)) return;
        setBackendPreviewFrame(frame);
        setIsWebcamReady(true);
        setError('');
      }),
      listen<Record<string, unknown>>('analysis-update', (e) => {
        const p = e.payload;
        setAnalysisResult({
          turtle_neck: Boolean(p.turtle_neck),
          shoulder_misalignment: Boolean(p.shoulder_misalignment),
          posture_score: Number(p.posture_score ?? 0),
          recommendations: (p.recommendations as string[]) ?? [],
          confidence: typeof p.confidence === 'number' ? p.confidence : undefined,
          metrics: p.metrics && typeof p.metrics === 'object' ? (p.metrics as PostureMetricsSnapshot) : undefined
        });
        void refreshHistory();
      })
    ]);
    return () => { void unlisten.then((fns) => fns.forEach((u) => u())); };
  }, [refreshHistory]);

  useEffect(() => { if (isWebcamReady && !isModelInitialized) void initializeModel(); }, [isWebcamReady, isModelInitialized, initializeModel]);
  useEffect(() => {
    if (!isMonitoring) { setAnalysisResult(null); setBackendPreviewFrame(null); setUseBackendPreview(false); }
  }, [isMonitoring]);
  useEffect(() => {
    if (!isMonitoring || !shouldUseBackendPreview || backendPreviewFrame) return;
    invoke('request_preview_frame').catch(console.error);
  }, [backendPreviewFrame, isMonitoring, shouldUseBackendPreview]);

  const onUserMedia = useCallback(() => { setIsWebcamReady(true); setUseBackendPreview(false); setError(''); }, []);
  const onUserMediaError = useCallback(async () => {
    setIsWebcamReady(false);
    setAnalysisResult(null);
    setUseBackendPreview(isMonitoring);
    if (isMonitoring) { setError('Using the tray camera preview instead.'); return; }
    try {
      if ((await platform()) === 'linux') {
        setError('Failed to access the webcam on Linux. Make sure no other app is using the camera and re-select the camera in Settings.');
        return;
      }
    } catch (e) { console.error(e); }
    setError('Could not access the webcam.');
  }, [isMonitoring]);

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

  return {
    webcamRef, isMonitoring, isWebcamReady, isModelInitialized, analysisResult, error, initializationProgress,
    calibrationStatus, calibratedImage, isPreviewOpen, setIsPreviewOpen, videoConstraints, shouldUseBackendPreview,
    backendPreviewFrame, historyRows, historyLoading, cameraYieldPaused, monitoringBusy, isReadyForUI, poorThreshold,
    refreshHistory, handleCalibrate, handleRemoveBaseline, onUserMedia, onUserMediaError, togglePostureMonitoring
  };
}
