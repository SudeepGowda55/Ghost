import assert from 'node:assert/strict';

import { describe, it } from 'vitest';

import {
  changeRequiresApproval,
  compareManifests,
  type ManifestChange,
} from '../../src/manifest/index.ts';
import { manifest, manifestOf, options } from './helpers.ts';

const approved = manifestOf(manifest());

function compareWith(overrides: Record<string, unknown>, parseOptions = options) {
  const { changes, requiresApproval } = compareManifests(
    approved,
    manifestOf(manifest(overrides), parseOptions),
  );
  return { changes, requiresApproval };
}

const OTHER_KEY = { kty: 'OKP', crv: 'Ed25519', x: 'Z_QKSqF5_5W5r2LfGwj1UyVOFyFew44-bMShKMwpCfo' };

describe('compareManifests', function () {
  it('finds nothing to approve when nothing changed', function () {
    assert.deepEqual(compareWith({}), { changes: [], requiresApproval: false });
  });

  it('lets the description and accent colour change silently', function () {
    assert.deepEqual(compareWith({ description: 'New words.', accent_color: '#000000' }), {
      changes: [
        { path: 'accent_color', requiresApproval: false },
        { path: 'description', requiresApproval: false },
      ],
      requiresApproval: false,
    });
  });

  it('lets a built-in icon change silently', function () {
    const before = manifestOf(manifest({ icon: { name: 'mic' } }));
    const after = manifestOf(manifest({ icon: { name: 'radio' } }));

    assert.equal(compareManifests(before, after).requiresApproval, false);
  });

  // The identity key vouches for it, so a leaked one can be replaced without a review.
  it('lets the backend key change silently', function () {
    assert.deepEqual(compareWith({ backend_key: OTHER_KEY }), {
      changes: [{ path: 'backend_key.x', requiresApproval: false }],
      requiresApproval: false,
    });
  });

  it('needs approval for a new identity key', function () {
    assert.deepEqual(compareWith({ identity_key: OTHER_KEY }).changes, [
      { path: 'identity_key.x', requiresApproval: true },
    ]);
  });

  it('needs approval to become, or stop being, a development build', function () {
    assert.deepEqual(compareWith({ development: true }), {
      changes: [{ path: 'development', requiresApproval: true }],
      requiresApproval: true,
    });
  });

  it('needs approval for a new name or author', function () {
    assert.deepEqual(compareWith({ name: 'Podcasts' }).changes, [
      { path: 'name', requiresApproval: true },
    ]);
    assert.equal(
      compareWith({ author: { name: 'Example Audio', url: 'https://example.com/team' } })
        .requiresApproval,
      true,
    );
  });

  it('needs approval for any change to a URL, even its path', function () {
    assert.deepEqual(
      compareWith({
        surfaces: [{ type: 'admin_page', url: '/dashboard' }],
      }),
      {
        changes: [{ path: 'surfaces[0].url', requiresApproval: true }],
        requiresApproval: true,
      },
    );
    assert.equal(compareWith({ icon: { url: '/icon-2.svg' } }).requiresApproval, true);
  });

  it('needs approval for a move even when nothing else in the manifest changes', function () {
    const manifestUrl = 'https://new.example.com/app.json';
    // Every path resolves against the manifest's address, so they all move with it.
    assert.deepEqual(compareWith({ manifest_url: manifestUrl }, { ...options, manifestUrl }), {
      changes: [
        { path: 'icon.url', requiresApproval: true },
        { path: 'manifest_url', requiresApproval: true },
        { path: 'surfaces[0].url', requiresApproval: true },
      ],
      requiresApproval: true,
    });
  });

  it('needs approval when a surface is added or removed', function () {
    // Every v0 manifest has exactly one surface, so build the other side by hand.
    const withoutSurfaces = { ...approved, surfaces: [] };

    assert.equal(compareManifests(withoutSurfaces, approved).requiresApproval, true);
    assert.equal(compareManifests(approved, withoutSurfaces).requiresApproval, true);
  });

  it('counts an empty list appearing as a change', function () {
    // A field added later starts out empty more often than not.
    const withCards = { ...approved, cards: [] } as unknown as typeof approved;

    assert.deepEqual(compareManifests(approved, withCards).changes, [
      { path: 'cards', requiresApproval: true },
    ]);
  });

  it('needs approval when a built-in icon is swapped for one the app serves', function () {
    const before = manifestOf(manifest({ icon: { name: 'mic' } }));

    assert.deepEqual(compareManifests(before, approved).changes, [
      { path: 'icon.name', requiresApproval: false },
      { path: 'icon.url', requiresApproval: true },
    ]);
  });
});

describe('compareManifests, for access', function () {
  const POSTS = {
    post: {
      scopes: [{ name: 'post:browse' }, { name: 'post:read', backend: true }],
    },
  };
  const before = manifestOf(manifest({ access: POSTS }));
  const withAccess = (access: unknown) =>
    compareManifests(before, manifestOf(manifest({ access })));

  it('needs approval for a new scope, under a resource already declared or a new one', function () {
    assert.deepEqual(
      withAccess({
        post: { scopes: [...POSTS.post.scopes, { name: 'post:edit' }] },
        tag: { scopes: [{ name: 'tag:browse' }] },
      }),
      {
        changes: [
          { scope: 'post:edit', change: 'added', backend: false },
          { scope: 'tag:browse', change: 'added', backend: false },
        ],
        requiresApproval: true,
      },
    );
  });

  it('needs approval for a scope newly marked for the backend', function () {
    assert.deepEqual(
      withAccess({
        post: {
          scopes: [
            { name: 'post:browse', backend: true },
            { name: 'post:read', backend: true },
          ],
        },
      }),
      {
        changes: [{ scope: 'post:browse', change: 'backend_added', backend: true }],
        requiresApproval: true,
      },
    );
  });

  it('narrows access at once when a scope or resource goes, or backend is turned off', function () {
    assert.deepEqual(withAccess({ post: { scopes: [{ name: 'post:browse' }] } }), {
      changes: [{ scope: 'post:read', change: 'removed', backend: true }],
      requiresApproval: false,
    });
    assert.equal(withAccess({}).requiresApproval, false);
    assert.deepEqual(
      withAccess({
        post: { scopes: [{ name: 'post:browse' }, { name: 'post:read' }] },
      }),
      {
        changes: [{ scope: 'post:read', change: 'backend_removed', backend: false }],
        requiresApproval: false,
      },
    );
  });

  it('finds no change when only the order differs', function () {
    assert.deepEqual(
      withAccess({
        post: {
          scopes: [{ name: 'post:read', backend: true }, { name: 'post:browse' }],
        },
      }),
      { changes: [], requiresApproval: false },
    );
    const two = manifestOf(
      manifest({
        access: { ...POSTS, slug: { scopes: [{ name: 'slug:generate' }] } },
      }),
    );
    const swapped = manifestOf(
      manifest({
        access: { slug: { scopes: [{ name: 'slug:generate' }] }, ...POSTS },
      }),
    );
    assert.deepEqual(compareManifests(two, swapped).changes, []);
  });

  it('lists field changes by path, then access changes in the registry’s order', function () {
    assert.deepEqual(
      compareManifests(
        before,
        manifestOf(manifest({ access: {}, name: 'Podcasts', accent_color: '#000000' })),
      ).changes,
      [
        { path: 'accent_color', requiresApproval: false },
        { path: 'name', requiresApproval: true },
        { scope: 'post:browse', change: 'removed', backend: false },
        { scope: 'post:read', change: 'removed', backend: true },
      ],
    );
  });
});

describe('changeRequiresApproval', function () {
  it('takes a field’s own rule, and needs approval for access only when it widens', function () {
    assert.deepEqual(
      [
        { path: 'name', requiresApproval: true },
        { path: 'description', requiresApproval: false },
        { scope: 'post:read', change: 'added', backend: false },
        { scope: 'post:read', change: 'backend_added', backend: true },
        { scope: 'post:read', change: 'removed', backend: false },
        { scope: 'post:read', change: 'backend_removed', backend: false },
      ].map((change) => changeRequiresApproval(change as ManifestChange)),
      [true, false, true, true, false, false],
    );
  });
});
