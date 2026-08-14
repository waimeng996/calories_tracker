import { GoogleGenerativeAI } from '@google/generative-ai';

export interface FoodAnalysis {
  description: string;
  calories: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
}

export class GeminiParseError extends Error {}

export function buildPrompt(userNote: string | null): string {
  const base =
    'You are a nutrition estimation assistant. Look at the photo — it may show the actual food, or a ' +
    'nutrition facts label — and estimate nutritional content. Respond with ONLY a JSON object (no markdown, ' +
    'no extra text) with exactly these fields: "description" (short string naming the food), "calories" ' +
    '(number, kcal), "carbsG" (number, grams), "proteinG" (number, grams), "fatG" (number, grams). Estimate ' +
    'for the entire visible portion.';
  if (userNote && userNote.trim().length > 0) {
    return (
      `${base} The user describes what they actually consumed: "${userNote.trim()}". Treat this as the ` +
      'authoritative portion/quantity, overriding "entire visible portion" above. If the photo is a nutrition ' +
      'facts label (e.g. values per 100g or per serving), read the per-unit values off the label and calculate ' +
      'the totals for the exact quantity in the note — do not default to the label\'s printed serving size.'
    );
  }
  return base;
}

function extractJsonText(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : raw).trim();
}

export function parseGeminiResponse(raw: string): FoodAnalysis {
  const jsonText = extractJsonText(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new GeminiParseError(`Gemini response was not valid JSON: ${raw.slice(0, 200)}`);
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new GeminiParseError('Gemini response was not a JSON object');
  }

  const obj = parsed as Record<string, unknown>;
  const requiredNumberFields = ['calories', 'carbsG', 'proteinG', 'fatG'] as const;
  for (const field of requiredNumberFields) {
    if (typeof obj[field] !== 'number' || Number.isNaN(obj[field])) {
      throw new GeminiParseError(`Gemini response missing or invalid numeric field "${field}"`);
    }
  }
  if (typeof obj.description !== 'string' || obj.description.length === 0) {
    throw new GeminiParseError('Gemini response missing "description" string field');
  }

  return {
    description: obj.description as string,
    calories: obj.calories as number,
    carbsG: obj.carbsG as number,
    proteinG: obj.proteinG as number,
    fatG: obj.fatG as number,
  };
}

export async function analyzeFoodPhoto(
  imageBase64: string,
  mimeType: string,
  userNote: string | null
): Promise<FoodAnalysis> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  // ponytail: 'gemini-2.5-flash' 404s live ("no longer available to new users") as of 2026-08;
  // 'gemini-flash-latest' is Google's maintained alias for the current flash model, verified
  // live against this key. Pin to a dated version if reproducibility across model updates matters.
  const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

  const result = await model.generateContent([
    buildPrompt(userNote),
    { inlineData: { data: imageBase64, mimeType } },
  ]);

  const text = result.response.text();
  return parseGeminiResponse(text);
}
