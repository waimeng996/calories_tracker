'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PhotoCapture from '@/components/PhotoCapture';
import { compressImage } from '@/lib/image';
import { createBrowserSupabase } from '@/lib/supabase/client';
import type { FoodAnalysis } from '@/lib/gemini';

export default function LogMealPage() {
  const router = useRouter();
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [analysis, setAnalysis] = useState<FoodAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (uploadError) {
      setError(uploadError.message);
      setSaving(false);
      return;
    }

    const { error: insertError } = await supabase.from('meal_logs').insert({
      id: mealId,
      user_id: user.id,
      photo_url: storagePath,
      user_note: note || null,
      ai_raw_description: analysis.description || null,
      calories: analysis.calories,
      carbs_g: analysis.carbsG,
      protein_g: analysis.proteinG,
      fat_g: analysis.fatG,
    });

    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-md p-6 space-y-4">
      <h1 className="text-xl font-semibold">记录一餐</h1>

      {!previewUrl && <PhotoCapture onCapture={handleCapture} />}

      {previewUrl && (
        <img src={previewUrl} alt="Meal preview" className="w-full rounded" />
      )}

      {previewUrl && !analysis && (
        <>
          <input
            type="text"
            placeholder="补充材料说明 (例如: low fat milk, light mayo)"
            className="w-full rounded border px-3 py-2"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="w-full rounded bg-gray-900 py-2 text-white disabled:opacity-50"
          >
            {analyzing ? '分析中…' : 'AI 分析'}
          </button>
        </>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {analysis && (
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
          <button onClick={handleSave} disabled={saving} className="w-full rounded bg-gray-900 py-2 text-white disabled:opacity-50">
            {saving ? 'Saving…' : '确认保存'}
          </button>
        </div>
      )}
    </main>
  );
}
