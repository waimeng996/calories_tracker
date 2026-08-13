'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase/client';
import {
  calculateDailyTargets,
  checkGoalSafety,
  type ActivityLevel,
  type Goal,
  type Sex,
} from '@/lib/nutrition';

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
  const [safetyWarning, setSafetyWarning] = useState<string | null>(null);
  const [acceptedOverride, setAcceptedOverride] = useState(false);
  const [dailyAdjustment, setDailyAdjustment] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const profileInput = {
    age: Number(age),
    weightKg: Number(weightKg),
    heightCm: Number(heightCm),
    sex,
    activityLevel,
  };

  function runSafetyCheck(): number {
    if (goal === 'maintain' || !targetWeightKg || !targetDate) {
      setSafetyWarning(null);
      return 0;
    }
    const result = checkGoalSafety({
      currentWeightKg: Number(weightKg),
      targetWeightKg: Number(targetWeightKg),
      targetDate,
    });
    if (!result.isSafe && !acceptedOverride) {
      setSafetyWarning(
        `呢个速度唔安全: 需要每周${result.requestedWeeklyChangeKg.toFixed(2)}kg, 建议上限每周${result.maxSafeWeeklyChangeKg.toFixed(2)}kg。` +
          `建议目标日期改做 ${result.suggestedTargetDate}, 或以安全速率继续。`
      );
    } else {
      setSafetyWarning(null);
    }
    return result.safeDailyCalorieAdjustment;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const adjustment = runSafetyCheck();
    if (safetyWarning && !acceptedOverride) {
      return; // block save until user accepts suggestion or overrides
    }

    setDailyAdjustment(adjustment);
    setSaving(true);

    const targets = calculateDailyTargets(profileInput, adjustment);
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
      target_date: goal === 'maintain' ? null : targetDate,
      daily_calories: targets.calories,
      daily_carbs_g: targets.carbsG,
      daily_protein_g: targets.proteinG,
      daily_fat_g: targets.fatG,
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
        {safetyWarning && (
          <div className="rounded border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
            <p>{safetyWarning}</p>
            <label className="mt-2 flex items-center gap-2">
              <input type="checkbox" checked={acceptedOverride} onChange={(e) => setAcceptedOverride(e.target.checked)} />
              我明白风险, 坚持原计划
            </label>
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="button"
          onClick={runSafetyCheck}
          className="w-full rounded border border-gray-900 py-2"
        >
          检查目标
        </button>
        <button type="submit" disabled={saving} className="w-full rounded bg-gray-900 py-2 text-white disabled:opacity-50">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </form>
    </main>
  );
}
