// Parse a Gemini text response into JSON, stripping any ```json fences.
// Throws on empty/invalid content — callers handle AI failures via try/catch.
export function parseGeminiJson(content: string | undefined | null): any {
  if (!content) {
    throw new Error('No content received from AI');
  }
  let cleanedContent = content.trim();
  if (cleanedContent.startsWith('```')) {
    cleanedContent = cleanedContent.replace(/```json?\n?/g, '').replace(/```\n?$/g, '');
  }
  return JSON.parse(cleanedContent);
}
