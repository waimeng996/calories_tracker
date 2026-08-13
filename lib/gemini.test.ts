import { describe, it, expect } from 'vitest';
import { parseGeminiResponse, buildPrompt, GeminiParseError } from './gemini';

describe('buildPrompt', () => {
  it('includes the user note as extra context when provided', () => {
    const prompt = buildPrompt('light mayo, low fat milk');
    expect(prompt).toContain('light mayo, low fat milk');
  });

  it('omits note context when none is given', () => {
    const prompt = buildPrompt(null);
    expect(prompt).not.toContain('null');
  });
});

describe('parseGeminiResponse', () => {
  it('parses a clean JSON response', () => {
    const raw = JSON.stringify({
      description: 'Grilled chicken breast with rice and broccoli',
      calories: 520,
      carbsG: 55,
      proteinG: 40,
      fatG: 12,
    });
    const result = parseGeminiResponse(raw);
    expect(result).toEqual({
      description: 'Grilled chicken breast with rice and broccoli',
      calories: 520,
      carbsG: 55,
      proteinG: 40,
      fatG: 12,
    });
  });

  it('parses JSON wrapped in a markdown code fence', () => {
    const raw = '```json\n{"description":"Toast with butter","calories":250,"carbsG":30,"proteinG":5,"fatG":10}\n```';
    const result = parseGeminiResponse(raw);
    expect(result.calories).toBe(250);
  });

  it('throws GeminiParseError on non-JSON text', () => {
    expect(() => parseGeminiResponse('Sorry, I cannot analyze this image.')).toThrow(GeminiParseError);
  });

  it('throws GeminiParseError when a required field is missing', () => {
    const raw = JSON.stringify({ description: 'Salad', calories: 200, carbsG: 10 });
    expect(() => parseGeminiResponse(raw)).toThrow(GeminiParseError);
  });

  it('throws GeminiParseError when a numeric field is not a number', () => {
    const raw = JSON.stringify({ description: 'Salad', calories: 'a lot', carbsG: 10, proteinG: 5, fatG: 5 });
    expect(() => parseGeminiResponse(raw)).toThrow(GeminiParseError);
  });
});
