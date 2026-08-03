import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * BTOProjects.sg schema — flat, relational, provenance-first.
 *
 * Notes:
 * - Every factual project field is mirrored into `projectFacts` with a
 *   confidence label (official | estimated | analysis) and a source trail.
 * - There is intentionally NO `comparisons` table: the compare tray is
 *   client-side localStorage for the MVP so anonymous users can compare
 *   without signing in (product guardrail: no auth wall for browsing).
 * - No `projectVersions`/`reviewQueue` yet (ARCHITECTURE.md v0 sketch);
 *   field-level `projectFacts` + `ingestionJobs` cover MVP provenance and
 *   parser monitoring. Revisit when HDB page ingestion lands.
 */

export const exerciseTypeValidator = v.union(v.literal("bto"), v.literal("sbf"));
export const exerciseStatusValidator = v.union(
  v.literal("upcoming"),
  v.literal("open"),
  v.literal("closed"),
);
export const classificationValidator = v.union(
  v.literal("Standard"),
  v.literal("Plus"),
  v.literal("Prime"),
  // SBF pools mix classifications (or predate them); HDB publishes these
  // rows as "NA"/"Unclassified" — stored honestly rather than guessed.
  v.literal("Unclassified"),
);
export const lifecycleStatusValidator = v.union(
  v.literal("announced"),
  v.literal("launched"),
  v.literal("construction"),
  v.literal("sbf"),
  v.literal("mop"),
);
export const btoFlatTypeValidator = v.union(
  v.literal("2-room Flexi"),
  v.literal("3-room"),
  v.literal("4-room"),
  v.literal("5-room"),
  v.literal("3Gen"),
);
export const confidenceValidator = v.union(
  v.literal("official"),
  v.literal("estimated"),
  v.literal("analysis"),
);
export const extractionMethodValidator = v.union(
  v.literal("parser"),
  v.literal("llm"),
  v.literal("manual"),
  v.literal("research"),
);
export const sourceKindValidator = v.union(
  v.literal("hdb"),
  v.literal("publisher"),
  v.literal("datagov"),
  v.literal("onemap"),
  v.literal("manual"),
  v.literal("research"),
);
export const alertEventStatusValidator = v.union(
  v.literal("pending"),
  v.literal("delivered"),
);
export const alertEventDeliveryPhaseValidator = v.union(
  v.literal("project"),
  v.literal("town"),
);

export default defineSchema({
  exercises: defineTable({
    key: v.string(), // e.g. "2026-02"
    label: v.string(), // e.g. "February 2026 BTO"
    type: exerciseTypeValidator,
    status: exerciseStatusValidator,
    applicationEnd: v.optional(v.string()), // ISO date "YYYY-MM-DD"
    // Cadence placeholders are never presented as official announcements.
    // Official ingestion clears this flag when the exercise is discovered.
    isEstimate: v.optional(v.boolean()),
  }).index("by_key", ["key"]),

  towns: defineTable({
    name: v.string(),
    region: v.string(),
    lat: v.number(),
    lng: v.number(),
  }).index("by_name", ["name"]),

  mrtStations: defineTable({
    name: v.string(),
    code: v.string(), // e.g. "EW18" or "NS9/TE2" for interchanges
    line: v.string(),
    lat: v.number(),
    lng: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_name", ["name"]),

  projects: defineTable({
    slug: v.string(),
    name: v.string(),
    townId: v.id("towns"),
    exerciseId: v.id("exercises"),
    region: v.string(),
    classification: classificationValidator,
    lifecycleStatus: lifecycleStatusValidator,
    // Denormalized from exercises.type so browsing/ranking never needs the
    // join. Optional for pre-SBF rows; readers treat undefined as "bto".
    saleType: v.optional(exerciseTypeValidator),
    lat: v.number(),
    lng: v.number(),
    description: v.string(),
    totalUnits: v.number(),
    estimatedWaitMonths: v.number(),
    estimatedCompletion: v.string(), // "YYYY-MM"
    nearestMrt: v.array(v.string()), // display strings, e.g. "Redhill (EW18)"
    mrtWalkingMinutes: v.number(),
    applicationDeadline: v.optional(v.string()), // ISO date "YYYY-MM-DD"
    notes: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_town", ["townId"])
    .index("by_exercise", ["exerciseId"])
    .index("by_classification", ["classification"])
    .index("by_lifecycle", ["lifecycleStatus"])
    .index("by_region", ["region"]),

  flatTypes: defineTable({
    projectId: v.id("projects"),
    type: btoFlatTypeValidator,
    units: v.number(),
    minPrice: v.number(),
    maxPrice: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_type", ["type"]),

  sources: defineTable({
    url: v.string(),
    publisher: v.string(),
    kind: sourceKindValidator,
    title: v.optional(v.string()),
    retrievedAt: v.number(),
    contentHash: v.optional(v.string()),
    snapshotRef: v.optional(v.string()),
  }).index("by_url", ["url"]),

  // Field-level provenance: one row per stored fact. Values are stringified
  // (numbers included) so a single table can hold every fact type.
  projectFacts: defineTable({
    projectId: v.id("projects"),
    field: v.string(), // e.g. "totalUnits", "flatType.4-room.minPrice"
    value: v.string(),
    confidence: confidenceValidator,
    extractionMethod: extractionMethodValidator,
    sourceId: v.optional(v.id("sources")),
    retrievedAt: v.number(),
    effectiveDate: v.optional(v.string()), // when the fact applies from
    note: v.optional(v.string()),
  })
    .index("by_project", ["projectId"])
    .index("by_project_and_field", ["projectId", "field"]),

  projectSources: defineTable({
    projectId: v.id("projects"),
    sourceId: v.id("sources"),
  })
    .index("by_project", ["projectId"])
    .index("by_source", ["sourceId"]),

  schools: defineTable({
    name: v.string(),
    level: v.union(v.literal("primary"), v.literal("secondary"), v.literal("mixed")),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    address: v.optional(v.string()),
    town: v.optional(v.string()),
  }).index("by_name", ["name"]),

  resaleTransactions: defineTable({
    town: v.string(),
    // Free-form string: data.gov.sg has types beyond BTO unions
    // ("EXECUTIVE", "MULTI-GENERATION"); mapped best-effort at ingest.
    flatType: v.string(),
    block: v.string(),
    streetName: v.string(),
    storeyRange: v.string(),
    floorAreaSqm: v.number(),
    flatModel: v.string(),
    leaseCommenceDate: v.number(), // year, e.g. 2015
    resalePrice: v.number(),
    month: v.string(), // "YYYY-MM"
  })
    .index("by_town", ["town"])
    .index("by_town_and_type", ["town", "flatType"])
    .index("by_month", ["month"]),

  users: defineTable({
    tokenIdentifier: v.string(),
    clerkId: v.optional(v.string()),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    telegramChatId: v.optional(v.string()),
  }).index("by_token", ["tokenIdentifier"]),

  userProfiles: defineTable({
    userId: v.id("users"),
    budgetMax: v.optional(v.number()),
    householdType: v.optional(v.string()),
    waitToleranceMonths: v.optional(v.number()),
    flatTypes: v.array(v.string()),
    towns: v.optional(v.array(v.string())),
    regions: v.optional(v.array(v.string())),
    workplaces: v.array(
      v.object({
        label: v.string(),
        address: v.optional(v.string()),
        lat: v.number(),
        lng: v.number(),
      }),
    ),
    parentsArea: v.optional(
      v.object({
        label: v.string(),
        address: v.optional(v.string()),
        lat: v.number(),
        lng: v.number(),
      }),
    ),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  geocodeRateLimits: defineTable({
    userId: v.id("users"),
    windowStart: v.number(),
    count: v.number(),
  }).index("by_user", ["userId"]),

  watchlists: defineTable({
    userId: v.id("users"),
    targetType: v.union(
      v.literal("project"),
      v.literal("town"),
      v.literal("mrt"),
    ),
    // Polymorphic ref stored as string: project slug, town name, or station code.
    targetId: v.string(),
    label: v.string(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_target", ["userId", "targetType", "targetId"])
    .index("by_target", ["targetType", "targetId"]),

  alerts: defineTable({
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
    deliveredVia: v.array(v.string()), // currently always ["inapp"]
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_read", ["userId", "read"])
    .index("by_event_and_user", ["alertEventId", "userId"]),

  // Transactional outbox for official project changes. Ingestion inserts an
  // event in the same mutation as its facts; delivery atomically fans out the
  // event to in-app alerts and marks it delivered.
  alertEvents: defineTable({
    projectId: v.id("projects"),
    eventKey: v.string(),
    title: v.string(),
    body: v.string(),
    status: alertEventStatusValidator,
    // Optional for migration compatibility. Existing pending rows begin in
    // the project phase at a null cursor.
    deliveryPhase: v.optional(alertEventDeliveryPhaseValidator),
    deliveryCursor: v.optional(v.string()),
    deliveryError: v.optional(v.string()),
    createdAt: v.number(),
    deliveredAt: v.optional(v.number()),
  })
    .index("by_event_key", ["eventKey"])
    .index("by_status_and_created", ["status", "createdAt"]),

  notificationLog: defineTable({
    alertId: v.optional(v.id("alerts")),
    channel: v.union(v.literal("telegram"), v.literal("log")),
    status: v.union(v.literal("sent"), v.literal("failed")),
    detail: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_alert", ["alertId"]),

  plannerSessions: defineTable({
    userId: v.id("users"),
    messages: v.array(
      v.object({
        role: v.union(v.literal("user"), v.literal("assistant")),
        content: v.string(),
        citedProjectSlugs: v.optional(v.array(v.string())),
        constraints: v.optional(v.any()), // interpreted-constraint snapshot per turn
      }),
    ),
    constraints: v.optional(v.any()), // latest merged constraints
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  ingestionJobs: defineTable({
    source: v.string(), // e.g. "datagov.resale", "datagov.schools"
    status: v.union(
      v.literal("running"),
      v.literal("success"),
      v.literal("failed"),
    ),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    stats: v.optional(v.any()),
    error: v.optional(v.string()),
  }).index("by_source", ["source"]),

  // Small key-value store (OneMap token cache etc.)
  kv: defineTable({
    key: v.string(),
    value: v.string(),
    expiresAt: v.optional(v.number()),
  }).index("by_key", ["key"]),
});
