import { useState } from 'react';
import playHapticFeedback from '@/lib/utils/haptic';

/**
 * Collapsible-section toggle with selection haptic — shared by the filter/preferences
 * sections that each had an identical `toggleExpanded` over an `isExpanded` state.
 */
export function useExpandToggle(initial = false): [boolean, () => void] {
  const [isExpanded, setIsExpanded] = useState(initial);
  const toggleExpanded = () => {
    playHapticFeedback('selection', false);
    setIsExpanded(!isExpanded);
  };
  return [isExpanded, toggleExpanded];
}
