import { gsap } from 'gsap';
import { useState, useEffect, useRef } from 'react';

export function useAnimatedNumber(target: number, duration = 0.7): number {
  const [display, setDisplay] = useState(target);
  const obj = useRef({ val: target });

  useEffect(() => {
    gsap.to(obj.current, {
      val: target,
      duration,
      ease: 'power2.out',
      onUpdate() { setDisplay(Math.round(obj.current.val)); },
    });
  }, [target, duration]);

  return display;
}
