/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activity from "../activity.js";
import type * as agentRuns from "../agentRuns.js";
import type * as agentSkills from "../agentSkills.js";
import type * as agentToolEvents from "../agentToolEvents.js";
import type * as chatSessions from "../chatSessions.js";
import type * as interviews from "../interviews.js";
import type * as meridian from "../meridian.js";
import type * as meridianData from "../meridianData.js";
import type * as messages from "../messages.js";
import type * as organizationMemories from "../organizationMemories.js";
import type * as sandboxE2E from "../sandboxE2E.js";
import type * as studies from "../studies.js";
import type * as studyParticipants from "../studyParticipants.js";
import type * as studyPlans from "../studyPlans.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activity: typeof activity;
  agentRuns: typeof agentRuns;
  agentSkills: typeof agentSkills;
  agentToolEvents: typeof agentToolEvents;
  chatSessions: typeof chatSessions;
  interviews: typeof interviews;
  meridian: typeof meridian;
  meridianData: typeof meridianData;
  messages: typeof messages;
  organizationMemories: typeof organizationMemories;
  sandboxE2E: typeof sandboxE2E;
  studies: typeof studies;
  studyParticipants: typeof studyParticipants;
  studyPlans: typeof studyPlans;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
