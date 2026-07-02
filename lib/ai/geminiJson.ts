// Parse a Gemini text response into JSON, stripping any ```json fences the model
// wraps around the payload. Throws when there's no content or the JSON is invalid
// (callers already handle AI failures via their surrounding try/catch).
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
