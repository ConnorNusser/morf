// Content moderation utilities.

const BLOCKED_WORDS = [
  'nigger', 'nigga', 'faggot', 'fag', 'retard', 'retarded', 'chink', 'spic', 'kike', 'wetback', 'beaner', 'gook', 'tranny', 'coon',
  'fuck', 'shit', 'ass', 'bitch', 'cunt', 'dick', 'cock', 'pussy', 'whore', 'slut', 'bastard', 'damn', 'piss',
  'penis', 'vagina', 'boob', 'tits', 'anal', 'porn', 'xxx', 'sex', 'nude', 'naked',
  'kill', 'murder', 'rape', 'terrorist', 'nazi', 'hitler',
  'pedo', 'molest', 'incest',
];

export function containsProfanity(text: string): boolean {
  const lower = text.toLowerCase();

  for (const word of BLOCKED_WORDS) {
    if (lower.includes(word)) {
      return true;
    }
  }
  return false;
}
