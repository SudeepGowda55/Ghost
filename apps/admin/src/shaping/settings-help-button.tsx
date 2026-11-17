import { Button } from '@tryghost/shade/components';
import { LucideIcon } from '@tryghost/shade/utils';
import { useFeatureFlag } from '@tryghost/admin-x-framework/hooks';
import { useHelpAccess, useHelpSettingsPlaceId } from './concepts';

// SHAPING PROTOTYPE ONLY — never merge (see src/shaping/README.md).
//
// Help in classic Admin's Settings, as a floating button in the bottom-right
// corner of the Settings navigation: the alternative to the link under it.
// Classic Admin has no top bar, and Settings swaps the main navigation (and
// its Help link) for its own. Marked for the Help app as the other Help links
// are, so it opens and closes the panel. Rendered inside the navigation's
// panel (SettingsSidebar), over its last items and the fade above them.
export function SettingsHelpButton() {
  const inAppSupport = useFeatureFlag('inAppSupport');
  const { topBar } = useHelpAccess();
  const place = useHelpSettingsPlaceId();

  if (!inAppSupport || !topBar || place !== 'floating') {
    return null;
  }

  return (
    <Button
      className="absolute right-4 bottom-4 z-20 size-10 bg-background shadow-md"
      shape="pill"
      size="icon"
      variant="outline"
      asChild
    >
      <a
        aria-label="Help"
        data-ghost-help=""
        href="https://ghost.org/help?utm_source=admin&utm_campaign=help"
        rel="noopener noreferrer"
        target="_blank"
        title="Help"
      >
        <LucideIcon.HelpCircle />
      </a>
    </Button>
  );
}
