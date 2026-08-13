'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase/client';

function nowForInput(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function InsulinLogPage() {
  const router = useRouter();
  const [units, setUnits] = useState('');
  const [loggedAt, setLoggedAt] = useState(nowForInput());
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const supabase = createBrowserSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('Not logged in');
      setSaving(false);
      return;
    }
    const { error: insertError } = await supabase.from('insulin_logs').insert({
      user_id: user.id,
      units: Number(units),
      logged_at: new Date(loggedAt).toISOString(),
      note: note || null,
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
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-xl font-semibold">记录胰岛素</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="number"
          step="0.5"
          required
          placeholder="Units"
          className="w-full rounded border px-3 py-2"
          value={units}
          onChange={(e) => setUnits(e.target.value)}
        />
        <input
          type="datetime-local"
          required
          className="w-full rounded border px-3 py-2"
          value={loggedAt}
          onChange={(e) => setLoggedAt(e.target.value)}
        />
        <input
          type="text"
          placeholder="Note (optional)"
          className="w-full rounded border px-3 py-2"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={saving} className="w-full rounded bg-gray-900 py-2 text-white disabled:opacity-50">
          {saving ? 'Saving…' : '保存'}
        </button>
      </form>
    </main>
  );
}
