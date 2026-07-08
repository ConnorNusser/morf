// OSRS-themed pixel achievement emblems; anything not listed falls back to its Ionicon.
import { ImageSourcePropType } from 'react-native';

const src = {
  anvil: require('@/assets/achievements/anvil.png'),
  barbell: require('@/assets/achievements/barbell.png'),
  boot: require('@/assets/achievements/boot.png'),
  bronzehelm: require('@/assets/achievements/bronzehelm.png'),
  bronzetrophy: require('@/assets/achievements/bronzetrophy.png'),
  candle: require('@/assets/achievements/candle.png'),
  cape: require('@/assets/achievements/cape.png'),
  coins: require('@/assets/achievements/coins.png'),
  dumbbell: require('@/assets/achievements/dumbbell.png'),
  farming: require('@/assets/achievements/farming.png'),
  flame: require('@/assets/achievements/flame.png'),
  flameBlue: require('@/assets/achievements/flame-blue.png'),
  flameGreen: require('@/assets/achievements/flame-green.png'),
  flamePurple: require('@/assets/achievements/flame-purple.png'),
  gravestone: require('@/assets/achievements/gravestone.png'),
  hourglass: require('@/assets/achievements/hourglass.png'),
  ironbar: require('@/assets/achievements/ironbar.png'),
  lightning: require('@/assets/achievements/lightning.png'),
  mace: require('@/assets/achievements/mace.png'),
  moneysack: require('@/assets/achievements/moneysack.png'),
  ornatetrophy: require('@/assets/achievements/ornatetrophy.png'),
  partyhat: require('@/assets/achievements/partyhat.png'),
  planet: require('@/assets/achievements/planet.png'),
  plate: require('@/assets/achievements/plate.png'),
  plateBronze: require('@/assets/achievements/plate-bronze.png'),
  plateMithril: require('@/assets/achievements/plate-mithril.png'),
  plateAdamant: require('@/assets/achievements/plate-adamant.png'),
  plateDragon: require('@/assets/achievements/plate-dragon.png'),
  rock: require('@/assets/achievements/rock.png'),
  scroll: require('@/assets/achievements/scroll.png'),
  skull: require('@/assets/achievements/skull.png'),
  steelhelm: require('@/assets/achievements/steelhelm.png'),
  strength: require('@/assets/achievements/strength.png'),
  sword: require('@/assets/achievements/sword.png'),
  torch: require('@/assets/achievements/torch.png'),
  trophy: require('@/assets/achievements/trophy.png'),
  warhammer: require('@/assets/achievements/warhammer.png'),
};

export const ACHIEVEMENT_EMBLEMS: Record<string, ImageSourcePropType> = {
  // Milestones — workouts logged
  'first-workout': src.dumbbell,
  'workouts-10': src.barbell,
  'workouts-50': src.bronzetrophy,
  'workouts-100': src.trophy,
  'workouts-250': src.ornatetrophy,
  'workouts-500': src.cape,

  // Consistency — streaks
  'streak-3': src.candle,
  'streak-7': src.flame,
  'streak-14': src.torch,
  'streak-30': src.flameBlue,
  'streak-60': src.flameGreen,
  'streak-100': src.flamePurple,

  // Tenure & active days
  'member-365': src.hourglass,
  'days-100': src.scroll,
  'days-365': src.ironbar,
  'days-200': src.farming,
  'member-1000': src.gravestone,

  // Volume
  'volume-100k': src.coins,
  'volume-1m': src.moneysack,
  'volume-5m': src.rock,
  'volume-10m': src.planet,
  'meme-9000': src.sword,

  // Reps & sets
  'reps-10k': src.anvil,
  'reps-50k': src.warhammer,
  'sets-1000': src.mace,
  'reps-marathon': src.boot,

  // Single-session hauls
  'session-20k': src.lightning,
  'session-50k': src.skull,

  // Strength tiers
  'tier-c': src.bronzehelm,
  'tier-b': src.steelhelm,
  'tier-a': src.strength,
  'tier-s': src.partyhat,

  // Plate club — heaviest single set
  'plates-1': src.plateBronze,
  'plates-2': src.plate,
  'plates-3': src.plateMithril,
  'plates-4': src.plateAdamant,
  'plates-5': src.plateDragon,

  // Absolute-strength "clubs" (powerlifting total)
  'total-600': src.barbell,
  'total-800': src.bronzetrophy,
  'total-1000': src.ornatetrophy,
  'total-1200': src.cape,
  'total-1300': src.ironbar,
  'total-1500': src.partyhat,

  // Niche / Strava-style badges
  'early-bird': src.candle,
  'night-owl': src.flamePurple,
  'vampire-hours': src.skull,
  'double-duty': src.dumbbell,
  'weekend-warrior': src.sword,
  'comeback-kid': src.torch,
  'four-seasons': src.farming,
  'well-rounded': src.strength,
  'balanced': src.barbell,
  'renaissance-lifter': src.scroll,
  'marathon-set': src.boot,
  'century-set': src.warhammer,
  'new-year': src.partyhat,
  'turkey-burn': src.flame,
  'gym-on-christmas': src.moneysack,
  'leap-of-faith': src.lightning,
};

// Bodyweight-ratio milestones use dynamic ids (`bw-<liftId>-<ratio>`); resolve by lift family.
export function emblemFor(id: string): ImageSourcePropType | undefined {
  const direct = ACHIEVEMENT_EMBLEMS[id];
  if (direct) return direct;
  if (id.startsWith('bw-deadlift')) return src.plateDragon;
  if (id.startsWith('bw-squat')) return src.plateAdamant;
  if (id.startsWith('bw-bench')) return src.plateMithril;
  if (id.startsWith('bw-overhead-press')) return src.barbell;
  return undefined;
}
