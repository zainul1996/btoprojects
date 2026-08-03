/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as alerts from "../alerts.js";
import type * as alertsEngine from "../alertsEngine.js";
import type * as crons from "../crons.js";
import type * as datagov from "../datagov.js";
import type * as exercises from "../exercises.js";
import type * as ingest_hdb from "../ingest/hdb.js";
import type * as ingest_lib from "../ingest/lib.js";
import type * as ingest_onemap from "../ingest/onemap.js";
import type * as ingest_resale from "../ingest/resale.js";
import type * as ingest_types from "../ingest/types.js";
import type * as ingestion from "../ingestion.js";
import type * as kvStore from "../kvStore.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_geo from "../lib/geo.js";
import type * as lib_plannerShared from "../lib/plannerShared.js";
import type * as lib_ranking from "../lib/ranking.js";
import type * as lib_validators from "../lib/validators.js";
import type * as mrt from "../mrt.js";
import type * as notifications from "../notifications.js";
import type * as onemap from "../onemap.js";
import type * as planner from "../planner.js";
import type * as plannerActions from "../plannerActions.js";
import type * as profile from "../profile.js";
import type * as projects from "../projects.js";
import type * as seed from "../seed.js";
import type * as seedData from "../seedData.js";
import type * as seedOct2026 from "../seedOct2026.js";
import type * as telegram from "../telegram.js";
import type * as towns from "../towns.js";
import type * as users from "../users.js";
import type * as watchlists from "../watchlists.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  alerts: typeof alerts;
  alertsEngine: typeof alertsEngine;
  crons: typeof crons;
  datagov: typeof datagov;
  exercises: typeof exercises;
  "ingest/hdb": typeof ingest_hdb;
  "ingest/lib": typeof ingest_lib;
  "ingest/onemap": typeof ingest_onemap;
  "ingest/resale": typeof ingest_resale;
  "ingest/types": typeof ingest_types;
  ingestion: typeof ingestion;
  kvStore: typeof kvStore;
  "lib/auth": typeof lib_auth;
  "lib/geo": typeof lib_geo;
  "lib/plannerShared": typeof lib_plannerShared;
  "lib/ranking": typeof lib_ranking;
  "lib/validators": typeof lib_validators;
  mrt: typeof mrt;
  notifications: typeof notifications;
  onemap: typeof onemap;
  planner: typeof planner;
  plannerActions: typeof plannerActions;
  profile: typeof profile;
  projects: typeof projects;
  seed: typeof seed;
  seedData: typeof seedData;
  seedOct2026: typeof seedOct2026;
  telegram: typeof telegram;
  towns: typeof towns;
  users: typeof users;
  watchlists: typeof watchlists;
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
