import {
  type Segment,
  useAddSegment,
  useBrowseSegments,
  useDeleteSegment,
  useEditSegment,
} from '@tryghost/admin-x-framework/api/segments';
import { useBrowseSettings } from '@tryghost/admin-x-framework/api/settings';
import { APIError, JSONError } from '@tryghost/admin-x-framework/errors';
import { canManageMembers } from '@tryghost/admin-x-framework/api/users';
import { useCurrentUser } from '@tryghost/admin-x-framework/api/current-user';
import { useCallback, useEffect, useMemo } from 'react';
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

type WriteAction = 'save' | 'delete';

const VIEW_NOT_FOUND_ERROR = 'This view no longer exists';
const WRITE_FAILED_ERRORS: Record<WriteAction, string> = {
  save: 'Failed to save view',
  delete: 'Failed to delete view',
};

/**
 * The longest view name, in characters, that can be saved. It mirrors the segments API's limit,
 * which refuses a longer name with an error the popover can only show as a generic failure.
 */
export const MEMBER_VIEW_NAME_MAX_LENGTH = 191;

/** A failed segments write as the popover shows it, in terms of views. */
class ViewWriteError extends Error {
  /** Whether the failure is the publisher's to fix, rather than one to report. */
  readonly refused: boolean;

  constructor(message: string, { refused, cause }: { refused: boolean; cause?: unknown }) {
    super(message, { cause });
    this.refused = refused;
  }
}

/**
 * The message a failed segments write shows. An unknown segment is a 404. The segments service
 * refuses a write with a 422 validation error whose `context` is written for a publisher, such as
 * a duplicate name. The API framework answers a request it can't parse with a 422 validation
 * error too, but with a generic context and the parsing problems in `details`, so that, like
 * anything else, reads as a failed save.
 */
function toViewWriteError(error: unknown, action: WriteAction): ViewWriteError {
  if (error instanceof ViewWriteError) {
    return error;
  }

  const status = error instanceof JSONError ? error.response?.status : undefined;
  const refusal = error instanceof JSONError ? error.data?.errors?.[0] : undefined;

  if (status === 404) {
    return new ViewWriteError(VIEW_NOT_FOUND_ERROR, { refused: true, cause: error });
  }

  const refusedByService =
    status === 422 && refusal?.type === 'ValidationError' && !Array.isArray(refusal.details);
  if (refusedByService && refusal.context) {
    return new ViewWriteError(refusal.context, { refused: true, cause: error });
  }

  return new ViewWriteError(WRITE_FAILED_ERRORS[action], { refused: false, cause: error });
}

/**
 * The pieces every member view write shares: the server's current segments, and a way to send a
 * segments write that reports failures in terms of views.
 */
function useSegmentWrites() {
  const { data, error, refetch: refetchSegments } = useSegmentsQuery();
  const { refetch: refetchSettings } = useBrowseSettings();
  const handleError = useHandleError();

  /**
   * The server's segments, waiting for the list when it hasn't loaded yet, or `null` on a server
   * without the segments API, where views are written through the settings instead.
   */
  const loadSegments = useCallback(
    async (action: WriteAction): Promise<Segment[] | null> => {
      if (isSegmentsApiMissing(error)) {
        return null;
      }
      if (data) {
        return data.segments;
      }

      const result = await refetchSegments({ cancelRefetch: false });
      if (result.data) {
        return result.data.segments;
      }
      if (isSegmentsApiMissing(result.error)) {
        return null;
      }

      handleError(result.error, { withToast: false });
      throw new ViewWriteError(WRITE_FAILED_ERRORS[action], {
        refused: false,
        cause: result.error,
      });
    },
    [data, error, handleError, refetchSegments],
  );

  /**
   * Sends a segments write. A successful write updates the cached segments list from its
   * response. A failed one refetches the list and the settings, since a refusal such as a view
   * deleted in another tab means the cached copies are out of date.
   */
  const send = useCallback(
    async (action: WriteAction, request: () => Promise<unknown>): Promise<void> => {
      try {
        await request();
      } catch (requestError) {
        void refetchSegments();
        void refetchSettings();

        const viewError = toViewWriteError(requestError, action);
        if (!viewError.refused) {
          handleError(requestError, { withToast: false, displayedMessage: viewError.message });
        }
        throw viewError;
      }
    },
    [handleError, refetchSegments, refetchSettings],
  );

  return { loadSegments, send };
}

export function useSaveMemberView() {
  const { loadSegments, send } = useSegmentWrites();
  const saveToSettings = useSaveMemberViewToSettings();
  const { mutateAsync: addSegment } = useAddSegment();
  const { mutateAsync: editSegment } = useEditSegment();

  return useCallback(
    async (name: string, filter: string, originalView?: MemberView) => {
      const segments = await loadSegments('save');

      if (!segments) {
        await saveToSettings(name, filter, originalView);
        return;
      }

      await send('save', () => {
        if (!originalView) {
          return addSegment({ name: name.trim(), filter });
        }

        const segment = segments.find((candidate) => candidate.filter === originalView.filter);
        if (!segment) {
          throw new ViewWriteError(VIEW_NOT_FOUND_ERROR, { refused: true });
        }
        return editSegment({ id: segment.id, name: name.trim() });
      });
    },
    [addSegment, editSegment, loadSegments, saveToSettings, send],
  );
}

export function useDeleteMemberView() {
  const { loadSegments, send } = useSegmentWrites();
  const deleteFromSettings = useDeleteMemberViewFromSettings();
  const { mutateAsync: deleteSegment } = useDeleteSegment();

  return useCallback(
    async (view: MemberView) => {
      const segments = await loadSegments('delete');

      if (!segments) {
        await deleteFromSettings(view);
        return;
      }

      await send('delete', () => {
        const segment = segments.find((candidate) => candidate.filter === view.filter);
        if (!segment) {
          throw new ViewWriteError(VIEW_NOT_FOUND_ERROR, { refused: true });
        }
        return deleteSegment(segment.id);
      });
    },
    [deleteFromSettings, deleteSegment, loadSegments, send],
  );
}

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
