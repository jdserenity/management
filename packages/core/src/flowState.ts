import type { ExerciseRunAgg, SessionType, WorkoutDefinition } from './sessionTypes';

export type FlowPhase = 'idle' | 'focus' | 'break';
export type BreakVariant = 'short' | 'long' | 'very_light';
export type LongBreakStage = 'exercise' | 'relax' | 'very_light';
export type DeskPosture = 'sitting' | 'standing';

export interface PersistedFlowState {
  version: 1;
  phase: FlowPhase;
  breakVariant: BreakVariant | null;
  longBreakStage: LongBreakStage | null;
  activeSessionType: SessionType | null;
  remainingSeconds: number;
  phasePlannedSeconds: number;
  phaseStartedAtMs: number;
  nextSessionType: SessionType | null;
  activeWorkout: WorkoutDefinition | null;
  workoutLogged: boolean;
  runStartedAt: number | null;
  runPomodoros: number;
  runDeepWork: number;
  runExerciseTotals: Record<string, ExerciseRunAgg>;
  pomodoroPosture: DeskPosture;
  lastPomodoroPosture: DeskPosture | null;
}

export const parsePersistedFlowState = (raw: string): PersistedFlowState | null => {
  try {
    const parsed = JSON.parse(raw) as PersistedFlowState;
    if (parsed?.version !== 1 || parsed.phase === undefined) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const isResumableFlow = (flow: PersistedFlowState): boolean =>
  flow.phase !== 'idle' && flow.remainingSeconds >= 0;
