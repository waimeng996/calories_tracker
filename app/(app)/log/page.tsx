'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PhotoCapture from '@/components/PhotoCapture';
import { compressImage } from '@/lib/image';
import { createBrowserSupabase } from '@/lib/supabase/client';
import type { FoodAnalysis } from '@/lib/gemini';

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '小食',
};

function LogMealForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mealType = MEAL_TYPE_LABELS[searchParams.get('type') ?? ''] ? searchParams.get('type')! : 'snack';

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [insulinUnits, setInsulinUnits] = useState('');
  const [analysis, setAnalysis] = useState<FoodAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set once an insert has succeeded despite a photo-upload failure (the one case where we
  // stay on this page afterward). Locks the form so a second click can't insert a duplicate row.
  const [savedWithoutPhoto, setSavedWithoutPhoto] = useState(false);

  function handleCapture(file: File) {
    setPhotoFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setAnalysis(null);
    setError(null);
  }

  async function handleAnalyze() {
    if (!photoFile) return;
    setAnalyzing(true);
    setError(null);
    try {
      const compressed = await compressImage(photoFile);
      const formData = new FormData();
      formData.append('photo', compressed, 'meal.jpg');
      formData.append('note', note);
      const res = await fetch('/api/analyze-food', { method: 'POST', body: formData });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error ?? 'Analysis failed');
      }
      setAnalysis(body.analysis as FoodAnalysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI分析失败, 可手动输入营养数据');
      setAnalysis({ description: '', calories: 0, carbsG: 0, proteinG: 0, fatG: 0 });
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSave() {
    if (!analysis || !photoFile) return;
    setSaving(true);
    setError(null);
    const supabase = createBrowserSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('Not logged in');
      setSaving(false);
      return;
    }

    const mealId = crypto.randomUUID();
    const compressed = await compressImage(photoFile);
    const storagePath = `${user.id}/${mealId}.jpg`;
    const { error: uploadError } = await supabase.storage.from('meal-photos').upload(storagePath, compressed, {
      contentType: 'image/jpeg',
    });
    // Photo upload failure must not block saving the meal's nutrition data — fall through
    // with photo_url: null (nullable column) and just warn instead of aborting.
    if (uploadError) {
      setError(`相片上传失败, 已保存营养数据 (可重试上传): ${uploadError.message}`);
    }

    const { error: insertError } = await supabase.from('meal_logs').insert({
      id: mealId,
      user_id: user.id,
      photo_url: uploadError ? null : storagePath,
      user_note: note || null,
      ai_raw_description: analysis.description || null,
      calories: analysis.calories,
      carbs_g: analysis.carbsG,
      protein_g: analysis.proteinG,
      fat_g: analysis.fatG,
      meal_type: mealType,
      insulin_units: insulinUnits ? Number(insulinUnits) : null,
    });

    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    // Meal data is saved either way. If the photo upload failed, stay on the page so the
    // warning stays visible instead of redirecting it out from under the user — but lock
    // the form so they can't click 确认保存 again and insert a duplicate row.
    if (uploadError) {
      setSavedWithoutPhoto(true);
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-md p-6 space-y-4">
      <h1 className="text-xl font-semibold">记录: {MEAL_TYPE_LABELS[mealType]}</h1>

      {!previewUrl && <PhotoCapture onCapture={handleCapture} />}

      {previewUrl && (
        <img src={previewUrl} alt="Meal preview" className="w-full rounded" />
      )}

      {previewUrl && !savedWithoutPhoto && (
        <input
          type="text"
          placeholder="补充材料说明 (例如: low fat milk, light mayo)"
          className="w-full rounded border px-3 py-2"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      )}

      {previewUrl && !analysis && (
        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="w-full rounded bg-gray-900 py-2 text-white disabled:opacity-50"
        >
          {analyzing ? '分析中…' : 'AI 分析'}
        </button>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {analysis && !savedWithoutPhoto && (
        <div className="space-y-3">
          <label className="block text-sm">食物描述
            <input className="mt-1 w-full rounded border px-3 py-2" value={analysis.description}
              onChange={(e) => setAnalysis({ ...analysis, description: e.target.value })} />
          </label>
          <label className="block text-sm">Calories
            <input type="number" className="mt-1 w-full rounded border px-3 py-2" value={analysis.calories}
              onChange={(e) => setAnalysis({ ...analysis, calories: Number(e.target.value) })} />
          </label>
          <label className="block text-sm">Carbs (g)
            <input type="number" className="mt-1 w-full rounded border px-3 py-2" value={analysis.carbsG}
              onChange={(e) => setAnalysis({ ...analysis, carbsG: Number(e.target.value) })} />
          </label>
          <label className="block text-sm">Protein (g)
            <input type="number" className="mt-1 w-full rounded border px-3 py-2" value={analysis.proteinG}
              onChange={(e) => setAnalysis({ ...analysis, proteinG: Number(e.target.value) })} />
          </label>
          <label className="block text-sm">Fat (g)
            <input type="number" className="mt-1 w-full rounded border px-3 py-2" value={analysis.fatG}
              onChange={(e) => setAnalysis({ ...analysis, fatG: Number(e.target.value) })} />
          </label>
          <label className="block text-sm">胰岛素 units (可选)
            <input type="number" min="0" step="0.5" className="mt-1 w-full rounded border px-3 py-2" value={insulinUnits}
              onChange={(e) => setInsulinUnits(e.target.value)} />
          </label>
          <button onClick={handleSave} disabled={saving} className="w-full rounded bg-gray-900 py-2 text-white disabled:opacity-50">
            {saving ? 'Saving…' : '确认保存'}
          </button>
        </div>
      )}

      {savedWithoutPhoto && (
        <p className="rounded border border-gray-300 bg-gray-50 py-2 text-center text-sm text-gray-700">
          已保存 (相片上传失败, 数值已记录)
        </p>
      )}
    </main>
  );
}

export default function LogMealPage() {
  return (
    <Suspense>
      <LogMealForm />
    </Suspense>
  );
}
