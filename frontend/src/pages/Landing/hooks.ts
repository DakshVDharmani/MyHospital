import { useEffect, useRef, useState } from 'react';

/**
 * The ONE scroll reader for the whole experience.
 *
 * Watches the pinned `<section>` (`targetRef`) and turns page scroll into a
 * normalised 0→1 `progress` (0 when its top hits the viewport top, 1 when its
 * bottom does). Everything cinematic reads `progressRef`; `velocityRef` carries
 * the smoothed per-frame delta so the model can lean into fast scrolling and
 * settle when you stop. React state only updates when the active section index
 * changes — never per frame.
 */
export function useScrollProgress(targetRef: React.RefObject<HTMLElement | null>) {
  const progressRef = useRef(0); // raw target (immediate)
  const smoothRef = useRef(0); // eased — what the scene actually follows
  const velocityRef = useRef(0); // smoothed signed delta of `smooth`
  const [section, setSection] = useState(0);

  useEffect(() => {
    let raf = 0;
    let prevSmooth = 0;
    let prevT = performance.now();
    let curSection = -1;

    const bandOf = (p: number) => {
      if (p < 0.16) return 0;
      if (p < 0.4) return 1;
      if (p < 0.62) return 2;
      if (p < 0.84) return 3;
      return 4;
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - prevT) / 1000);
      prevT = now;

      const el = targetRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const scrollable = rect.height - window.innerHeight;
        progressRef.current =
          scrollable > 0 ? Math.max(0, Math.min(1, -rect.top / scrollable)) : 0;
      }

      // Exponential smoothing — frame-rate independent. This is the "camera
      // catches up smoothly / settles when you stop" feel, no scroll-jacking.
      const lambda = 6.5;
      const k = 1 - Math.exp(-lambda * dt);
      smoothRef.current += (progressRef.current - smoothRef.current) * k;

      const inst = (smoothRef.current - prevSmooth) / (dt || 1 / 60);
      prevSmooth = smoothRef.current;
      velocityRef.current += (inst - velocityRef.current) * 0.2;

      const b = bandOf(smoothRef.current);
      if (b !== curSection) {
        curSection = b;
        setSection(b);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [targetRef]);

  return { progressRef, smoothRef, velocityRef, section };
}

/**
 * Pointer position as -1..1 from screen centre, eased. On touch / no fine
 * pointer it simply stays at rest (the 3D layer adds its own gentle sway
 * instead). Consumers read `.current` every frame; nothing re-renders.
 */
export function usePointerParallax() {
  const ref = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const fine = window.matchMedia('(pointer: fine)').matches;
    if (!fine) return;
    let tx = 0;
    let ty = 0;
    let raf = 0;
    const ease = () => {
      raf = requestAnimationFrame(ease);
      ref.current.x += (tx - ref.current.x) * 0.06;
      ref.current.y += (ty - ref.current.y) * 0.06;
    };
    const onMove = (e: PointerEvent) => {
      tx = (e.clientX / window.innerWidth) * 2 - 1;
      ty = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const onLeave = () => {
      tx = 0;
      ty = 0;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerout', onLeave, { passive: true });
    raf = requestAnimationFrame(ease);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerout', onLeave);
    };
  }, []);
  return ref;
}

/** Live `prefers-reduced-motion: reduce`. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

/** Coarse device-capability probe — used to scale particle counts / DPR / AA. */
export function useIsLowPower() {
  return useRef(
    typeof window !== 'undefined' &&
      (window.matchMedia('(max-width: 820px)').matches ||
        (navigator.hardwareConcurrency ?? 8) <= 4 ||
        !window.matchMedia('(pointer: fine)').matches),
  ).current;
}
