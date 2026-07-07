import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { analyzeDataUrl, initPoseLandmarker } from '@/posture/postureEngine';
import { usePostureSession } from '@/context/PostureSessionContext';
import { isPostureMonitoringEnabledPref, setPostureMonitoringEnabledPref } from '@/lib/postureMonitoringPref';

/**
 * Runs MediaPipe pose on frames emitted by the Rust camera loop and sends results
 * back for notifications, SQLite logging, and UI updates.
 */
const PosturePipeline: React.FC = () => {
  const { pushScore, markMonitoring } = usePostureSession();
  const monitoringRef = useRef(false);
  const busyRef = useRef(false);

  useEffect(() => {
    const unsubs: Array<() => void> = [];
    void isPostureMonitoringEnabledPref().then((initial) => {
      monitoringRef.current = initial;
      markMonitoring(initial);
    });

    void listen<{ active: boolean }>('monitoring-state-changed', (e) => {
      const active = Boolean(e.payload?.active);
      monitoringRef.current = active;
      markMonitoring(active);
      void setPostureMonitoringEnabledPref(active);
    }).then((u) => unsubs.push(u));

    void listen<string>('camera-preview-frame', async (event) => {
      if (!monitoringRef.current || busyRef.current) return;
      const dataUrl = event.payload?.trim();
      if (!dataUrl?.startsWith('data:image/')) return;
      busyRef.current = true;
      try {
        const payload = await analyzeDataUrl(dataUrl);
        if (!payload || !monitoringRef.current) return;
        pushScore(payload.posture_score);
        await invoke('submit_posture_analysis', {
          payload: {
            turtle_neck: payload.turtle_neck,
            shoulder_misalignment: payload.shoulder_misalignment,
            posture_score: payload.posture_score,
            confidence: payload.confidence,
            metrics_json: JSON.stringify(payload.metrics),
          },
        });
      } catch (err) {
        console.error('PosturePipeline frame failed:', err);
      } finally {
        busyRef.current = false;
      }
    }).then((u) => unsubs.push(u));

    void initPoseLandmarker().catch((e) => console.error('Pose landmarker preload failed:', e));

    return () => {
      unsubs.forEach((fn) => {
        fn();
      });
    };
  }, [pushScore, markMonitoring]);

  return null;
};

export default PosturePipeline;
