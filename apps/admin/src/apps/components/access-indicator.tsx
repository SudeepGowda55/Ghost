import React from 'react';
import { Banner } from '@tryghost/shade/components';
import { Stack, Text } from '@tryghost/shade/primitives';
import { type AccessLine, describeScopes } from '@tryghost/app-contracts';
import type { AppManifest } from '@tryghost/admin-x-framework/api/app-installations';
import { servedFrom } from '@/apps/lib/served-from';
import type { AccessChangeGroup } from '@/apps/lib/access-changes';
import { SectionEyebrow } from './section-eyebrow';

interface AccessIndicatorProps {
  manifest: AppManifest;
  /**
   * Leaves out the label, the intro, the border and where the app's data goes, for a page that
   * gives the list its own section heading and card.
   */
  bare?: boolean;
}

/** How an app gets what's on the list, on an app's details page. */
export const OPENED_APP_ACCESS_INTRO = 'The app acts as whoever opens it, within their role.';

/** How an app gets what's on the list, for anyone deciding to let it in. */
const ACCOUNT_ACCESS_INTRO =
  'The app acts as whoever opens it, within their role. Only install apps from developers you trust.';

/** Why a backend's scopes are shown apart. */
export const BACKEND_ACCESS_WARNING =
  'The app’s backend can use these at any time, even when nobody has the app open, and isn’t limited to anyone’s role.';

const NO_ACCESS = 'This app doesn’t ask for access to anything on your site.';

/** One line per resource: its name over what the app can do with it, one sentence per scope. */
export const AccessLines: React.FC<{ lines: AccessLine[]; testId?: string }> = ({
  lines,
  testId = 'access-item',
}) => (
  <ul className="m-0 flex list-none flex-col gap-3 p-0">
    {lines.map((line) => (
      <li key={line.resource} data-testid={testId}>
        <Text size="sm" weight="semibold">
          {line.title}
        </Text>
        <ul className="m-0 list-disc pl-5">
          {line.actions.map((action) => (
            <li key={action}>
              <Text size="sm" tone="secondary">
                {action}
              </Text>
            </li>
          ))}
        </ul>
      </li>
    ))}
  </ul>
);

/** What a change to an app's access adds and takes away, in the review screen's words. */
export const AccessChanges: React.FC<{ groups: AccessChangeGroup[] }> = ({ groups }) => (
  <Stack data-testid="app-access-changes" gap="md">
    {groups.map((group) => (
      <Stack key={group.kind} data-testid={`app-access-${group.kind}`} gap="sm">
        <Text size="sm" weight="semibold">
          {group.heading}
        </Text>
        <AccessLines lines={group.lines} testId="access-change-item" />
      </Stack>
    ))}
  </Stack>
);

/**
 * The one way Ghost shows what an app can access: one line per resource the manifest declares,
 * in the scope registry's words, and the scopes its backend may use on its own apart, with a
 * warning, as nobody is present when it does.
 */
export const AccessIndicator: React.FC<AccessIndicatorProps> = ({ manifest, bare = false }) => {
  const lines = describeScopes(manifest.access.map((scope) => scope.name));
  const backendLines = describeScopes(
    manifest.access.filter((scope) => scope.backend).map((scope) => scope.name),
  );

  const list = lines.length ? (
    <AccessLines lines={lines} />
  ) : (
    <Text data-testid="app-no-access" size="sm" tone="secondary">
      {NO_ACCESS}
    </Text>
  );

  const backend = backendLines.length > 0 && (
    <Stack data-testid="app-backend-access" gap="sm">
      <SectionEyebrow>Its backend, on its own</SectionEyebrow>
      <Banner size="md" variant="warning">
        <p className="m-0 text-sm text-foreground">{BACKEND_ACCESS_WARNING}</p>
      </Banner>
      <AccessLines lines={backendLines} testId="backend-access-item" />
    </Stack>
  );

  if (bare) {
    return (
      <Stack data-testid="access-indicator" gap="lg">
        {list}
        {backend}
      </Stack>
    );
  }

  return (
    <Stack data-testid="access-indicator" gap="md">
      <Stack gap="xs">
        <SectionEyebrow>Required permissions</SectionEyebrow>
        <Text size="sm" tone="secondary">
          {ACCOUNT_ACCESS_INTRO}
        </Text>
      </Stack>
      {/* The box holds the list, then where the app's data goes as a band across its bottom,
          outside the list so assistive tech doesn't count it as a permission. It clips the
          band to its corners. */}
      <div className="overflow-hidden rounded-lg border border-border-default">
        <div className="p-4">{list}</div>
        <div className="bg-muted px-4 py-3">
          <DataAccessedBy manifest={manifest} />
        </div>
      </div>
      {backend}
    </Stack>
  );
};

/** Where an app reads and writes its data: a quiet label over the address. */
const DataAccessedBy: React.FC<{ manifest: AppManifest }> = ({ manifest }) => (
  <Stack className="min-w-0" data-testid="app-data-accessed-by" gap="sm">
    <p className="stat-label text-muted-foreground">Data accessed by</p>
    <p className="min-w-0 text-sm break-words text-foreground">{servedFrom(manifest)}</p>
  </Stack>
);
