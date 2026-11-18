import type { AppScopeName } from '../scopes.ts';
import type { FetchMethod } from './rules.ts';

/**
 * The Admin API routes apps can reach through the fetch escape hatch. Everything else is
 * refused.
 *
 * Apps call the Admin API with the staff user's own session. This list stands in for an
 * app-scoped token with permissions, which checks on the server what was approved. Its routes
 * are grouped under the scope registry's names, and `checkAdminApiRequest` refuses a route whose
 * scope the installation wasn't approved for, as Admin holds the approved manifest while the app
 * runs. It is still a stopgap: the server checks nothing an app does through the bridge.
 *
 * What's allowed, and why:
 *
 * - Posts, pages and tags: list, read, create, edit and delete one at a time. Apps exist to
 *   work with the publisher's content. Bulk edits, bulk deletes, exports, copies, uploads and
 *   gift links are left out.
 * - Staff users, tiers and newsletters: list only, for showing an author, an access level or a
 *   newsletter. Members, settings, integrations and everything that hands out lasting access
 *   are left out.
 * - The search index of posts, pages and tags, and slug generation, which Admin's own editor
 *   uses to pick a slug before saving.
 * - The site's public details: its title, description, logo, icon, cover image and accent
 *   colour, for showing the site's branding. They need no scope.
 * - How a post performed, through the includes and sort fields that reach it, only with
 *   `post:read_stats`.
 *
 * Writes of posts, pages and tags are checked further, so an app can't ask Ghost to email a post,
 * set code injection or write mobiledoc: a write may carry only the query parameters its group
 * lists, which leaves out `newsletter`, `email_segment` and `source`, and `refusedContent`
 * checks its body.
 * These checks are a stopgap for the private beta behind a flag. The security review re-reviews
 * them before anyone outside the team gets access (BER-3992), and Permissions and auth replaces
 * them with checks on the server.
 *
 * What the security review before opening apps to outside developers (BER-3992) must look at
 * in this set:
 *
 * - Publishing and unpublishing: a write can change a post's status, schedule it, or change who
 *   can read it (`visibility`, `tiers`), with no confirmation from the publisher. Publishing a
 *   scheduled post that already has a newsletter sends its email then, with no parameter.
 * - Staff emails: `GET /users/` returns every staff user's email.
 * - Content: a write can put HTML and script in a post or page, in a Lexical card or a caption
 *   for one, which Ghost serves on the site's own origin, and on Admin's where the two share
 *   one. It can also put HTML in `feature_image_caption`, which emails show as it is, so it
 *   reaches members when the post is sent as a newsletter. Only code injection and a mobiledoc
 *   that isn't `null` are refused.
 *
 * Routes are written as `METHOD /path`, in path segments. `:id` matches only an object ID: 24
 * lowercase hexadecimal characters. Any other `:name` matches any one segment, such as a slug.
 * A route matches with or without a trailing `/`, and its fixed segments in any case, as Ghost's
 * router reads them. A fixed segment must be written out, not escaped: Ghost's router matches
 * the path as it arrives, so `/posts/sl%75g/…` doesn't reach the slug route.
 */

export interface AdminApiRouteGroup {
  /**
   * The registry scope these routes stand for, such as `post:edit`, or `null` for routes any app
   * may call.
   */
  readonly scope: AppScopeName | null;
  /** Each route as `METHOD /path`, relative to the Admin API root. */
  readonly routes: readonly string[];
  /**
   * The only query parameters a request in this group may carry, by exact name. Any other name
   * is refused, so a spelling Ghost's query parser reads differently, such as `[newsletter]`,
   * can't slip a parameter past the check. A group without this list allows any parameter.
   */
  readonly allowedParameters?: readonly string[];
  /**
   * The relations `include` may name and the fields `order` sorts by that need a scope of their
   * own, mapped to that scope, or to `null` when the group's own scope is enough. A key ending
   * in `.*` covers every name under it. With this map, an `include` it doesn't name is refused,
   * and an `order` field it doesn't name needs nothing more. Reading a post can include how it
   * performed, which only `post:read_stats` gives.
   */
  readonly fieldScopes?: Readonly<Record<string, AppScopeName | null>>;
  /** Whether a write in this group sends content, whose body `refusedContent` checks. */
  readonly checksContent?: true;
}

// What Ghost reads on a post or page write, minus `newsletter` and `email_segment`, which send
// the post as email, `source=html`, which turns HTML into the post's content as it is, and the
// rest of what only Admin's editor needs.
const POST_WRITE_PARAMETERS = ['include', 'formats', 'save_revision'] as const;

// What Ghost's post and page routes read, minus `debug` and `collection`.
const POST_BROWSE_PARAMETERS = [
  'include',
  'filter',
  'fields',
  'formats',
  'limit',
  'order',
  'page',
  'absolute_urls',
] as const;
const POST_READ_PARAMETERS = ['include', 'fields', 'formats', 'absolute_urls'] as const;

// What a post or page can include or be sorted by. How it performed by email, in signups and
// conversions, and in feedback is `post:read_stats`'s.
const POST_FIELDS = {
  tags: null,
  authors: null,
  'authors.roles': null,
  tiers: null,
  newsletter: null,
  post_revisions: null,
  'post_revisions.author': null,
  email: 'post:read_stats',
  'email.*': 'post:read_stats',
  'count.*': 'post:read_stats',
  sentiment: 'post:read_stats',
} as const satisfies Record<string, AppScopeName | null>;

export const ADMIN_API_ALLOWLIST: readonly AdminApiRouteGroup[] = [
  {
    scope: 'post:browse',
    routes: ['GET /posts', 'GET /pages', 'GET /search-index/posts', 'GET /search-index/pages'],
    allowedParameters: POST_BROWSE_PARAMETERS,
    fieldScopes: POST_FIELDS,
  },
  {
    scope: 'post:read',
    routes: ['GET /posts/:id', 'GET /posts/slug/:slug', 'GET /pages/:id', 'GET /pages/slug/:slug'],
    allowedParameters: POST_READ_PARAMETERS,
    fieldScopes: POST_FIELDS,
  },
  {
    scope: 'post:add',
    routes: ['POST /posts', 'POST /pages'],
    allowedParameters: POST_WRITE_PARAMETERS,
    fieldScopes: POST_FIELDS,
    checksContent: true,
  },
  {
    scope: 'post:edit',
    routes: ['PUT /posts/:id', 'PUT /pages/:id'],
    allowedParameters: POST_WRITE_PARAMETERS,
    fieldScopes: POST_FIELDS,
    checksContent: true,
  },
  {
    scope: 'post:destroy',
    routes: ['DELETE /posts/:id', 'DELETE /pages/:id'],
    allowedParameters: POST_WRITE_PARAMETERS,
    fieldScopes: POST_FIELDS,
    checksContent: true,
  },
  { scope: 'tag:browse', routes: ['GET /tags', 'GET /search-index/tags'] },
  { scope: 'tag:read', routes: ['GET /tags/:id', 'GET /tags/slug/:slug'] },
  {
    scope: 'tag:add',
    routes: ['POST /tags'],
    allowedParameters: ['include'],
    checksContent: true,
  },
  {
    scope: 'tag:edit',
    routes: ['PUT /tags/:id'],
    allowedParameters: ['include'],
    checksContent: true,
  },
  {
    scope: 'tag:destroy',
    routes: ['DELETE /tags/:id'],
    allowedParameters: ['include'],
    checksContent: true,
  },
  { scope: 'user:browse', routes: ['GET /users'] },
  { scope: 'tier:browse', routes: ['GET /tiers'] },
  { scope: 'newsletter:browse', routes: ['GET /newsletters'] },
  {
    scope: 'slug:generate',
    routes: ['GET /slugs/:type/:name', 'GET /slugs/:type/:name/:id'],
  },
  // The site's public details, for showing its branding. Ghost serves them without signing in,
  // so they need no scope.
  { scope: null, routes: ['GET /site'] },
];

const OBJECT_ID = /^[0-9a-f]{24}$/;

type Segment =
  | { readonly kind: 'fixed'; readonly value: string }
  | { readonly kind: 'id' }
  | { readonly kind: 'any' };

interface Route {
  readonly method: string;
  readonly segments: readonly Segment[];
  readonly route: string;
  readonly group: AdminApiRouteGroup;
}

const ROUTES: readonly Route[] = ADMIN_API_ALLOWLIST.flatMap((group) =>
  group.routes.map((route) => {
    const [method = '', path = ''] = route.split(' ');
    return {
      method,
      route,
      group,
      segments: path
        .split('/')
        .filter(Boolean)
        .map((segment): Segment => {
          if (segment === ':id') {
            return { kind: 'id' };
          }
          return segment.startsWith(':') ? { kind: 'any' } : { kind: 'fixed', value: segment };
        }),
    };
  }),
);

const OPAQUE_SEGMENT = /^\.{1,2}$/;

// Matches the path's segments as they arrive. A parameter is decoded before it's checked, as
// Ghost's router decodes it, and mustn't decode to `.`, `..` or a separator; a fixed segment
// isn't decoded, as the router matches it escaped.
function matches(route: Route, segments: readonly string[]): boolean {
  return (
    route.segments.length === segments.length &&
    route.segments.every((part, index) => {
      const segment = segments[index] as string;
      if (part.kind === 'fixed') {
        return part.value === segment.toLowerCase();
      }
      if (part.kind === 'id') {
        return OBJECT_ID.test(segment);
      }
      try {
        const decoded = decodeURIComponent(segment);
        return !OPAQUE_SEGMENT.test(decoded) && !/[/\\]/.test(decoded);
      } catch {
        return false;
      }
    })
  );
}

/**
 * The scope a field in `fieldScopes` needs: `null` when the group's own is enough, and
 * `undefined` when the map doesn't name it.
 */
export function scopeForField(
  fieldScopes: Readonly<Record<string, AppScopeName | null>>,
  field: string,
): AppScopeName | null | undefined {
  const name = field.toLowerCase();
  for (const [key, scope] of Object.entries(fieldScopes)) {
    if (key.endsWith('.*') ? name.startsWith(key.slice(0, -1)) : name === key) {
      return scope;
    }
  }
  return undefined;
}

/** The route an allowed request matched, and the group it belongs to. */
export interface AllowedAdminApiRoute {
  /** The route as the allowlist writes it, such as `PUT /posts/:id`. */
  readonly route: string;
  readonly group: AdminApiRouteGroup;
}

/**
 * Finds the allowlist route a request to an Admin API path with this method matches, or
 * returns `undefined` when apps can't make it. Takes a pathname relative to the Admin API root,
 * such as `/posts/`, without the query.
 *
 * A path matches nothing if it has an empty segment, other than the trailing `/`, or a segment
 * that is `.` or `..`, written out or escaped, because where such a path leads depends on which
 * parser reads it.
 */
export function findAllowedAdminApiRoute(
  pathname: string,
  method: FetchMethod,
): AllowedAdminApiRoute | undefined {
  if (!pathname.startsWith('/')) {
    return undefined;
  }
  const segments = pathname.slice(1).replace(/\/$/, '').split('/');
  if (segments.some((segment) => segment === '' || OPAQUE_SEGMENT.test(segment))) {
    return undefined;
  }
  const route = ROUTES.find((each) => each.method === method && matches(each, segments));
  return route && { route: route.route, group: route.group };
}
