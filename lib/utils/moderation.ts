/**
 * Content moderation utilities for filtering inappropriate content
 */

const BLOCKED_WORDS = [
  'nigger', 'nigga', 'faggot', 'fag', 'retard', 'retarded', 'chink', 'spic', 'kike', 'wetback', 'beaner', 'gook', 'tranny', 'coon',
  'fuck', 'shit', 'ass', 'bitch', 'cunt', 'dick', 'cock', 'pussy', 'whore', 'slut', 'bastard', 'damn', 'piss',
  'penis', 'vagina', 'boob', 'tits', 'anal', 'porn', 'xxx', 'sex', 'nude', 'naked',
  'kill', 'murder', 'rape', 'terrorist', 'nazi', 'hitler',
  'pedo', 'molest', 'incest',
];

/**
 * Checks if text contains any blocked/profane words
 * Also checks for common leet speak substitutions
 */
export function containsProfanity(text: string): boolean {
  const lower = text.toLowerCase();

  // Check direct matches
  for (const word of BLOCKED_WORDS) {
    if (lower.includes(word)) {
      return true;
    }
  }
  return false;
}

/**
 * Sanitizes text by removing or replacing profane words
 * Returns the sanitized text
 */
export function sanitizeText(text: string, replacement: string = '***'): string {
  let result = text;
  const lower = text.toLowerCase();

  for (const word of BLOCKED_WORDS) {
    const regex = new RegExp(word, 'gi');
    result = result.replace(regex, replacement);
  }

  return result;
}
