"use client";

import Link from "next/link";
import { useAction, useMutation, useQuery } from "convex/react";
import { Check, LocateFixed, MapPin, X } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { toast } from "sonner";

import { api } from "../../../convex/_generated/api";
import {
  PROFILE_FLAT_TYPES,
  PROFILE_LIMITS,
  PROFILE_REGIONS,
  normalizeProfileInput,
  type SavedGeoPoint,
} from "../../../convex/lib/profilePreferences";
import {
  DEFAULT_FILTERS,
  serializeExplorerParams,
} from "@/components/explore/filter-model";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  clearPreferencesDraft,
  readPreferencesDraft,
  writePreferencesDraft,
  type PreferencesPendingMatch,
} from "@/lib/profile-preferences-draft";

export type PreferencesFormState = {
  budget: string;
  waitMonths: string;
  flatTypes: string[];
  towns: string;
  regions: string[];
  workplaces: SavedGeoPoint[];
  parentsArea?: SavedGeoPoint;
};

type ProfileSnapshot = {
  form: PreferencesFormState;
  updatedAt: number | null;
};

type PendingMatch = PreferencesPendingMatch;

type FieldErrors = {
  budget?: string;
  wait?: string;
  towns?: string;
};

const EMPTY_FORM: PreferencesFormState = {
  budget: "",
  waitMonths: "",
  flatTypes: [],
  towns: "",
  regions: [],
  workplaces: [],
};

function parseOptionalNumber(value: string): number | undefined {
  const trimmed = value.trim().replace(/,/g, "");
  return trimmed === "" ? undefined : Number(trimmed);
}

function townTokens(value: string): string[] {
  return value
    .split(",")
    .map((town) => town.trim().replace(/\s+/g, " "))
    .filter(Boolean);
}

function normalizedForm(form: PreferencesFormState): PreferencesFormState {
  return { ...form, towns: townTokens(form.towns).join(", ") };
}

function sameForm(a: PreferencesFormState, b: PreferencesFormState): boolean {
  return JSON.stringify(normalizedForm(a)) === JSON.stringify(normalizedForm(b));
}

function snapshotOf(
  profile:
    | {
        budgetMax?: number;
        waitToleranceMonths?: number;
        flatTypes: string[];
        towns?: string[];
        regions?: string[];
        workplaces: SavedGeoPoint[];
        parentsArea?: SavedGeoPoint;
        updatedAt: number;
      }
    | null,
): ProfileSnapshot {
  return profile
    ? {
        form: {
          budget: profile.budgetMax?.toString() ?? "",
          waitMonths: profile.waitToleranceMonths?.toString() ?? "",
          flatTypes: profile.flatTypes,
          towns: profile.towns?.join(", ") ?? "",
          regions: profile.regions ?? [],
          workplaces: profile.workplaces,
          parentsArea: profile.parentsArea,
        },
        updatedAt: profile.updatedAt,
      }
    : { form: EMPTY_FORM, updatedAt: null };
}

export function preferencesExplorerHref(form: PreferencesFormState): string {
  const query = serializeExplorerParams({
    ...DEFAULT_FILTERS,
    town: townTokens(form.towns)[0],
    region: form.regions[0],
    flat: form.flatTypes[0],
    maxPrice: parseOptionalNumber(form.budget),
    maxWait: parseOptionalNumber(form.waitMonths),
  });
  return query ? `/explore?${query}` : "/explore";
}

export function PreferencesTab({
  ready,
  owner,
  onDirtyChange,
}: {
  ready: boolean;
  owner?: string;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const profile = useQuery(api.profile.get, ready ? {} : "skip");
  const upsert = useMutation(api.profile.upsert);
  const resolveAddress = useAction(api.profileActions.resolveSingaporeAddress);
  const [form, setForm] = useState<PreferencesFormState>(EMPTY_FORM);
  const [baseline, setBaseline] = useState<ProfileSnapshot | null>(null);
  const [remoteConflict, setRemoteConflict] =
    useState<ProfileSnapshot | null>(null);
  const [workplaceInput, setWorkplaceInput] = useState("");
  const [parentsInput, setParentsInput] = useState("");
  const [pendingMatch, setPendingMatch] = useState<PendingMatch | null>(null);
  const [resolving, setResolving] = useState<"workplace" | "parents" | null>(
    null,
  );
  const [resolverError, setResolverError] = useState<{
    kind: "workplace" | "parents";
    message: string;
  } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [concurrencyBlocked, setConcurrencyBlocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const budgetRef = useRef<HTMLInputElement>(null);
  const waitRef = useRef<HTMLInputElement>(null);
  const townsRef = useRef<HTMLInputElement>(null);

  const dirty =
    baseline !== null &&
    (!sameForm(form, baseline.form) ||
      workplaceInput !== "" ||
      parentsInput !== "" ||
      pendingMatch !== null);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(
    () => () => {
      onDirtyChange?.(false);
    },
    [onDirtyChange],
  );

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    if (profile === undefined || !owner) return;
    const incoming = snapshotOf(profile);
    if (baseline === null) {
      const draft = readPreferencesDraft(owner);
      queueMicrotask(() => {
        if (draft) {
          setForm(draft.form);
          setWorkplaceInput(draft.workplaceInput);
          setParentsInput(draft.parentsInput);
          setPendingMatch(draft.pendingMatch);
          setBaseline({
            form: incoming.form,
            updatedAt: draft.baselineUpdatedAt,
          });
          setDraftRestored(true);
        } else {
          setForm(incoming.form);
          setBaseline(incoming);
        }
      });
      return;
    }
    if (incoming.updatedAt === baseline.updatedAt) return;
    if (
      incoming.updatedAt !== null &&
      baseline.updatedAt !== null &&
      incoming.updatedAt < baseline.updatedAt
    ) {
      return;
    }
    queueMicrotask(() => {
      if (dirty) {
        setRemoteConflict(incoming);
      } else {
        setForm(incoming.form);
        setBaseline(incoming);
        setRemoteConflict(null);
        setConcurrencyBlocked(false);
      }
    });
  }, [baseline, dirty, owner, profile]);

  useEffect(() => {
    if (!owner || baseline === null) return;
    if (!dirty) {
      clearPreferencesDraft();
      return;
    }
    writePreferencesDraft({
      owner,
      form,
      workplaceInput,
      parentsInput,
      pendingMatch,
      baselineUpdatedAt: baseline.updatedAt,
      savedAt: Date.now(),
    });
  }, [
    baseline,
    dirty,
    form,
    owner,
    parentsInput,
    pendingMatch,
    workplaceInput,
  ]);

  const explorerHref = useMemo(() => preferencesExplorerHref(form), [form]);

  if (!ready || !owner || profile === undefined || baseline === null) {
    return (
      <div className="space-y-6" aria-label="Loading preferences">
        <Skeleton className="h-5 w-52" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const updateForm = (
    update: (current: PreferencesFormState) => PreferencesFormState,
  ) => {
    setSaveError(null);
    setForm(update);
  };

  const discardDraft = () => {
    const latest = remoteConflict ?? snapshotOf(profile);
    setForm(latest.form);
    setBaseline(latest);
    setWorkplaceInput("");
    setParentsInput("");
    setPendingMatch(null);
    setResolverError(null);
    setRemoteConflict(null);
    setFieldErrors({});
    setSaveError(null);
    setConcurrencyBlocked(false);
    setDraftRestored(false);
    clearPreferencesDraft();
  };

  const toggle = (key: "flatTypes" | "regions", value: string) => {
    updateForm((current) => ({
      ...current,
      [key]: current[key].includes(value)
        ? current[key].filter((entry) => entry !== value)
        : [...current[key], value],
    }));
  };

  const resolve = async (kind: "workplace" | "parents") => {
    const address = (kind === "workplace" ? workplaceInput : parentsInput).trim();
    setResolverError(null);
    setPendingMatch(null);
    if (
      address.length < PROFILE_LIMITS.labelMin ||
      address.length > PROFILE_LIMITS.labelMax
    ) {
      setResolverError({
        kind,
        message: "Enter between 3 and 120 characters.",
      });
      return;
    }
    setResolving(kind);
    try {
      const result = await resolveAddress({ address });
      if (!result.ok) {
        const message =
          result.reason === "not_found"
            ? "No Singapore address matched. Add a block, street or postal code."
            : result.reason === "rate_limited"
              ? "Address lookup limit reached. Try again in the next hour."
              : "Address lookup is temporarily unavailable. Try again later.";
        setResolverError({ kind, message });
        return;
      }
      setPendingMatch({ kind, ...result.match });
    } catch {
      setResolverError({
        kind,
        message: "Address lookup failed. Check the address and try again.",
      });
    } finally {
      setResolving(null);
    }
  };

  const confirmMatch = () => {
    if (!pendingMatch) return;
    const duplicate = [
      ...form.workplaces,
      ...(form.parentsArea ? [form.parentsArea] : []),
    ].some(
      (point) =>
        point.address?.toLocaleLowerCase("en-SG") ===
          pendingMatch.address.toLocaleLowerCase("en-SG") ||
        (point.lat === pendingMatch.lat && point.lng === pendingMatch.lng),
    );
    if (duplicate) {
      setResolverError({
        kind: pendingMatch.kind,
        message: "That place is already in your preferences.",
      });
      return;
    }
    updateForm((current) => {
      if (pendingMatch.kind === "parents") {
        return {
          ...current,
          parentsArea: {
            label: "Parents’ area",
            address: pendingMatch.address,
            lat: pendingMatch.lat,
            lng: pendingMatch.lng,
          },
        };
      }
      const used = new Set(current.workplaces.map((point) => point.label));
      const index = [1, 2].find((value) => !used.has(`Workplace ${value}`)) ?? 1;
      return {
        ...current,
        workplaces: [
          ...current.workplaces,
          {
            label: `Workplace ${index}`,
            address: pendingMatch.address,
            lat: pendingMatch.lat,
            lng: pendingMatch.lng,
          },
        ],
      };
    });
    if (pendingMatch.kind === "workplace") setWorkplaceInput("");
    else setParentsInput("");
    setPendingMatch(null);
    setResolverError(null);
  };

  const validate = (): {
    budgetMax?: number;
    waitToleranceMonths?: number;
    towns: string[];
  } | null => {
    const errors: FieldErrors = {};
    const budgetMax = parseOptionalNumber(form.budget);
    const waitToleranceMonths = parseOptionalNumber(form.waitMonths);
    const towns = townTokens(form.towns);
    if (
      budgetMax !== undefined &&
      (!Number.isFinite(budgetMax) ||
        budgetMax < PROFILE_LIMITS.budgetMin ||
        budgetMax > PROFILE_LIMITS.budgetMax)
    ) {
      errors.budget = "Enter S$100,000 to S$2,000,000.";
    }
    if (
      waitToleranceMonths !== undefined &&
      (!Number.isInteger(waitToleranceMonths) ||
        waitToleranceMonths < PROFILE_LIMITS.waitMinMonths ||
        waitToleranceMonths > PROFILE_LIMITS.waitMaxMonths)
    ) {
      errors.wait = "Enter a whole number from 1 to 120 months.";
    }
    if (towns.length > PROFILE_LIMITS.towns) {
      errors.towns = `Choose no more than ${PROFILE_LIMITS.towns} towns.`;
    } else if (towns.some((town) => town.length > 80)) {
      errors.towns = "Each town must be 80 characters or fewer.";
    }
    setFieldErrors(errors);
    const firstRef = errors.budget
      ? budgetRef
      : errors.wait
        ? waitRef
        : errors.towns
          ? townsRef
          : null;
    firstRef?.current?.focus();
    return Object.keys(errors).length > 0
      ? null
      : { budgetMax, waitToleranceMonths, towns };
  };

  const save = async () => {
    setSaveError(null);
    if (remoteConflict) {
      setSaveError("Load the latest saved version before making more changes.");
      return;
    }
    const valid = validate();
    if (!valid) return;
    setSaving(true);
    try {
      const normalized = normalizeProfileInput({
        budgetMax: valid.budgetMax,
        waitToleranceMonths: valid.waitToleranceMonths,
        flatTypes: form.flatTypes,
        towns: valid.towns,
        regions: form.regions,
        workplaces: form.workplaces,
        parentsArea: form.parentsArea,
      });
      const result = await upsert({
        ...normalized,
        expectedUpdatedAt: baseline.updatedAt,
      });
      const savedForm: PreferencesFormState = {
        budget: normalized.budgetMax?.toString() ?? "",
        waitMonths: normalized.waitToleranceMonths?.toString() ?? "",
        flatTypes: normalized.flatTypes,
        towns: normalized.towns.join(", "),
        regions: normalized.regions,
        workplaces: normalized.workplaces,
        parentsArea: normalized.parentsArea,
      };
      setForm(savedForm);
      setBaseline({ form: savedForm, updatedAt: result.updatedAt });
      setWorkplaceInput("");
      setParentsInput("");
      setPendingMatch(null);
      setResolverError(null);
      setFieldErrors({});
      setConcurrencyBlocked(false);
      setDraftRestored(false);
      clearPreferencesDraft();
      toast("Planning preferences saved");
    } catch (cause) {
      if (
        cause instanceof Error &&
        cause.message.includes("Profile changed elsewhere")
      ) {
        setSaveError(
          "Preferences changed elsewhere. Load the latest version before saving.",
        );
        setConcurrencyBlocked(true);
      } else {
        setSaveError("Preferences could not be saved. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="max-w-2xl space-y-8"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div>
        <h2 className="text-lg font-semibold text-ink">Planning preferences</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Saved context for the planner and project distance analysis.
        </p>
        {draftRestored && dirty ? (
          <p role="status" className="mt-1 text-xs text-teal-deeper">
            Draft restored from this browser tab.
          </p>
        ) : null}
      </div>

      {remoteConflict ? (
        <div role="alert" className="rounded-lg bg-coral-subtle px-4 py-3">
          <p className="text-sm text-coral">
            These preferences changed elsewhere while you were editing. Your
            local draft has not been overwritten.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={discardDraft}
          >
            Load latest saved version
          </Button>
        </div>
      ) : null}

      <section aria-labelledby="preference-basics" className="space-y-4">
        <h3 id="preference-basics" className="font-medium text-ink">
          Budget and timing
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldInput
            ref={budgetRef}
            id="preference-budget"
            label="Maximum budget (S$)"
            value={form.budget}
            placeholder="550000"
            error={fieldErrors.budget}
            onChange={(value) =>
              updateForm((current) => ({ ...current, budget: value }))
            }
          />
          <FieldInput
            ref={waitRef}
            id="preference-wait"
            label="Maximum wait (months)"
            value={form.waitMonths}
            placeholder="48"
            error={fieldErrors.wait}
            onChange={(value) =>
              updateForm((current) => ({ ...current, waitMonths: value }))
            }
          />
        </div>
      </section>

      <section aria-labelledby="preference-home" className="space-y-4">
        <h3 id="preference-home" className="font-medium text-ink">
          Home search
        </h3>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-ink">Flat types</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-3">
            {PROFILE_FLAT_TYPES.map((flatType) => (
              <label
                key={flatType}
                className="flex items-center gap-2 text-sm text-ink"
              >
                <Checkbox
                  checked={form.flatTypes.includes(flatType)}
                  onCheckedChange={() => toggle("flatTypes", flatType)}
                />
                {flatType}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="space-y-1.5">
          <Label htmlFor="preference-towns">Preferred towns</Label>
          <Input
            ref={townsRef}
            id="preference-towns"
            placeholder="Tampines, Bedok"
            value={form.towns}
            aria-invalid={fieldErrors.towns ? true : undefined}
            aria-describedby={
              fieldErrors.towns
                ? "preference-towns-error preference-towns-hint"
                : "preference-towns-hint"
            }
            onChange={(event) =>
              updateForm((current) => ({
                ...current,
                towns: event.target.value,
              }))
            }
          />
          {fieldErrors.towns ? (
            <p id="preference-towns-error" className="text-xs text-coral">
              {fieldErrors.towns}
            </p>
          ) : null}
          <p id="preference-towns-hint" className="text-xs text-muted-foreground">
            Separate up to {PROFILE_LIMITS.towns} towns with commas.
          </p>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-ink">Regions</legend>
          <div className="flex flex-wrap gap-2">
            {PROFILE_REGIONS.map((region) => {
              const selected = form.regions.includes(region);
              return (
                <Button
                  key={region}
                  type="button"
                  size="sm"
                  variant={selected ? "secondary" : "outline"}
                  aria-pressed={selected}
                  onClick={() => toggle("regions", region)}
                >
                  {selected ? <Check aria-hidden /> : null}
                  {region}
                </Button>
              );
            })}
          </div>
        </fieldset>
      </section>

      <section aria-labelledby="preference-places" className="space-y-4">
        <div>
          <h3 id="preference-places" className="font-medium text-ink">
            Places that matter
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Exact addresses are stored in your account and sent only to OneMap
            for resolution. Deterministic ranking receives coordinates
            server-side; addresses are not sent to the AI provider or shared
            URLs.
          </p>
        </div>
        <ResolvedPlaces
          title="Workplaces"
          points={form.workplaces}
          onRemove={(index) =>
            updateForm((current) => ({
              ...current,
              workplaces: current.workplaces.filter((_, i) => i !== index),
            }))
          }
        />
        {form.workplaces.length < PROFILE_LIMITS.workplaces ? (
          <AddressResolver
            id="workplace-address"
            label="Add a workplace"
            value={workplaceInput}
            pending={resolving === "workplace"}
            match={pendingMatch?.kind === "workplace" ? pendingMatch : null}
            error={
              resolverError?.kind === "workplace"
                ? resolverError.message
                : undefined
            }
            onChange={(value) => {
              setWorkplaceInput(value);
              setPendingMatch(null);
              setResolverError(null);
            }}
            onResolve={() => void resolve("workplace")}
            onConfirm={confirmMatch}
            onReject={() => setPendingMatch(null)}
          />
        ) : null}

        {form.parentsArea ? (
          <ResolvedPlaces
            title="Parents’ area"
            points={[form.parentsArea]}
            onRemove={() =>
              updateForm((current) => ({
                ...current,
                parentsArea: undefined,
              }))
            }
          />
        ) : (
          <AddressResolver
            id="parents-address"
            label="Parents’ area (optional)"
            value={parentsInput}
            pending={resolving === "parents"}
            match={pendingMatch?.kind === "parents" ? pendingMatch : null}
            error={
              resolverError?.kind === "parents"
                ? resolverError.message
                : undefined
            }
            onChange={(value) => {
              setParentsInput(value);
              setPendingMatch(null);
              setResolverError(null);
            }}
            onResolve={() => void resolve("parents")}
            onConfirm={confirmMatch}
            onReject={() => setPendingMatch(null)}
          />
        )}
      </section>

      {saveError ? (
        <p role="alert" className="text-sm text-coral">
          {saveError}
        </p>
      ) : null}
      <div className="border-t border-border pt-5">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            disabled={
              !dirty ||
              saving ||
              resolving !== null ||
              remoteConflict !== null ||
              concurrencyBlocked
            }
          >
            {saving ? "Saving…" : "Save preferences"}
          </Button>
          <span
            role="status"
            className={
              dirty ? "text-sm text-ink" : "text-sm text-teal-deeper"
            }
          >
            {dirty ? "Unsaved changes" : "Saved"}
          </span>
          {dirty ? (
            <Button type="button" variant="ghost" onClick={discardDraft}>
              Discard draft
            </Button>
          ) : null}
          {!dirty ? (
            <Button variant="link" render={<Link href={explorerHref} />}>
              Explore a starting match
            </Button>
          ) : null}
        </div>
        {!dirty ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Uses the first selected town, region and flat type where available.
            You can adjust all filters in Explorer.
          </p>
        ) : null}
      </div>
    </form>
  );
}

function FieldInput({
  ref,
  id,
  label,
  value,
  placeholder,
  error,
  onChange,
}: {
  ref: RefObject<HTMLInputElement | null>;
  id: string;
  label: string;
  value: string;
  placeholder: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const errorId = `${id}-error`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        ref={ref}
        id={id}
        inputMode="numeric"
        placeholder={placeholder}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? (
        <p id={errorId} className="text-xs text-coral">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function AddressResolver({
  id,
  label,
  value,
  pending,
  match,
  error,
  onChange,
  onResolve,
  onConfirm,
  onReject,
}: {
  id: string;
  label: string;
  value: string;
  pending: boolean;
  match: PendingMatch | null;
  error?: string;
  onChange: (value: string) => void;
  onResolve: () => void;
  onConfirm: () => void;
  onReject: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!match) return;
    queueMicrotask(() => confirmRef.current?.focus());
  }, [match]);
  const errorId = `${id}-error`;
  const statusId = `${id}-status`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          placeholder="Building, street or postal code"
          maxLength={PROFILE_LIMITS.labelMax}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            error ? errorId : match ? statusId : undefined
          }
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            if (
              !pending &&
              value.trim().length >= PROFILE_LIMITS.labelMin
            ) {
              onResolve();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={pending || value.trim().length < PROFILE_LIMITS.labelMin}
          onClick={onResolve}
        >
          <LocateFixed aria-hidden />
          {pending ? "Resolving…" : "Resolve"}
        </Button>
      </div>
      {error ? (
        <p
          id={errorId}
          role="alert"
          aria-live="assertive"
          className="text-xs text-coral"
        >
          {error}
        </p>
      ) : null}
      {match ? (
        <div
          id={statusId}
          role="status"
          aria-live="polite"
          className="rounded-lg bg-muted/50 px-3 py-2"
        >
          <p className="text-sm break-words text-ink">
            OneMap matched: {match.address}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Confirm this address before adding it to your preferences.
          </p>
          <div className="mt-2 flex gap-2">
            <Button
              ref={confirmRef}
              type="button"
              size="sm"
              onClick={onConfirm}
            >
              Confirm
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onReject}
            >
              Reject
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ResolvedPlaces({
  title,
  points,
  onRemove,
}: {
  title: string;
  points: SavedGeoPoint[];
  onRemove: (index: number) => void;
}) {
  if (points.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-ink">{title}</p>
      <ul className="space-y-2">
        {points.map((point, index) => (
          <li
            key={`${point.label}-${index}`}
            className="flex items-start justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2"
          >
            <span className="flex min-w-0 gap-2 text-sm text-ink">
              <MapPin
                className="mt-0.5 size-4 shrink-0 text-teal-deep"
                aria-hidden
              />
              <span className="min-w-0">
                <span className="block text-xs font-medium text-muted-foreground">
                  {point.label}
                </span>
                <span className="block break-words">
                  {point.address ?? point.label}
                </span>
              </span>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${point.label}`}
              onClick={() => onRemove(index)}
            >
              <X aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
