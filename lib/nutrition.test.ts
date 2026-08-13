import { describe, it, expect } from 'vitest';
import { calculateBMR, calculateTDEE, calculateDailyTargets, checkGoalSafety } from './nutrition';

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
    expect(targets.calories).toBeCloseTo(tdee, 0);
    // carbs 47.5% of calories / 4 kcal per g
    expect(targets.carbsG).toBeCloseTo((tdee * 0.475) / 4, 0);
    expect(targets.proteinG).toBeCloseTo((tdee * 0.225) / 4, 0);
    expect(targets.fatG).toBeCloseTo((tdee * 0.3) / 9, 0);
  });

  it('applies a negative calorie adjustment for weight loss', () => {
    const input = { age: 30, weightKg: 70, heightCm: 175, sex: 'male' as const, activityLevel: 'sedentary' as const };
    const tdee = calculateTDEE(input);
    const targets = calculateDailyTargets(input, -500);
    expect(targets.calories).toBeCloseTo(tdee - 500, 0);
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
