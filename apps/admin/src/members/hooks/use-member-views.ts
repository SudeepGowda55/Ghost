import { useBrowseSegments } from '@tryghost/admin-x-framework/api/segments';
import { APIError } from '@tryghost/admin-x-framework/errors';
import { canManageMembers } from '@tryghost/admin-x-framework/api/users';
import { useCurrentUser } from '@tryghost/admin-x-framework/api/current-user';
import { useEffect, useMemo } from 'react';
import { useHandleError } from '@tryghost/admin-x-framework/hooks';
import {
  useDeleteMemberViewFromSettings,
  useMemberViewsFromSettings,
  useSaveMemberViewToSettings,
} from '@/members/member-views-from-settings';

/**
 * Saved member views, for the members screen and the sidebar. Callers list, save, rename and
 * delete views through these hooks without knowing where Ghost stores them.
 */

/** A saved member view: a named member filter. The filter identifies the view. */
export interface MemberView {
  name: string;
  filter: string;
}

/** Whether a segments request failed because the server is older than the segments API. */
function isSegmentsApiMissing(error: unknown): boolean {
  return error instanceof APIError && error.response?.status === 404;
}

/**
 * The segments list, requested only for staff who are shown member views. Once the server answers
 * 404 the query is disabled, so a server older than the segments API gets one failed request, not
 * one each time the sidebar or the members screen mounts.
 */
function useSegmentsQuery() {
  const { data: currentUser } = useCurrentUser();
  const showsMemberViews = Boolean(currentUser && canManageMembers(currentUser));

  return useBrowseSegments({
    defaultErrorHandler: false,
    enabled: (query) => showsMemberViews && !isSegmentsApiMissing(query.state.error),
  });
}

/**
 * The saved member views in display order. They come from the segments API once its list has
 * loaded. Until then, and when it can't be read, they come from the cached settings, which Ghost
 * stores them in, so they show as soon as the settings load.
 */
export function useMemberViews(): MemberView[] {
  const { data, error } = useSegmentsQuery();
  const handleError = useHandleError();
  const segmentsApiMissing = isSegmentsApiMissing(error);
  const settingsViews = useMemberViewsFromSettings(segmentsApiMissing);

  useEffect(() => {
    if (error && !segmentsApiMissing) {
      handleError(error, { withToast: false });
    }
  }, [error, handleError, segmentsApiMissing]);

  return useMemo(() => data?.segments ?? settingsViews, [data, settingsViews]);
}

export {
  useDeleteMemberViewFromSettings as useDeleteMemberView,
  useSaveMemberViewToSettings as useSaveMemberView,
};

export function useActiveMemberView(
  views: MemberView[],
  nql: string | undefined,
): MemberView | null {
  return useMemo(() => {
    if (!nql || views.length === 0) {
      return null;
    }

    return views.find((view) => view.filter === nql) ?? null;
  }, [views, nql]);
}
