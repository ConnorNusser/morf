// Shared training types. Only these aliases remain (routine generation is now
// deterministic — see lib/data/programTemplates.ts); they stay here because
// several modules already import them from this path.

export type TrainingGoal = 'hypertrophy' | 'strength' | 'powerbuilding' | 'recomp' | 'athletic' | 'general';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
