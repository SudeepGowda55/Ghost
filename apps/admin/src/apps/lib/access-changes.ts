import {
  type AccessChange,
  type AccessLine,
  type AppScopeName,
  describeScopes,
} from '@tryghost/app-contracts';

/** A kind of change to an app's access, in the scope registry's words, one line per resource. */
export interface AccessChangeGroup {
  kind: AccessChange['change'];
  heading: string;
  lines: AccessLine[];
}

const HEADINGS: Record<AccessChangeGroup['kind'], string> = {
  added: 'New access',
  backend_added: 'New for its backend, at any time',
  removed: 'No longer has',
  backend_removed: 'No longer for its backend',
};

/**
 * Groups changes to an app's access as a publisher reads them: what it gains, what its backend
 * may now use on its own, and what it gives up. A scope added for the backend shows in both of
 * the first two, as it widens both. Kinds with nothing in them are left out.
 */
export function describeAccessChanges(changes: readonly AccessChange[]): AccessChangeGroup[] {
  const scopesFor: Record<AccessChangeGroup['kind'], AppScopeName[]> = {
    added: [],
    backend_added: [],
    removed: [],
    backend_removed: [],
  };
  for (const { scope, change, backend } of changes) {
    scopesFor[change].push(scope);
    if (change === 'added' && backend) {
      scopesFor.backend_added.push(scope);
    }
  }
  return (Object.keys(HEADINGS) as AccessChangeGroup['kind'][]).flatMap((kind) => {
    const lines = describeScopes(scopesFor[kind]);
    return lines.length ? [{ kind, heading: HEADINGS[kind], lines }] : [];
  });
}
