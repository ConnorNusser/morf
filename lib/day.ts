import { DayOfWeek } from '@/types';

/**
 * Day names for display (capitalized)
 */
export const DAY_NAMES_DISPLAY = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
] as const;

/**
 * Day names for internal use (lowercase, matches DayOfWeek type)
 */
export const DAY_NAMES_INTERNAL = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
] as const;

/**
 * Short day names for compact display
 */
export const DAY_NAMES_SHORT = [
  'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'
] as const;

/**
 * Get current day index (0 = Monday, 6 = Sunday)
 * Converts JavaScript's Date.getDay() (0 = Sunday) to our format
 */
export const getCurrentDayIndex = (): number => {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  // Convert to our format where 0 = Monday
  return dayOfWeek === 0 ? 6 : dayOfWeek - 1;
};

/**
 * Get display name for a day index (0-6)
 */
export const getDayName = (dayIndex: number): string => {
  return DAY_NAMES_DISPLAY[dayIndex] || 'Unknown';
};

/**
 * Get short name for a day index (0-6)
 */
export const getDayNameShort = (dayIndex: number): string => {
  return DAY_NAMES_SHORT[dayIndex] || 'Un';
};

/**
 * Get internal name for a day index (0-6)
 */
export const getDayNameInternal = (dayIndex: number): DayOfWeek | null => {
  return DAY_NAMES_INTERNAL[dayIndex] || null;
};

/**
 * Get day index from internal day name
 */
export const getDayIndexFromInternal = (dayName: DayOfWeek): number => {
  return DAY_NAMES_INTERNAL.indexOf(dayName);
};

/**
 * Get day index from display day name
 */
export const getDayIndexFromDisplay = (dayName: string): number => {
  return DAY_NAMES_DISPLAY.indexOf(dayName as typeof DAY_NAMES_DISPLAY[number]);
};

/**
 * Ensure a day index is valid (0-6)
 */
export const validateDayIndex = (dayIndex: number): number => {
  return Math.max(0, Math.min(6, dayIndex));
};

/**
 * Check if a day index is valid
 */
export const isValidDayIndex = (dayIndex: number): boolean => {
  return dayIndex >= 0 && dayIndex <= 6;
};

/**
 * Capitalize first letter of day name
 */
export const capitalizeDayName = (dayName: string): string => {
  return dayName.charAt(0).toUpperCase() + dayName.slice(1);
}; 