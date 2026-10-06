'use client';

import { useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { motion, useMotionValueEvent, useScroll, useTransform } from 'framer-motion';

const QUERY = '(max-width: 760px) and (prefers-reduced-motion: no-preference)';
function subscribe(onChange: () => void) {
  const query = window.matchMedia(QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}
const snapshot = () => window.matchMedia(QUERY).matches;
const serverSnapshot = () => false;

type HeroContent = { art: ReactNode; intro: ReactNode; demo: ReactNode };

function AnimatedHero({ art, intro, demo }: HeroContent) {
  const scene = useRef<HTMLDivElement>(null);
  // Both endpoints use the same fixed header edge. The scene is two stable
  // screens tall, so its centre is exactly the sticky release point. Using
  // the viewport bottom here makes iOS toolbar changes shift the progress.
  const { scrollYProgress } = useScroll({ target: scene, offset: ['start 84px', 'center 84px'] });
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '-100%']);
  // The feedback travels into the space released by the sheet. At the end
  // both translations equal one screen, so normal scrolling resumes seamlessly.
  const feedbackY = useTransform(scrollYProgress, (progress) => {
    // Slow the added movement to zero at the handoff, matching native scroll
    // velocity rather than snapping from double speed back to normal.
    const arrival = 1 - (1 - progress) ** 2;
    return `calc(var(--hero-screen) * ${-arrival})`;
  });
  const photoOpacity = useTransform(scrollYProgress, [0, 0.35, 1], [1, 1, 0]);
  const photoScale = useTransform(scrollYProgress, [0, 1], [1, 1.16]);
  const [cleared, setCleared] = useState(false);
  const clearedRef = useRef(false);
  useMotionValueEvent(scrollYProgress, 'change', (progress) => {
    // Avoid boundary chatter during tiny direction reversals at the handoff.
    const next = clearedRef.current ? progress > 0.98 : progress >= 1;
    if (next === clearedRef.current) return;
    clearedRef.current = next;
    setCleared(next);
  });
  return <>
    <div ref={scene} className="hero-scene" data-reveal="true">
      <div className="hero-stage">
        <motion.div className="hero-art" aria-hidden="true" style={{ opacity: photoOpacity, scale: photoScale }}>{art}</motion.div>
        <motion.div className="hero-sheet" style={{ y }} inert={cleared} aria-hidden={cleared || undefined}>{intro}</motion.div>
      </div>
    </div>
    <motion.div className="hero-demo hero-demo-reveal site-container" style={{ y: feedbackY }}>{demo}</motion.div>
  </>;
}

/** The cover lifts first, then the feedback takes its place as the photo fades.
 * Motion values update the transform without rendering React per frame.
 * Server HTML and reduced motion retain an ordinary readable layout. */
export function MobileHeroReveal({ art, intro, demo }: HeroContent) {
  const enabled = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  if (enabled) return <AnimatedHero art={art} intro={intro} demo={demo} />;
  return <>
    <div className="hero-scene" data-reveal="false">
      <div className="hero-stage">
        <div className="hero-art" aria-hidden="true">{art}</div>
        <div className="hero-sheet">{intro}</div>
      </div>
    </div>
    <div className="hero-demo site-container">{demo}</div>
  </>;
}
