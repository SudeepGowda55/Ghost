import { describe, expect, it } from 'vitest';
import { describeAccessChanges } from './access-changes';

describe('describeAccessChanges', () => {
  it('groups changes by kind, one line per resource in the registry’s words', () => {
    expect(
      describeAccessChanges([
        { scope: 'tag:edit', change: 'added', backend: false },
        { scope: 'post:read', change: 'added', backend: true },
        { scope: 'post:browse', change: 'backend_added', backend: true },
        { scope: 'tier:browse', change: 'removed', backend: false },
        { scope: 'post:edit', change: 'backend_removed', backend: false },
      ]).map(({ kind, heading, lines }) => [
        kind,
        heading,
        lines.map(({ title, actions }) => `${title}: ${actions.join(' ')}`),
      ]),
    ).toEqual([
      ['added', 'New access', ['Posts and pages: Read any post or page.', 'Tags: Edit tags.']],
      [
        'backend_added',
        'New for its backend, at any time',
        ['Posts and pages: List and search posts and pages. Read any post or page.'],
      ],
      ['removed', 'No longer has', ['Tiers: List your tiers and their prices.']],
      [
        'backend_removed',
        'No longer for its backend',
        [
          'Posts and pages: Edit, publish and email posts and pages, change who can read them and create tags for them.',
        ],
      ],
    ]);
  });

  it('is empty when access didn’t change', () => {
    expect(describeAccessChanges([])).toEqual([]);
  });
});
