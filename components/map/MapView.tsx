'use client';

import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface MapViewProps {
  geoJsonData?: GeoJSON.FeatureCollection | null;
  center?: [number, number];
  zoom?: number;
  onFeatureClick?: (feature: GeoJSON.Feature) => void;
}

export default function MapView({
  geoJsonData,
  center = [-94.6859, 46.3527],
  zoom = 8,
  onFeatureClick,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<maplibregl.Map | null>(null);
  const clickHandlerRef = useRef(onFeatureClick);
  const sourceId = 'dynamic-spatial-layer';

  useEffect(() => {
    clickHandlerRef.current = onFeatureClick;
  }, [onFeatureClick]);

  useEffect(() => {
    if (!mapContainer.current || mapInstance.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center,
      zoom,
      attributionControl: { compact: true },
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'imperial' }), 'bottom-left');
    mapInstance.current = map;

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, [center, zoom]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !geoJsonData) return;

    const update = () => {
      if (map.getSource(sourceId)) {
        (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(geoJsonData);
      } else {
        map.addSource(sourceId, { type: 'geojson', data: geoJsonData });

        map.addLayer({
          id: 'spatial-layer-fill',
          type: 'fill',
          source: sourceId,
          filter: ['==', ['geometry-type'], 'Polygon'],
          paint: { 'fill-color': '#0284c7', 'fill-opacity': 0.25, 'fill-outline-color': '#38bdf8' },
        });
        map.addLayer({
          id: 'spatial-layer-outline',
          type: 'line',
          source: sourceId,
          filter: ['==', ['geometry-type'], 'Polygon'],
          paint: { 'line-color': '#0ea5e9', 'line-width': 1.5, 'line-opacity': 0.8 },
        });
        map.addLayer({
          id: 'spatial-layer-line',
          type: 'line',
          source: sourceId,
          filter: ['==', ['geometry-type'], 'LineString'],
          paint: { 'line-color': '#0ea5e9', 'line-width': 3, 'line-opacity': 0.9 },
        });
        map.addLayer({
          id: 'spatial-layer-points',
          type: 'circle',
          source: sourceId,
          filter: ['==', ['geometry-type'], 'Point'],
          paint: {
            'circle-radius': ['case', ['has', 'vitality_score'], 8, ['has', 'cluster_id'], 8, 6],
            'circle-color': [
              'case',
              ['==', ['get', 'tier'], 'Top 20%'], '#f59e0b',
              ['has', 'vitality_score'], '#22c55e',
              ['has', 'category'], '#f43f5e',
              '#0ea5e9',
            ],
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#ffffff',
            'circle-opacity': 0.9,
          },
        });

        ['spatial-layer-points', 'spatial-layer-fill', 'spatial-layer-outline'].forEach((layerId) => {
          map.on('click', layerId, (e) => {
            const feature = e.features?.[0];
            if (feature) clickHandlerRef.current?.(feature as unknown as GeoJSON.Feature);
          });
          map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
          map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
        });
      }

      if (geoJsonData.features && geoJsonData.features.length > 0) {
        try {
          const bounds = new maplibregl.LngLatBounds();
          let hasCoords = false;
          geoJsonData.features.forEach((f) => {
            if (!f.geometry) return;
            const g = f.geometry as any;
            if (g.type === 'Point' && Array.isArray(g.coordinates)) {
              bounds.extend(g.coordinates as [number, number]);
              hasCoords = true;
            } else if (g.type === 'Polygon' && g.coordinates?.[0]) {
              g.coordinates[0].forEach((c: number[]) => { bounds.extend(c as [number, number]); hasCoords = true; });
            } else if (g.type === 'MultiPolygon') {
              g.coordinates.forEach((poly: number[][][]) => {
                poly[0]?.forEach((c: number[]) => { bounds.extend(c as [number, number]); hasCoords = true; });
              });
            }
          });
          if (hasCoords && !bounds.isEmpty()) {
            map.fitBounds(bounds, { padding: 60, maxZoom: 12, duration: 800 });
          }
        } catch (e) {
          console.warn('Could not fit bounds', e);
        }
      }
    };

    if (map.isStyleLoaded()) update();
    else map.once('load', update);
  }, [geoJsonData]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="absolute inset-0 w-full h-full" />
    </div>
  );
}
