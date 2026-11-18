import { type AccessChange, compareAccess, widensAccess } from './access.ts';
import type { AppManifest } from './schema.ts';

/**
 * The only fields that may change without the publisher approving it again: text, colour
 * and the backend key. Access isn't a field here: its changes decide their own approval. Everything else says who the app is or is a URL Ghost loads or
 * links to, and a field added to the manifest later needs approval until it is listed
 * here.
 *
 * The backend key is vouched for by the identity key, which signed the manifest naming
 * it, so an app can replace a leaked one without every site having to approve it.
 */
const SILENT_PATHS = new Set(['description', 'accent_color', 'icon.name']);
const SILENT_PREFIXES = ['backend_key.'];

const isSilent = (path: string) =>
  SILENT_PATHS.has(path) || SILENT_PREFIXES.some((prefix) => path.startsWith(prefix));

/** A field of the manifest that differs, other than access. */
export interface FieldChange {
  /** Where in the manifest the change is, e.g. `surfaces[0].url`. */
  path: string;
  /** Whether this change needs the publisher to approve it before it applies. */
  requiresApproval: boolean;
}

/** One thing that differs between two versions of a manifest: a field, or one scope's access. */
export type ManifestChange = FieldChange | AccessChange;

export function isAccessChange(change: ManifestChange): change is AccessChange {
  return 'scope' in change;
}

/**
 * Whether a change needs the publisher's approval. A field says so itself; an access change
 * needs it when it widens access.
 */
export function changeRequiresApproval(change: ManifestChange): boolean {
  return isAccessChange(change) ? widensAccess(change) : change.requiresApproval;
}

export interface ManifestComparison {
  /**
   * Everything that differs: the fields, by path, then access, in the registry's order. Empty
   * when nothing changed.
   */
  changes: ManifestChange[];
  /** Whether any of the changes needs approval. */
  requiresApproval: boolean;
}

function entriesOf(value: unknown, path: string): Array<[string, unknown]> {
  if (Array.isArray(value)) {
    return value.map((item, index) => [`${path}[${index}]`, item]);
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).map(([key, item]) => [path ? `${path}.${key}` : key, item]);
  }
  return [];
}

// Each leaf is kept as JSON, so values of different types never compare equal. An empty
// list or object is a leaf too: otherwise a field that arrives as `[]` would not count as
// a change.
function collectLeaves(value: unknown, path: string, leaves: Map<string, string>): void {
  const entries = entriesOf(value, path);
  if (entries.length === 0) {
    leaves.set(path, JSON.stringify(value));
    return;
  }
  for (const [itemPath, item] of entries) {
    collectLeaves(item, itemPath, leaves);
  }
}

// Access is compared by meaning, not field by field, so it's left out here.
function leavesOf({ access: _access, ...manifest }: AppManifest): Map<string, string> {
  const leaves = new Map<string, string>();
  collectLeaves(manifest, '', leaves);
  return leaves;
}

/**
 * Compares the manifest a publisher approved with a newer one, field by field. A field
 * that appears or disappears counts as changed.
 *
 * Access is compared by meaning instead, one change per scope: a scope added or removed, or
 * one the backend may now, or no longer, use. Only the changes that widen access need approval,
 * and reordering is no change.
 *
 * The manifest names its own `manifest_url`, which decides what future updates say, so a
 * move needs approval like any other change of URL.
 */
export function compareManifests(approved: AppManifest, next: AppManifest): ManifestComparison {
  const before = leavesOf(approved);
  const after = leavesOf(next);
  const paths = [...new Set([...before.keys(), ...after.keys()])].sort();

  const changes: ManifestChange[] = [
    ...paths
      .filter((path) => before.get(path) !== after.get(path))
      .map((path) => ({ path, requiresApproval: !isSilent(path) })),
    ...compareAccess(approved.access, next.access),
  ];

  return { changes, requiresApproval: changes.some(changeRequiresApproval) };
}
