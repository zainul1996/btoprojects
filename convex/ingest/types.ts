/**
 * Shared contracts for the ingestion pipeline (Track W1).
 *
 * Pure types only — no Convex imports — so standalone parse-test scripts under
 * scripts/ can import the same shapes as the Convex actions.
 */

/** Result of one full ingestion run, reported in ingestionJobs.notes/logs. */
export interface IngestRunSummary {
  jobName: string;
  rowsFetched: number;
  rowsWritten: number;
  /** Facts that landed as new rows. */
  factsInserted: number;
  /** Facts skipped because the latest stored value already matches. */
  factsUnchanged: number;
  /** Facts skipped because they would downgrade an "official" value. */
  factsConflicts: number;
  errors: string[];
}

export function emptySummary(jobName: string): IngestRunSummary {
  return {
    jobName,
    rowsFetched: 0,
    rowsWritten: 0,
    factsInserted: 0,
    factsUnchanged: 0,
    factsConflicts: 0,
    errors: [],
  };
}

/** ingestionJobs.source values — single source of truth for jobs and crons. */
export const INGEST_JOBS = {
  resale: "datagov.resale",
  geocode: "onemap.geocode",
  hdbLaunches: "hdb.launches",
} as const;

/** kv-table key tracking the newest resale month already ingested ("YYYY-MM"). */
export const KV_RESALE_LATEST_MONTH = "ingest.resale.latestMonth";
