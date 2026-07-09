export type StreakLogState = 'success' | 'failed' | 'none';

export type StreakLogCell = { state: StreakLogState; updatedAt: string };

export type StreakActivity = {
  id: string;
  name?: string;
  description?: string;
  frequency?: 'daily' | 'weekly';
  weeklyTarget?: number;
  scheduledDays?: string[];
  canFail?: boolean;
  /** If true, missing success on this activity fails the whole day on the heatmap (red X). */
  necessary?: boolean;
  archivedAt?: string | null;
  /** Link to a nutrition staple id — logging that staple (or this task) keeps both in sync. */
  linkedStapleId?: string;
  /** Link to the water tracker — logging water completes this task. */
  linkedWater?: boolean;
  extraCalories?: number;
  extraProtein?: number;
  extraWaterMl?: number;
  _fromConfig?: boolean;
  _logOnly?: boolean;
};

export type StreakConfig = {
  activities: StreakActivity[];
  archivedActivities: StreakActivity[];
};

export type StreakActivityStats = {
  currentStreak: number;
  longestStreak: number;
  totalSuccesses: number;
  totalDays: number;
  weeklySuccesses?: number;
  weeklyTarget?: number;
  isWeekly?: boolean;
};

export type StreakData = {
  logs: Record<string, Record<string, StreakLogCell | null>>;
  activityStartDates: Record<string, string>;
  pausedActivities: Record<string, string>;
  unpausedActivities: Record<string, string>;
  activityResetCounts: Record<string, number>;
  stats: Record<string, StreakActivityStats>;
  _inferredStartDates?: Record<string, string | null>;
  _inferredLastLogDates?: Record<string, string | null>;
};

export type StreakState = {
  config: StreakConfig;
  data: StreakData;
  activityConfigMap: Record<string, StreakActivity>;
  currentDay: string;
};
