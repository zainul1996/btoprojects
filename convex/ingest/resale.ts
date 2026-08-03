import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction, internalMutation } from "../_generated/server";
import { emptySummary, INGEST_JOBS, KV_RESALE_LATEST_MONTH } from "./types";

/**
 * Incremental ingestion of the official HDB "Resale flat prices" dataset
 * (based on registration date, from Jan-2017 onwards) from data.gov.sg.
 *
 * Flow: poll-download API -> short-lived CSV URL -> parse -> month-grouped
 * replace-insert batches. The incremental cursor lives in the kv table under
 * KV_RESALE_LATEST_MONTH; the newest stored month is always re-ingested
 * because late registrations trickle in.
 *
 * Deliberately NOT "use node": the spec requires this action and the
 * insertResaleMonth mutation in one file, and "use node" files may only
 * export actions. The default runtime already provides fetch to actions and
 * the CSV parser is pure string processing, so no Node APIs are needed.
 *
 * MEMORY (verified the hard way, 3 Aug 2026): the full CSV is ~31 MB /
 * ~237k rows — materialising it as string[][] blows the 64 MB action heap
 * (OOM on the first live `convex run`; the author's parse test ran under
 * full Node via scripts/ingest-test-resale.mjs). The parser below is a row
 * GENERATOR and only rows inside the ingest window (month >= cutoff) are
 * retained — older rows are validated/counted and dropped as parsed.
 */

const DATASET_ID = "d_8b84c4ee58e3cfc0ece0d773c8ca6abc";
const POLL_DOWNLOAD_URL = `https://api-open.data.gov.sg/v1/public/api/datasets/${DATASET_ID}/poll-download`;
const INITIATE_DOWNLOAD_URL = `https://api-open.data.gov.sg/v1/public/api/datasets/${DATASET_ID}/initiate-download`;
const SOURCE_TITLE =
  "HDB Resale flat prices (registration date, from Jan-2017 onwards)";

/** Bounded first run: only the newest N calendar months are ingested. */
const FIRST_RUN_MONTH_COUNT = 13;
/** Convex arg-size safety: max rows sent per insertResaleMonth call. */
const MAX_ROWS_PER_MUTATION = 1500;
/** Delete loop batch size when clearing a month. */
const DELETE_BATCH_SIZE = 500;
const MAX_PARSE_ERRORS_LOGGED = 10;
const POLL_RETRY_DELAY_MS = 2000;
const RATE_LIMIT_RETRY_DELAY_MS = 15000;

interface ResaleRow {
  town: string;
  flatType: string;
  block: string;
  streetName: string;
  storeyRange: string;
  floorAreaSqm: number;
  flatModel: string;
  leaseCommenceDate: number;
  resalePrice: number;
}

const resaleRowValidator = v.object({
  town: v.string(),
  flatType: v.string(),
  block: v.string(),
  streetName: v.string(),
  storeyRange: v.string(),
  floorAreaSqm: v.number(),
  flatModel: v.string(),
  leaseCommenceDate: v.number(),
  resalePrice: v.number(),
});

const runSummaryValidator = v.object({
  jobName: v.string(),
  rowsFetched: v.number(),
  rowsWritten: v.number(),
  factsInserted: v.number(),
  factsUnchanged: v.number(),
  factsConflicts: v.number(),
  errors: v.array(v.string()),
});

/**
 * Replace-insert one month of resale transactions. When chunking a large
 * month across calls, pass replaceExisting only on the first chunk — it
 * clears the month's existing rows before inserting; later chunks append.
 */
export const insertResaleMonth = internalMutation({
  args: {
    month: v.string(),
    rows: v.array(resaleRowValidator),
    replaceExisting: v.optional(v.boolean()),
  },
  returns: v.object({ deleted: v.number(), inserted: v.number() }),
  handler: async (ctx, args) => {
    let deleted = 0;
    if (args.replaceExisting ?? true) {
      for (;;) {
        const batch = await ctx.db
          .query("resaleTransactions")
          .withIndex("by_month", (q) => q.eq("month", args.month))
          .take(DELETE_BATCH_SIZE);
        if (batch.length === 0) break;
        for (const row of batch) {
          await ctx.db.delete("resaleTransactions", row._id);
        }
        deleted += batch.length;
      }
    }
    for (const row of args.rows) {
      await ctx.db.insert("resaleTransactions", { ...row, month: args.month });
    }
    return { deleted, inserted: args.rows.length };
  },
});

export const run = internalAction({
  args: {},
  returns: runSummaryValidator,
  handler: async (ctx) => {
    const summary = emptySummary(INGEST_JOBS.resale);
    const jobId = await ctx.runMutation(internal.ingest.lib.startJob, {
      source: INGEST_JOBS.resale,
    });
    try {
      const csvText = await fetchResaleCsv();

      // Cutoff BEFORE parsing so out-of-window rows are never retained:
      // first run ingests only the newest FIRST_RUN_MONTH_COUNT calendar
      // months; incremental runs re-ingest the cursor month itself (late
      // registrations trickle in) plus anything newer.
      const cursor = await ctx.runMutation(internal.ingest.lib.getKv, {
        key: KV_RESALE_LATEST_MONTH,
      });
      const newestMonthInFile = newestMonthIn(csvText);
      if (newestMonthInFile === null) {
        throw new Error("data.gov.sg CSV contained no usable rows");
      }
      const cutoff =
        cursor ?? shiftMonth(newestMonthInFile, -(FIRST_RUN_MONTH_COUNT - 1));

      const rowsByMonth = parseResaleCsvWindow(
        csvText,
        cutoff,
        summary.errors,
        summary,
      );
      const months = [...rowsByMonth.keys()].sort();

      await ctx.runMutation(internal.ingest.lib.upsertSource, {
        url: POLL_DOWNLOAD_URL,
        kind: "datagov",
        publisher: "data.gov.sg / HDB",
        title: SOURCE_TITLE,
      });

      for (const month of months) {
        const monthRows = rowsByMonth.get(month) ?? [];
        for (
          let offset = 0;
          offset < monthRows.length;
          offset += MAX_ROWS_PER_MUTATION
        ) {
          const result = await ctx.runMutation(
            internal.ingest.resale.insertResaleMonth,
            {
              month,
              rows: monthRows.slice(offset, offset + MAX_ROWS_PER_MUTATION),
              replaceExisting: offset === 0,
            },
          );
          summary.rowsWritten += result.inserted;
        }
      }

      if (months.length > 0) {
        await ctx.runMutation(internal.ingest.lib.setKv, {
          key: KV_RESALE_LATEST_MONTH,
          value: months[months.length - 1],
        });
      }

      // Resale rows are bulk facts: count inserts, no unchanged/conflict path.
      summary.factsInserted = summary.rowsWritten;
      await ctx.runMutation(internal.ingest.lib.finishJob, {
        jobId,
        status: "success",
        stats: summary,
      });
      return summary;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      summary.errors.push(message);
      await ctx.runMutation(internal.ingest.lib.finishJob, {
        jobId,
        status: "failed",
        stats: summary,
        error: message,
      });
      throw error;
    }
  },
});

interface PollDownloadBody {
  code?: number;
  data?: { status?: string; url?: string };
  errorMsg?: string;
}

async function fetchResaleCsv(): Promise<string> {
  const apiKey = process.env.DATAGOV_API_KEY;
  const headers: Record<string, string> = apiKey
    ? { "x-api-key": apiKey }
    : {};

  let downloadUrl = await pollForDownloadUrl(headers, 1);
  if (downloadUrl === null) {
    // Documented flow when a CSV build is not already cached: initiate the
    // download, then poll until the short-lived URL is ready.
    const initRes = await fetch(INITIATE_DOWNLOAD_URL, { headers });
    if (!initRes.ok) {
      throw new Error(`initiate-download failed: HTTP ${initRes.status}`);
    }
    downloadUrl = await pollForDownloadUrl(headers, 3);
  }
  if (downloadUrl === null) {
    throw new Error("data.gov.sg poll-download returned no download URL");
  }

  const res = await fetch(downloadUrl);
  if (!res.ok) {
    throw new Error(`CSV download failed: HTTP ${res.status}`);
  }
  return await res.text();
}

async function pollForDownloadUrl(
  headers: Record<string, string>,
  maxAttempts: number,
): Promise<string | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(POLL_DOWNLOAD_URL, { headers });
    if (res.status === 429) {
      await sleep(RATE_LIMIT_RETRY_DELAY_MS);
      continue;
    }
    if (!res.ok) {
      throw new Error(`poll-download failed: HTTP ${res.status}`);
    }
    const body = (await res.json()) as PollDownloadBody;
    if (body.code === 0 && typeof body.data?.url === "string") {
      return body.data.url;
    }
    await sleep(POLL_RETRY_DELAY_MS);
  }
  return null;
}

/** "ANG MO KIO" -> "Ang Mo Kio"; "KALLANG/WHAMPOA" -> "Kallang/Whampoa". */
function titleCase(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .split(/([/\s]+)/)
    .map((part) =>
      part.length > 0 ? part.charAt(0).toUpperCase() + part.slice(1) : part,
    )
    .join("");
}

/** "3 ROOM" -> "3-room"; "MULTI-GENERATION" -> "multi-generation". */
function normalizeFlatType(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

/** Shift a "YYYY-MM" month string by delta months. */
function shiftMonth(month: string, delta: number): string {
  const [yearPart, monthPart] = month.split("-");
  const year = Number(yearPart);
  const mon = Number(monthPart);
  const total = year * 12 + (mon - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/**
 * Newest "YYYY-MM" month present in the file. The month column is the only
 * place this pattern appears (other date-ish fields are bare "YYYY" years),
 * so a cheap regex scan finds the ingest-window edge without materialising
 * any rows.
 */
function newestMonthIn(csvText: string): string | null {
  const monthPattern = /(?:19|20)\d{2}-(?:0[1-9]|1[0-2])/g;
  let newest: string | null = null;
  let match: RegExpExecArray | null;
  while ((match = monthPattern.exec(csvText)) !== null) {
    if (newest === null || match[0] > newest) newest = match[0];
  }
  return newest;
}

/**
 * Parse the CSV into a month-grouped map, retaining only rows inside the
 * ingest window (month >= cutoff). Every row is still validated and counted
 * (rowsFetched / skipped) exactly as before — the window only limits what
 * is KEPT, which is what keeps the action inside its 64 MB heap.
 */
function parseResaleCsvWindow(
  csvText: string,
  cutoff: string,
  errors: string[],
  summary: { rowsFetched: number },
): Map<string, ResaleRow[]> {
  const iterator = iterCsvRows(csvText);
  const first = iterator.next();
  if (first.done) {
    return new Map();
  }
  const header = first.value.map((cell) => cell.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const idx = {
    month: col("month"),
    town: col("town"),
    flatType: col("flat_type"),
    block: col("block"),
    streetName: col("street_name"),
    storeyRange: col("storey_range"),
    floorAreaSqm: col("floor_area_sqm"),
    flatModel: col("flat_model"),
    leaseCommenceDate: col("lease_commence_date"),
    resalePrice: col("resale_price"),
  };
  const missing = Object.entries(idx)
    .filter(([, position]) => position === -1)
    .map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(
      `data.gov.sg CSV missing expected columns: ${missing.join(", ")}`,
    );
  }

  const rowsByMonth = new Map<string, ResaleRow[]>();
  let skipped = 0;
  for (const fields of iterator) {
    if (fields.length < header.length) {
      skipped++;
      continue;
    }
    const month = fields[idx.month].trim();
    const floorAreaSqm = Number(fields[idx.floorAreaSqm]);
    const leaseCommenceDate = Number(fields[idx.leaseCommenceDate]);
    const resalePrice = Number(fields[idx.resalePrice]);
    if (
      !/^\d{4}-\d{2}$/.test(month) ||
      !Number.isFinite(floorAreaSqm) ||
      !Number.isFinite(leaseCommenceDate) ||
      !Number.isFinite(resalePrice)
    ) {
      skipped++;
      if (errors.length < MAX_PARSE_ERRORS_LOGGED) {
        errors.push(
          `Skipped malformed CSV row: ${fields.slice(0, 3).join(" | ")}`,
        );
      }
      continue;
    }
    summary.rowsFetched++;
    // Outside the ingest window: counted as fetched, never retained.
    if (month < cutoff) continue;
    const row: ResaleRow = {
      town: titleCase(fields[idx.town]),
      flatType: normalizeFlatType(fields[idx.flatType]),
      block: fields[idx.block].trim(),
      streetName: fields[idx.streetName].trim(),
      storeyRange: fields[idx.storeyRange].trim(),
      floorAreaSqm,
      flatModel: fields[idx.flatModel].trim(),
      leaseCommenceDate,
      resalePrice,
    };
    const bucket = rowsByMonth.get(month);
    if (bucket) {
      bucket.push(row);
    } else {
      rowsByMonth.set(month, [row]);
    }
  }
  if (skipped > 0 && errors.length < MAX_PARSE_ERRORS_LOGGED) {
    errors.push(`Skipped ${skipped} malformed/short CSV row(s) in total`);
  }
  return rowsByMonth;
}

/**
 * Minimal RFC-4180-style CSV row generator: handles quoted fields, escaped
 * quotes (""), commas/newlines inside quotes, CRLF, and a leading BOM.
 * Yields one row at a time so the whole table is never held in memory.
 */
function* iterCsvRows(text: string): Generator<string[], void, unknown> {
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  if (text.charCodeAt(0) === 0xfeff) {
    i = 1;
  }
  for (; i < text.length; i++) {
    const ch = text.charAt(i);
    if (inQuotes) {
      if (ch === '"') {
        if (text.charAt(i + 1) === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      yield row;
      row = [];
      field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    yield row;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
