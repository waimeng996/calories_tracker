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
  const calories = Math.max(rawCalories, MIN_SAFE_CALORIES);
  return {
    calories,
    carbsG: Math.round((calories * CARB_RATIO) / KCAL_PER_G_CARB),
    proteinG: Math.round((calories * PROTEIN_RATIO) / KCAL_PER_G_PROTEIN),
    fatG: Math.round((calories * FAT_RATIO) / KCAL_PER_G_FAT),
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
  const today = new Date(input.today ?? new Date().toISOString().slice(0, 10));
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
