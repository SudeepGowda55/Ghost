const SIDES = ['top', 'right', 'bottom', 'left'] as const;

const BOUNDARY_ATTRIBUTE = 'data-ghost-safe-area';

/**
 * Whether a Ghost app's SDK has set the safe area on `<html>` of the document `container` is in,
 * or this one. It sets `--ghost-safe-area-inset-*` there as inline styles, which read without
 * working out the page's styles.
 */
export function hasSafeArea(container?: HTMLElement): boolean {
  // Rendered without a document, such as on a server, there's no app around it yet.
  if (!container && typeof globalThis.document === 'undefined') {
    return false;
  }
  const root = (container?.ownerDocument ?? globalThis.document).documentElement;
  return SIDES.some(
    (side) => root.style.getPropertyValue(`--ghost-safe-area-inset-${side}`) !== '',
  );
}

/**
 * In a Ghost app, Admin's chrome floats over the edges of the app's page, and the app SDK sets how
 * far it reaches in as `--ghost-safe-area-inset-*` on `<html>`. Returns an invisible element
 * covering that safe area in the document a popup opens in, the overlay's when `container` is in
 * it, so the popup can keep inside it as it keeps inside the window. It follows the variables as
 * they change, so it's right whenever the popup opens. Anywhere the variables aren't set, there's
 * none.
 */
export function safeAreaBoundary(container?: HTMLElement): HTMLElement | undefined {
  if (!hasSafeArea(container)) {
    return undefined;
  }
  const document = container?.ownerDocument ?? globalThis.document;
  const parent = container ?? document.body;
  let boundary = parent.querySelector<HTMLElement>(`:scope > [${BOUNDARY_ATTRIBUTE}]`);
  if (!boundary) {
    boundary = document.createElement('div');
    boundary.setAttribute(BOUNDARY_ATTRIBUTE, '');
    boundary.setAttribute('aria-hidden', 'true');
    boundary.style.cssText = [
      'position: fixed',
      ...SIDES.map((side) => `${side}: var(--ghost-safe-area-inset-${side}, 0px)`),
      'visibility: hidden',
      'pointer-events: none',
    ].join('; ');
    parent.append(boundary);
  }
  return boundary;
}

/**
 * The props that keep a Radix popup inside a Ghost app's safe area: its collision boundary, unless
 * the caller gave one, and `data-safe-area`, for styles that size it to the room that leaves.
 */
export function safeAreaCollision(
  collisionBoundary: Element | null | Array<Element | null> | undefined,
  container?: HTMLElement,
) {
  const boundary = safeAreaBoundary(container);
  return {
    collisionBoundary: collisionBoundary ?? boundary,
    'data-safe-area': boundary ? '' : undefined,
  };
}
