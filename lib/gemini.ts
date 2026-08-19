import { GoogleGenerativeAI } from '@google/generative-ai';

export interface FoodAnalysis {
  description: string;
  calories: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
  breakdown: string;
}

export class GeminiParseError extends Error {}

export function buildPrompt(userNote: string | null): string {
  const base =
    'You are a nutrition estimation assistant. Look at the photo — it may show the actual food, or a ' +
    'nutrition facts label — and estimate nutritional content. Account for likely hidden ingredients implied ' +
    'by the dish (e.g. mayo/dressing in a sandwich, oil used in cooking, sauce, bread/wrap type) even if not ' +
    'visible, not just the visible filling. Respond with ONLY a JSON object (no markdown, ' +
    'no extra text) with exactly these fields: "description" (short string naming the food), "calories" ' +
    '(number, kcal), "carbsG" (number, grams), "proteinG" (number, grams), "fatG" (number, grams), ' +
    '"breakdown" (string — your reasoning broken down by component, ONE COMPONENT PER LINE separated by ' +
    '"\\n", e.g. for a tuna mayo sandwich: one line for bread slice count and kcal, one line for tuna+mayo ' +
    'portion and its kcal/fat, one line per other filling; for a fried dish: one line for main ingredient ' +
    'portion in grams and its kcal/carbs, one line for oil/sauce used in cooking. Each line states its own ' +
    'estimated kcal/macros so the numbers in the other fields can be sanity-checked against it). ' +
    'Estimate for the entire visible portion.';
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
    // Reasoning aid, not user input — model sometimes omits it, so don't hard-fail the whole
    // analysis over a missing breakdown when the numeric fields it's meant to explain are fine.
    breakdown: typeof obj.breakdown === 'string' ? obj.breakdown : '',
  };
}

// Bound how long we wait on Gemini. Without this, a slow response leaves the connection
// idle until some network proxy on the user's path kills it with its own generic timeout
// page (e.g. "Inactivity Timeout") instead of a JSON error we control.
const GEMINI_TIMEOUT_MS = 45_000;

export async function analyzeFoodPhoto(
  imageBase64: string,
  mimeType: string,
  userNote: string | null
): Promise<FoodAnalysis> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  // ponytail: 'gemini-2.0-flash' and 'gemini-2.5-flash' both 404 live as of 2026-08 (retired).
  // 'gemini-flash-latest' (thinking-enabled) is more accurate (reasons about hidden
  // ingredients like sauce/mayo) but confirmed hit-or-miss with "high demand" 503s.
  // 'gemini-flash-lite-latest' has no thinking step but is fast and healthy. Try the
  // accurate one first, fall back to lite on 503 rather than failing the whole analysis.
  const content = [buildPrompt(userNote), { inlineData: { data: imageBase64, mimeType } }];
  const modelNames = ['gemini-flash-latest', 'gemini-flash-lite-latest'];

  let text: string | undefined;
  let lastErr: unknown;
  for (const modelName of modelNames) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(content, { timeout: GEMINI_TIMEOUT_MS });
      text = result.response.text();
      break;
    } catch (err) {
      lastErr = err;
      const message = err instanceof Error ? err.message : String(err);
      if (message.toLowerCase().includes('timeout') || message.toLowerCase().includes('abort')) {
        throw new GeminiParseError('AI 分析超时, 请重试或手动输入营养数据');
      }
      // 503 ("high demand") — worth a shot on the next (fallback) model; anything else
      // (bad key, quota, etc.) will just fail the same way again, so don't bother retrying.
      if (!message.includes('503')) throw err;
    }
  }
  if (text === undefined) throw lastErr;

  return parseGeminiResponse(text);
}
