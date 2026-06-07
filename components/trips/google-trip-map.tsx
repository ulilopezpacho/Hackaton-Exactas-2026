"use client";

import { FocusIcon, MapIcon } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

import type { ItineraryItemDto } from "@/lib/trips/data";
import { cn } from "@/lib/utils";

type GoogleTripMapProps = {
  heightClassName?: string;
  items: ItineraryItemDto[];
  onSelect: (itemId: string) => void;
  selectedItemId: string | null;
  showAllControl?: boolean;
};

const MARKER_COLORS = ["#0B5D4B", "#C9472E", "#2F6F91", "#9A6A20", "#755A8A"];
const NEARBY_THRESHOLD = 0.003;
const SPREAD_RADIUS = 0.0035;
const CLEAN_MAP_STYLES: google.maps.MapTypeStyle[] = [
  {
    featureType: "administrative",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "poi",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "transit",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "road",
    elementType: "labels.icon",
    stylers: [{ visibility: "off" }],
  },
];

type MapPosition = {
  lat: number;
  lng: number;
};

function spreadNearbyPositions(items: ItineraryItemDto[]) {
  const positions = items.map<MapPosition>((item) => ({
    lat: item.place!.latitude!,
    lng: item.place!.longitude!,
  }));
  const visited = new Set<number>();

  positions.forEach((position, index) => {
    if (visited.has(index)) {
      return;
    }

    const cluster = positions
      .map((candidate, candidateIndex) => ({
        candidateIndex,
        distance: Math.hypot(
          candidate.lat - position.lat,
          (candidate.lng - position.lng) *
            Math.cos((position.lat * Math.PI) / 180),
        ),
      }))
      .filter(({ distance }) => distance < NEARBY_THRESHOLD)
      .map(({ candidateIndex }) => candidateIndex);

    cluster.forEach((clusterIndex) => visited.add(clusterIndex));

    if (cluster.length < 2) {
      return;
    }

    const center = cluster.reduce(
      (result, clusterIndex) => ({
        lat: result.lat + positions[clusterIndex].lat / cluster.length,
        lng: result.lng + positions[clusterIndex].lng / cluster.length,
      }),
      { lat: 0, lng: 0 },
    );

    cluster.forEach((clusterIndex, clusterPosition) => {
      const angle =
        -Math.PI / 2 + (clusterPosition * Math.PI * 2) / cluster.length;
      positions[clusterIndex] = {
        lat: center.lat + Math.sin(angle) * SPREAD_RADIUS,
        lng:
          center.lng +
          (Math.cos(angle) * SPREAD_RADIUS) /
            Math.cos((center.lat * Math.PI) / 180),
      };
    });
  });

  return positions;
}

export function GoogleTripMap({
  heightClassName = "h-[32rem]",
  items,
  onSelect,
  selectedItemId,
  showAllControl = true,
}: GoogleTripMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const selectedItemIdRef = useRef(selectedItemId);
  const boundsRef = useRef<google.maps.LatLngBounds | null>(null);
  const routeRef = useRef<google.maps.Polyline | null>(null);
  const markersRef = useRef<
    Map<string, google.maps.marker.AdvancedMarkerElement>
  >(new Map());
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID;
  const mappedItems = useMemo(
    () =>
      items.filter(
        (item) =>
          item.place?.latitude != null && item.place?.longitude != null,
      ),
    [items],
  );
  const displayPositions = useMemo(
    () => spreadNearbyPositions(mappedItems),
    [mappedItems],
  );

  useEffect(() => {
    selectedItemIdRef.current = selectedItemId;
  }, [selectedItemId]);

  function showAllMarkers() {
    if (mapRef.current && boundsRef.current) {
      mapRef.current.fitBounds(boundsRef.current, 48);
    }
  }

  useEffect(() => {
    if (!apiKey || !containerRef.current || mappedItems.length === 0) {
      return;
    }

    let cancelled = false;
    const markers = markersRef.current;

    async function initializeMap() {
      const { importLibrary, setOptions } = await import(
        "@googlemaps/js-api-loader"
      );

      setOptions({
        authReferrerPolicy: "origin",
        key: apiKey,
        language: "es",
        region: "ES",
        v: "weekly",
      });

      const [{ Map: GoogleMap }, { AdvancedMarkerElement }] =
        await Promise.all([
          importLibrary("maps"),
          importLibrary("marker"),
        ]);

      if (cancelled || !containerRef.current) {
        return;
      }

      const bounds = new google.maps.LatLngBounds();
      const map = new GoogleMap(containerRef.current, {
        disableDefaultUI: true,
        gestureHandling: "cooperative",
        mapId: mapId || "DEMO_MAP_ID",
        zoomControl: true,
      });

      if (!mapId) {
        map.setOptions({ styles: CLEAN_MAP_STYLES });
      }

      mapRef.current = map;
      markers.clear();

      mappedItems.forEach((item, index) => {
        const position = displayPositions[index];
        const color = MARKER_COLORS[index % MARKER_COLORS.length];
        const selected = item.id === selectedItemIdRef.current;
        const markerContent = document.createElement("button");
        markerContent.className =
          "grid size-9 place-items-center rounded-full border-2 border-white font-bold text-white shadow-lg transition-all";
        markerContent.textContent = String(index + 1);
        markerContent.type = "button";
        markerContent.dataset.markerColor = color;
        markerContent.style.backgroundColor = selected ? "#FFFFFF" : color;
        markerContent.style.borderColor = selected ? color : "#FFFFFF";
        markerContent.style.color = selected ? color : "#FFFFFF";
        markerContent.classList.toggle("scale-125", selected);
        markerContent.setAttribute(
          "aria-label",
          `Seleccionar ${item.place!.name}`,
        );
        markerContent.addEventListener("click", () => onSelect(item.id));

        const marker = new AdvancedMarkerElement({
          collisionBehavior: google.maps.CollisionBehavior.REQUIRED,
          content: markerContent,
          map,
          position,
          title: item.place!.name,
          zIndex: selected
            ? mappedItems.length + 10
            : mappedItems.length - index,
        });

        markers.set(item.id, marker);
        bounds.extend(position);
      });

      routeRef.current = new google.maps.Polyline({
        clickable: false,
        geodesic: true,
        icons: [
          {
            icon: {
              path: "M 0,-1 0,1",
              scale: 2.5,
              strokeColor: "#0B5D4B",
              strokeOpacity: 0.75,
              strokeWeight: 2,
            },
            offset: "0",
            repeat: "14px",
          },
        ],
        map,
        path: displayPositions,
        strokeOpacity: 0,
        zIndex: 1,
      });
      boundsRef.current = bounds;
      map.fitBounds(bounds, 48);
    }

    void initializeMap();

    return () => {
      cancelled = true;
      markers.forEach((marker) => {
        marker.map = null;
      });
      markers.clear();
      routeRef.current?.setMap(null);
      routeRef.current = null;
      boundsRef.current = null;
      mapRef.current = null;
    };
  }, [apiKey, displayPositions, mapId, mappedItems, onSelect]);

  useEffect(() => {
    markersRef.current.forEach((marker, itemId) => {
      const element = marker.content as HTMLElement | null;
      const selected = itemId === selectedItemId;

      if (!element) {
        return;
      }

      element.classList.toggle("scale-125", selected);
      element.style.backgroundColor = selected
        ? "#FFFFFF"
        : element.dataset.markerColor!;
      element.style.borderColor = selected
        ? element.dataset.markerColor!
        : "#FFFFFF";
      element.style.color = selected
        ? element.dataset.markerColor!
        : "#FFFFFF";
      const itemIndex = mappedItems.findIndex((item) => item.id === itemId);
      marker.zIndex = selected
        ? mappedItems.length + 10
        : mappedItems.length - itemIndex;
    });

    const selectedIndex = mappedItems.findIndex(
      (item) => item.id === selectedItemId,
    );
    if (selectedIndex >= 0) {
      mapRef.current?.panTo(displayPositions[selectedIndex]);
    }
  }, [displayPositions, mappedItems, selectedItemId]);

  if (!apiKey) {
    return (
      <div className="grid min-h-96 place-items-center rounded-3xl border border-dashed bg-muted/50 p-8 text-center">
        <div className="max-w-sm">
          <MapIcon className="mx-auto mb-4 size-8 text-primary" />
          <p className="text-xl font-semibold">
            El mapa está listo para conectarse
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Configurá `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` y
            `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "min-h-96 overflow-hidden rounded-3xl border bg-muted shadow-sm",
        mappedItems.length === 0 && "grid place-items-center p-8",
      )}
    >
      {mappedItems.length ? (
        <div className={cn("relative w-full", heightClassName)}>
          <div className="h-full w-full" ref={containerRef} />
          {showAllControl ? (
            <button
              aria-label="Ver todas las paradas"
              className="absolute right-3 top-3 z-10 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground shadow-md transition-colors hover:bg-secondary"
              onClick={showAllMarkers}
              type="button"
            >
              <FocusIcon className="size-4" />
              Ver todo
            </button>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Este día todavía no tiene lugares con coordenadas.
        </p>
      )}
    </div>
  );
}
