import { mirroredReps, numberPadConfig } from '../lib/workout/numberPadEdit';

describe('mirroredReps', () => {
  const above = { weight: 135, reps: 8 };

  it('mirrors the row above when the weights match', () => {
    expect(mirroredReps(above, 135, 5)).toBe(8);
  });

  it('mirrors the row above when the weight is 0 (bodyweight / not entered)', () => {
    expect(mirroredReps(above, 0, 0)).toBe(8);
  });

  it('leaves the row alone when it already mirrors the row above', () => {
    expect(mirroredReps(above, 135, 8)).toBeNull();
    expect(mirroredReps(above, 0, 8)).toBeNull();
  });

  it('clears reps that were only a stale copy once the weight diverges', () => {
    expect(mirroredReps(above, 155, 8)).toBe(0);
  });

  it('keeps typed reps when the weight diverges', () => {
    expect(mirroredReps(above, 155, 5)).toBeNull();
  });
});

describe('numberPadConfig', () => {
  const set = { weight: 142.5, reps: 6, duration: 45 };

  it('weight: decimal, unit-aware increments, has Next', () => {
    expect(numberPadConfig('weight', set, 'lbs')).toEqual({
      label: 'Weight',
      unit: 'lbs',
      value: 142.5,
      allowDecimal: true,
      increments: [-10, -5, 5, 10],
      hasNext: true,
    });
    expect(numberPadConfig('weight', set, 'kg').increments).toEqual([-5, -2.5, 2.5, 5]);
    expect(numberPadConfig('weight', set, 'kg').unit).toBe('kg');
  });

  it('reps: whole numbers, no unit, no Next', () => {
    expect(numberPadConfig('reps', set, 'lbs')).toEqual({
      label: 'Reps',
      unit: undefined,
      value: 6,
      allowDecimal: false,
      increments: [-1, 1, 2, 5],
      hasNext: false,
    });
  });

  it('duration: seconds, defaulting to 0 when unset', () => {
    expect(numberPadConfig('duration', set, 'lbs')).toEqual({
      label: 'Seconds',
      unit: 'sec',
      value: 45,
      allowDecimal: false,
      increments: [-15, -5, 5, 15],
      hasNext: false,
    });
    expect(numberPadConfig('duration', { weight: 0, reps: 0 }, 'kg').value).toBe(0);
  });
});
