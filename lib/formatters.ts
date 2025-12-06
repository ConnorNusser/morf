/**
 * Formatting utilities for dates, durations, and display values
 */

/**
 * Format a date as relative time (e.g., "2m ago", "3h ago", "5d ago")
 */
export const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffWeeks < 4) return `${diffWeeks}w ago`;
  return date.toLocaleDateString();
};

/**
 * Format seconds as duration (e.g., "45min", "1h 15m")
 */
export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}min`;
};

/**
 * Format a number with locale-specific separators (e.g., 1,234,567)
 */
export const formatNumber = (num: number): string => {
  return num.toLocaleString();
};

/**
 * Format weight with unit (e.g., "185 lbs", "84 kg")
 */
export const formatWeight = (weight: number, unit: 'lbs' | 'kg' = 'lbs'): string => {
  return `${Math.round(weight)} ${unit}`;
};
