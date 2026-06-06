"use client";

import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { MapIcon } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

import type { ItineraryItemDto } from "@/lib/trips/data";
import { cn } from "@/lib/utils";

type GoogleTripMapProps = {
  items: ItineraryItemDto[];
  onSelect: (itemId: string) => void;
  selectedItemId: string | null;
};

export function GoogleTripMap({
  items,
  onSelect,
  selectedItemId,
}: GoogleTripMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
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

  useEffect(() => {
    if (!apiKey || !containerRef.current || mappedItems.length === 0) {
      return;
    }

    let cancelled = false;
    const markers = markersRef.current;

    async function initializeMap() {
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

      mapRef.current = map;
      markers.clear();

      mappedItems.forEach((item, index) => {
        const position = {
          lat: item.place!.latitude!,
          lng: item.place!.longitude!,
        };
        const markerContent = document.createElement("button");
        markerContent.className =
          "grid size-9 place-items-center rounded-full border-2 border-white bg-primary font-bold text-primary-foreground shadow-lg transition-transform";
        markerContent.textContent = String(index + 1);
        markerContent.type = "button";
        markerContent.setAttribute(
          "aria-label",
          `Seleccionar ${item.place!.name}`,
        );
        markerContent.addEventListener("click", () => onSelect(item.id));

        const marker = new AdvancedMarkerElement({
          content: markerContent,
          map,
          position,
          title: item.place!.name,
        });

        markers.set(item.id, marker);
        bounds.extend(position);
      });

      map.fitBounds(bounds, 48);
    }

    void initializeMap();

    return () => {
      cancelled = true;
      markers.forEach((marker) => {
        marker.map = null;
      });
      markers.clear();
      mapRef.current = null;
    };
  }, [apiKey, mapId, mappedItems, onSelect]);

  useEffect(() => {
    markersRef.current.forEach((marker, itemId) => {
      const element = marker.content as HTMLElement | null;
      element?.classList.toggle("scale-125", itemId === selectedItemId);
    });

    const selectedItem = mappedItems.find(
      (item) => item.id === selectedItemId,
    );
    if (
      selectedItem?.place?.latitude != null &&
      selectedItem.place.longitude != null
    ) {
      mapRef.current?.panTo({
        lat: selectedItem.place.latitude,
        lng: selectedItem.place.longitude,
      });
    }
  }, [mappedItems, selectedItemId]);

  if (!apiKey) {
    return (
      <div className="grid min-h-96 place-items-center rounded-3xl border border-dashed bg-muted/50 p-8 text-center">
        <div className="max-w-sm">
          <MapIcon className="mx-auto mb-4 size-8 text-primary" />
          <p className="font-heading text-xl font-semibold">
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
        <div className="h-[32rem] w-full" ref={containerRef} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Este día todavía no tiene lugares con coordenadas.
        </p>
      )}
    </div>
  );
}
