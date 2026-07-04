// Custom Old School RuneScape–themed achievement emblems, mapped by achievement id.
// Each id points at one of 16 hand-processed pixel icons (Gemini/Nano-Banana →
// chroma-keyed → hard-pixelated for the crude OSRS/MS-Paint look). Where an id is
// listed the emblem replaces the mono Ionicon in AchievementBadge; anything not
// listed falls back to its Ionicon. Bundled at assets/achievements/*.
import { ImageSourcePropType } from 'react-native';

const trophy = require('@/assets/achievements/trophy.png');
const strength = require('@/assets/achievements/strength.png');
const flame = require('@/assets/achievements/flame.png');
const coins = require('@/assets/achievements/coins.png');
const farming = require('@/assets/achievements/farming.png');
const partyhat = require('@/assets/achievements/partyhat.png');
const skull = require('@/assets/achievements/skull.png');
const plate = require('@/assets/achievements/plate.png');
const dumbbell = require('@/assets/achievements/dumbbell.png');
const sword = require('@/assets/achievements/sword.png');
const cape = require('@/assets/achievements/cape.png');
const scroll = require('@/assets/achievements/scroll.png');
const rock = require('@/assets/achievements/rock.png');
const anvil = require('@/assets/achievements/anvil.png');
const boot = require('@/assets/achievements/boot.png');
const lightning = require('@/assets/achievements/lightning.png');

export const ACHIEVEMENT_EMBLEMS: Record<string, ImageSourcePropType> = {
  // Milestones — workouts logged. Early counts get the dumbbell; the big
  // centuries get the trophy; the 500 club earns the skill cape.
  'first-workout': dumbbell, // First Rep
  'workouts-10': dumbbell,   // Getting Serious
  'workouts-50': dumbbell,   // Committed
  'workouts-100': trophy,    // Century
  'workouts-250': trophy,    // Iron Devotee
  'workouts-500': cape,      // Iron Legend

  // Consistency — training streaks all burn the flame.
  'streak-3': flame,
  'streak-7': flame,
  'streak-14': flame,
  'streak-30': flame,
  'streak-60': flame,
  'streak-100': flame,
  // Tenure & active-days — the logbook scroll; "touch grass" gets the farming crop.
  'member-365': scroll,   // Veteran
  'days-100': scroll,     // Regular
  'days-365': scroll,     // Year of Iron
  'days-200': farming,    // Touch Grass
  'member-1000': scroll,  // Lifer

  // Volume — GP coins for weight moved; boulders for the multi-million hauls.
  'volume-100k': coins,   // Mover
  'volume-1m': coins,     // Millionaire
  'volume-5m': rock,      // Tonnage
  'volume-10m': rock,     // Earth Mover
  'meme-9000': sword,     // It's Over 9,000!

  // Reps & sets — the smithing anvil for grinding volume; the marathon boot.
  'reps-10k': anvil,      // Rep Machine
  'reps-50k': anvil,      // Rep God
  'sets-1000': anvil,     // Glutton for Punishment
  'reps-marathon': boot,  // Marathoner

  // Single-session hauls — lightning for a big day, skull for leg-day regret.
  'session-20k': lightning, // Big Session
  'session-50k': skull,     // Leg Day Regret

  // Strength tiers — the RuneScape Strength skill; S-tier earns the party hat.
  'tier-c': strength, // Above Average
  'tier-b': strength, // Strong
  'tier-a': strength, // Elite
  'tier-s': partyhat, // Legendary

  // Plate club — heaviest single set. The barbell plate, and a skull once it
  // gets genuinely dangerous.
  'plates-1': plate,
  'plates-2': plate,
  'plates-3': plate,
  'plates-4': plate,
  'plates-5': skull, // Five Plates
};
