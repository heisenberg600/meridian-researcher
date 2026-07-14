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
import type * as brandProfiles from "../brandProfiles.js";
import type * as callRecords from "../callRecords.js";
import type * as chatSessions from "../chatSessions.js";
import type * as companyMemory from "../companyMemory.js";
import type * as credits from "../credits.js";
import type * as http from "../http.js";
import type * as interviewBriefs from "../interviewBriefs.js";
import type * as interviews from "../interviews.js";
import type * as knowledge from "../knowledge.js";
import type * as knowledgeActions from "../knowledgeActions.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_billing from "../lib/billing.js";
import type * as lib_interviewAccess from "../lib/interviewAccess.js";
import type * as lib_outreach from "../lib/outreach.js";
import type * as lib_workflow from "../lib/workflow.js";
import type * as meridian from "../meridian.js";
import type * as meridianData from "../meridianData.js";
import type * as messages from "../messages.js";
import type * as organizationMemories from "../organizationMemories.js";
import type * as outreachBatches from "../outreachBatches.js";
import type * as participantImports from "../participantImports.js";
import type * as participantInvites from "../participantInvites.js";
import type * as paymentActions from "../paymentActions.js";
import type * as paymentWebhookActions from "../paymentWebhookActions.js";
import type * as paymentWebhookHttp from "../paymentWebhookHttp.js";
import type * as paymentWebhooks from "../paymentWebhooks.js";
import type * as payments from "../payments.js";
import type * as sandboxE2E from "../sandboxE2E.js";
import type * as studies from "../studies.js";
import type * as studyMemory from "../studyMemory.js";
import type * as studyParticipants from "../studyParticipants.js";
import type * as studyPlans from "../studyPlans.js";
import type * as users from "../users.js";
import type * as waitlist from "../waitlist.js";

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
  brandProfiles: typeof brandProfiles;
  callRecords: typeof callRecords;
  chatSessions: typeof chatSessions;
  companyMemory: typeof companyMemory;
  credits: typeof credits;
  http: typeof http;
  interviewBriefs: typeof interviewBriefs;
  interviews: typeof interviews;
  knowledge: typeof knowledge;
  knowledgeActions: typeof knowledgeActions;
  "lib/auth": typeof lib_auth;
  "lib/billing": typeof lib_billing;
  "lib/interviewAccess": typeof lib_interviewAccess;
  "lib/outreach": typeof lib_outreach;
  "lib/workflow": typeof lib_workflow;
  meridian: typeof meridian;
  meridianData: typeof meridianData;
  messages: typeof messages;
  organizationMemories: typeof organizationMemories;
  outreachBatches: typeof outreachBatches;
  participantImports: typeof participantImports;
  participantInvites: typeof participantInvites;
  paymentActions: typeof paymentActions;
  paymentWebhookActions: typeof paymentWebhookActions;
  paymentWebhookHttp: typeof paymentWebhookHttp;
  paymentWebhooks: typeof paymentWebhooks;
  payments: typeof payments;
  sandboxE2E: typeof sandboxE2E;
  studies: typeof studies;
  studyMemory: typeof studyMemory;
  studyParticipants: typeof studyParticipants;
  studyPlans: typeof studyPlans;
  users: typeof users;
  waitlist: typeof waitlist;
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
