import { describe, expect, it } from 'vitest';
import { swipeDirection } from './swipe';

describe('swipeDirection', () => {
  it('reads a quick, mostly horizontal stroke as a swipe', () => {
    expect(swipeDirection({ dx: -120, dy: 10, ms: 200 })).toBe('left');
    expect(swipeDirection({ dx: 90, dy: -20, ms: 300 })).toBe('right');
  });

  it('ignores short strokes, taps and slow drags', () => {
    expect(swipeDirection({ dx: -40, dy: 0, ms: 100 })).toBeNull();
    expect(swipeDirection({ dx: 0, dy: 0, ms: 50 })).toBeNull();
    expect(swipeDirection({ dx: -150, dy: 0, ms: 1200 })).toBeNull();
  });

  it('ignores vertical scrolling, even with some sideways drift', () => {
    expect(swipeDirection({ dx: 70, dy: 300, ms: 250 })).toBeNull();
    expect(swipeDirection({ dx: -80, dy: 60, ms: 250 })).toBeNull();
  });
});
