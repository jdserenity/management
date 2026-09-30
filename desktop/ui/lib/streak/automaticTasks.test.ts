import { describe, expect, it } from 'vitest';
import { automaticTaskChecks } from '@/lib/streak/automaticTasks';

describe('automatic streak task thresholds', () => {
  it('checks water only after its configured daily target is reached', () => {
    expect(automaticTaskChecks({ water: { totalMl: 1999, targetMl: 2000 } }).water).toBe(false);
    expect(automaticTaskChecks({ water: { totalMl: 2000, targetMl: 2000 } }).water).toBe(true);
  });

  it('checks food only after every configured nutrition target is reached', () => {
    expect(automaticTaskChecks({ food: { calories: 2100, calorieTarget: 2200, protein: 150, proteinTarget: 150 } }).food).toBe(false);
    expect(automaticTaskChecks({ food: { calories: 2200, calorieTarget: 2200, protein: 149, proteinTarget: 150 } }).food).toBe(false);
    expect(automaticTaskChecks({ food: { calories: 2200, calorieTarget: 2200, protein: 150, proteinTarget: 150 } }).food).toBe(true);
  });

  it('does not check food when no nutrition target has been configured', () => {
    expect(automaticTaskChecks({ food: { calories: 5000, calorieTarget: 0, protein: 300, proteinTarget: 0 } }).food).toBe(false);
  });

  it('checks workout only after every movement task for the day is complete', () => {
    expect(automaticTaskChecks({ workout: { completedTasks: 3, totalTasks: 4 } }).workout).toBe(false);
    expect(automaticTaskChecks({ workout: { completedTasks: 4, totalTasks: 4 } }).workout).toBe(true);
  });
});
