import { describe, expect, it } from 'vitest';
import { overlayClipPath } from './overlay-clip';

const all = (r: number) => ({ topLeft: r, topRight: r, bottomRight: r, bottomLeft: r });

const window = { width: 1280, height: 720 };
const safeArea = { top: 44, right: 8, bottom: 65, left: 90 };

describe('overlayClipPath', () => {
  it('shows the safe area, with the card’s rounded corners', () => {
    expect(overlayClipPath(safeArea, window, all(12), [])).toBe(
      'inset(44px 8px 65px 90px round 12px 12px 12px 12px)',
    );
    expect(overlayClipPath(safeArea, window, all(0), [])).toBe('inset(44px 8px 65px 90px)');
  });

  it('ignores floating chrome outside the safe area', () => {
    const circle = { top: 60, right: 74, bottom: 110, left: 24 };
    expect(overlayClipPath(safeArea, window, all(0), [circle])).toBe('inset(44px 8px 65px 90px)');
  });

  it('cuts out the part of floating chrome over the safe area, such as an open capsule', () => {
    const capsule = { top: 60, right: 300, bottom: 600, left: 24 };
    expect(overlayClipPath(safeArea, window, all(0), [capsule])).toBe(
      'path(evenodd, "M90,44H1272V655H90V44ZM90,60H300V600H90Z")',
    );
  });

  it('rounds the safe area’s corners on the path too', () => {
    const panel = { top: 300, right: 1260, bottom: 640, left: 900 };
    expect(overlayClipPath(safeArea, window, all(12), [panel])).toBe(
      'path(evenodd, "M102,44H1260A12,12 0 0 1 1272,56V643A12,12 0 0 1 1260,655H102A12,12 0 0 1 90,643V56A12,12 0 0 1 102,44ZM900,300H1260V640H900Z")',
    );
  });

  it('leaves a corner square where a hole reaches into its rounding', () => {
    const capsule = { top: 60, right: 300, bottom: 700, left: 24 };
    expect(overlayClipPath(safeArea, window, all(12), [capsule])).toBe(
      // Only the bottom-left corner, which the hole reaches into, is square.
      'path(evenodd, "M102,44H1260A12,12 0 0 1 1272,56V643A12,12 0 0 1 1260,655H90V56A12,12 0 0 1 102,44ZM90,60H300V655H90Z")',
    );
  });

  it('cuts out overlapping chrome as one hole, so the two don’t cancel out', () => {
    const a = { top: 100, right: 400, bottom: 300, left: 200 };
    const b = { top: 200, right: 500, bottom: 400, left: 300 };
    expect(overlayClipPath(safeArea, window, all(0), [a, b])).toBe(
      'path(evenodd, "M90,44H1272V655H90V44ZM200,100H500V400H200Z")',
    );
  });

  it('rounds only the corners that are the card’s', () => {
    const corners = { topLeft: 0, topRight: 12, bottomRight: 0, bottomLeft: 0 };
    expect(overlayClipPath(safeArea, window, corners, [])).toBe(
      'inset(44px 8px 65px 90px round 0px 12px 0px 0px)',
    );
  });

  it('joins chrome that only overlaps once the boxes beside it are joined', () => {
    const a = { top: 100, right: 200, bottom: 200, left: 100 };
    const b = { top: 300, right: 400, bottom: 400, left: 300 };
    const c = { top: 150, right: 350, bottom: 350, left: 150 };
    // C overlaps both A and B; joined with B first, it must join A too.
    expect(overlayClipPath(safeArea, window, all(0), [b, a, c])).toBe(
      'path(evenodd, "M90,44H1272V655H90V44ZM100,100H400V400H100Z")',
    );
  });
});
