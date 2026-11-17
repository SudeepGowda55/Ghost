import React from 'react';
import { cn } from '@tryghost/shade/utils';
import { type SidePanelSize, sidePanelStore } from './side-panel-store';
import { useSidePanel } from './use-side-panel';
// SHAPING PROTOTYPE ONLY — never merge (see src/shaping/README.md).
import { getFloatingSidebarTiming } from '@tryghost/shade/components';
import { type HelpDesign, useHelpDesign, useHelpPanelId } from '@/shaping/concepts';

// SHAPING PROTOTYPE ONLY: the prototype's layouts open, close and expand the
// panel as the Admin 7 navigation pins and unpins: over the same 520ms, on the
// easing the page slides beside it with. That curve is the one the panel is
// already on (`ease-emphasized`), so only the duration differs from main's
// 200ms and 300ms. The capsule's own overshoot isn't taken: the panel's width
// moves the page, which would wobble.
const NAVIGATION_DURATION = getFloatingSidebarTiming().duration;
// As a class: NAVIGATION_DURATION, which Tailwind can't read
const NAVIGATION_DURATION_CLASS = 'duration-[520ms]';

// How long the panel takes to expand or collapse, in milliseconds: longer than
// it takes to open or close, as it crosses most of the page
const RESIZE_DURATION = 300;

// At its default size the panel is as wide as the navigation across the page from it
// SHAPING PROTOTYPE ONLY: `--side-panel-width`, which the prototype's Design
// option can widen. On main this is the navigation's width.
const DEFAULT_WIDTH = 'w-(--side-panel-width)';

const PANEL_WIDTH: Record<SidePanelSize, string> = {
  default: DEFAULT_WIDTH,
  full: 'w-[calc(100%-var(--side-panel-navigation-width))]',
};

// Less the bezel between the panel and the page's card
const FRAMED_PANEL_WIDTH: Record<SidePanelSize, string> = {
  default: DEFAULT_WIDTH,
  full: 'w-[calc(100%-var(--side-panel-navigation-width)-var(--admin-frame-side))]',
};

// SHAPING PROTOTYPE ONLY — never merge (see src/shaping/README.md).
// Floating layouts: the panel is a card over the page, which keeps its width.
// It's held off the window's edges by the frame's insets (none in classic
// Admin) plus a gap, and never reaches under the navigation.
const FLOAT_GAP = '8px';
const FLOAT_SIDE = `calc(var(--admin-frame-side, 0px) + ${FLOAT_GAP})`;
const FLOAT_TOP = `calc(var(--admin-frame-top, 0px) + ${FLOAT_GAP})`;
const FLOAT_FULL_WIDTH = `calc(100vw - var(--side-panel-navigation-width) - ${FLOAT_SIDE} - ${FLOAT_GAP})`;
const FLOAT_FULL_HEIGHT = `calc(100vh - ${FLOAT_TOP} - ${FLOAT_SIDE})`;

type FloatingLayout = 'float' | 'window';

function floatingSize(layout: FloatingLayout, size: SidePanelSize, design: HelpDesign) {
  if (size === 'full') {
    return { width: FLOAT_FULL_WIDTH, height: FLOAT_FULL_HEIGHT };
  }
  return layout === 'window'
    ? {
        width: `${design.windowWidth}px`,
        height: `min(${design.windowHeight}px, ${FLOAT_FULL_HEIGHT})`,
      }
    : { width: 'var(--side-panel-width)', height: FLOAT_FULL_HEIGHT };
}

interface SidePanelProps {
  /** False hides open content without closing it. */
  visible: boolean;
  framed: boolean;
  /** SHAPING PROTOTYPE ONLY: how the panel sits with the page (see shaping/concepts.ts). */
  layout?: 'push' | FloatingLayout;
  /** Makes the panel inert, as the navigation and page are while the unpaid-subscription takeover shows. */
  locked: boolean;
}

export function SidePanel({ visible, framed, locked, layout = 'push' }: SidePanelProps) {
  const { state, close } = useSidePanel();
  const shown = visible && state.open;
  // SHAPING PROTOTYPE ONLY
  const design = useHelpDesign();
  // Main's own timing in the Current layout, to compare against
  const navigationMotion = useHelpPanelId() !== 'current';
  const resizeDuration = navigationMotion ? NAVIGATION_DURATION : RESIZE_DURATION;
  const durationClass = navigationMotion ? NAVIGATION_DURATION_CLASS : 'duration-200';
  const floating = layout === 'push' ? null : floatingSize(layout, state.size, design);
  // Room between the panel's edge and its content (see HelpDesign.framePadding)
  const contentPadding = design.framePadding ? `${design.framePadding}px` : undefined;
  const isFloating = floating !== null;
  const regionRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    sidePanelStore.setAvailable(visible);
  }, [visible]);

  // The panel animates when it's opened, closed or resized, and not when a
  // route hides or shows it. A screen change has a transition of its own, and
  // the page beside the panel would otherwise be laid out again on every
  // frame of the panel's: the editor opens at its full width, as it does with
  // the panel closed. Reading the width while transitions are off settles it
  // there, so none starts once they're back on.
  const lastVisible = React.useRef(visible);
  React.useLayoutEffect(() => {
    const region = regionRef.current;
    if (!region || lastVisible.current === visible) {
      return;
    }
    lastVisible.current = visible;
    region.style.transition = 'none';
    void region.offsetWidth;
    region.style.transition = '';
  }, [visible]);

  // SHAPING PROTOTYPE ONLY: the panel's size follows the window's in the
  // prototype's layouts (and on main when expanded). Its transitions are for
  // opening, closing and expanding; left on while the window is resized, each
  // step starts a new one, so the panel's edge trails 200ms behind content
  // that's already at its new width, which shows cropped and then jumps. Off
  // while the window is being resized, the panel follows it directly.
  React.useEffect(() => {
    const region = regionRef.current;
    if (!region) {
      return;
    }
    let settled: number | undefined;
    const onResize = () => {
      region.style.transition = 'none';
      window.clearTimeout(settled);
      settled = window.setTimeout(() => {
        region.style.transition = '';
      }, 150);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.clearTimeout(settled);
      region.style.transition = '';
    };
  }, []);

  // Expanding and collapsing cover most of the page, so they take longer than
  // opening and closing, on the same easing. The content doesn't follow the panel's edge, which
  // would lay it out again on every frame: it takes its new width at once,
  // against the right edge, and fades in as the panel uncovers or leaves it.
  const lastSize = React.useRef(state.size);
  React.useLayoutEffect(() => {
    const region = regionRef.current;
    const content = contentRef.current;
    if (!region || !content || lastSize.current === state.size) {
      return;
    }
    lastSize.current = state.size;
    if (!shown || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    // Before anything reads the panel's styles, which starts its transition
    region.style.transitionDuration = `${resizeDuration}ms`;
    // SHAPING PROTOTYPE ONLY: a floating panel's content is sized in its styles
    if (state.size === 'full' && !isFloating) {
      // The width the panel is growing to: the row it's in, less the
      // navigation's width and the bezel beside the panel
      const style = getComputedStyle(region);
      const width =
        (region.parentElement?.clientWidth ?? 0) -
        parseFloat(style.getPropertyValue('--side-panel-navigation-width')) -
        parseFloat(style.marginLeft);
      if (width > 0) {
        content.style.width = `${width}px`;
      }
    }
    const fade =
      typeof content.animate === 'function'
        ? content.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration: resizeDuration / 2,
            easing: 'ease-out',
          })
        : null;
    const settle = () => {
      region.style.transitionDuration = '';
      content.style.width = '';
    };
    const timer = window.setTimeout(settle, resizeDuration + 50);
    return () => {
      window.clearTimeout(timer);
      settle();
      fade?.cancel();
    };
  }, [state.size, shown, isFloating, resizeDuration]);

  // The layout can swap this panel for a new one, e.g. when the Admin 7 frame
  // appears once the Labs config loads. This cleanup has to run before the new
  // panel marks itself available, or the panel stays unavailable. Layout effect
  // cleanups run before new layout effects, but a useEffect cleanup runs after.
  React.useLayoutEffect(
    () => () => {
      sidePanelStore.setAvailable(false);
      sidePanelStore.reset();
    },
    [],
  );

  // The content is a node from outside React. Moving a node in the DOM can reset
  // it (an iframe reloads, for one), so it's only inserted when it changes.
  React.useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) {
      return;
    }
    if (!state.element) {
      content.replaceChildren();
    } else if (content.firstChild !== state.element) {
      content.replaceChildren(state.element);
    }
  }, [state.element]);

  // The content takes focus itself if it wants it. Closing returns focus to
  // where it was before opening, as the content it was in is hidden.
  const returnFocusRef = React.useRef<Element | null>(null);
  React.useLayoutEffect(() => {
    const region = regionRef.current;
    if (!region || !state.element) {
      return;
    }
    if (state.open) {
      if (!region.contains(document.activeElement)) {
        returnFocusRef.current = document.activeElement;
      }
      return;
    }
    const returnFocus = returnFocusRef.current;
    returnFocusRef.current = null;
    const focusWasWithin =
      region.contains(document.activeElement) || document.activeElement === document.body;
    if (focusWasWithin && returnFocus instanceof HTMLElement && returnFocus.isConnected) {
      returnFocus.focus({ preventScroll: true });
    }
  }, [state.open, state.element]);

  React.useEffect(() => {
    if (!shown || locked) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      // Radix marks the Escape that dismissed a dialog or menu
      if (event.key === 'Escape' && !event.defaultPrevented) {
        close();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [shown, locked, close]);

  // Applied through a ref because React 18 has no first-class inert prop.
  React.useLayoutEffect(() => {
    if (regionRef.current) {
      regionRef.current.inert = locked;
    }
  }, [locked]);

  // SHAPING PROTOTYPE ONLY: the floating layouts. The same element as the
  // panel beside the page, so switching concepts never reloads its content.
  if (floating) {
    return (
      <div
        ref={regionRef}
        className={cn(
          'fixed z-30 flex justify-end overflow-hidden rounded-xl bg-background shadow-xl ring-1 ring-border ease-emphasized motion-reduce:transition-none',
          durationClass,
          layout === 'window' ? 'origin-bottom-right' : 'origin-right',
          shown
            ? 'transition-[width,height,opacity,translate,scale]'
            : cn(
                'pointer-events-none invisible opacity-0 transition-[width,height,opacity,translate,scale,visibility]',
                layout === 'window' ? 'translate-y-2 scale-95' : 'translate-x-4',
              ),
        )}
        data-side-panel={shown ? state.size : 'closed'}
        data-side-panel-layout={layout}
        style={
          {
            right: FLOAT_SIDE,
            bottom: FLOAT_SIDE,
            ...floating,
            // The content's width, as a variable rather than set on the content:
            // the resize effect above clears the content's own inline width
            // when it settles, which left the frame at a browser's default 300px
            '--side-panel-content-width': floating.width,
          } as React.CSSProperties
        }
      >
        {/* At the size the panel is heading for, against its right edge, so the
            content doesn't reflow while the panel animates */}
        <div
          ref={contentRef}
          className="h-full w-(--side-panel-content-width) shrink-0 *:size-full"
          style={{ padding: contentPadding }}
        />
      </div>
    );
  }

  return (
    // No role or name: the content brings its own semantics
    <div
      ref={regionRef}
      className={cn(
        // On the easing the Admin 7 frame opens and closes with
        'flex h-full shrink-0 justify-end overflow-hidden bg-background ease-emphasized motion-reduce:transition-none',
        // SHAPING PROTOTYPE ONLY: main's is duration-200
        durationClass,
        // Visible as soon as it opens, so it can take focus, and hidden once it has closed
        shown
          ? cn(
              'transition-[width,margin]',
              framed
                ? cn(
                    'ml-(--admin-frame-side) rounded-(--admin-frame-radius) dark:ring-1 dark:ring-border-glass',
                    FRAMED_PANEL_WIDTH[state.size],
                  )
                : cn('border-l border-border', PANEL_WIDTH[state.size]),
            )
          : 'invisible w-0 transition-[width,margin,visibility]',
      )}
      data-side-panel={shown ? state.size : 'closed'}
      data-side-panel-layout={layout}
    >
      {/* At the width it's heading for while the panel animates, so the content doesn't reflow,
          and against the right edge, where it ends up as the panel opens, closes or resizes */}
      <div
        ref={contentRef}
        className={cn(
          'h-full shrink-0 *:size-full',
          state.size === 'full' ? 'w-full' : DEFAULT_WIDTH,
        )}
        // SHAPING PROTOTYPE ONLY
        style={{ padding: contentPadding }}
      />
    </div>
  );
}
