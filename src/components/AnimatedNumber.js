// src/components/AnimatedNumber.js
import { useEffect, useRef, useState } from 'react';

export default function AnimatedNumber({ value, duration = 600, format = v => v, ...props }) {
  const [display, setDisplay] = useState(value);
  const raf = useRef();
  const prev = useRef(value);

  useEffect(() => {
    if (prev.current === value) return;
    const start = prev.current;
    const end = value;
    const startTime = performance.now();
    function animate(now) {
      const elapsed = now - startTime;
      const pct = Math.min(1, elapsed / duration);
      setDisplay(Math.round(start + (end - start) * pct));
      if (pct < 1) raf.current = requestAnimationFrame(animate);
      else prev.current = value;
    }
    raf.current && cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(animate);
    return () => raf.current && cancelAnimationFrame(raf.current);
  }, [value, duration]);

  return <span {...props}>{format(display)}</span>;
}
