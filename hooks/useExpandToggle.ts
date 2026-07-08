import { useState } from 'react';
import playHapticFeedback from '@/lib/utils/haptic';

// Collapsible-section toggle with selection haptic.
export function useExpandToggle(initial = false): [boolean, () => void] {
  const [isExpanded, setIsExpanded] = useState(initial);
  const toggleExpanded = () => {
    playHapticFeedback('selection', false);
    setIsExpanded(!isExpanded);
  };
  return [isExpanded, toggleExpanded];
}
