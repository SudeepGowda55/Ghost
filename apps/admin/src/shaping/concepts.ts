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
 * - auto: push on a window wide enough to dock (DOCK_MIN_WIDTH), float on a
 *   narrower one. Docked, it grows into the space a wide window leaves beside
 *   the page (see useHelpPanelWidth)
 * - auto-window: as auto, with the window on a narrower one, not the
 *   full-height card
 */
export type HelpPanelLayout = 'push' | 'float' | 'window' | 'auto' | 'auto-window';

/** A layout that docks the panel beside the page where the window is wide enough. */
const docksWhenWide = (layout: HelpPanelLayout) => layout === 'auto' || layout === 'auto-window';

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
      'Beside the page on wide windows (1600px and up); a full-height card over its right edge on narrower ones.',
    layout: 'auto',
  },
  {
    id: 'hybrid',
    label: 'Hybrid',
    description:
      'Beside the page on wide windows (1600px and up); the smaller card in the bottom-right corner on narrower ones.',
    layout: 'auto-window',
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
   * abbreviated (128k), and a narrower search (300px, not 480px). `always`, or only on a window
   * too narrow for the full top bar (`narrow`, see TOP_BAR_SLIM_BELOW).
   */
  slim: 'never' | 'narrow' | 'always';
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
    slim: 'never',
    everywhere: false,
  },
  {
    id: 'access-a',
    label: 'Top bar',
    description:
      'In the Admin 7 top bar, in place of the account menu. Classic adds it under the Settings menu. The panel shows on every screen.',
    topBar: true,
    slim: 'never',
    everywhere: true,
  },
  {
    id: 'access-b',
    label: 'Top bar slim',
    description:
      'As A, with a calmer top bar: a short month, long numbers abbreviated (128k), and a narrower search.',
    topBar: true,
    slim: 'always',
    everywhere: true,
  },
  {
    id: 'access-c',
    label: 'Top bar hybrid',
    description: 'The full top bar on wide windows (1600px and up), the slim one on narrower ones.',
    topBar: true,
    slim: 'narrow',
    everywhere: true,
  },
] as const satisfies readonly HelpAccess[];

/**
 * Below this window width the hybrid top bar is the slim one: Shade's `xxxl`
 * breakpoint. With every number showing, the full top bar keeps search
 * centred and at its full 480px down to about 1580px; narrower than that
 * search slides off centre. The slim one keeps it centred down to about 1240px.
 */
export const TOP_BAR_SLIM_BELOW = 1600;

export type HelpAccessId = (typeof HELP_ACCESS_POINTS)[number]['id'];

/**
 * Where Help goes in classic Admin's Settings, which has no top bar and swaps
 * the main navigation for its own: a link under the Settings navigation, or a
 * floating button in the page's bottom-right corner. Used with any access
 * point but Current.
 */
export const HELP_SETTINGS_PLACES = [
  { id: 'footer', label: 'Menu footer' },
  { id: 'floating', label: 'Floating button' },
] as const;

export type HelpSettingsPlaceId = (typeof HELP_SETTINGS_PLACES)[number]['id'];

/**
 * From this window width the panel docks beside the page, in every design:
 * Shade's `xxxl` breakpoint. The page is squeezed some beside it there, to
 * about 880px of content beside main's panel and 800px beside a Roomy one,
 * which was judged better than floating over it. (1800px, where the page was
 * hardly squeezed, engaged the float too soon.)
 */
export const DOCK_MIN_WIDTH = 1600;

const PANEL_KEY = 'shaping.help.panel';
const DESIGN_KEY = 'shaping.help.design';
const ACCESS_KEY = 'shaping.help.access';
const SETTINGS_PLACE_KEY = 'shaping.help.settingsPlace';
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
const readSettingsPlaceId = () =>
  read<HelpSettingsPlaceId>(SETTINGS_PLACE_KEY, HELP_SETTINGS_PLACES);

export const setHelpPanel = (id: HelpPanelId) => write(PANEL_KEY, id);
export const setHelpDesign = (id: HelpDesignId) => write(DESIGN_KEY, id);
export const setHelpAccess = (id: HelpAccessId) => write(ACCESS_KEY, id);
export const setHelpSettingsPlace = (id: HelpSettingsPlaceId) => write(SETTINGS_PLACE_KEY, id);

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
export const useHelpSettingsPlaceId = () => useSyncExternalStore(subscribe, readSettingsPlaceId);

export const useHelpDesign = (): HelpDesign => {
  const id = useHelpDesignId();
  return HELP_DESIGNS.find((design) => design.id === id) ?? HELP_DESIGNS[0];
};

const isNarrowForFullTopBar = () => window.innerWidth < TOP_BAR_SLIM_BELOW;

/** Whether the Admin 7 top bar shows slim: the access point's choice, for the window's width. */
export const useTopBarSlim = (): boolean => {
  const { slim } = useHelpAccess();
  const narrow = useSyncExternalStore(subscribeToWidth, isNarrowForFullTopBar);
  return slim === 'always' || (slim === 'narrow' && narrow);
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
  if (!docksWhenWide(layout)) {
    return `${panelWidth}px`;
  }
  const spare = `calc(100vw - var(--side-panel-navigation-width) - ${PAGE_FULL_WIDTH + frameSides}px)`;
  return `clamp(${panelWidth}px, ${spare}, ${HELP_FRAME_MAX_WIDTH + 2 * framePadding}px)`;
};

const hasRoomToDock = () => window.innerWidth >= DOCK_MIN_WIDTH;

/** The picked panel's layout, with `auto` settled for the window's width. */
export const useHelpPanelLayout = (): 'push' | 'float' | 'window' => {
  const id = useHelpPanelId();
  const roomToDock = useSyncExternalStore(subscribeToWidth, hasRoomToDock);
  const layout: HelpPanelLayout = HELP_PANELS.find((panel) => panel.id === id)?.layout ?? 'push';
  if (layout === 'auto') {
    return roomToDock ? 'push' : 'float';
  }
  if (layout === 'auto-window') {
    return roomToDock ? 'push' : 'window';
  }
  return layout;
};
