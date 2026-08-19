'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PhotoLightbox from './PhotoLightbox';
import MealEditModal from './MealEditModal';

interface MealCardProps {
  id: string;
  time: string;
  description: string;
  calories: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
  insulinUnits: number | null;
  breakdown: string | null;
  photoUrl: string | null;
}

export default function MealCard({ id, time, description, calories, carbsG, proteinG, fatG, insulinUnits, breakdown, photoUrl }: MealCardProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [editing, setEditing] = useState(false);

  async function handleDelete() {
    if (!confirm('确定要删除呢条记录?')) return;
    setDeleting(true);
    setError(null);
    const res = await fetch(`/api/meal-logs/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? '删除失败, 请重试');
      setDeleting(false);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3 rounded-xl bg-white p-3">
      <div
        className={`h-9 w-9 flex-shrink-0 rounded-lg bg-[#EAF3FC] bg-cover bg-center ${photoUrl ? 'cursor-pointer' : ''}`}
        style={photoUrl ? { backgroundImage: `url(${photoUrl})` } : undefined}
        onClick={photoUrl ? () => setZoomed(true) : undefined}
        role={photoUrl ? 'button' : undefined}
        aria-label={photoUrl ? '放大睇相片' : undefined}
      />
      {zoomed && photoUrl && <PhotoLightbox src={photoUrl} onClose={() => setZoomed(false)} />}
      {editing && (
        <MealEditModal
          id={id}
          description={description}
          calories={calories}
          carbsG={carbsG}
          proteinG={proteinG}
          fatG={fatG}
          insulinUnits={insulinUnits}
          breakdown={breakdown}
          onClose={() => setEditing(false)}
        />
      )}
      <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setEditing(true)}>
        <p className="truncate text-sm">{description}</p>
        <p className="text-xs text-gray-400">
          {time} · {Math.round(calories)} kcal{insulinUnits ? ` · 💉 ${insulinUnits}u` : ''}
        </p>
        <p className="text-xs text-gray-400">
          碳水{Math.round(carbsG)}g · 蛋白{Math.round(proteinG)}g · 脂肪{Math.round(fatG)}g
        </p>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
      <button onClick={handleDelete} disabled={deleting} aria-label="删除呢条记录" className="flex-shrink-0 text-[#D85A30] disabled:opacity-50">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" />
        </svg>
      </button>
    </div>
  );
}
