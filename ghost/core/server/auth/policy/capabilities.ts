import { permissions as permissionData } from '../permissions/permissions-data';
import * as rolePermissions from '../permissions/role-permissions';
import type { Scopes } from '../principal';

/** An `object_type:action` key, such as `post:edit`. */
export type Capability = `${string}:${string}`;

/**
 * The principal as policy reads it. The request principal carries no roles
 * yet, so canThis adds the role names it loads. An app's `roles` are the
 * roles of the user it acts for, or null when it acts for none. Scopes are
 * capability keys; a principal with none is unscoped.
 */
export type PolicyPrincipal =
  | { kind: 'internal' }
  | { kind: 'anonymous' }
  | { kind: 'user'; roles: readonly string[]; scopes?: Scopes }
  | { kind: 'integration'; roles: readonly string[]; scopes?: Scopes }
  | { kind: 'app'; roles: readonly string[] | null; scopes: Scopes };

export interface Capabilities {
  /** The keys the principal's roles grant, or an app's scopes when it has no user */
  granted: ReadonlySet<Capability>;
  /** The keys its token and app scopes allow, or `unlimited` when it has neither */
  scopes: ReadonlySet<Capability> | 'unlimited';
}

export function capabilityKey(objectType: string, action: string): Capability {
  return `${objectType}:${action}`;
}

const ALL: ReadonlySet<Capability> = new Set(
  Object.entries(permissionData).flatMap(([objectType, actions]) =>
    actions.map((action) => capabilityKey(objectType, action)),
  ),
);

const NONE: ReadonlySet<Capability> = new Set();

// Grants depend only on role names, which are code, so each role set is built once per process
const byRoleSet = new Map<string, ReadonlySet<Capability>>();

function roleGrants(roles: readonly string[]): ReadonlySet<Capability> {
  const key = [...new Set(roles)].sort().join('\n');
  let grants = byRoleSet.get(key);

  if (!grants) {
    grants = new Set(
      rolePermissions
        .forRoles(roles)
        .map((perm) => capabilityKey(perm.object_type, perm.action_type)),
    );
    byRoleSet.set(key, grants);
  }

  return grants;
}

/** A staff user's grants; Owner is granted every key. */
function staffGrants(roles: readonly string[]): ReadonlySet<Capability> {
  return roles.includes('Owner') ? ALL : roleGrants(roles);
}

/** Scopes as exact keys; `post:*` expands to every action of that type. */
function toKeys(scopes: Scopes): ReadonlySet<Capability> {
  return new Set(
    scopes.flatMap((scope): Capability[] => {
      const [objectType, action] = scope.split(':');
      if (action !== '*') {
        return [scope as Capability];
      }
      const actions: readonly string[] = Object.hasOwn(permissionData, objectType)
        ? permissionData[objectType as keyof typeof permissionData]
        : [];
      return actions.map((each) => capabilityKey(objectType, each));
    }),
  );
}

function granted(principal: PolicyPrincipal): ReadonlySet<Capability> {
  switch (principal.kind) {
    case 'internal':
      return ALL;
    case 'anonymous':
      return NONE;
    case 'user':
      return staffGrants(principal.roles);
    // A legacy key takes its integration role's grants, with no Owner bypass
    case 'integration':
      return roleGrants(principal.roles);
    // With no user to act for, an app is granted exactly its scopes
    case 'app':
      return principal.roles ? staffGrants(principal.roles) : toKeys(principal.scopes);
  }
}

// Only one scope source exists per principal today; app tokens will intersect theirs here
function scopeLimit(principal: PolicyPrincipal): Capabilities['scopes'] {
  if (principal.kind === 'internal' || principal.kind === 'anonymous' || !principal.scopes) {
    return 'unlimited';
  }
  return toKeys(principal.scopes);
}

// Keyed on the principal object, so canThis computes once per check chain
const memo = new WeakMap<PolicyPrincipal, Capabilities>();

/** The keys the principal is granted and the keys its scopes allow. */
export function capabilities(principal: PolicyPrincipal): Capabilities {
  let result = memo.get(principal);

  if (!result) {
    result = Object.freeze({ granted: granted(principal), scopes: scopeLimit(principal) });
    memo.set(principal, result);
  }

  return result;
}
