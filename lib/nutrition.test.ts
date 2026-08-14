import { describe, it, expect } from 'vitest';
import {
  calculateBMR,
  calculateTDEE,
  calculateDailyTargets,
  checkGoalSafety,
  calculateBMI,
  suggestWaterMl,
  summarizeWeightTrend,
} from './nutrition';

describe('calculateBMR', () => {
  it('computes Mifflin-St Jeor BMR for a male', () => {
    // BMR = 10*70 + 6.25*175 - 5*30 + 5 = 700 + 1093.75 - 150 + 5 = 1648.75
    const bmr = calculateBMR({ age: 30, weightKg: 70, heightCm: 175, sex: 'male', activityLevel: 'sedentary' });
    expect(bmr).toBeCloseTo(1648.75, 1);
  });

  it('computes Mifflin-St Jeor BMR for a female', () => {
    // BMR = 10*60 + 6.25*165 - 5*25 - 161 = 600 + 1031.25 - 125 - 161 = 1345.25
    const bmr = calculateBMR({ age: 25, weightKg: 60, heightCm: 165, sex: 'female', activityLevel: 'sedentary' });
    expect(bmr).toBeCloseTo(1345.25, 1);
  });
});

describe('calculateTDEE', () => {
  it('multiplies BMR by the activity factor', () => {
    const input = { age: 30, weightKg: 70, heightCm: 175, sex: 'male' as const, activityLevel: 'moderate' as const };
    const bmr = calculateBMR(input);
    const tdee = calculateTDEE(input);
    expect(tdee).toBeCloseTo(bmr * 1.55, 1);
  });
});

describe('calculateDailyTargets', () => {
  it('splits calories into macros using fixed ratios', () => {
    const input = { age: 30, weightKg: 70, heightCm: 175, sex: 'male' as const, activityLevel: 'sedentary' as const };
    const targets = calculateDailyTargets(input, 0);
    const tdee = calculateTDEE(input);
    // calories is rounded to a whole number for display; compare against the rounded TDEE.
    expect(targets.calories).toBe(Math.round(tdee));
    // carbs 47.5% of calories / 4 kcal per g
    expect(targets.carbsG).toBeCloseTo((tdee * 0.475) / 4, 0);
    expect(targets.proteinG).toBeCloseTo((tdee * 0.225) / 4, 0);
    expect(targets.fatG).toBeCloseTo((tdee * 0.3) / 9, 0);
  });

  it('applies a negative calorie adjustment for weight loss', () => {
    const input = { age: 30, weightKg: 70, heightCm: 175, sex: 'male' as const, activityLevel: 'sedentary' as const };
    const tdee = calculateTDEE(input);
    const targets = calculateDailyTargets(input, -500);
    expect(targets.calories).toBe(Math.round(tdee - 500));
  });

  it('never returns a calorie target below 1200', () => {
    const input = { age: 60, weightKg: 45, heightCm: 150, sex: 'female' as const, activityLevel: 'sedentary' as const };
    const targets = calculateDailyTargets(input, -2000);
    expect(targets.calories).toBeGreaterThanOrEqual(1200);
  });
});

describe('checkGoalSafety', () => {
  it('flags an unsafe fast weight-loss target', () => {
    // 20kg in 12 weeks = 1.667kg/week, max safe = min(1, 0.8*0.01) -> for 80kg current, 1% = 0.8kg, so cap 0.8
    const result = checkGoalSafety({
      currentWeightKg: 80,
      targetWeightKg: 60,
      targetDate: '2026-11-06', // ~12 weeks after today
      today: '2026-08-14',
    });
    expect(result.isSafe).toBe(false);
    expect(result.requestedWeeklyChangeKg).toBeCloseTo(1.667, 2);
    expect(result.maxSafeWeeklyChangeKg).toBeCloseTo(0.8, 2);
    expect(result.suggestedTargetDate).not.toBeNull();
    expect(result.safeDailyCalorieAdjustment).toBeLessThan(0);
  });

  it('accepts a safe, gradual weight-loss target', () => {
    const result = checkGoalSafety({
      currentWeightKg: 80,
      targetWeightKg: 76,
      targetDate: '2026-10-09', // 8 weeks, 0.5kg/week
      today: '2026-08-14',
    });
    expect(result.isSafe).toBe(true);
    expect(result.suggestedTargetDate).toBeNull();
  });

  it('handles weight gain the same way (positive direction)', () => {
    const result = checkGoalSafety({
      currentWeightKg: 60,
      targetWeightKg: 63,
      targetDate: '2026-09-11', // 4 weeks, 0.75kg/week, safe (max 1% of 60 = 0.6 -> unsafe actually)
      today: '2026-08-14',
    });
    expect(result.requestedWeeklyChangeKg).toBeGreaterThan(0);
    expect(result.maxSafeWeeklyChangeKg).toBeCloseTo(0.6, 2);
    expect(result.isSafe).toBe(false);
  });

  it('suggests a safe target date weeks in the future for unsafe goals', () => {
    // 20kg loss in 12 weeks (1.667/week) exceeds 0.8kg/week cap
    // Safe pace: 20kg / 0.8kg/week = 25 weeks from Aug 14 = ~Feb 5, 2027
    const result = checkGoalSafety({
      currentWeightKg: 80,
      targetWeightKg: 60,
      targetDate: '2026-11-06',
      today: '2026-08-14',
    });
    expect(result.isSafe).toBe(false);
    expect(result.suggestedTargetDate).not.toBeNull();
    // Safe date should be ~25 weeks away, roughly Feb 2027, not Aug 2026
    const suggestedDate = new Date(result.suggestedTargetDate!);
    const minSafeDate = new Date('2027-02-01');
    const maxSafeDate = new Date('2027-02-10');
    expect(suggestedDate.getTime()).toBeGreaterThanOrEqual(minSafeDate.getTime());
    expect(suggestedDate.getTime()).toBeLessThanOrEqual(maxSafeDate.getTime());
  });
});

describe('calculateBMI', () => {
  it('categorizes underweight', () => {
    expect(calculateBMI(50, 175)).toEqual({ bmi: 16.3, category: '偏瘦' });
  });

  it('categorizes normal', () => {
    expect(calculateBMI(68, 175)).toEqual({ bmi: 22.2, category: '正常' });
  });

  it('categorizes overweight', () => {
    expect(calculateBMI(80, 175)).toEqual({ bmi: 26.1, category: '超重' });
  });

  it('categorizes obese', () => {
    expect(calculateBMI(95, 175)).toEqual({ bmi: 31, category: '肥胖' });
  });
});

describe('suggestWaterMl', () => {
  it('suggests 33ml per kg of body weight', () => {
    expect(suggestWaterMl(68)).toBe(2244);
  });
});

describe('summarizeWeightTrend', () => {
  it('returns null trend with fewer than 2 entries', () => {
    const result = summarizeWeightTrend([{ date: '2026-08-14', weightKg: 70 }]);
    expect(result.weeklyChangeKg).toBeNull();
    expect(result.isSafe).toBeNull();
    expect(result.movingAvg).toEqual([{ date: '2026-08-14', avgKg: 70 }]);
  });

  it('computes a 7-day moving average and weekly change', () => {
    const logs = [
      { date: '2026-08-08', weightKg: 70 },
      { date: '2026-08-15', weightKg: 69.3 },
    ];
    const result = summarizeWeightTrend(logs);
    expect(result.weeklyChangeKg).toBeCloseTo(-0.7, 2);
    // max safe = min(1, 69.3*0.01=0.693); 0.7kg/week exceeds it
    expect(result.isSafe).toBe(false);
  });

  it('flags an unsafe weekly change', () => {
    const logs = [
      { date: '2026-08-08', weightKg: 70 },
      { date: '2026-08-15', weightKg: 68 },
    ];
    const result = summarizeWeightTrend(logs);
    expect(result.weeklyChangeKg).toBeCloseTo(-2, 2);
    expect(result.isSafe).toBe(false);
  });

  it('ignores entries older than 7 days when computing weekly change', () => {
    const logs = [
      { date: '2026-07-01', weightKg: 90 }, // far outside the trailing 7-day window
      { date: '2026-08-08', weightKg: 70 },
      { date: '2026-08-15', weightKg: 69.5 },
    ];
    const result = summarizeWeightTrend(logs);
    expect(result.weeklyChangeKg).toBeCloseTo(-0.5, 2);
  });
});
