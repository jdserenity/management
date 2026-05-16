import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const MAX_POINTS = 90;

type Ctx = {
  scoreHistory: readonly number[];
  monitoringSinceSec: number | null;
  pushScore: (score: number) => void;
  clearHistory: () => void;
  markMonitoring: (active: boolean) => void;
};

const PostureSessionContext = createContext<Ctx | null>(null);

export function PostureSessionProvider({ children }: { children: React.ReactNode }) {
  const [scoreHistory, setScoreHistory] = useState<number[]>([]);
  const [monitoringSinceSec, setMonitoringSinceSec] = useState<number | null>(null);

  const pushScore = useCallback((score: number) => {
    setScoreHistory((prev) => {
      const next = [...prev, score];
      if (next.length > MAX_POINTS) next.splice(0, next.length - MAX_POINTS);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setScoreHistory([]);
  }, []);

  const markMonitoring = useCallback((active: boolean) => {
    if (active) {
      setMonitoringSinceSec(Math.floor(Date.now() / 1000));
      setScoreHistory([]);
    } else {
      setMonitoringSinceSec(null);
      setScoreHistory([]);
    }
  }, []);

  const value = useMemo(
    () => ({ scoreHistory, monitoringSinceSec, pushScore, clearHistory, markMonitoring }),
    [scoreHistory, monitoringSinceSec, pushScore, clearHistory, markMonitoring],
  );

  return <PostureSessionContext.Provider value={value}>{children}</PostureSessionContext.Provider>;
}

export function usePostureSession(): Ctx {
  const v = useContext(PostureSessionContext);
  if (!v) throw new Error('usePostureSession requires PostureSessionProvider');
  return v;
}
