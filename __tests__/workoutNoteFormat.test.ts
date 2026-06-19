import { GeneratedWorkout } from '../types';
import { workoutToNoteText } from '../lib/workout/workoutNoteFormat';
import { workoutNoteParser } from '../lib/workout/workoutNoteParser';

function set(weight: number, reps: number, completed = true) {
  return { setNumber: 1, weight, reps, unit: 'lbs' as const, completed };
}

function workout(exercises: { id: string; sets: ReturnType<typeof set>[] }[]): GeneratedWorkout {
  return {
    id: 'w1',
    title: 't',
    description: '',
    estimatedDuration: 60,
    difficulty: 'medium',
    createdAt: new Date(2026, 5, 10),
    exercises: exercises.map(e => ({
      id: e.id,
      sets: e.sets.length,
      reps: '',
      isCompleted: true,
      completedSets: e.sets,
    })),
  } as unknown as GeneratedWorkout;
}

describe('workoutToNoteText', () => {
  it('renders weighted sets as "Name wxr, wxr"', () => {
    const text = workoutToNoteText(workout([
      { id: 'bench-press-barbell', sets: [set(135, 8), set(155, 6)] },
    ]));
    expect(text).toContain('135x8, 155x6');
  });

  it('renders bodyweight sets as "xreps"', () => {
    const text = workoutToNoteText(workout([
      { id: 'pull-ups-bodyweight', sets: [set(0, 10), set(0, 8)] },
    ]));
    expect(text).toContain('x10, x8');
    expect(text).not.toContain('0x10');
  });

  it('skips incomplete sets and empty exercises', () => {
    const text = workoutToNoteText(workout([
      { id: 'bench-press-barbell', sets: [set(135, 8), set(155, 6, false)] },
      { id: 'squat-barbell', sets: [set(0, 0)] }, // nothing loggable
    ]));
    expect(text).toContain('135x8');
    expect(text).not.toContain('155x6');
    expect(text.split('\n')).toHaveLength(1); // squat line dropped
  });

  it('round-trips weighted lifts back through the local parser', () => {
    const text = workoutToNoteText(workout([
      { id: 'bench-press-barbell', sets: [set(135, 8), set(155, 6)] },
    ]));
    const parsed = workoutNoteParser.parseLocal(text);
    expect(parsed.exercises).toHaveLength(1);
    expect(parsed.exercises[0].sets).toHaveLength(2);
    expect(parsed.exercises[0].sets[0]).toMatchObject({ weight: 135, reps: 8 });
    expect(parsed.exercises[0].sets[1]).toMatchObject({ weight: 155, reps: 6 });
  });
});

describe('parseLocal', () => {
  it('returns empty for blank input', () => {
    expect(workoutNoteParser.parseLocal('   ')).toEqual({ exercises: [], confidence: 0, rawText: '   ' });
  });

  it('parses multiple lines synchronously', () => {
    const parsed = workoutNoteParser.parseLocal('Bench 135x8, 155x6\nSquat 225x5');
    expect(parsed.exercises).toHaveLength(2);
    expect(parsed.exercises[0].sets[0]).toMatchObject({ weight: 135, reps: 8 });
    expect(parsed.exercises[1].sets[0]).toMatchObject({ weight: 225, reps: 5 });
  });
});
