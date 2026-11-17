import React, { useState, useSyncExternalStore } from 'react';
import {
  Button,
  Checkbox,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@tryghost/shade/components';
import { Inline, Stack, Text } from '@tryghost/shade/primitives';
import { ShadeApp } from '@tryghost/shade/app';
import { LucideIcon, cn } from '@tryghost/shade/utils';
import {
  HELP_ACCESS_POINTS,
  HELP_DESIGNS,
  HELP_PANELS,
  type HelpAccessId,
  type HelpDesignId,
  type HelpPanelId,
  setBusyTopBar,
  setHelpAccess,
  setHelpDesign,
  setHelpPanel,
  useBusyTopBar,
  useHelpAccessId,
  useHelpDesignId,
  useHelpPanelId,
} from './concepts';

// SHAPING PROTOTYPE ONLY — never merge (see src/shaping/README.md).
//
// The prototype menu, as in the automations and analytics prototypes. A small
// square in the bottom-right corner is the hover target; the beaker inside it
// fades in while the pointer is over the square, while it has keyboard focus,
// or while its menu is open. Away from Current it stays faintly visible, as a
// reminder that a concept is showing.
//
// Its own React root, outside Admin's, so the screens being shaped never know
// it's there (mounted by mount-menu.tsx). ShadeApp gives it Shade's styles
// and follows Admin's dark mode.

const subscribeToTheme = (onChange: () => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
};
const isDark = () => document.documentElement.classList.contains('dark');

/** One option: filled while it's the one picked. */
function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      aria-pressed={pressed}
      shape="pill"
      size="sm"
      type="button"
      variant={pressed ? 'default' : 'outline'}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

/** One of the menu's sections: its title, and its options side by side, wrapping. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Stack gap="sm">
      <Text size="xs" tone="secondary" weight="medium">
        {title}
      </Text>
      <Inline gap="xs" wrap>
        {children}
      </Inline>
    </Stack>
  );
}

interface Option {
  id: string;
  label: string;
}

/** A section where one option is picked. The menu stays open, to flick between them. */
function Options({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: readonly Option[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <Section title={title}>
      {options.map((option) => (
        <Chip key={option.id} pressed={option.id === value} onClick={() => onChange(option.id)}>
          {option.label}
        </Chip>
      ))}
    </Section>
  );
}

export const ShapingMenu: React.FC = () => {
  const [open, setOpen] = useState(false);
  const dark = useSyncExternalStore(subscribeToTheme, isDark);
  const panel = useHelpPanelId();
  const design = useHelpDesignId();
  const access = useHelpAccessId();
  const busyTopBar = useBusyTopBar();

  return (
    <ShadeApp className="shade-admin" darkMode={dark}>
      {/* Kept tight to the corner: Help can sit under it, and the square takes
          the pointer from whatever it covers */}
      <div className="group/proto fixed right-0 bottom-0 z-[60] flex size-12 items-end justify-end p-1.5">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              aria-label="Prototype"
              className={cn(
                'bg-background/80 text-muted-foreground opacity-0 backdrop-blur-sm transition-opacity group-hover/proto:opacity-100 focus-visible:opacity-100 motion-reduce:transition-none',
                (panel !== 'current' || design !== 'current' || access !== 'current') &&
                  'opacity-40',
                open && 'bg-muted opacity-100',
              )}
              size="icon"
              type="button"
              variant="ghost"
            >
              <LucideIcon.FlaskConical strokeWidth={2} />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80" side="top">
            <Stack gap="lg">
              <Text size="md" weight="semibold">
                Help panel
              </Text>
              <Options
                options={HELP_PANELS}
                title="Layout"
                value={panel}
                onChange={(id) => setHelpPanel(id as HelpPanelId)}
              />
              <Options
                options={HELP_DESIGNS}
                title="Design"
                value={design}
                onChange={(id) => setHelpDesign(id as HelpDesignId)}
              />
              <Options
                options={HELP_ACCESS_POINTS}
                title="Access"
                value={access}
                onChange={(id) => setHelpAccess(id as HelpAccessId)}
              />
              {/* What the site would need set up, faked to judge an option at its busiest */}
              <Section title="Conditions">
                <Inline align="center" gap="sm">
                  <Checkbox
                    checked={busyTopBar}
                    id="shaping-busy-top-bar"
                    onCheckedChange={(checked) => setBusyTopBar(checked === true)}
                  />
                  <Label htmlFor="shaping-busy-top-bar">Busy top bar</Label>
                </Inline>
              </Section>
            </Stack>
          </PopoverContent>
        </Popover>
      </div>
    </ShadeApp>
  );
};
