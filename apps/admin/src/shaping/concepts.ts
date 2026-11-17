import { useSyncExternalStore } from 'react';

// SHAPING PROTOTYPE ONLY — never merge (see src/shaping/README.md).
//
// Where in-app Help lives in Admin, in pieces picked separately in the
// prototype menu, so any one can be tried with any other:
//
// - the layout: how Help's panel sits with the page
// - the design: the panel's own width and padding
// - the access point: where Help is opened from, and so where it can show
//
// A change applies live, without a reload, and keeps Help open as it was.

/**
 * How the panel sits with the page:
 * - push: in a column beside the page, which gets narrower (main's behaviour)
 * - float: a card over the page's right edge, full height; the page keeps its
 *   width. Not an option of its own (it lost to docking when there's room),
 *   but what `auto` falls back to
 * - window: a smaller card over the page's bottom-right corner
 * - auto: push where the page keeps its full width beside it, float otherwise.
 *   Docked, it grows into the space a wide window leaves beside the page (see
 *   useHelpPanelWidth)
 */
export type HelpPanelLayout = 'push' | 'float' | 'window' | 'auto';

export interface HelpPanel {
  id: string;
  label: string;
  description: string;
  layout: HelpPanelLayout;
}

export const HELP_PANELS = [
  {
    id: 'current',
    label: 'Current',
    description: 'Beside the page, which gets narrower.',
    layout: 'push',
  },
  {
    id: 'window',
    label: 'Window',
    description: 'A smaller card in the bottom-right corner, clear of the page’s header.',
    layout: 'window',
  },
  {
    id: 'dock',
    label: 'Floating',
    description:
      'Beside the page on wide windows (1800px and up); a full-height card over its right edge on narrower ones.',
    layout: 'auto',
  },
] as const satisfies readonly HelpPanel[];

export type HelpPanelId = (typeof HELP_PANELS)[number]['id'];

/**
 * The panel's own design: how wide it is beside the page, and the room around
 * Help in it. Expanding is main's in every design.
 */
export interface HelpDesign {
  id: string;
  label: string;
  /** The panel's width beside the page, in px. Main's is the navigation's, 316. */
  panelWidth: number;
  /** The floating window's width and tallest height, in px. */
  windowWidth: number;
  windowHeight: number;
  /**
   * Space between the panel's edge and Help's frame, in px. Help is a page
   * from another site in a frame, with a 16px gutter of its own that Admin
   * can't change, so 8px here puts Help's content 24px from the panel's edge.
   * It stays when the panel is expanded, so Help's header doesn't shift;
   * Help's gutter is 40px there, which makes 48px.
   */
  framePadding: number;
}

export const HELP_DESIGNS = [
  {
    id: 'current',
    label: 'Current',
    panelWidth: 316,
    windowWidth: 380,
    windowHeight: 640,
    framePadding: 0,
  },
  {
    id: 'roomy',
    label: 'Roomy',
    panelWidth: 400,
    windowWidth: 440,
    windowHeight: 680,
    framePadding: 8,
  },
] as const satisfies readonly HelpDesign[];

export type HelpDesignId = (typeof HELP_DESIGNS)[number]['id'];

export interface HelpAccess {
  id: string;
  label: string;
  description: string;
  /**
   * Moves Help from the account menu to the Admin 7 top bar. Classic Admin has
   * no top bar, so it keeps Help in the main navigation and adds it under the
   * Settings navigation.
   */
  topBar: boolean;
  /**
   * Calms the Admin 7 top bar's right side: a short month, long numbers
   * abbreviated (128k), and a narrower search.
   */
  slim: boolean;
  /**
   * The panel shows where it can be opened from. Main's access point is the
   * main navigation, so the panel hides in Settings and the editor; one that's
   * within reach on other screens lets it show on every desktop screen.
   */
  everywhere: boolean;
}

export const HELP_ACCESS_POINTS = [
  {
    id: 'current',
    label: 'Current',
    description:
      'Help in the main navigation (the account menu in Admin 7). The panel hides in Settings and the editor.',
    topBar: false,
    slim: false,
    everywhere: false,
  },
  {
    id: 'access-a',
    label: 'Top bar',
    description:
      'In the Admin 7 top bar, in place of the account menu. Classic adds it under the Settings menu. The panel shows on every screen.',
    topBar: true,
    slim: false,
    everywhere: true,
  },
  {
    id: 'access-b',
    label: 'Top bar slim',
    description:
      'As A, with a calmer top bar: a short month, long numbers abbreviated (128k), and a narrower search.',
    topBar: true,
    slim: true,
    everywhere: true,
  },
] as const satisfies readonly HelpAccess[];

export type HelpAccessId = (typeof HELP_ACCESS_POINTS)[number]['id'];

/**
 * From this window width the page keeps its full content width beside a docked
 * panel as wide as main's. A wider panel needs that much more.
 */
export const DOCK_MIN_WIDTH = 1800;

const PANEL_KEY = 'shaping.help.panel';
const DESIGN_KEY = 'shaping.help.design';
const ACCESS_KEY = 'shaping.help.access';
const CHANGE_EVENT = 'shaping:help-change';

const read = <Id extends string>(key: string, options: readonly { id: Id }[]): Id => {
  try {
    const stored = localStorage.getItem(key);
    return options.find((option) => option.id === stored)?.id ?? options[0].id;
  } catch {
    return options[0].id;
  }
};

const write = (key: string, id: string) => {
  try {
    localStorage.setItem(key, id);
  } catch {
    // Storage blocked: the change still applies until the page reloads.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
};

const readPanelId = () => read<HelpPanelId>(PANEL_KEY, HELP_PANELS);
const readDesignId = () => read<HelpDesignId>(DESIGN_KEY, HELP_DESIGNS);
const readAccessId = () => read<HelpAccessId>(ACCESS_KEY, HELP_ACCESS_POINTS);

export const setHelpPanel = (id: HelpPanelId) => write(PANEL_KEY, id);
export const setHelpDesign = (id: HelpDesignId) => write(DESIGN_KEY, id);
export const setHelpAccess = (id: HelpAccessId) => write(ACCESS_KEY, id);

// Site conditions the prototype fakes, to judge an option at its busiest.
//
// The Admin 7 top bar only shows Online with web analytics set up, and MRR with
// paid members on, which a local Ghost usually has neither of. On by default.
const BUSY_TOP_BAR_KEY = 'shaping.help.busyTopBar';
const readBusyTopBar = () => {
  try {
    return localStorage.getItem(BUSY_TOP_BAR_KEY) !== 'off';
  } catch {
    return true;
  }
};
export const setBusyTopBar = (busy: boolean) => write(BUSY_TOP_BAR_KEY, busy ? 'on' : 'off');

const subscribe = (onChange: () => void) => {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
};

export const useHelpPanelId = () => useSyncExternalStore(subscribe, readPanelId);
export const useHelpDesignId = () => useSyncExternalStore(subscribe, readDesignId);
export const useHelpAccessId = () => useSyncExternalStore(subscribe, readAccessId);

export const useHelpDesign = (): HelpDesign => {
  const id = useHelpDesignId();
  return HELP_DESIGNS.find((design) => design.id === id) ?? HELP_DESIGNS[0];
};

export const useBusyTopBar = () => useSyncExternalStore(subscribe, readBusyTopBar);

export const useHelpAccess = (): HelpAccess => {
  const id = useHelpAccessId();
  return HELP_ACCESS_POINTS.find((access) => access.id === id) ?? HELP_ACCESS_POINTS[0];
};

const subscribeToWidth = (onChange: () => void) => {
  window.addEventListener('resize', onChange);
  return () => window.removeEventListener('resize', onChange);
};

/** The widest a page gets: its 1280px content column and a 40px gutter either side. */
const PAGE_FULL_WIDTH = 1360;

/**
 * Help changes its own layout once its frame is 640px wide (a 40px gutter in
 * place of 16px), so the panel stops growing just short of that.
 */
const HELP_FRAME_MAX_WIDTH = 639;

/**
 * The panel's width beside the page, as CSS. Fixed at the design's width,
 * except in the layout that docks when there's room: a window wider than the
 * navigation, a full-width page and the panel leaves dead space either side of
 * the page's content, so there the panel takes it, up to the widest Help's
 * frame stays in its panel layout. `frameSides` is the Admin 7 frame's bezels
 * around and between the page and the panel, in px.
 */
export const useHelpPanelWidth = (frameSides: number): string => {
  const id = useHelpPanelId();
  const { panelWidth, framePadding } = useHelpDesign();
  const layout: HelpPanelLayout = HELP_PANELS.find((panel) => panel.id === id)?.layout ?? 'push';
  if (layout !== 'auto') {
    return `${panelWidth}px`;
  }
  const spare = `calc(100vw - var(--side-panel-navigation-width) - ${PAGE_FULL_WIDTH + frameSides}px)`;
  return `clamp(${panelWidth}px, ${spare}, ${HELP_FRAME_MAX_WIDTH + 2 * framePadding}px)`;
};

/** The picked panel's layout, with `auto` settled for the window's width. */
export const useHelpPanelLayout = (): Exclude<HelpPanelLayout, 'auto'> => {
  const id = useHelpPanelId();
  const { panelWidth } = useHelpDesign();
  const dockMinWidth = DOCK_MIN_WIDTH + panelWidth - HELP_DESIGNS[0].panelWidth;
  const roomToDock = useSyncExternalStore(
    subscribeToWidth,
    () => window.innerWidth >= dockMinWidth,
  );
  const layout: HelpPanelLayout = HELP_PANELS.find((panel) => panel.id === id)?.layout ?? 'push';
  if (layout === 'auto') {
    return roomToDock ? 'push' : 'float';
  }
  return layout;
};
