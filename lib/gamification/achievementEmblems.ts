// Custom Old School RuneScape–themed achievement emblems — one bespoke pixel icon
// per achievement. Each was generated (Gemini/Nano-Banana) then chroma-keyed and
// hard-pixelated for the crude OSRS/MS-Paint look. Progression families use
// authentic OSRS tier ladders: escalating flames for streaks, bronze→dragon metal
// weight plates, and a bronze-helm→steel-helm→strength→party-hat strength ladder.
// Anything not listed here falls back to its Ionicon. Bundled at assets/achievements/*.
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
  // Milestones — workouts logged. Dumbbell → barbell for the early counts, then a
  // bronze → gold → winged-gold trophy ladder, capped by the 500-club skill cape.
  'first-workout': src.dumbbell,   // First Rep
  'workouts-10': src.barbell,      // Getting Serious
  'workouts-50': src.bronzetrophy, // Committed
  'workouts-100': src.trophy,      // Century
  'workouts-250': src.ornatetrophy,// Iron Devotee
  'workouts-500': src.cape,        // Iron Legend

  // Consistency — streaks escalate the fire: candle → campfire → torch → blue →
  // green → purple magic flame as the streak grows.
  'streak-3': src.candle,       // Warming Up
  'streak-7': src.flame,        // Full Week
  'streak-14': src.torch,       // Locked In
  'streak-30': src.flameBlue,   // Unstoppable
  'streak-60': src.flameGreen,  // Iron Will
  'streak-100': src.flamePurple,// Relentless

  // Tenure & active days — the hourglass, the logbook scroll, an iron bar for a
  // year of iron, the farming crop for "touch grass", and a gravestone for a lifer.
  'member-365': src.hourglass,  // Veteran
  'days-100': src.scroll,       // Regular
  'days-365': src.ironbar,      // Year of Iron
  'days-200': src.farming,      // Touch Grass
  'member-1000': src.gravestone,// Lifer

  // Volume — coins → money sack for weight moved, a boulder then a whole planet for
  // the mega-hauls, and a sword for the "It's Over 9,000!" wink.
  'volume-100k': src.coins,     // Mover
  'volume-1m': src.moneysack,   // Millionaire
  'volume-5m': src.rock,        // Tonnage
  'volume-10m': src.planet,     // Earth Mover
  'meme-9000': src.sword,       // It's Over 9,000!

  // Reps & sets — the smithing anvil → warhammer for rep grinds, a spiked mace for
  // the glutton, and a winged boot for the marathon.
  'reps-10k': src.anvil,        // Rep Machine
  'reps-50k': src.warhammer,    // Rep God
  'sets-1000': src.mace,        // Glutton for Punishment
  'reps-marathon': src.boot,    // Marathoner

  // Single-session hauls — lightning for a big day, a skull for leg-day regret.
  'session-20k': src.lightning, // Big Session
  'session-50k': src.skull,     // Leg Day Regret

  // Strength tiers — an OSRS armour ladder: bronze helm → steel helm → the Strength
  // skill arm → the party-hat rare at the top.
  'tier-c': src.bronzehelm, // Above Average
  'tier-b': src.steelhelm,  // Strong
  'tier-a': src.strength,   // Elite
  'tier-s': src.partyhat,   // Legendary

  // Plate club — heaviest single set, climbing the OSRS metal tiers:
  // bronze → iron → mithril → adamant → dragon.
  'plates-1': src.plateBronze,  // One Plate
  'plates-2': src.plate,        // Plate Tectonics (iron / grey)
  'plates-3': src.plateMithril, // Three Plate Club
  'plates-4': src.plateAdamant, // Four Plate Monster
  'plates-5': src.plateDragon,  // Five Plates
};
