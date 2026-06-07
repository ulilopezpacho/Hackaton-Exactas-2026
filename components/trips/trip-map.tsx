"use client";

import { FocusIcon } from "lucide-react";
import maplibregl, {
  type LngLatBounds,
  type Map as MapLibreMap,
  type Marker,
} from "maplibre-gl";
import { useEffect, useMemo, useRef } from "react";

import type { ItineraryItemDto } from "@/lib/trips/data";
import { cn } from "@/lib/utils";

type TripMapProps = {
  heightClassName?: string;
  items: ItineraryItemDto[];
  onSelect: (itemId: string) => void;
  selectedItemId: string | null;
  selectedZoom?: number;
  showAllControl?: boolean;
};

const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const ROUTE_SOURCE_ID = "trip-route";
const ROUTE_LAYER_ID = "trip-route";
const MARKER_COLORS = ["#0B5D4B", "#C9472E", "#2F6F91", "#9A6A20", "#755A8A"];

type MapPosition = {
  lat: number;
  lng: number;
};

type TripMarker = {
  button: HTMLButtonElement;
  marker: Marker;
  wrapper: HTMLDivElement;
};

function getMapPositions(items: ItineraryItemDto[]) {
  return items.map<MapPosition>((item) => ({
    lat: item.place!.latitude!,
    lng: item.place!.longitude!,
  }));
}

function markerZIndex(selected: boolean, index: number, count: number) {
  return selected ? count + 10 : count - index;
}

export function TripMap({
  heightClassName = "h-[32rem]",
  items,
  onSelect,
  selectedItemId,
  selectedZoom,
  showAllControl = true,
}: TripMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const boundsRef = useRef<LngLatBounds | null>(null);
  const markersRef = useRef<Map<string, TripMarker>>(new Map());
  const selectedItemIdRef = useRef(selectedItemId);
  const selectedZoomRef = useRef(selectedZoom);
  const mappedItems = useMemo(
    () =>
      items.filter(
        (item) =>
          item.place?.latitude != null && item.place?.longitude != null,
      ),
    [items],
  );
  const displayPositions = useMemo(
    () => getMapPositions(mappedItems),
    [mappedItems],
  );

  useEffect(() => {
    selectedItemIdRef.current = selectedItemId;
  }, [selectedItemId]);

  useEffect(() => {
    selectedZoomRef.current = selectedZoom;
  }, [selectedZoom]);

  function showAllMarkers() {
    if (mapRef.current && boundsRef.current) {
      mapRef.current.fitBounds(boundsRef.current, {
        duration: 500,
        padding: 48,
      });
    }
  }

  useEffect(() => {
    if (!containerRef.current || mappedItems.length === 0) {
      return;
    }

    const firstPosition = displayPositions[0];
    const bounds = new maplibregl.LngLatBounds();
    const markers = markersRef.current;
    const map = new maplibregl.Map({
      bearing: 0,
      center: [firstPosition.lng, firstPosition.lat],
      container: containerRef.current,
      cooperativeGestures: true,
      dragRotate: false,
      maxPitch: 0,
      pitch: 0,
      pitchWithRotate: false,
      style: MAP_STYLE,
      touchPitch: false,
      zoom: 12,
    });

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "bottom-right",
    );

    mappedItems.forEach((item, index) => {
      const position = displayPositions[index];
      const color = MARKER_COLORS[index % MARKER_COLORS.length];
      const selected = item.id === selectedItemIdRef.current;
      const wrapper = document.createElement("div");
      const button = document.createElement("button");
      button.className =
        "grid size-9 place-items-center rounded-full border-2 font-bold shadow-lg transition-all";
      button.textContent = String(index + 1);
      button.type = "button";
      button.dataset.markerColor = color;
      button.style.backgroundColor = selected ? "#FFFFFF" : color;
      button.style.borderColor = selected ? color : "#FFFFFF";
      button.style.color = selected ? color : "#FFFFFF";
      wrapper.style.zIndex = String(
        markerZIndex(selected, index, mappedItems.length),
      );
      button.classList.toggle("scale-125", selected);
      button.setAttribute("aria-label", `Seleccionar ${item.place!.name}`);
      button.addEventListener("click", () => onSelect(item.id));
      wrapper.append(button);

      const marker = new maplibregl.Marker({
        anchor: "center",
        element: wrapper,
      })
        .setLngLat([position.lng, position.lat])
        .addTo(map);

      markers.set(item.id, { button, marker, wrapper });
      bounds.extend([position.lng, position.lat]);
    });

    boundsRef.current = bounds;

    map.on("load", () => {
      map.addSource(ROUTE_SOURCE_ID, {
        data: {
          geometry: {
            coordinates: displayPositions.map(({ lat, lng }) => [lng, lat]),
            type: "LineString",
          },
          properties: {},
          type: "Feature",
        },
        type: "geojson",
      });
      map.addLayer({
        id: ROUTE_LAYER_ID,
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": "#0B5D4B",
          "line-dasharray": [1.5, 2],
          "line-opacity": 0.75,
          "line-width": 3,
        },
        source: ROUTE_SOURCE_ID,
        type: "line",
      });

      map.fitBounds(bounds, { duration: 0, padding: 48 });

      const selectedIndex = mappedItems.findIndex(
        (item) => item.id === selectedItemIdRef.current,
      );
      if (selectedZoomRef.current && selectedIndex >= 0) {
        const selectedPosition = displayPositions[selectedIndex];
        map.jumpTo({
          center: [selectedPosition.lng, selectedPosition.lat],
          zoom: selectedZoomRef.current,
        });
      }
    });

    mapRef.current = map;

    return () => {
      markers.forEach(({ marker }) => marker.remove());
      markers.clear();
      boundsRef.current = null;
      mapRef.current = null;
      map.remove();
    };
  }, [displayPositions, mappedItems, onSelect]);

  useEffect(() => {
    markersRef.current.forEach(({ button, wrapper }, itemId) => {
      const selected = itemId === selectedItemId;
      const itemIndex = mappedItems.findIndex((item) => item.id === itemId);
      const color = button.dataset.markerColor!;

      button.classList.toggle("scale-125", selected);
      button.style.backgroundColor = selected ? "#FFFFFF" : color;
      button.style.borderColor = selected ? color : "#FFFFFF";
      button.style.color = selected ? color : "#FFFFFF";
      wrapper.style.zIndex = String(
        markerZIndex(selected, itemIndex, mappedItems.length),
      );
    });

    const selectedIndex = mappedItems.findIndex(
      (item) => item.id === selectedItemId,
    );
    const map = mapRef.current;

    if (map && selectedIndex >= 0) {
      const position = displayPositions[selectedIndex];
      map.easeTo({
        center: [position.lng, position.lat],
        duration: 400,
        zoom: selectedZoom ?? map.getZoom(),
      });
    }
  }, [displayPositions, mappedItems, selectedItemId, selectedZoom]);

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
