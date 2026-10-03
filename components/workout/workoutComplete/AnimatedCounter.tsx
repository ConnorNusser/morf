import { Text } from '@/components/Themed';
import React, { useEffect, useState } from 'react';

const AnimatedCounter = ({
  value,
  suffix = '',
  duration = 1500,
  delay = 0,
  style,
}: {
  value: number;
  suffix?: string;
  duration?: number;
  delay?: number;
  style?: any;
}) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    // Count up 0 → value via RAF rather than hard-jumping when the timeout fires.
    let raf = 0;
    let start: number | null = null;
    const begin = setTimeout(() => {
      const tick = (now: number) => {
        if (start === null) start = now;
        const p = duration > 0 ? Math.min(1, (now - start) / duration) : 1;
        const eased = 1 - Math.pow(1 - p, 3);
        setDisplayValue(Math.round(value * eased));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => { clearTimeout(begin); if (raf) cancelAnimationFrame(raf); };
  }, [value, delay, duration]);

  return (
    <Text style={style}>
      {displayValue}{suffix}
    </Text>
  );
};

export default AnimatedCounter;
