'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase/client';
import {
  calculateDailyTargets,
  checkGoalSafety,
  type ActivityLevel,
  type Goal,
  type GoalCheckResult,
  type Sex,
} from '@/lib/nutrition';

// Mirrors lib/nutrition.ts's private KCAL_PER_KG_FAT constant. Needed here to derive the
// user's actually-requested (uncapped) daily calorie adjustment for the override path —
// checkGoalSafety only ever returns the capped/safe adjustment.
const KCAL_PER_KG_FAT = 7700;

export default function OnboardingPage() {
  const router = useRouter();
  const [age, setAge] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [sex, setSex] = useState<Sex>('female');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('sedentary');
  const [goal, setGoal] = useState<Goal>('maintain');
  const [targetWeightKg, setTargetWeightKg] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [safetyResult, setSafetyResult] = useState<GoalCheckResult | null>(null);
  const [acceptedOverride, setAcceptedOverride] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const profileInput = {
    age: Number(age),
    weightKg: Number(weightKg),
    heightCm: Number(heightCm),
    sex,
    activityLevel,
  };

  // Requested (uncapped) daily calorie adjustment, signed the same way checkGoalSafety
  // signs safeDailyCalorieAdjustment (negative = loss, positive = gain), but built from
  // the user's actual requested weekly rate instead of the capped one.
  function requestedDailyCalorieAdjustment(result: GoalCheckResult): number {
    const direction = Number(targetWeightKg) >= Number(weightKg) ? 1 : -1;
    return (direction * result.requestedWeeklyChangeKg * KCAL_PER_KG_FAT) / 7;
  }

  async function saveProfile(dailyCalorieAdjustment: number, effectiveTargetDate: string | null, overrideAccepted: boolean) {
    setError(null);
    setSaving(true);

    const targets = calculateDailyTargets(profileInput, dailyCalorieAdjustment);
    const supabase = createBrowserSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('Not logged in');
      setSaving(false);
      return;
    }

    const { error: upsertError } = await supabase.from('profiles').upsert({
      id: user.id,
      age: profileInput.age,
      weight_kg: profileInput.weightKg,
      height_cm: profileInput.heightCm,
      sex: profileInput.sex,
      activity_level: profileInput.activityLevel,
      goal,
      target_weight_kg: goal === 'maintain' ? null : Number(targetWeightKg),
      target_date: goal === 'maintain' ? null : effectiveTargetDate,
      daily_calories: targets.calories,
      daily_carbs_g: targets.carbsG,
      daily_protein_g: targets.proteinG,
      daily_fat_g: targets.fatG,
      goal_override_accepted: overrideAccepted,
      updated_at: new Date().toISOString(),
    });

    setSaving(false);
    if (upsertError) {
      setError(upsertError.message);
      return;
    }
    router.push('/');
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (goal === 'maintain' || !targetWeightKg || !targetDate) {
      setSafetyResult(null);
      await saveProfile(0, null, false);
      return;
    }

    // Always run the safety check as part of submit, and gate on its return value
    // directly — never on state a previous render set, which may not have applied yet.
    const result = checkGoalSafety({
      currentWeightKg: Number(weightKg),
      targetWeightKg: Number(targetWeightKg),
      targetDate,
    });

    if (!result.isSafe && !acceptedOverride) {
      setSafetyResult(result);
      return; // block save until the user adopts the safe suggestion or overrides
    }

    setSafetyResult(null);
    const adjustment = result.isSafe ? result.safeDailyCalorieAdjustment : requestedDailyCalorieAdjustment(result);
    await saveProfile(adjustment, targetDate, !result.isSafe);
  }

  async function handleAdoptSafeSuggestion() {
    if (!safetyResult?.suggestedTargetDate) return;
    const suggestedDate = safetyResult.suggestedTargetDate;
    const adjustment = safetyResult.safeDailyCalorieAdjustment;
    setTargetDate(suggestedDate);
    setAcceptedOverride(false);
    setSafetyResult(null);
    await saveProfile(adjustment, suggestedDate, false);
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-xl font-semibold">Your profile</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="number" required placeholder="Age" className="w-full rounded border px-3 py-2" value={age} onChange={(e) => setAge(e.target.value)} />
        <input type="number" required placeholder="Weight (kg)" className="w-full rounded border px-3 py-2" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
        <input type="number" required placeholder="Height (cm)" className="w-full rounded border px-3 py-2" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
        <select className="w-full rounded border px-3 py-2" value={sex} onChange={(e) => setSex(e.target.value as Sex)}>
          <option value="female">Female</option>
          <option value="male">Male</option>
        </select>
        <select className="w-full rounded border px-3 py-2" value={activityLevel} onChange={(e) => setActivityLevel(e.target.value as ActivityLevel)}>
          <option value="sedentary">Sedentary</option>
          <option value="light">Lightly active</option>
          <option value="moderate">Moderately active</option>
          <option value="active">Active</option>
          <option value="very_active">Very active</option>
        </select>
        <select className="w-full rounded border px-3 py-2" value={goal} onChange={(e) => setGoal(e.target.value as Goal)}>
          <option value="maintain">Maintain weight</option>
          <option value="lose">Lose weight</option>
          <option value="gain">Gain weight</option>
        </select>
        {goal !== 'maintain' && (
          <>
            <input type="number" required placeholder="Target weight (kg)" className="w-full rounded border px-3 py-2" value={targetWeightKg} onChange={(e) => setTargetWeightKg(e.target.value)} />
            <input type="date" required className="w-full rounded border px-3 py-2" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          </>
        )}
        {safetyResult && !safetyResult.isSafe && (
          <div className="rounded border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
            <p>
              {`呢个速度唔安全: 需要每周${safetyResult.requestedWeeklyChangeKg.toFixed(2)}kg, 建议上限每周${safetyResult.maxSafeWeeklyChangeKg.toFixed(2)}kg。` +
                `建议目标日期改做 ${safetyResult.suggestedTargetDate}, 或以安全速率继续。`}
            </p>
            <button
              type="button"
              onClick={handleAdoptSafeSuggestion}
              disabled={saving}
              className="mt-2 w-full rounded border border-amber-700 py-1.5 text-amber-900 disabled:opacity-50"
            >
              采用安全建议日期
            </button>
            <label className="mt-2 flex items-center gap-2">
              <input type="checkbox" checked={acceptedOverride} onChange={(e) => setAcceptedOverride(e.target.checked)} />
              我明白风险, 坚持原计划
            </label>
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={saving} className="w-full rounded bg-gray-900 py-2 text-white disabled:opacity-50">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </form>
    </main>
  );
}
