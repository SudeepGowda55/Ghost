import React from 'react';
import { Link, useLocation, useNavigate } from '@tryghost/admin-x-framework';
import { cn, formatNumber, LucideIcon } from '@tryghost/shade/utils';
import { useOpenGlobalSearch } from '@/global-search/global-search-context';
import { searchShortcutLabel } from '@/global-search/search-shortcut';
import {
  CUSTOMIZE_SITE_PATH,
  VIEW_SITE_PATH,
  useCanCustomizeSite,
  useIsCustomizingSite,
} from '@/view-site/api';
import { type FrameMrr, type FrameStat, useFrameStats } from './use-frame-stats';
// SHAPING PROTOTYPE ONLY — never merge (see src/shaping/README.md).
import { useFeatureFlag } from '@tryghost/admin-x-framework/hooks';
import { useBusyTopBar, useHelpAccess, useTopBarSlim } from '@/shaping/concepts';

// Small caps, as in the Admin 7 vision
const LABEL = 'text-[10px] leading-none font-medium tracking-[0.04em] uppercase';
const MUTED = 'text-gray-600';

/** Option + 1 and Option + 2 switch between Ghost and View site. */
const PLACE_SHORTCUTS: Record<string, string> = {
  Digit1: '/',
  Digit2: '/site',
};

function isEditable(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

function usePlaceShortcuts(enabled: boolean) {
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!enabled) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) {
        return;
      }
      // The physical key: on a Mac, Option + digit types a special character
      const to = PLACE_SHORTCUTS[event.code];
      if (to && !isEditable(event.target)) {
        event.preventDefault();
        navigate(to);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, navigate]);
}

interface PlaceTabProps {
  to: string;
  active: boolean;
  shortcut: string;
  className?: string;
  children: React.ReactNode;
}

function PlaceTab({ to, active, shortcut, className, children }: PlaceTabProps) {
  return (
    <Link
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-full items-center transition-colors hover:text-white',
        LABEL,
        active ? 'text-white' : MUTED,
        className,
      )}
      title={shortcut}
      to={to}
    >
      {children}
    </Link>
  );
}

function SearchPill() {
  const openGlobalSearch = useOpenGlobalSearch();
  // SHAPING PROTOTYPE ONLY: narrower in the slim top bar
  const slim = useTopBarSlim();

  if (!openGlobalSearch) {
    return null;
  }

  return (
    <button
      className={cn(
        slim ? 'max-w-[300px]' : 'max-w-[480px]',
        'flex h-7 w-full min-w-0 cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 backdrop-blur-sm transition-colors hover:bg-white/10',
        'shadow-[inset_0_1px_0_color-mix(in_oklab,var(--color-white)_8%,transparent),inset_0_-1px_0_color-mix(in_oklab,var(--color-black)_20%,transparent)]',
      )}
      title="Search"
      type="button"
      onClick={openGlobalSearch}
    >
      <LucideIcon.Search className={cn('size-3.5 shrink-0', MUTED)} strokeWidth={1.75} />
      <span className={cn('min-w-0 flex-1 truncate text-left', LABEL, MUTED)}>Search</span>
      <span className={cn('shrink-0', LABEL, MUTED)}>{searchShortcutLabel}</span>
    </button>
  );
}

/** Today's date and the time, its colon blinking */
function Clock() {
  const [now, setNow] = React.useState(() => new Date());

  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // SHAPING PROTOTYPE ONLY: a short month in the slim top bar, which is
  // narrower, so it sheds the date and time later
  const slim = useTopBarSlim();
  const date = now.toLocaleDateString('en-US', {
    month: slim ? 'short' : 'long',
    day: 'numeric',
  });
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');

  return (
    // SHAPING PROTOTYPE ONLY: the first to go as the bar narrows (see AdminFrameTopBar)
    <div
      className={cn(
        'hidden items-center gap-2',
        slim ? 'min-[900px]:flex' : 'min-[960px]:flex',
        LABEL,
        MUTED,
      )}
    >
      <span className={cn('hidden', slim ? 'min-[960px]:inline' : 'min-[1040px]:inline')}>
        {date}
      </span>
      <time dateTime={now.toISOString()}>
        {hours}
        <span className="motion-safe:animate-[admin-frame-blink_1s_infinite]">:</span>
        {minutes}
      </time>
    </div>
  );
}

/** A number, or a dash while it loads */
function statText<T>(stat: FrameStat<T>, format: (value: T) => string): string {
  return stat === undefined || stat === null ? '–' : format(stat);
}

function formatMrr({ amount, currency }: FrameMrr): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      maximumFractionDigits: 0,
    }).format(amount / 100);
  } catch {
    // Not a currency Intl knows
    return `${formatNumber(Math.round(amount / 100))} ${currency.toUpperCase()}`;
  }
}

// SHAPING PROTOTYPE ONLY: the slim top bar's numbers, long ones abbreviated to
// whole thousands or millions (128k, 1k), without the decimal Shade's
// abbreviateNumber keeps. The bar's labels are capitals, so the numbers opt
// out to keep the small k.
const SLIM_NUMBER = 'normal-case';

function formatSlimCount(count: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 0 })
    .format(count)
    .replace('K', 'k');
}

function formatSlimMrr({ amount, currency }: FrameMrr): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      notation: 'compact',
      maximumFractionDigits: 0,
    })
      .format(amount / 100)
      .replace('K', 'k');
  } catch {
    // Not a currency Intl knows
    return `${formatSlimCount(Math.round(amount / 100))} ${currency.toUpperCase()}`;
  }
}

function Stat({ label, to, children }: { label: string; to: string; children: React.ReactNode }) {
  return (
    <Link className={cn('group flex h-full items-center gap-1', LABEL)} to={to}>
      <span className={cn('transition-colors group-hover:text-white', MUTED)}>{label}</span>
      <span className="text-white">{children}</span>
    </Link>
  );
}

// SHAPING PROTOTYPE ONLY: the top bar at its busiest, each number a long one
const BUSY_STATS = {
  online: 1284,
  members: 128450,
  mrr: { amount: 4825000, currency: 'usd' },
};

/** The time, and the site's numbers linking to Analytics */
function SiteNumbers() {
  const siteStats = useFrameStats();
  // SHAPING PROTOTYPE ONLY: sample numbers, so all three show (see shaping/concepts.ts)
  const busy = useBusyTopBar();
  const stats = busy ? BUSY_STATS : siteStats;
  // SHAPING PROTOTYPE ONLY: the slim top bar abbreviates long numbers
  const slim = useTopBarSlim();
  const formatCount = slim ? formatSlimCount : formatNumber;

  return (
    <>
      <Clock />
      {stats.online !== null && (
        <Link
          className={cn('group flex h-full items-center gap-2', LABEL)}
          title="Online"
          to="/analytics"
        >
          <span aria-hidden="true" className="block size-2 shrink-0 bg-green" />
          <span className={cn('transition-colors group-hover:text-white', MUTED)}>
            <span className={cn(slim && SLIM_NUMBER)}>{statText(stats.online, formatCount)}</span>
            {/* SHAPING PROTOTYPE ONLY: the dot stands for it on a narrow bar */}
            <span className={cn('hidden', slim ? 'min-[850px]:inline' : 'min-[900px]:inline')}>
              {' '}
              Online
            </span>
          </span>
        </Link>
      )}
      {stats.members !== null && (
        <Stat label="Members" to="/analytics/growth">
          <span className={cn(slim && SLIM_NUMBER)}>{statText(stats.members, formatCount)}</span>
        </Stat>
      )}
      {stats.mrr !== null && (
        <Stat label="MRR" to="/analytics/growth?tab=mrr">
          <span className={cn(slim && SLIM_NUMBER)}>
            {statText(stats.mrr, slim ? formatSlimMrr : formatMrr)}
          </span>
        </Stat>
      )}
    </>
  );
}

/** Opens View site's Customize panel, or closes it again. */
function CustomizeToggle() {
  const customizing = useIsCustomizingSite();

  return (
    <Link
      aria-pressed={customizing}
      className={cn(
        'flex h-full items-center transition-colors hover:text-white',
        LABEL,
        customizing ? 'text-white' : MUTED,
      )}
      to={customizing ? VIEW_SITE_PATH : CUSTOMIZE_SITE_PATH}
    >
      Customize
    </Link>
  );
}

/**
 * SHAPING PROTOTYPE ONLY: Help in the top bar, which shows on every screen the
 * frame does, Settings included. Marked for the Help app as the other Help
 * links are, so it opens and closes the panel.
 */
function HelpLink() {
  const inAppSupport = useFeatureFlag('inAppSupport');
  const { topBar } = useHelpAccess();

  if (!inAppSupport || !topBar) {
    return null;
  }

  return (
    <a
      aria-label="Help"
      className={cn('flex h-full items-center transition-colors hover:text-white', MUTED)}
      data-ghost-help=""
      href="https://ghost.org/help?utm_source=admin&utm_campaign=help"
      rel="noopener noreferrer"
      target="_blank"
      title="Help"
    >
      <LucideIcon.HelpCircle className="size-4" strokeWidth={2} />
    </a>
  );
}

/**
 * The frame's top bar: places on the left, search in the middle, and the
 * time and the site's numbers on the right. On View site, the right side
 * customizes the site's design instead.
 *
 * SHAPING PROTOTYPE ONLY: main's three equal columns let a full right side run
 * under search from about 1450px down. Here each side is as wide as what's in
 * it, and search fills what's left between them, up to 480px, with a gutter
 * either side. With room to spare the sides are equal, so search is centred;
 * with less it sits off centre, then narrows. As the bar narrows further the
 * right side sheds what matters least, so search keeps a usable width down to
 * 800px, where the bar gives way to the mobile layout:
 * - below 1040px the date goes
 * - below 960px the time goes
 * - below 900px Online is its dot and number
 *
 * The slim top bar (which the hybrid switches to below 1600px) has less on its
 * right, and search stops at 300px, so each of those steps comes later: 960px,
 * 900px and 850px.
 */
export function AdminFrameTopBar({ hidden = false }: { hidden?: boolean }) {
  const { pathname } = useLocation();
  const isViewSite = pathname === VIEW_SITE_PATH;
  const canCustomize = useCanCustomizeSite();
  // Closed around a full-screen surface, nothing shows where they'd lead
  usePlaceShortcuts(!hidden);
  // SHAPING PROTOTYPE ONLY
  const slim = useTopBarSlim();

  return (
    <div
      className={cn(
        'grid h-full items-center gap-x-6 whitespace-nowrap',
        slim
          ? 'grid-cols-[minmax(max-content,1fr)_minmax(0,300px)_minmax(max-content,1fr)]'
          : 'grid-cols-[minmax(max-content,1fr)_minmax(0,480px)_minmax(max-content,1fr)]',
      )}
      data-testid="admin-frame-top-bar"
    >
      <nav aria-label="Places" className="flex h-full items-center gap-6 pl-6">
        <PlaceTab active={!isViewSite} className="font-semibold" shortcut="Option + 1" to="/">
          Ghost
        </PlaceTab>
        <PlaceTab active={isViewSite} shortcut="Option + 2" to={VIEW_SITE_PATH}>
          View site
        </PlaceTab>
      </nav>
      <div className="flex min-w-0 justify-center">
        <SearchPill />
      </div>
      <div className="flex h-full items-center justify-end gap-5 pr-6">
        {isViewSite && canCustomize ? <CustomizeToggle /> : <SiteNumbers />}
        <HelpLink />
      </div>
    </div>
  );
}
