"use client";

import type { ComponentProps } from "react";
import {
  ExternalLink,
  Layers3,
  MapPinned,
  RefreshCw,
  School,
  Soup,
  TrainFront,
  TreePine,
} from "lucide-react";

import type { HawkerDataset } from "@/components/map/hawker-data";
import { AmenityMapSymbol } from "@/components/map/map-amenity-symbol";
import { activeMapLayerCount } from "@/components/map/map-layer-model";
import type { ParkDataset } from "@/components/map/park-data";
import type { PrimarySchoolDataset } from "@/components/map/school-data";
import type { TrainStationDataset } from "@/components/map/train-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
type MapLayerControlProps = {
  mrtEnabled: boolean;
  onMrtEnabledChange: (enabled: boolean) => void;
  trainStatus: "idle" | "loading" | "ready" | "error";
  trainDataset: TrainStationDataset | null;
  onRetryTrains: () => void;
  hawkerEnabled: boolean;
  onHawkerEnabledChange: (enabled: boolean) => void;
  hawkerStatus: "idle" | "loading" | "ready" | "error";
  hawkerDataset: HawkerDataset | null;
  onRetryHawkers: () => void;
  parksEnabled: boolean;
  onParksEnabledChange: (enabled: boolean) => void;
  parkStatus: "idle" | "loading" | "ready" | "error";
  parkDataset: ParkDataset | null;
  onRetryParks: () => void;
  primarySchoolsEnabled: boolean;
  onPrimarySchoolsEnabledChange: (enabled: boolean) => void;
  primarySchoolStatus: "idle" | "loading" | "ready" | "error";
  primarySchoolDataset: PrimarySchoolDataset | null;
  onRetryPrimarySchools: () => void;
};

function retrievedLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function SourceLine({
  publisher,
  retrievedAt,
  sourceUrl,
}: {
  publisher: string;
  retrievedAt: string;
  sourceUrl: string;
}) {
  return (
    <p className="px-1 text-xs leading-relaxed text-muted-foreground">
      {publisher} · Retrieved{" "}
      <span className="tnum">{retrievedLabel(retrievedAt)}</span> ·{" "}
      <a
        href={sourceUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 font-medium text-teal-deeper underline-offset-4 hover:underline"
      >
        Source
        <ExternalLink className="size-3" aria-hidden />
      </a>
    </p>
  );
}

function LayerOptions({
  mrtEnabled,
  onMrtEnabledChange,
  trainStatus,
  trainDataset,
  onRetryTrains,
  hawkerEnabled,
  onHawkerEnabledChange,
  hawkerStatus,
  hawkerDataset,
  onRetryHawkers,
  parksEnabled,
  onParksEnabledChange,
  parkStatus,
  parkDataset,
  onRetryParks,
  primarySchoolsEnabled,
  onPrimarySchoolsEnabledChange,
  primarySchoolStatus,
  primarySchoolDataset,
  onRetryPrimarySchools,
  controlIdPrefix,
}: MapLayerControlProps & { controlIdPrefix: string }) {
  const hawkerCount = hawkerDataset?.items.length;
  const trainCount = trainDataset?.coverage.stations;
  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby={`${controlIdPrefix}-projects-heading`}>
        <h3
          id={`${controlIdPrefix}-projects-heading`}
          className="mb-1.5 px-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
        >
          Projects
        </h3>
        <div className="flex items-center gap-3 rounded-lg bg-muted/45 px-3 py-2.5">
          <MapPinned className="size-4 shrink-0 text-teal-deep" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink">BTO and SBF</p>
            <p className="text-xs text-muted-foreground">Always shown</p>
          </div>
          <Badge variant="secondary">Projects</Badge>
        </div>
      </section>

      <section aria-labelledby={`${controlIdPrefix}-transport-heading`}>
        <h3
          id={`${controlIdPrefix}-transport-heading`}
          className="mb-1.5 px-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
        >
          Transport
        </h3>
        <div className="flex items-center gap-3 rounded-lg bg-muted/45 px-3 py-2.5 transition-colors hover:bg-muted/70">
          <TrainFront className="size-4 shrink-0 text-navy" aria-hidden />
          <label
            htmlFor={`${controlIdPrefix}-trains`}
            className="min-w-0 flex-1 cursor-pointer"
          >
            <span className="block text-sm font-medium text-ink">
              MRT and LRT
            </span>
            <span className="block text-xs text-muted-foreground">
              {trainStatus === "loading"
                ? "Loading LTA station locations"
                : trainStatus === "error"
                  ? "Station locations could not be loaded"
                  : trainStatus === "ready" && trainCount === 0
                    ? "No MRT or LRT locations available"
                    : trainStatus === "ready"
                      ? `${trainCount} named MRT/LRT station groups from LTA exit data`
                      : "Loaded when the map opens"}
            </span>
          </label>
          {trainStatus === "error" && mrtEnabled ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onRetryTrains}
              aria-label="Retry loading MRT and LRT stations"
            >
              <RefreshCw aria-hidden />
            </Button>
          ) : null}
          <Checkbox
            id={`${controlIdPrefix}-trains`}
            checked={mrtEnabled}
            onCheckedChange={(checked) => onMrtEnabledChange(checked === true)}
            aria-label="Show MRT and LRT stations"
          />
        </div>
        {trainDataset ? (
          <div className="mt-1.5">
            <SourceLine
              publisher="Land Transport Authority"
              retrievedAt={trainDataset.dataset.retrievedAt}
              sourceUrl={trainDataset.dataset.sourceUrl}
            />
          </div>
        ) : null}
      </section>

      <section aria-labelledby={`${controlIdPrefix}-daily-heading`}>
        <h3
          id={`${controlIdPrefix}-daily-heading`}
          className="mb-1.5 px-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
        >
          Daily needs
        </h3>
        <div className="flex items-center gap-3 rounded-lg bg-muted/45 px-3 py-2.5 transition-colors hover:bg-muted/70">
          <Soup className="size-4 shrink-0 text-teal-deep" aria-hidden />
          <label
            htmlFor={`${controlIdPrefix}-hawkers`}
            className="min-w-0 flex-1 cursor-pointer"
          >
            <span className="block text-sm font-medium text-ink">
              Hawker centres
            </span>
            <span className="block text-xs text-muted-foreground">
              {hawkerStatus === "loading"
                ? "Loading NEA locations"
                : hawkerStatus === "error"
                  ? "Locations could not be loaded"
                  : hawkerStatus === "ready" && hawkerCount === 0
                    ? "No locations in the current dataset"
                    : hawkerStatus === "ready"
                      ? `${hawkerCount} NEA locations`
                      : "Loaded only when switched on"}
            </span>
          </label>
          {hawkerStatus === "error" && hawkerEnabled ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onRetryHawkers}
              aria-label="Retry loading hawker centres"
            >
              <RefreshCw aria-hidden />
            </Button>
          ) : null}
          <Checkbox
            id={`${controlIdPrefix}-hawkers`}
            checked={hawkerEnabled}
            onCheckedChange={(checked) =>
              onHawkerEnabledChange(checked === true)
            }
            aria-label="Show hawker centres"
          />
        </div>

        {hawkerDataset ? (
          <div className="mt-1.5">
            <SourceLine
              publisher="National Environment Agency"
              retrievedAt={hawkerDataset.dataset.retrievedAt}
              sourceUrl={hawkerDataset.dataset.sourceUrl}
            />
          </div>
        ) : null}
      </section>

      <section aria-labelledby={`${controlIdPrefix}-family-heading`}>
        <h3
          id={`${controlIdPrefix}-family-heading`}
          className="mb-1.5 px-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
        >
          Family
        </h3>
        <div className="flex items-center gap-3 rounded-lg bg-muted/45 px-3 py-2.5 transition-colors hover:bg-muted/70">
          <School className="size-4 shrink-0 text-navy" aria-hidden />
          <label
            htmlFor={`${controlIdPrefix}-primary-schools`}
            className="min-w-0 flex-1 cursor-pointer"
          >
            <span className="block text-sm font-medium text-ink">
              Primary schools
            </span>
            <span className="block text-xs text-muted-foreground">
              {primarySchoolStatus === "loading"
                ? "Loading MOE school locations"
                : primarySchoolStatus === "error"
                  ? "School locations could not be loaded"
                  : primarySchoolStatus === "ready" &&
                      primarySchoolDataset?.items.length === 0
                    ? "No primary school locations available"
                    : primarySchoolStatus === "ready"
                      ? `${primarySchoolDataset?.coverage.schools} primary-level schools from MOE`
                      : "Loaded only when switched on"}
            </span>
          </label>
          {primarySchoolStatus === "error" && primarySchoolsEnabled ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onRetryPrimarySchools}
              aria-label="Retry loading primary schools"
            >
              <RefreshCw aria-hidden />
            </Button>
          ) : null}
          <Checkbox
            id={`${controlIdPrefix}-primary-schools`}
            checked={primarySchoolsEnabled}
            onCheckedChange={(checked) =>
              onPrimarySchoolsEnabledChange(checked === true)
            }
            aria-label="Show primary schools"
          />
        </div>
        {primarySchoolDataset ? (
          <div className="mt-1.5 flex flex-col gap-0.5">
            <SourceLine
              publisher="Ministry of Education"
              retrievedAt={primarySchoolDataset.dataset.retrievedAt}
              sourceUrl={primarySchoolDataset.dataset.sourceUrl}
            />
            <SourceLine
              publisher="Singapore Land Authority (OneMap)"
              retrievedAt={primarySchoolDataset.geocoder.retrievedAt}
              sourceUrl={primarySchoolDataset.geocoder.sourceUrl}
            />
          </div>
        ) : null}
      </section>

      <section aria-labelledby={`${controlIdPrefix}-lifestyle-heading`}>
        <h3
          id={`${controlIdPrefix}-lifestyle-heading`}
          className="mb-1.5 px-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
        >
          Lifestyle
        </h3>
        <div className="flex items-center gap-3 rounded-lg bg-muted/45 px-3 py-2.5 transition-colors hover:bg-muted/70">
          <TreePine className="size-4 shrink-0 text-teal-deep" aria-hidden />
          <label
            htmlFor={`${controlIdPrefix}-parks`}
            className="min-w-0 flex-1 cursor-pointer"
          >
            <span className="block text-sm font-medium text-ink">
              Parks and nature reserves
            </span>
            <span className="block text-xs text-muted-foreground">
              {parkStatus === "loading"
                ? "Loading NParks locations"
                : parkStatus === "error"
                  ? "Park locations could not be loaded"
                  : parkStatus === "ready" && parkDataset?.items.length === 0
                    ? "No park locations available"
                    : parkStatus === "ready"
                      ? `${parkDataset?.coverage.parks} NParks mapped areas`
                      : "Loaded only when switched on"}
            </span>
          </label>
          {parkStatus === "error" && parksEnabled ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onRetryParks}
              aria-label="Retry loading parks and nature reserves"
            >
              <RefreshCw aria-hidden />
            </Button>
          ) : null}
          <Checkbox
            id={`${controlIdPrefix}-parks`}
            checked={parksEnabled}
            onCheckedChange={(checked) =>
              onParksEnabledChange(checked === true)
            }
            aria-label="Show parks and nature reserves"
          />
        </div>
        {parkDataset ? (
          <div className="mt-1.5">
            <SourceLine
              publisher="National Parks Board"
              retrievedAt={parkDataset.dataset.retrievedAt}
              sourceUrl={parkDataset.dataset.sourceUrl}
            />
          </div>
        ) : null}
      </section>

      <p className="px-1 text-xs leading-relaxed text-muted-foreground">
        Dense layers appear as you zoom in. School markers are not official
        Primary 1 distance measurements.
      </p>
    </div>
  );
}

function MobileMapKey({
  showMrt,
  showHawkers,
  showPlannedHawkers,
  showParks,
  showPrimarySchools,
}: {
  showMrt: boolean;
  showHawkers: boolean;
  showPlannedHawkers: boolean;
  showParks: boolean;
  showPrimarySchools: boolean;
}) {
  return (
    <section
      className="mt-4 border-t border-border pt-4 lg:hidden"
      aria-label="Map key"
    >
      <h3 className="text-sm font-medium text-ink">Map key</h3>
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <span className="bto-map-legend__symbol" aria-hidden />
          Launched BTO
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            className="bto-map-legend__symbol"
            data-variant="announced"
            aria-hidden
          />
          Announced area
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            className="bto-map-legend__symbol"
            data-variant="sbf"
            aria-hidden
          />
          SBF town
        </span>
        {showMrt ? (
          <span className="inline-flex items-center gap-2">
            <AmenityMapSymbol kind="mrt" className="bto-mrt-legend__symbol" />
            MRT/LRT
          </span>
        ) : null}
        {showHawkers ? (
          <span className="inline-flex items-center gap-2">
            <AmenityMapSymbol
              kind="hawker"
              className="bto-hawker-legend__symbol"
            />
            Hawker centre
          </span>
        ) : null}
        {showPlannedHawkers ? (
          <span className="inline-flex items-center gap-2">
            <AmenityMapSymbol
              kind="hawker"
              className="bto-hawker-legend__symbol"
              variant="planned"
            />
            Planned hawker
          </span>
        ) : null}
        {showParks ? (
          <span className="inline-flex items-center gap-2">
            <AmenityMapSymbol kind="park" className="bto-park-legend__symbol" />
            Park area
          </span>
        ) : null}
        {showPrimarySchools ? (
          <span className="inline-flex items-center gap-2">
            <AmenityMapSymbol
              kind="school"
              className="bto-school-legend__symbol"
            />
            Primary school
          </span>
        ) : null}
      </div>
    </section>
  );
}

function LayersButton({
  activeCount,
  ...triggerProps
}: { activeCount: number } & ComponentProps<typeof Button>) {
  return (
    <Button
      {...triggerProps}
      variant="outline"
      size="sm"
      className="bg-surface/95 shadow-sm backdrop-blur-sm"
      aria-label={`Open map layers, ${activeCount} active`}
    >
      <Layers3 aria-hidden />
      Layers
      <span className="tnum grid size-5 place-items-center rounded-full bg-teal-subtle text-xs font-medium text-teal-deeper">
        {activeCount}
      </span>
    </Button>
  );
}

export function MapLayerControl(props: MapLayerControlProps) {
  const activeCount = activeMapLayerCount({
    mrt: props.mrtEnabled,
    hawker: props.hawkerEnabled,
    parks: props.parksEnabled,
    primarySchools: props.primarySchoolsEnabled,
  });
  const hasPlannedHawkers =
    props.hawkerDataset?.items.some((item) => item.status === "planned") ??
    false;

  return (
    <>
      <div className="absolute top-3 right-3 z-20 lg:hidden">
        <Drawer showSwipeHandle>
          <DrawerTrigger render={<LayersButton activeCount={activeCount} />} />
          <DrawerContent>
            <DrawerHeader className="border-b border-border px-4 pt-1 pb-4">
              <DrawerTitle>Map layers</DrawerTitle>
              <DrawerDescription>
                Choose the location information shown on the map.
              </DrawerDescription>
            </DrawerHeader>
            <div className="overflow-y-auto px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <LayerOptions {...props} controlIdPrefix="mobile-layer" />
              <MobileMapKey
                showMrt={props.mrtEnabled}
                showHawkers={
                  props.hawkerEnabled &&
                  (props.hawkerDataset?.items.length ?? 0) > 0
                }
                showPlannedHawkers={props.hawkerEnabled && hasPlannedHawkers}
                showParks={
                  props.parksEnabled &&
                  (props.parkDataset?.items.length ?? 0) > 0
                }
                showPrimarySchools={
                  props.primarySchoolsEnabled &&
                  (props.primarySchoolDataset?.items.length ?? 0) > 0
                }
              />
            </div>
          </DrawerContent>
        </Drawer>
      </div>

      <div className="absolute top-3 right-3 z-20 hidden lg:block">
        <Popover>
          <PopoverTrigger render={<LayersButton activeCount={activeCount} />} />
          <PopoverContent
            align="end"
            className="max-h-[min(42rem,calc(100svh-2rem))] w-80 overflow-y-auto p-3"
          >
            <PopoverHeader className="px-1 pb-1">
              <PopoverTitle>Map layers</PopoverTitle>
              <PopoverDescription>
                Choose the location information shown on the map.
              </PopoverDescription>
            </PopoverHeader>
            <LayerOptions {...props} controlIdPrefix="desktop-layer" />
          </PopoverContent>
        </Popover>
      </div>
    </>
  );
}
