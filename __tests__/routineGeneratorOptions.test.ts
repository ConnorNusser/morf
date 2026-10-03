import {
  buildRoutineOptions,
  DURATION_OPTIONS,
  filterBrowseExercises,
  RoutineGeneratorSelections,
  selectProgramTemplate,
} from '../lib/workout/routineGeneratorOptions';

describe('selectProgramTemplate', () => {
  it('maps strength to full body at 3 days and the strength split above', () => {
    expect(selectProgramTemplate('strength', 3)).toBe('full_body');
    expect(selectProgramTemplate('strength', 4)).toBe('strength');
    expect(selectProgramTemplate('strength', 6)).toBe('strength');
  });

  it('maps hypertrophy across the day counts', () => {
    expect(selectProgramTemplate('hypertrophy', 3)).toBe('ppl');
    expect(selectProgramTemplate('hypertrophy', 4)).toBe('upper_lower');
    expect(selectProgramTemplate('hypertrophy', 5)).toBe('bro_split');
    expect(selectProgramTemplate('hypertrophy', 6)).toBe('ppl');
  });

  it('maps powerbuilding across the day counts', () => {
    expect(selectProgramTemplate('powerbuilding', 3)).toBe('full_body');
    expect(selectProgramTemplate('powerbuilding', 4)).toBe('upper_lower');
    expect(selectProgramTemplate('powerbuilding', 5)).toBe('powerbuilding');
  });

  it('shares the default mapping for recomp, athletic, and general', () => {
    for (const goal of ['recomp', 'athletic', 'general'] as const) {
      expect(selectProgramTemplate(goal, 3)).toBe('full_body');
      expect(selectProgramTemplate(goal, 4)).toBe('upper_lower');
      expect(selectProgramTemplate(goal, 5)).toBe('ppl');
      expect(selectProgramTemplate(goal, 6)).toBe('ppl');
    }
  });
});

describe('buildRoutineOptions', () => {
  const base: RoutineGeneratorSelections = {
    selectedGoal: 'hypertrophy',
    selectedDays: 4,
    selectedDuration: 60,
    selectedExperience: null,
    selectedFocus: [],
    ignoredMuscles: [],
    includedExercises: [],
    excludedExercises: [],
  };

  it('defaults to beginner and leaves empty lists undefined', () => {
    expect(buildRoutineOptions(base)).toEqual({
      programTemplate: 'upper_lower',
      trainingGoal: 'hypertrophy',
      weeklyDays: 4,
      focusMuscles: undefined,
      ignoredMuscles: undefined,
      trainingYears: 0,
      experienceLevel: 'beginner',
      workoutDuration: 60,
      exercisesPerWorkout: { min: 5, max: 5 },
      includedExercises: undefined,
      excludedExercises: undefined,
    });
  });

  it('passes through experience, muscles, and exercise picks', () => {
    const options = buildRoutineOptions({
      ...base,
      selectedGoal: 'strength',
      selectedDays: 3,
      selectedDuration: 90,
      selectedExperience: 'advanced',
      selectedFocus: ['chest'],
      ignoredMuscles: ['legs'],
      includedExercises: ['bench-press'],
      excludedExercises: ['squat'],
    });
    expect(options.programTemplate).toBe('full_body');
    expect(options.trainingYears).toBe(4);
    expect(options.experienceLevel).toBe('advanced');
    expect(options.exercisesPerWorkout).toEqual({ min: 6, max: 7 });
    expect(options.focusMuscles).toEqual(['chest']);
    expect(options.ignoredMuscles).toEqual(['legs']);
    expect(options.includedExercises).toEqual(['bench-press']);
    expect(options.excludedExercises).toEqual(['squat']);
  });

  it('uses the exercise range of every duration option', () => {
    for (const option of DURATION_OPTIONS) {
      const options = buildRoutineOptions({ ...base, selectedDuration: option.id });
      expect(options.exercisesPerWorkout).toEqual({ min: option.min, max: option.max });
    }
  });
});

describe('filterBrowseExercises', () => {
  const exercises = [
    { id: 'bench', name: 'Bench Press', muscleGroup: 'chest' },
    { id: 'row', name: 'Barbell Row', muscleGroup: 'back' },
    { id: 'fly', name: 'Cable Fly', muscleGroup: 'chest' },
    { id: 'mystery', name: 'Back Extension', muscleGroup: '' },
  ];
  const ids = (list: { id: string }[]) => list.map(e => e.id);

  it('returns the same list when nothing is filtered', () => {
    expect(filterBrowseExercises(exercises, null, '')).toBe(exercises);
    expect(filterBrowseExercises(exercises, null, '   ')).toBe(exercises);
  });

  it('filters by exact muscle group', () => {
    expect(ids(filterBrowseExercises(exercises, 'chest', ''))).toEqual(['bench', 'fly']);
  });

  it('matches the query against name or muscle, case-insensitively and trimmed', () => {
    expect(ids(filterBrowseExercises(exercises, null, '  BACK '))).toEqual(['row', 'mystery']);
    expect(ids(filterBrowseExercises(exercises, null, 'press'))).toEqual(['bench']);
  });

  it('applies the muscle filter and the query together', () => {
    expect(ids(filterBrowseExercises(exercises, 'chest', 'cable'))).toEqual(['fly']);
    expect(ids(filterBrowseExercises(exercises, 'back', 'bench'))).toEqual([]);
  });
});
