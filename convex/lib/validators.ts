import { v } from "convex/values";
import {
  amenityCategoryValidator,
  amenityGeometryAccuracyValidator,
  amenityGeometryRoleValidator,
  amenityStatusValidator,
  btoFlatTypeValidator,
  classificationValidator,
  confidenceValidator,
  exerciseStatusValidator,
  exerciseTypeValidator,
  extractionMethodValidator,
  lifecycleStatusValidator,
  sourceKindValidator,
} from "../schema";

/**
 * Shared return-type validators. Public Convex functions must declare
 * `returns` validators; defining the doc shapes once here keeps them
 * consistent across query files.
 */

export const townValidator = v.object({
  _id: v.id("towns"),
  _creationTime: v.number(),
  name: v.string(),
  region: v.string(),
  lat: v.number(),
  lng: v.number(),
});

export const exerciseValidator = v.object({
  _id: v.id("exercises"),
  _creationTime: v.number(),
  key: v.string(),
  label: v.string(),
  type: exerciseTypeValidator,
  status: exerciseStatusValidator,
  applicationEnd: v.optional(v.string()),
  isEstimate: v.optional(v.boolean()),
});

export const projectValidator = v.object({
  _id: v.id("projects"),
  _creationTime: v.number(),
  slug: v.string(),
  name: v.string(),
  townId: v.id("towns"),
  exerciseId: v.id("exercises"),
  region: v.string(),
  classification: classificationValidator,
  lifecycleStatus: lifecycleStatusValidator,
  saleType: v.optional(exerciseTypeValidator),
  lat: v.number(),
  lng: v.number(),
  description: v.string(),
  totalUnits: v.number(),
  estimatedWaitMonths: v.number(),
  estimatedCompletion: v.string(),
  nearestMrt: v.array(v.string()),
  mrtWalkingMinutes: v.number(),
  applicationDeadline: v.optional(v.string()),
  notes: v.optional(v.string()),
  updatedAt: v.number(),
});

export const flatTypeValidator = v.object({
  _id: v.id("flatTypes"),
  _creationTime: v.number(),
  projectId: v.id("projects"),
  type: btoFlatTypeValidator,
  units: v.number(),
  minPrice: v.number(),
  maxPrice: v.number(),
});

export const sourceValidator = v.object({
  _id: v.id("sources"),
  _creationTime: v.number(),
  url: v.string(),
  publisher: v.string(),
  kind: sourceKindValidator,
  title: v.optional(v.string()),
  retrievedAt: v.number(),
  contentHash: v.optional(v.string()),
  snapshotRef: v.optional(v.string()),
});

export const projectFactValidator = v.object({
  _id: v.id("projectFacts"),
  _creationTime: v.number(),
  projectId: v.id("projects"),
  field: v.string(),
  value: v.string(),
  confidence: confidenceValidator,
  extractionMethod: extractionMethodValidator,
  sourceId: v.optional(v.id("sources")),
  retrievedAt: v.number(),
  effectiveDate: v.optional(v.string()),
  note: v.optional(v.string()),
});

export const projectSummaryValidator = v.object({
  project: projectValidator,
  town: v.union(townValidator, v.null()),
  flatTypes: v.array(flatTypeValidator),
  // Exercise label ("February 2026 SBF") for card-level provenance chips.
  exerciseLabel: v.union(v.string(), v.null()),
  exerciseStatus: v.union(exerciseStatusValidator, v.null()),
  exerciseApplicationEnd: v.union(v.string(), v.null()),
});

export const projectDetailsValidator = v.object({
  project: projectValidator,
  town: v.union(townValidator, v.null()),
  exercise: v.union(exerciseValidator, v.null()),
  flatTypes: v.array(flatTypeValidator),
  // Facts grouped by field name, latest-first retrieval order not guaranteed.
  facts: v.record(v.string(), v.array(projectFactValidator)),
  sources: v.array(sourceValidator),
});

export const resaleTransactionValidator = v.object({
  _id: v.id("resaleTransactions"),
  _creationTime: v.number(),
  town: v.string(),
  flatType: v.string(),
  block: v.string(),
  streetName: v.string(),
  storeyRange: v.string(),
  floorAreaSqm: v.number(),
  flatModel: v.string(),
  leaseCommenceDate: v.number(),
  resalePrice: v.number(),
  month: v.string(),
});

export const comparablesValidator = v.object({
  transactions: v.array(resaleTransactionValidator),
  median: v.union(v.number(), v.null()),
  count: v.number(),
  // Recency window stats (months within `asOfMonth` - 6, inclusive).
  recentMedian: v.union(v.number(), v.null()),
  recentCount: v.number(),
});

export const mrtStationValidator = v.object({
  _id: v.id("mrtStations"),
  _creationTime: v.number(),
  name: v.string(),
  code: v.string(),
  line: v.string(),
  lat: v.number(),
  lng: v.number(),
});

export const amenityValidator = v.object({
  _id: v.id("amenities"),
  _creationTime: v.number(),
  sourceKey: v.string(),
  externalId: v.string(),
  sourceId: v.id("sources"),
  name: v.string(),
  category: amenityCategoryValidator,
  status: amenityStatusValidator,
  lat: v.number(),
  lng: v.number(),
  spatialCell: v.string(),
  geometryAccuracy: amenityGeometryAccuracyValidator,
  geometryRole: amenityGeometryRoleValidator,
  address: v.optional(v.string()),
  effectiveDate: v.optional(v.string()),
  lastVerifiedAt: v.number(),
});

export const userValidator = v.object({
  _id: v.id("users"),
  _creationTime: v.number(),
  tokenIdentifier: v.string(),
  clerkId: v.optional(v.string()),
  name: v.optional(v.string()),
  email: v.optional(v.string()),
  telegramChatId: v.optional(v.string()),
});

export const geoPointValidator = v.object({
  label: v.string(),
  address: v.optional(v.string()),
  lat: v.number(),
  lng: v.number(),
});

export const userProfileValidator = v.object({
  _id: v.id("userProfiles"),
  _creationTime: v.number(),
  userId: v.id("users"),
  budgetMax: v.optional(v.number()),
  waitToleranceMonths: v.optional(v.number()),
  flatTypes: v.array(v.string()),
  towns: v.optional(v.array(v.string())),
  regions: v.optional(v.array(v.string())),
  workplaces: v.array(geoPointValidator),
  parentsArea: v.optional(geoPointValidator),
  updatedAt: v.number(),
});

export const watchlistValidator = v.object({
  _id: v.id("watchlists"),
  _creationTime: v.number(),
  userId: v.id("users"),
  targetType: v.union(v.literal("project"), v.literal("town"), v.literal("mrt")),
  targetId: v.string(),
  label: v.string(),
  createdAt: v.number(),
});

export const alertValidator = v.object({
  _id: v.id("alerts"),
  _creationTime: v.number(),
  userId: v.id("users"),
  kind: v.union(
    v.literal("project_update"),
    v.literal("new_launch"),
    v.literal("exercise_open"),
    v.literal("system"),
    v.literal("test"),
  ),
  title: v.string(),
  body: v.string(),
  projectId: v.optional(v.id("projects")),
  alertEventId: v.optional(v.id("alertEvents")),
  read: v.boolean(),
  deliveredVia: v.array(v.string()),
  createdAt: v.number(),
});

export const constraintsValidator = v.object({
  budgetMax: v.optional(v.number()),
  flatTypes: v.optional(v.array(v.string())),
  waitToleranceMonths: v.optional(v.number()),
  towns: v.optional(v.array(v.string())),
  regions: v.optional(v.array(v.string())),
  workplaces: v.optional(v.array(v.string())),
  parentsArea: v.optional(v.string()),
});

export const scoreComponentValidator = v.object({
  score: v.number(),
  reasons: v.array(v.string()),
});

export const rankingValidator = v.object({
  slug: v.string(),
  name: v.string(),
  town: v.string(),
  classification: classificationValidator,
  totalScore: v.number(),
  breakdown: v.object({
    budgetFit: scoreComponentValidator,
    waitFit: scoreComponentValidator,
    flatTypeFit: scoreComponentValidator,
    locationFit: scoreComponentValidator,
  }),
});
