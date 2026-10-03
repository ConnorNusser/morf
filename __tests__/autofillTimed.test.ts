import { getLastSetsFor } from '@/lib/workout/autofill';
import { LoggedWorkout } from '@/types';

// A timed hold is logged as weight 0 / reps 0 + duration (HoldTimer → editSet).
const plankSession = {
  id: 'w1',
  title: 'Core',
  createdAt: new Date('2026-09-28T10:00:00'),
  exercises: [
    {
      id: 'plank',
      completedSets: [
        { setNumber: 1, weight: 0, reps: 0, unit: 'lbs', completed: true, duration: 90 },
        { setNumber: 2, weight: 0, reps: 0, unit: 'lbs', completed: true, duration: 75 },
      ],
    },
  ],
} as unknown as LoggedWorkout;

describe('getLastSetsFor — timed holds', () => {
  it('carries the hold duration so "prev" and autofill show last time', () => {
    const sets = getLastSetsFor('plank', [plankSession], 'lbs');
    expect(sets?.map(s => s.duration)).toEqual([90, 75]);
  });
});
