import { useRef, type TouchEvent } from 'react';

export type SwipeDirection = 'left' | 'right';

const MIN_DISTANCE = 60; // px
const MAX_DURATION = 800; // ms
const MIN_RATIO = 1.5; // horizontal must clearly dominate vertical movement

/** Decides whether a finished touch stroke was a sideways swipe. */
export function swipeDirection({ dx, dy, ms }: { dx: number; dy: number; ms: number }): SwipeDirection | null {
  if (ms > MAX_DURATION || Math.abs(dx) < MIN_DISTANCE || Math.abs(dx) < MIN_RATIO * Math.abs(dy)) return null;
  return dx < 0 ? 'left' : 'right';
}

/** Touch handlers to spread onto an element; calls `onSwipe` for single-finger sideways swipes. */
export function useSwipe(onSwipe: (direction: SwipeDirection) => void) {
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  return {
    onTouchStart(e: TouchEvent) {
      const t = e.touches[0];
      start.current = e.touches.length === 1 ? { x: t.clientX, y: t.clientY, t: Date.now() } : null;
    },
    onTouchEnd(e: TouchEvent) {
      const s = start.current;
      start.current = null;
      const t = e.changedTouches[0];
      if (!s || !t) return;
      const direction = swipeDirection({ dx: t.clientX - s.x, dy: t.clientY - s.y, ms: Date.now() - s.t });
      if (direction) onSwipe(direction);
    },
  };
}
