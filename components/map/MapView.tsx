'use-client';

import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface MapViewProps {
  geoJsonData?: GeoJSON.FeatureCollection | null;
  center?: [number, number];
  zoom?: number;
}

export default function MapView({ 
  geoJsonData, 
  center = [-94.6859, 46.3527], // Default center (e.g., Minnesota area)
  zoom = 11 
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!mapContainer.current || mapInstance.current) return;

    // Initialize MapLibre GL JS with a clean open-source vector style
    mapInstance.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://demotiles.maplibre.org/style.json', // Lightweight default style
      center: center,
      zoom: zoom,
    });

    mapInstance.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    return () => {
      mapInstance.current?.remove();
      mapInstance.current = null;
    };
  }, []);

  // Update dynamic layers when new GeoJSON results stream in from the AI copilot or queries
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !geoJsonData) return;

    const sourceId = 'dynamic-spatial-layer';

    if (map.getSource(sourceId)) {
      (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(geoJsonData);
    } else {
      map.on('load', () => {
        map.addSource(sourceId, {
          type: 'geojson',
          data: geoJsonData,
        });

        map.addLayer({
          id: 'spatial-layer-fill',
          type: 'fill',
          source: sourceId,
          filter: ['==', '$type', 'Polygon'],
          paint: {
            'fill-color': '#0284c7',
            'fill-opacity': 0.4,
          },
        });

        map.addLayer({
          id: 'spatial-layer-points',
          type: 'circle',
          source: sourceId,
          filter: ['==', '$type', 'Point'],
          paint: {
            'circle-radius': 8,
            'circle-color': '#0ea5e9',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        });
      });
    }
  }, [geoJsonData]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="absolute inset-0 w-full h-full" />
    </div>
  );
}
