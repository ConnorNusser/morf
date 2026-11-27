// One shared UI-thread clock for every RankAvatar on screen. A single
// withRepeat timing animation sweeps 0→1 over AURA_CLOCK_MS; each avatar maps
// it to its own orbit/pulse phase inside a worklet (every period divides the
// clock, so the wrap is seamless). Ref-counted: it runs only while at least one
// animated avatar is mounted and active, and stops entirely otherwise.
import { AURA_CLOCK_MS } from '@/lib/ui/rankAura';
import { useEffect } from 'react';
import { cancelAnimation, Easing, makeMutable, SharedValue, withRepeat, withTiming } from 'react-native-reanimated';

const clock = makeMutable(0);
let subscribers = 0;

function acquire() {
  subscribers += 1;
  if (subscribers === 1) {
    clock.value = 0;
    clock.value = withRepeat(withTiming(1, { duration: AURA_CLOCK_MS, easing: Easing.linear }), -1, false);
  }
}

function release() {
  subscribers = Math.max(0, subscribers - 1);
  if (subscribers === 0) cancelAnimation(clock);
}

export function useAuraClock(active: boolean): SharedValue<number> {
  useEffect(() => {
    if (!active) return;
    acquire();
    return release;
  }, [active]);
  return clock;
}
