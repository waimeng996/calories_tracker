import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { analyzeFoodPhoto, GeminiParseError } from '@/lib/gemini';

export async function POST(request: NextRequest) {
  // Everything below can throw (auth call, multipart parsing, Gemini call) — the whole
  // body is wrapped so the route always responds with JSON, never a raw platform error
  // page that breaks the client's res.json().
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const formData = await request.formData();
    const photo = formData.get('photo');
    const note = formData.get('note');

    if (!(photo instanceof File)) {
      return NextResponse.json({ error: 'Missing photo' }, { status: 400 });
    }

    const arrayBuffer = await photo.arrayBuffer();
    const imageBase64 = Buffer.from(arrayBuffer).toString('base64');

    const analysis = await analyzeFoodPhoto(
      imageBase64,
      photo.type || 'image/jpeg',
      typeof note === 'string' ? note : null
    );
    return NextResponse.json({ analysis });
  } catch (err) {
    console.error('analyze-food failed:', err);
    const message = err instanceof GeminiParseError ? err.message : 'Food analysis failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
