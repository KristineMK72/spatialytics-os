'use client';

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
  center = [-94.6859, 46.3527], // Central Minnesota
  zoom = 10,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<maplibregl.Map | null>(null);
  const sourceId = 'dynamic-spatial-layer';

  // Initialize map once
  useEffect(() => {
    if (!mapContainer.current || mapInstance.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://demotiles.maplibre.org/style.json',
      center,
      zoom,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'imperial' }), 'bottom-left');

    mapInstance.current = map;

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, [center, zoom]);

  // Sync GeoJSON layer
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !geoJsonData) return;

    const update = () => {
      if (map.getSource(sourceId)) {
        (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(geoJsonData);
      } else {
        map.addSource(sourceId, {
          type: 'geojson',
          data: geoJsonData,
        });

        map.addLayer({
          id: 'spatial-layer-fill',
          type: 'fill',
          source: sourceId,
          filter: ['==', ['geometry-type'], 'Polygon'],
          paint: {
            'fill-color': '#0284c7',
            'fill-opacity': 0.35,
            'fill-outline-color': '#38bdf8',
          },
        });

        map.addLayer({
          id: 'spatial-layer-line',
          type: 'line',
          source: sourceId,
          filter: ['==', ['geometry-type'], 'LineString'],
          paint: {
            'line-color': '#0ea5e9',
            'line-width': 3,
            'line-opacity': 0.9,
          },
        });

        map.addLayer({
          id: 'spatial-layer-points',
          type: 'circle',
          source: sourceId,
          filter: ['==', ['geometry-type'], 'Point'],
          paint: {
            'circle-radius': [
              'case',
              ['has', 'cluster_id'],
              10,
              7,
            ],
            'circle-color': [
              'case',
              ['==', ['get', 'tier'], 'Top 20%'],
              '#f59e0b',
              ['has', 'cluster_id'],
              '#38bdf8',
              '#0ea5e9',
            ],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
            'circle-opacity': 0.9,
          },
        });
      }
    };

    if (map.isStyleLoaded()) {
      update();
    } else {
      map.once('load', update);
    }
  }, [geoJsonData]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="absolute inset-0 w-full h-full" />
    </div>
  );
}
