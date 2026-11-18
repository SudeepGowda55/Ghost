import assert from 'node:assert/strict';
import { authorize } from '../../../../../core/server/auth/policy/authorize';
import type { PolicyPrincipal } from '../../../../../core/server/auth/policy/capabilities';
import {
  getGrantFlags,
  toPolicyPrincipal,
  type LoadedActors,
} from '../../../../../core/server/auth/permissions/can-this';
import parseContext from '../../../../../core/server/auth/permissions/parse-context';
import { permissions as permissionData } from '../../../../../core/server/auth/permissions/permissions-data';
import * as rolePermissions from '../../../../../core/server/auth/permissions/role-permissions';
import type { Permission } from '../../../../../core/server/auth/permissions/role-permissions';
import type { Principal } from '../../../../../core/server/auth/principal';

// canThis' grant check before the policy core, kept verbatim apart from lodash
function legacyGrantFlags(loaded: LoadedActors, actType: string, objType: string) {
  const userPermissions = loaded.user ? loaded.user.permissions : null;
  const apiKeyPermissions = loaded.apiKey ? loaded.apiKey.permissions : null;

  let hasUserPermission: boolean | undefined;
  let hasApiKeyPermission: boolean;

  const checkPermission = (perm: Permission) =>
    perm.action_type === actType && perm.object_type === objType;

  const isOwner = Boolean(loaded.user?.roles?.some((role) => role.name === 'Owner'));
  if (isOwner) {
    hasUserPermission = true;
  } else if (userPermissions && userPermissions.length > 0) {
    hasUserPermission = userPermissions.some(checkPermission);
  }

  hasApiKeyPermission = true;
  if (apiKeyPermissions !== null) {
    if (loaded.user) {
      hasApiKeyPermission = true;
    } else {
      hasUserPermission = true;
      hasApiKeyPermission = apiKeyPermissions.some(checkPermission);
    }
  }

  return { hasUserPermission, hasApiKeyPermission };
}

// What providers.user and providers.apiKey load for these role names
function loadUser(roles: string[]) {
  return {
    permissions: rolePermissions.forRoles(roles),
    roles: roles.map((name, i) => ({ id: `role-${i}`, name })),
  };
}

function loadApiKey(role: string | null) {
  return {
    permissions: role ? rolePermissions.forRoles([role]) : [],
    roles: [role ? { id: 'key-role', name: role } : null],
  };
}

const userView = Object.freeze({ id: '1', email: 'a@example.com', name: 'A', status: 'active' });
const keyView = (type: string) =>
  Object.freeze({ id: 'key', type, user_id: null, integration_id: 'integration' });

// Apps are always scoped; with every key in scope, the cap changes nothing
const everyKey = Object.entries(permissionData).flatMap(([objectType, actions]) =>
  actions.map((action) => `${objectType}:${action}`),
);

const staffRoles = ['Owner', 'Administrator', 'Super Editor', 'Editor', 'Author', 'Contributor'];
const integrationRoles = rolePermissions.roleNames().filter((name) => name.endsWith('Integration'));

interface Case {
  name: string;
  context: unknown;
  loaded: LoadedActors;
  /** What canThis loaded before, when it now skips a load */
  legacyLoaded?: LoadedActors;
}

const cases: Case[] = [];

for (const role of [...staffRoles, ...integrationRoles, 'Unknown Role']) {
  const user = loadUser([role]);
  cases.push({
    name: `${role} session`,
    context: {
      user: '1',
      principal: { kind: 'user', method: 'session', user: userView } satisfies Principal,
    },
    loaded: { user, apiKey: null },
  });
  cases.push({
    name: `${role} legacy context`,
    context: { user: '1' },
    loaded: { user, apiKey: null },
  });
  // A staff token's principal skips the key load; a legacy context still loads it
  cases.push({
    name: `${role} staff token`,
    context: {
      user: '1',
      api_key: { id: 'key', type: 'admin' },
      principal: {
        kind: 'user',
        method: 'staff_token',
        user: userView,
        apiKey: keyView('admin'),
      } satisfies Principal,
    },
    loaded: { user, apiKey: null },
    legacyLoaded: { user, apiKey: loadApiKey(null) },
  });
  cases.push({
    name: `${role} staff token, legacy context`,
    context: { user: '1', api_key: { id: 'key', type: 'admin' } },
    loaded: { user, apiKey: loadApiKey(null) },
  });
  cases.push({
    name: `app acting for ${role}, scoped to every key`,
    context: {
      user: '1',
      principal: {
        kind: 'app',
        method: 'oauth_authorization_code',
        app: { id: 'installation' },
        actingFor: userView,
        scopes: everyKey,
      } satisfies Principal,
    },
    loaded: { user, apiKey: null },
  });
}

cases.push({
  name: 'user with no roles',
  context: { user: '1' },
  loaded: { user: loadUser([]), apiKey: null },
});

for (const role of [...integrationRoles, ...staffRoles, 'Unknown Role']) {
  cases.push({
    name: `${role} admin key`,
    context: {
      api_key: { id: 'key', type: 'admin' },
      principal: {
        kind: 'integration',
        method: 'admin_api_key',
        apiKey: keyView('admin'),
        integration: null,
      } satisfies Principal,
    },
    loaded: { user: null, apiKey: loadApiKey(role) },
  });
  cases.push({
    name: `${role} admin key, legacy context`,
    context: { api_key: { id: 'key', type: 'admin' } },
    loaded: { user: null, apiKey: loadApiKey(role) },
  });
}

cases.push({
  name: 'content key',
  context: {
    api_key: { id: 'key', type: 'content' },
    principal: {
      kind: 'integration',
      method: 'content_api_key',
      apiKey: keyView('content'),
      integration: null,
    } satisfies Principal,
  },
  loaded: { user: null, apiKey: loadApiKey(null) },
});
cases.push({
  name: 'anonymous',
  context: { principal: { kind: 'anonymous' } satisfies Principal },
  loaded: { user: null, apiKey: null },
});
cases.push({ name: 'no context', context: undefined, loaded: { user: null, apiKey: null } });

const checks = Object.entries(permissionData).flatMap(([objectType, actions]) =>
  actions.map((action) => [action, objectType] as const),
);

describe('Authorization policy equivalence with the legacy grant check', function () {
  for (const { name, context, loaded, legacyLoaded = loaded } of cases) {
    it(name, async function () {
      const principal = toPolicyPrincipal(parseContext(context), loaded);
      const mismatches: string[] = [];

      for (const [action, objectType] of checks) {
        const legacy = legacyGrantFlags(legacyLoaded, action, objectType);
        const flags = getGrantFlags(principal, action, objectType);
        const allowed = await authorize(principal, action, objectType).then(
          () => true,
          () => false,
        );

        // Hooks read the flags by truthiness, so undefined and false are the same answer
        if (
          flags.hasUserPermission !== Boolean(legacy.hasUserPermission) ||
          flags.hasApiKeyPermission !== legacy.hasApiKeyPermission ||
          allowed !== Boolean(legacy.hasUserPermission && legacy.hasApiKeyPermission)
        ) {
          mismatches.push(`${objectType}:${action}`);
        }
      }

      assert.deepEqual(mismatches, []);
    });
  }

  // canThis resolves internal requests before the grant check; policy gives the same answer
  it('internal', async function () {
    const principal: PolicyPrincipal = { kind: 'internal' };
    for (const [action, objectType] of checks) {
      assert.deepEqual(await authorize(principal, action, objectType), {});
    }
  });

  it('covers every check canThis exposes', function () {
    const covered = new Set(checks.map(([action, objectType]) => `${objectType}:${action}`));
    for (const [action, objectTypes] of Object.entries(rolePermissions.actionsMap)) {
      for (const objectType of objectTypes) {
        assert(covered.has(`${objectType}:${action}`), `${objectType}:${action}`);
      }
    }
  });
});
