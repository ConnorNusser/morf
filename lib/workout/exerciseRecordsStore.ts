// Loads the global per-exercise records, seeding them from workout history the
// first time so existing users' routines immediately anchor to real past
// performance instead of showing blank until every exercise is re-logged.
import { storageService } from '@/lib/storage/storage';
import { ExerciseRecord, GeneratedWorkout } from '@/types';
import { updateExerciseRecords } from './progression';

export async function loadExerciseRecords(
  history: GeneratedWorkout[]
): Promise<Record<string, ExerciseRecord>> {
  const existing = await storageService.getExerciseRecords();
  if (Object.keys(existing).length > 0 || history.length === 0) return existing;

  // First run: fold history oldest→newest so each exercise's anchor ends on its
  // latest session and best-e1RM reflects the all-time best. Stamp each record
  // with the real session date, not "now".
  const sorted = [...history].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  let records: Record<string, ExerciseRecord> = {};
  for (const w of sorted) {
    records = updateExerciseRecords(records, w.exercises, new Date(w.createdAt));
  }
  await storageService.saveExerciseRecords(records);
  return records;
}
