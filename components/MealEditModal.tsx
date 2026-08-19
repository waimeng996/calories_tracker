'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface MealEditModalProps {
  id: string;
  description: string;
  calories: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
  insulinUnits: number | null;
  onClose: () => void;
}

export default function MealEditModal({
  id,
  description,
  calories,
  carbsG,
  proteinG,
  fatG,
  insulinUnits,
  onClose,
}: MealEditModalProps) {
  const router = useRouter();
  const [form, setForm] = useState({
    description,
    calories: String(calories),
    carbsG: String(carbsG),
    proteinG: String(proteinG),
    fatG: String(fatG),
    insulinUnits: insulinUnits !== null ? String(insulinUnits) : '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/meal-logs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: form.description,
        calories: Number(form.calories),
        carbsG: Number(form.carbsG),
        proteinG: Number(form.proteinG),
        fatG: Number(form.fatG),
        insulinUnits: form.insulinUnits === '' ? null : Number(form.insulinUnits),
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? '保存失败, 请重试');
      setSaving(false);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md space-y-3 rounded-t-2xl bg-white p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-sm font-medium">编辑记录</h2>

        <label className="block text-sm">食物描述
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>
        <label className="block text-sm">Calories
          <input type="number" className="mt-1 w-full rounded border px-3 py-2" value={form.calories}
            onChange={(e) => setForm({ ...form, calories: e.target.value })} />
        </label>
        <label className="block text-sm">Carbs (g)
          <input type="number" className="mt-1 w-full rounded border px-3 py-2" value={form.carbsG}
            onChange={(e) => setForm({ ...form, carbsG: e.target.value })} />
        </label>
        <label className="block text-sm">Protein (g)
          <input type="number" className="mt-1 w-full rounded border px-3 py-2" value={form.proteinG}
            onChange={(e) => setForm({ ...form, proteinG: e.target.value })} />
        </label>
        <label className="block text-sm">Fat (g)
          <input type="number" className="mt-1 w-full rounded border px-3 py-2" value={form.fatG}
            onChange={(e) => setForm({ ...form, fatG: e.target.value })} />
        </label>
        <label className="block text-sm">胰岛素 units (可选)
          <input type="number" min="0" step="0.5" className="mt-1 w-full rounded border px-3 py-2" value={form.insulinUnits}
            onChange={(e) => setForm({ ...form, insulinUnits: e.target.value })} />
        </label>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded border border-gray-300 py-2 text-sm">取消</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 rounded bg-gray-900 py-2 text-sm text-white disabled:opacity-50">
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
