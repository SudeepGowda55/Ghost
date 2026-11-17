import React, { useCallback, useEffect, useState } from 'react';

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
} from '@tryghost/shade/components';
import { Stack } from '@tryghost/shade/primitives';
import { cn, LucideIcon } from '@tryghost/shade/utils';
// SHAPING PROTOTYPE ONLY — never merge (see src/shaping/README.md).
import { useFeatureFlag } from '@tryghost/admin-x-framework/hooks';
import { useHelpAccess, useHelpSettingsPlaceId } from '@/shaping/concepts';
import { SettingsHelpButton } from '@/shaping/settings-help-button';
import { NavMenuItem } from './nav-menu-item';

const FADE_HEIGHT = 48;

function SettingsNavigationFade({ slot }: { slot: HTMLElement | null }) {
  const [remainingScroll, setRemainingScroll] = useState(0);

  useEffect(() => {
    if (!slot) {
      return;
    }

    let detach: (() => void) | undefined;

    const attach = () => {
      const scroller = slot.querySelector<HTMLElement>('#settings-sidebar-scroller');
      if (!scroller) {
        return false;
      }

      const updateVisibility = () => {
        setRemainingScroll(
          Math.max(0, scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight),
        );
      };
      const mutationObserver = new MutationObserver(updateVisibility);
      const resizeObserver = new ResizeObserver(updateVisibility);

      updateVisibility();
      scroller.addEventListener('scroll', updateVisibility, { passive: true });
      mutationObserver.observe(scroller, { childList: true, subtree: true });
      resizeObserver.observe(scroller);
      detach = () => {
        scroller.removeEventListener('scroll', updateVisibility);
        mutationObserver.disconnect();
        resizeObserver.disconnect();
      };

      return true;
    };

    const slotObserver = new MutationObserver(() => {
      if (attach()) {
        slotObserver.disconnect();
      }
    });
    if (!attach()) {
      slotObserver.observe(slot, { childList: true, subtree: true });
    }

    return () => {
      slotObserver.disconnect();
      detach?.();
    };
  }, [slot]);

  if (remainingScroll <= 1) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-12 bg-gradient-to-t from-sidebar to-transparent"
      style={{ opacity: Math.min(1, remainingScroll / FADE_HEIGHT) }}
    />
  );
}

/**
 * SHAPING PROTOTYPE ONLY: Help under the Settings navigation, where the main
 * navigation's Help link is out of reach. Marked for the Help app as that
 * link is.
 */
function SettingsHelpLink() {
  const inAppSupport = useFeatureFlag('inAppSupport');
  const { topBar } = useHelpAccess();
  // Or as a floating button in the navigation's corner (see shaping/settings-help-button.tsx)
  const place = useHelpSettingsPlaceId();

  if (!inAppSupport || !topBar || place !== 'footer') {
    return null;
  }

  return (
    // The Settings navigation's own side padding (px-5 in settings/layout/sidebar.tsx),
    // so Help lines up with the items above it
    <SidebarGroup className="shrink-0 border-t border-border px-5">
      <SidebarGroupContent>
        <SidebarMenu>
          <NavMenuItem>
            <NavMenuItem.Link
              data-ghost-help=""
              rel="noopener noreferrer"
              target="_blank"
              to="https://ghost.org/help?utm_source=admin&utm_campaign=help"
            >
              <LucideIcon.HelpCircle />
              <NavMenuItem.Label>Help</NavMenuItem.Label>
            </NavMenuItem.Link>
          </NavMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

interface SettingsSidebarProps extends React.ComponentProps<typeof Sidebar> {
  slotRef: (element: HTMLDivElement | null) => void;
}

const SettingsSidebar = React.forwardRef<HTMLDivElement, SettingsSidebarProps>(
  function SettingsSidebar({ className, slotRef, ...props }, ref) {
    const [slot, setSlot] = useState<HTMLDivElement | null>(null);
    const handleSlotRef = useCallback(
      (element: HTMLDivElement | null) => {
        setSlot(element);
        slotRef(element);
      },
      [slotRef],
    );

    return (
      <Sidebar
        ref={ref}
        className={cn('[&_[data-sidebar=sidebar]]:overflow-hidden', className)}
        data-testid="admin-sidebar"
        {...props}
      >
        <SidebarContent className="relative overflow-hidden pt-5 pb-0">
          <Stack ref={handleSlotRef} className="min-h-0 flex-1" gap="none" />
          <SettingsNavigationFade slot={slot} />
        </SidebarContent>
        <SettingsHelpLink />
        <SettingsHelpButton />
      </Sidebar>
    );
  },
);

export default SettingsSidebar;
