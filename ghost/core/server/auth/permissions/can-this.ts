import _ from 'lodash';
import providers, { type LoadedPermissions } from './providers';
import { actionsMap } from './role-permissions';
import { authorize, noPermission } from '../policy/authorize';
import { capabilities, capabilityKey, type PolicyPrincipal } from '../policy/capabilities';
import { scopesAllow } from '../policy/scopes';
import parseContext, { type ParsedContext } from './parse-context';

const models = require('../../models');

/** User and API key permissions, each null when that actor is absent */
export interface LoadedActors {
  user: LoadedPermissions | null;
  apiKey: Awaited<ReturnType<typeof providers.apiKey>> | null;
}

/** canThis(context).edit.post(idOrModel, unsafeAttrs) */
type ObjectTypeHandler = (
  modelOrId?: string | number | { id: string } | null,
  unsafeAttrs?: Record<string, unknown>,
) => Promise<unknown>;

export type CanThisResult = Record<string, Record<string, ObjectTypeHandler>>;

/** The principal policy decides for, from the actors canThis loaded. */
export function toPolicyPrincipal(context: ParsedContext, loaded: LoadedActors): PolicyPrincipal {
  const principal = context.principal;
  const scopes = principal && 'scopes' in principal ? principal.scopes : undefined;

  // A staff token acts as its user; the key's own role is ignored
  if (loaded.user) {
    const roles = loaded.user.roles.map((role) => role.name);
    if (principal?.kind === 'app') {
      return { kind: 'app', roles, scopes: principal.scopes };
    }
    return { kind: 'user', roles, scopes };
  }

  if (loaded.apiKey) {
    const roles = loaded.apiKey.roles.flatMap((role) => (role?.name ? [role.name] : []));
    return { kind: 'integration', roles, scopes };
  }

  return { kind: 'anonymous' };
}

/** The grant flags the model `permissible` hooks still take; they read them by truthiness. */
export function getGrantFlags(principal: PolicyPrincipal, actType: string, objType: string) {
  const granted = capabilities(principal).granted.has(capabilityKey(objType, actType));

  // An integration key's grant is the key's flag; every other principal's is the user's
  if (principal.kind === 'integration') {
    return { hasUserPermission: true, hasApiKeyPermission: granted };
  }
  return { hasUserPermission: granted, hasApiKeyPermission: true };
}

/** What every check in one canThis chain shares. */
interface PolicyLoad {
  loaded: LoadedActors;
  principal: PolicyPrincipal;
}

function isAppWithoutUser(context: ParsedContext) {
  return context.principal?.kind === 'app' && !context.user;
}

class CanThisResultBuilder {
  buildObjectTypeHandlers(
    objTypes: readonly string[],
    actType: string,
    context: ParsedContext,
    policyLoad: Promise<PolicyLoad>,
  ) {
    const objectTypeModelMap: Record<string, { permissible?: (...args: unknown[]) => unknown }> = {
      post: models.Post,
      role: models.Role,
      user: models.User,
      setting: models.Settings,
      invite: models.Invite,
      integration: models.Integration,
      comment: models.Comment,
    };

    // Iterate through the object types, i.e. ['post', 'tag', 'user']
    return _.reduce(
      objTypes,
      function (objTypeHandlers: Record<string, ObjectTypeHandler>, objType) {
        // Grab the TargetModel through the objectTypeModelMap
        const TargetModel = objectTypeModelMap[objType];

        // Create the 'handler' for the object type;
        // the '.post()' in canThis(user).edit.post()
        objTypeHandlers[objType] = function (modelOrId, unsafeAttrs) {
          let modelId: string | number | undefined;
          unsafeAttrs = unsafeAttrs || {};

          // If it's an internal request, resolve immediately
          if (context.internal) {
            return Promise.resolve();
          }

          // Until PLA-639, an app needs a user to act for, whatever its scopes
          if (isAppWithoutUser(context)) {
            return Promise.reject(noPermission());
          }

          if (_.isNumber(modelOrId) || _.isString(modelOrId)) {
            // It's an id already, do nothing
            modelId = modelOrId;
          } else if (modelOrId) {
            // It's a model, get the id
            modelId = modelOrId.id;
          }
          // Wait for the user loading to finish
          return policyLoad.then(function ({ loaded: loadedPermissions, principal }) {
            // Scopes cap the hooks as they will cap row rules; unscoped principals pass
            const { scopes } = capabilities(principal);
            if (!scopesAllow(scopes, capabilityKey(objType, actType))) {
              return Promise.reject(noPermission());
            }

            // Offer a chance for the TargetModel to override the results
            if (TargetModel && _.isFunction(TargetModel.permissible)) {
              const { hasUserPermission, hasApiKeyPermission } = getGrantFlags(
                principal,
                actType,
                objType,
              );

              // Ensure permission decisions are based on the user's role if present, not their staff-token.
              const permissionsForModel = loadedPermissions.user
                ? { ...loadedPermissions, apiKey: null }
                : loadedPermissions;

              return TargetModel.permissible(
                modelId,
                actType,
                context,
                unsafeAttrs,
                permissionsForModel,
                hasUserPermission,
                hasApiKeyPermission,
              );
            }

            return authorize(principal, actType, objType, {
              resource: modelId,
              attrs: unsafeAttrs,
            }).then(() => undefined);
          });
        };

        return objTypeHandlers;
      },
      {},
    );
  }

  beginCheck(rawContext: unknown): CanThisResult {
    let userPermissionLoad: Promise<LoadedPermissions | null>;
    let apiKeyPermissionLoad: Promise<LoadedActors['apiKey']>;

    // Get context.user, context.api_key and context.app
    const context = parseContext(rawContext);

    // Kick off loading of user permissions if necessary
    if (context.user) {
      userPermissionLoad = providers.user(context.user);
    } else {
      // Resolve null if no context.user to prevent db call
      userPermissionLoad = Promise.resolve(null);
    }

    // Kick off loading of api key permissions if necessary. An app never acts as
    // a key, and a staff token's principal already says the key acts as its user.
    const principalKind = context.principal?.kind;
    if (context.api_key && principalKind !== 'app' && !(context.user && principalKind === 'user')) {
      apiKeyPermissionLoad = providers.apiKey(context.api_key.id);
    } else {
      // Resolve null if no context.api_key
      apiKeyPermissionLoad = Promise.resolve(null);
    }

    // Wait for both user and api key permissions to load
    const permissionsLoad = Promise.all([userPermissionLoad, apiKeyPermissionLoad]).then(
      function (result): LoadedActors {
        return {
          user: result[0],
          apiKey: result[1],
        };
      },
    );

    // One policy principal per chain, so capabilities are computed once for it
    const policyLoad = permissionsLoad.then((loaded) => ({
      loaded,
      principal: toPolicyPrincipal(context, loaded),
    }));

    // Iterate through the actions and their related object types
    _.each(actionsMap, (objTypes, actType) => {
      // Build up the object type handlers;
      // the '.post()' parts in canThis(user).edit.post()
      const objTypeHandlers = this.buildObjectTypeHandlers(objTypes, actType, context, policyLoad);

      // Define a property for the action on the result;
      // the '.edit' in canThis(user).edit.post()
      Object.defineProperty(this, actType, {
        writable: false,
        enumerable: false,
        configurable: false,
        value: objTypeHandlers,
      });
    });

    // Return this for chaining
    return this as unknown as CanThisResult;
  }
}

export default function canThis(context: unknown): CanThisResult {
  const result = new CanThisResultBuilder();

  return result.beginCheck(context);
}
