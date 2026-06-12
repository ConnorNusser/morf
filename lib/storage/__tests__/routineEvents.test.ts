import { emitRoutinesChanged, subscribeRoutinesChanged } from '../routineEvents';

describe('routineEvents', () => {
  it('notifies subscribers on emit and stops after unsubscribe', () => {
    let a = 0;
    let b = 0;
    const offA = subscribeRoutinesChanged(() => { a++; });
    const offB = subscribeRoutinesChanged(() => { b++; });

    emitRoutinesChanged();
    expect(a).toBe(1);
    expect(b).toBe(1);

    offA();
    emitRoutinesChanged();
    expect(a).toBe(1); // unsubscribed
    expect(b).toBe(2);

    offB();
  });

  it('a throwing listener does not block the others', () => {
    let reached = false;
    const off1 = subscribeRoutinesChanged(() => { throw new Error('boom'); });
    const off2 = subscribeRoutinesChanged(() => { reached = true; });
    expect(() => emitRoutinesChanged()).not.toThrow();
    expect(reached).toBe(true);
    off1();
    off2();
  });
});
