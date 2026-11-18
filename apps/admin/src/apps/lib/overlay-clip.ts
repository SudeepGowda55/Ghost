import type { SafeArea } from '@tryghost/app-contracts/bridge';

/**
 * Set on `<html>` while an app's overlay shows. Floating chrome that can step aside, such as the
 * side panel as a window, hides while it's set.
 */
export const APP_OVERLAY_ATTRIBUTE = 'data-app-overlay';

/** A box in the window, in pixels. */
export interface Box {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * Admin's chrome that floats over the app's page rather than beside it, which the overlay shows
 * none of: the Admin 7 navigation's capsule, open over the page while it's unpinned, and anything
 * marked `data-floating-chrome`, such as the side panel as a window or the minimized bar.
 */
export const FLOATING_CHROME_SELECTOR = '[data-slot=floating-sidebar], [data-floating-chrome]';

const overlaps = (a: Box, b: Box) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/**
 * Merges boxes that overlap into the box around them, until none overlap: under the even-odd
 * rule, two holes over the same point would cancel out and show the frame there again.
 */
function merge(boxes: readonly Box[]): Box[] {
  const merged = [...boxes];
  let joined = true;
  // Until a pass joins none: a joined box can grow to overlap one already passed.
  while (joined) {
    joined = false;
    for (let i = 0; i < merged.length && !joined; i += 1) {
      for (let j = i + 1; j < merged.length && !joined; j += 1) {
        if (overlaps(merged[i], merged[j])) {
          const [a, b] = [merged[i], merged[j]];
          merged[i] = {
            top: Math.min(a.top, b.top),
            right: Math.max(a.right, b.right),
            bottom: Math.max(a.bottom, b.bottom),
            left: Math.min(a.left, b.left),
          };
          merged.splice(j, 1);
          joined = true;
        }
      }
    }
  }
  return merged;
}

const round = (value: number) => Math.round(value * 100) / 100;

/** How far each corner of the safe area is rounded: only those that are corners of Admin's card. */
export interface Corners {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
}

/**
 * The overlay frame's `clip-path`: the app's safe area, with the corners that are Admin's card's
 * rounded as the card's are, and a hole for each box of floating chrome over it. The frame covers
 * the whole window, so the path is in the window's coordinates. The holes cut out whole boxes, so
 * they never let the frame show over a rounded corner of the chrome. A corner a hole reaches into
 * stays square: under the even-odd rule, the part of the hole outside the rounding would show the
 * frame again.
 */
export function overlayClipPath(
  safeArea: SafeArea,
  window: { width: number; height: number },
  corners: Corners,
  holes: readonly Box[],
): string {
  const top = safeArea.top;
  const left = safeArea.left;
  const right = window.width - safeArea.right;
  const bottom = window.height - safeArea.bottom;
  const cut = merge(holes)
    .map((hole) => ({
      top: Math.max(hole.top, top),
      right: Math.min(hole.right, right),
      bottom: Math.min(hole.bottom, bottom),
      left: Math.max(hole.left, left),
    }))
    .filter((hole) => hole.left < hole.right && hole.top < hole.bottom);
  const limit = Math.max(0, Math.min((right - left) / 2, (bottom - top) / 2));
  // A corner's rounding, as the box it takes, unless a hole reaches into that box.
  const corner = (radius: number, atRight: boolean, atBottom: boolean) => {
    const r = Math.max(0, Math.min(radius, limit));
    const x = atRight ? right - r : left;
    const y = atBottom ? bottom - r : top;
    const box = { top: y, right: x + r, bottom: y + r, left: x };
    return cut.some((hole) => overlaps(hole, box)) ? 0 : r;
  };
  const topLeft = corner(corners.topLeft, false, false);
  const topRight = corner(corners.topRight, true, false);
  const bottomRight = corner(corners.bottomRight, true, true);
  const bottomLeft = corner(corners.bottomLeft, false, true);
  if (cut.length === 0) {
    const radii = [topLeft, topRight, bottomRight, bottomLeft];
    const rounding = radii.some(Boolean) ? ` round ${radii.map((r) => `${r}px`).join(' ')}` : '';
    return `inset(${top}px ${safeArea.right}px ${safeArea.bottom}px ${left}px${rounding})`;
  }
  const arc = (r: number, x: number, y: number) =>
    r ? `A${r},${r} 0 0 1 ${round(x)},${round(y)}` : '';
  const outer = [
    `M${round(left + topLeft)},${round(top)}`,
    `H${round(right - topRight)}`,
    arc(topRight, right, top + topRight),
    `V${round(bottom - bottomRight)}`,
    arc(bottomRight, right - bottomRight, bottom),
    `H${round(left + bottomLeft)}`,
    arc(bottomLeft, left, bottom - bottomLeft),
    `V${round(top + topLeft)}`,
    arc(topLeft, left + topLeft, top),
    'Z',
  ].join('');
  const inner = cut
    .map(
      (hole) =>
        `M${round(hole.left)},${round(hole.top)}H${round(hole.right)}V${round(hole.bottom)}H${round(hole.left)}Z`,
    )
    .join('');
  return `path(evenodd, "${outer}${inner}")`;
}
