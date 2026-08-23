'use client';

import { useSyncExternalStore } from 'react';

const QUERY = '(pointer: coarse)';

function subscribe(onChange: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

function getSnapshot() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(QUERY).matches;
}

/* The server has no pointer, so it renders the desktop answer and the client
   corrects it on hydration. useSyncExternalStore is what makes that a planned
   re-render rather than a hydration mismatch. */
function getServerSnapshot() {
  return false;
}

/**
 * True on touch devices.
 *
 * Used to switch off decoration that is permanently animating. On a phone the
 * expensive part is not the size of an effect, it is that it never stops:
 * every forever-running rAF loop competes with touch scrolling for the main
 * thread on the exact frames where the scroll needs it.
 */
export function useCoarsePointer() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
