import assert from 'node:assert/strict';
import { authorize } from '../../../../../core/server/auth/policy/authorize';
import { capabilities } from '../../../../../core/server/auth/policy/capabilities';
import { rowRules } from '../../../../../core/server/auth/policy/rules';
import { scopesAllow } from '../../../../../core/server/auth/policy/scopes';

const noPermission = { errorType: 'NoPermissionError' };

describe('Authorization policy', function () {
  describe('capabilities', function () {
    it('grants Owner every key, unscoped', function () {
      const owner = capabilities({ kind: 'user', roles: ['Owner'] });
      assert(owner.granted.has('db:deleteAllContent'));
      assert(owner.granted.has('upgrade:add'));
      assert.equal(owner.granted, capabilities({ kind: 'internal' }).granted);
      assert.equal(owner.scopes, 'unlimited');
    });

    it('grants a staff role its role grants', function () {
      const { granted } = capabilities({ kind: 'user', roles: ['Contributor'] });
      assert(granted.has('post:browse'));
      assert(!granted.has('post:publish'));
      assert(!granted.has('setting:edit'));
    });

    it('builds each role set once', function () {
      assert.equal(
        capabilities({ kind: 'user', roles: ['Editor', 'Author'] }).granted,
        capabilities({ kind: 'user', roles: ['Author', 'Editor', 'Author'] }).granted,
      );
    });

    it('computes once per principal', function () {
      const principal = { kind: 'user', roles: ['Editor'] } as const;
      assert.equal(capabilities(principal), capabilities(principal));
    });

    it('does not give an integration key the Owner bypass', function () {
      assert.equal(capabilities({ kind: 'integration', roles: ['Owner'] }).granted.size, 0);
    });

    it('grants a content key and an anonymous request nothing', function () {
      assert.equal(capabilities({ kind: 'integration', roles: [] }).granted.size, 0);
      assert.equal(capabilities({ kind: 'anonymous' }).granted.size, 0);
    });

    it('grants an app with no user exactly its scopes', function () {
      const app = capabilities({ kind: 'app', roles: null, scopes: ['post:read'] });
      assert.deepEqual([...app.granted], ['post:read']);
      assert.deepEqual(app.scopes, new Set(['post:read']));
    });

    it('grants an app acting for a user that user’s grants, capped by its scopes', function () {
      const app = capabilities({ kind: 'app', roles: ['Editor'], scopes: ['post:read'] });
      assert.equal(app.granted, capabilities({ kind: 'user', roles: ['Editor'] }).granted);
      assert.deepEqual(app.scopes, new Set(['post:read']));
    });

    it('expands a wildcard scope to every action of its type', function () {
      const { scopes } = capabilities({
        kind: 'integration',
        roles: [],
        scopes: ['webhook:*', 'tag:read', 'nope:*'],
      });
      assert.deepEqual(
        scopes,
        new Set(['webhook:add', 'webhook:edit', 'webhook:destroy', 'tag:read']),
      );
      assert.deepEqual(
        [...capabilities({ kind: 'app', roles: null, scopes: ['webhook:*'] }).granted],
        ['webhook:add', 'webhook:edit', 'webhook:destroy'],
      );
    });

    it('scopes a token principal by its scopes', function () {
      assert.deepEqual(
        capabilities({ kind: 'user', roles: ['Owner'], scopes: ['tag:edit'] }).scopes,
        new Set(['tag:edit']),
      );
      assert.deepEqual(
        capabilities({ kind: 'integration', roles: [], scopes: [] }).scopes,
        new Set(),
      );
    });
  });

  describe('scopes', function () {
    it('allows everything when unlimited', function () {
      assert.equal(scopesAllow('unlimited', 'db:deleteAllContent'), true);
    });

    it('allows only listed keys when scoped', function () {
      assert.equal(scopesAllow(new Set(['post:read']), 'post:read'), true);
      assert.equal(scopesAllow(new Set(['post:read']), 'post:edit'), false);
    });
  });

  describe('authorize', function () {
    it('lets an internal request through', async function () {
      assert.deepEqual(await authorize({ kind: 'internal' }, 'edit', 'post'), {});
    });

    it('allows a granted, unscoped key', async function () {
      assert.deepEqual(await authorize({ kind: 'user', roles: ['Editor'] }, 'publish', 'post'), {});
    });

    it('refuses a key that is not granted', async function () {
      await assert.rejects(
        authorize({ kind: 'user', roles: ['Author'] }, 'edit', 'setting'),
        noPermission,
      );
      await assert.rejects(authorize({ kind: 'anonymous' }, 'browse', 'post'), noPermission);
    });

    it('refuses a granted key the scopes lack, even for Owner', async function () {
      const owner = { kind: 'user', roles: ['Owner'], scopes: ['tag:read'] } as const;
      assert.deepEqual(await authorize(owner, 'read', 'tag'), {});
      await assert.rejects(authorize(owner, 'edit', 'tag'), noPermission);
    });

    it('has no row rules yet', function () {
      assert.deepEqual(Object.keys(rowRules), []);
    });
  });
});
