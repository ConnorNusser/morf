import {
  buildSetSnapshot,
  currentSnapshotSet,
  setActivityContent,
} from '../lib/workout/liveSetSnapshot';
import { WorkoutDraft } from '../lib/workout/workoutDraft';

const draft: WorkoutDraft = [
  {
    key: 'a',
    name: 'Bench Press',
    recognized: true,
    sets: [
      { weight: 135, reps: 8, unit: 'lbs', done: true },
      { weight: 155, reps: 6, unit: 'lbs' },
    ],
  },
  {
    key: 'b',
    name: '',
    recognized: false,
    sets: [{ weight: 60, reps: 10, unit: 'kg', done: false }],
  },
];

describe('buildSetSnapshot', () => {
  it('flattens every set in draft order with 1-based set numbers', () => {
    expect(buildSetSnapshot(draft)).toEqual([
      { exerciseKey: 'a', exerciseName: 'Bench Press', setNumber: 1, totalSets: 2, reps: 8, weight: 135, unit: 'lbs', done: true },
      { exerciseKey: 'a', exerciseName: 'Bench Press', setNumber: 2, totalSets: 2, reps: 6, weight: 155, unit: 'lbs', done: false },
      { exerciseKey: 'b', exerciseName: 'Exercise', setNumber: 1, totalSets: 1, reps: 10, weight: 60, unit: 'kg', done: false },
    ]);
  });

  it('is empty for an empty draft or exercises with no sets', () => {
    expect(buildSetSnapshot([])).toEqual([]);
    expect(buildSetSnapshot([{ key: 'c', name: 'Squat', recognized: true, sets: [] }])).toEqual([]);
  });
});

describe('currentSnapshotSet', () => {
  it('is the first not-done set', () => {
    const current = currentSnapshotSet(buildSetSnapshot(draft));
    expect(current?.exerciseKey).toBe('a');
    expect(current?.setNumber).toBe(2);
  });

  it('is null when everything is done or there are no sets', () => {
    const allDone = buildSetSnapshot(draft).map((s) => ({ ...s, done: true }));
    expect(currentSnapshotSet(allDone)).toBeNull();
    expect(currentSnapshotSet([])).toBeNull();
  });
});

describe('setActivityContent', () => {
  it('builds the SET-mode payload without the done flag, in a stable field order', () => {
    const current = currentSnapshotSet(buildSetSnapshot(draft))!;
    const content = setActivityContent(current);
    expect(content).toEqual({
      mode: 'set',
      workoutTitle: 'Workout',
      set: { exerciseKey: 'a', exerciseName: 'Bench Press', setNumber: 2, totalSets: 2, reps: 6, weight: 155, unit: 'lbs' },
    });
    // The screen dedupes Live Activity updates on this exact string.
    expect(JSON.stringify(content)).toBe(
      '{"mode":"set","workoutTitle":"Workout","set":{"exerciseKey":"a","exerciseName":"Bench Press","setNumber":2,"totalSets":2,"reps":6,"weight":155,"unit":"lbs"}}',
    );
  });
});
