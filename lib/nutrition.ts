import { toMalaysiaLocal } from './date';

export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type Goal = 'lose' | 'maintain' | 'gain';

export interface ProfileInput {
  age: number;
  weightKg: number;
  heightCm: number;
  sex: Sex;
  activityLevel: ActivityLevel;
}

export interface DailyTargets {
  calories: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
}

const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

// Fixed macro split (midpoints of the 45-50 / 20-25 / 25-30 % ranges from the spec).
const CARB_RATIO = 0.475;
const PROTEIN_RATIO = 0.225;
const FAT_RATIO = 0.3;

const KCAL_PER_G_CARB = 4;
const KCAL_PER_G_PROTEIN = 4;
const KCAL_PER_G_FAT = 9;

const MIN_SAFE_CALORIES = 1200;

const KCAL_PER_KG_FAT = 7700;
const MAX_SAFE_WEEKLY_CHANGE_KG_ABS = 1;
const MAX_SAFE_WEEKLY_CHANGE_PCT = 0.01;

export function calculateBMR(input: ProfileInput): number {
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age;
  return input.sex === 'male' ? base + 5 : base - 161;
}

export function calculateTDEE(input: ProfileInput): number {
  return calculateBMR(input) * ACTIVITY_FACTORS[input.activityLevel];
}

export function calculateDailyTargets(input: ProfileInput, dailyCalorieAdjustment: number): DailyTargets {
  const rawCalories = calculateTDEE(input) + dailyCalorieAdjustment;
  const calories = Math.round(Math.max(rawCalories, MIN_SAFE_CALORIES));
  return {
    calories,
    carbsG: Math.round((calories * CARB_RATIO) / KCAL_PER_G_CARB),
    proteinG: Math.round((calories * PROTEIN_RATIO) / KCAL_PER_G_PROTEIN),
    fatG: Math.round((calories * FAT_RATIO) / KCAL_PER_G_FAT),
  };
}

export interface BMIResult {
  bmi: number;
  category: '偏瘦' | '正常' | '超重' | '肥胖';
}

export function calculateBMI(weightKg: number, heightCm: number): BMIResult {
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  const category: BMIResult['category'] =
    bmi < 18.5 ? '偏瘦' : bmi < 24 ? '正常' : bmi < 28 ? '超重' : '肥胖';
  return { bmi: Math.round(bmi * 10) / 10, category };
}

const ML_PER_KG_WATER = 33;

export function suggestWaterMl(weightKg: number): number {
  return Math.round(weightKg * ML_PER_KG_WATER);
}

export interface WeightLogEntry {
  date: string; // YYYY-MM-DD
  weightKg: number;
}

export interface WeightTrend {
  movingAvg: { date: string; avgKg: number }[];
  /** Change per week over the trailing 7 days; null when fewer than 2 entries in that window. */
  weeklyChangeKg: number | null;
  isSafe: boolean | null;
}

const MOVING_AVG_WINDOW_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function summarizeWeightTrend(logs: WeightLogEntry[]): WeightTrend {
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));

  const movingAvg = sorted.map((entry, i) => {
    const window = sorted.slice(Math.max(0, i - MOVING_AVG_WINDOW_DAYS + 1), i + 1);
    const avgKg = window.reduce((sum, e) => sum + e.weightKg, 0) / window.length;
    return { date: entry.date, avgKg: Math.round(avgKg * 100) / 100 };
  });

  if (sorted.length < 2) {
    return { movingAvg, weeklyChangeKg: null, isSafe: null };
  }

  const last = sorted[sorted.length - 1];
  const windowStartMs = new Date(last.date).getTime() - MOVING_AVG_WINDOW_DAYS * MS_PER_DAY;
  const window = sorted.filter((e) => new Date(e.date).getTime() >= windowStartMs);
  if (window.length < 2) {
    return { movingAvg, weeklyChangeKg: null, isSafe: null };
  }

  const first = window[0];
  const daysBetween = (new Date(last.date).getTime() - new Date(first.date).getTime()) / MS_PER_DAY;
  const weeks = Math.max(daysBetween / 7, 1 / 7);
  const weeklyChangeKg = (last.weightKg - first.weightKg) / weeks;
  const maxSafeWeeklyChangeKg = Math.min(MAX_SAFE_WEEKLY_CHANGE_KG_ABS, last.weightKg * MAX_SAFE_WEEKLY_CHANGE_PCT);
  const isSafe = Math.abs(weeklyChangeKg) <= maxSafeWeeklyChangeKg;

  return { movingAvg, weeklyChangeKg: Math.round(weeklyChangeKg * 100) / 100, isSafe };
}

export interface RangeWeightSummary {
  startKg: number | null;
  endKg: number | null;
  changeKg: number | null;
  weeklyChangeKg: number | null;
  isSafe: boolean | null;
}

// First vs. last weight log within an arbitrary range (e.g. a report's date range) —
// unlike summarizeWeightTrend, which is always the trailing-7-day window off the latest entry.
export function summarizeRangeWeightChange(logs: WeightLogEntry[]): RangeWeightSummary {
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) {
    return { startKg: null, endKg: null, changeKg: null, weeklyChangeKg: null, isSafe: null };
  }
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (sorted.length < 2 || first.date === last.date) {
    return { startKg: first.weightKg, endKg: last.weightKg, changeKg: null, weeklyChangeKg: null, isSafe: null };
  }

  const changeKg = last.weightKg - first.weightKg;
  const daysBetween = (new Date(last.date).getTime() - new Date(first.date).getTime()) / MS_PER_DAY;
  const weeks = Math.max(daysBetween / 7, 1 / 7);
  const weeklyChangeKg = changeKg / weeks;
  const maxSafeWeeklyChangeKg = Math.min(MAX_SAFE_WEEKLY_CHANGE_KG_ABS, last.weightKg * MAX_SAFE_WEEKLY_CHANGE_PCT);
  const isSafe = Math.abs(weeklyChangeKg) <= maxSafeWeeklyChangeKg;

  return {
    startKg: first.weightKg,
    endKg: last.weightKg,
    changeKg: Math.round(changeKg * 100) / 100,
    weeklyChangeKg: Math.round(weeklyChangeKg * 100) / 100,
    isSafe,
  };
}

export interface GoalCheckInput {
  currentWeightKg: number;
  targetWeightKg: number;
  targetDate: string; // ISO date, e.g. '2026-11-06'
  today?: string; // ISO date, defaults to current date
}

export interface GoalCheckResult {
  requestedWeeklyChangeKg: number;
  maxSafeWeeklyChangeKg: number;
  isSafe: boolean;
  suggestedTargetDate: string | null;
  /** Daily calorie adjustment (negative for loss, positive for gain) to apply, using the safe rate when unsafe. */
  safeDailyCalorieAdjustment: number;
}

export function checkGoalSafety(input: GoalCheckInput): GoalCheckResult {
  // Default "today" uses Malaysia local date (not server-process TZ / UTC date-slice),
  // consistent with lib/date.ts's day-boundary handling elsewhere in the app.
  const today = new Date(input.today ?? toMalaysiaLocal(new Date().toISOString()).dateKey);
  const targetDate = new Date(input.targetDate);
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeks = Math.max((targetDate.getTime() - today.getTime()) / msPerWeek, 1 / 7);

  const totalChangeKg = input.targetWeightKg - input.currentWeightKg;
  const requestedWeeklyChangeKg = Math.abs(totalChangeKg) / weeks;

  const maxSafeWeeklyChangeKg = Math.min(
    MAX_SAFE_WEEKLY_CHANGE_KG_ABS,
    input.currentWeightKg * MAX_SAFE_WEEKLY_CHANGE_PCT
  );

  const isSafe = requestedWeeklyChangeKg <= maxSafeWeeklyChangeKg;
  const direction = totalChangeKg >= 0 ? 1 : -1;
  const safeWeeklyChangeKg = direction * maxSafeWeeklyChangeKg;

  let suggestedTargetDate: string | null = null;
  if (!isSafe) {
    const safeWeeks = Math.abs(totalChangeKg) / maxSafeWeeklyChangeKg;
    const suggested = new Date(today.getTime() + safeWeeks * msPerWeek);
    suggestedTargetDate = suggested.toISOString().slice(0, 10);
  }

  const effectiveWeeklyChangeKg = isSafe ? requestedWeeklyChangeKg * direction : safeWeeklyChangeKg;
  const safeDailyCalorieAdjustment = (effectiveWeeklyChangeKg * KCAL_PER_KG_FAT) / 7;

  return {
    requestedWeeklyChangeKg,
    maxSafeWeeklyChangeKg,
    isSafe,
    suggestedTargetDate,
    safeDailyCalorieAdjustment,
  };
}
