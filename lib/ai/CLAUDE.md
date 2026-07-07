# lib/ai — AI generation

Google **Gemini** (`@google/generative-ai`) turns user intent into workouts, routines, and exercise metadata. Key: `EXPO_PUBLIC_GEMINI_API_KEY`. Two singleton services, each with a **deterministic fallback** so the app works with no key and no network.

## Modules

| File | Role |
| --- | --- |
| `aiWorkoutGenerator.ts` | Singleton `aiWorkoutGenerator`. `generateWorkoutNote()`, `refinePlan()`, `generateCustomExerciseMetadata()`. Single workouts + custom-exercise enrichment. |
| `aiRoutineGenerator.ts` | Singleton `aiRoutineGenerator`. `generateRoutineProgram()`, `refineRoutineProgram()`, `convertToRoutines()`. Multi-day programs from a `ProgramTemplate`. |
| `geminiJson.ts` | `parseGeminiJson()` — strips ```` ``` ```` fences and parses model JSON. **Every model response goes through this**; don't hand-roll parsing. |
| `splitTemplates.ts` | Training-split scaffolds (PPL, upper/lower, etc.). |
| `prompts/*.prompt.ts` | Pure prompt string factories — see below. |

## Prompts live in `prompts/`, not inline

Every prompt is a pure `build…Prompt(params) => string` factory. **Edit these files to change model behavior** — the service methods only assemble params and call the model.

- `workoutGeneration.prompt.ts` — `buildWorkoutGenerationPrompt` + `EXERCISE_NAMING_INSTRUCTIONS` (the canonical naming rules; shared/imported, not duplicated).
- `routineGeneration.prompt.ts` — `buildRoutineGenerationPrompt`
- `workoutRefinement.prompt.ts` — `buildWorkoutRefinementPrompt`
- `customExercise.prompt.ts` — `buildCustomExercisePrompt`
- `workoutNoteParsing.prompt.ts` — `buildWorkoutNoteParsingPrompt`

## Model routing

Set per-call in `getGenerativeModel({ model })`:
- `gemini-2.5-flash` — generation & refinement (workouts, routines).
- `gemini-3.1-flash-lite` — cheap enrichment (custom-exercise metadata).

When adding a call, pick the model explicitly at the call site; there's no shared default.

## Invariants — keep these true

- **Fallbacks are not optional.** Each generator has a `generateFallback…` path used when the key is missing, the request fails, or JSON won't parse. New generation features need a deterministic fallback too, or they break the no-key/offline experience.
- **There's a non-AI parsing path.** Freeform/voice set logging goes through `lib/workout/workoutNoteParser.ts` + `localWorkoutParser.ts` (deterministic, tested in `__tests__/localWorkoutParser.test.ts`) — not through Gemini. Don't route logging through the model.
- **Output must map onto `types/index.ts`.** Generated shapes (`GeneratedWorkout`, `Routine`, `CustomExercise`) are hand-typed there; exercise ids must resolve against `lib/data/exercises.json` (`aiRoutineGenerator` does fuzzy name→id matching in `findExerciseByName`/`convertToRoutines`).

## Tests

`lib/ai/__tests__/convertToRoutines.test.ts` and root `__tests__/aiParserIntegration.test.ts` cover the deterministic conversion/parsing — run `npx jest convertToRoutines` after touching routine conversion or exercise matching.
