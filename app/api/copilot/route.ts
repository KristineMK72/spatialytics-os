import { NextResponse } from 'next/server';
import { queryGeoJSON } from '@/lib/db';

// Demo tenant ID from schema seed
const DEMO_TENANT = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

export async function POST(req: Request) {
  try {
    const { prompt, tenantId = DEMO_TENANT } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const lower = prompt.toLowerCase();
    let geoJson: GeoJSON.FeatureCollection;

    if (lower.includes('customer') || lower.includes('cluster') || lower.includes('value')) {
      try {
        const result = await queryGeoJSON(
          `SELECT cluster_customers($1) AS geojson`,
          [tenantId]
        );
        geoJson = result;
      } catch {
        geoJson = await queryGeoJSON(
          `
          SELECT json_build_object(
            'type', 'FeatureCollection',
            'features', COALESCE(json_agg(
              json_build_object(
                'type', 'Feature',
                'geometry', ST_AsGeoJSON(geom)::json,
                'properties', json_build_object(
                  'id', id,
                  'name', customer_name,
                  'ltv', lifetime_value,
                  'tier', tier
                )
              )
            ), '[]'::json)
          ) AS geojson
          FROM customers
          WHERE tenant_id = $1 AND geom IS NOT NULL
          `,
          [tenantId]
        );
      }
    } else if (lower.includes('site') || lower.includes('store') || lower.includes('score') || lower.includes('location')) {
      geoJson = await queryGeoJSON(
        `
        SELECT json_build_object(
          'type', 'FeatureCollection',
          'features', COALESCE(json_agg(
            json_build_object(
              'type', 'Feature',
              'geometry', ST_AsGeoJSON(geom)::json,
              'properties', json_build_object(
                'id', id,
                'name', name,
                'vitality_score', vitality_score,
                'address', address
              )
            )
          ), '[]'::json)
        ) AS geojson
        FROM stores
        WHERE tenant_id = $1 AND is_active = TRUE
        `,
        [tenantId]
      );
    } else if (lower.includes('trade') || lower.includes('area') || lower.includes('catchment')) {
      geoJson = await queryGeoJSON(
        `
        SELECT json_build_object(
          'type', 'FeatureCollection',
          'features', COALESCE(json_agg(
            json_build_object(
              'type', 'Feature',
              'geometry', ST_AsGeoJSON(geom)::json,
              'properties', json_build_object(
                'zone_name', zone_name,
                'type', 'trade_area'
              )
            )
          ), '[]'::json)
        ) AS geojson
        FROM trade_areas
        WHERE tenant_id = $1
        `,
        [tenantId]
      );
    } else {
      geoJson = await queryGeoJSON(
        `
        SELECT json_build_object(
          'type', 'FeatureCollection',
          'features', COALESCE(json_agg(
            json_build_object(
              'type', 'Feature',
              'geometry', ST_AsGeoJSON(geom)::json,
              'properties', json_build_object(
                'name', name,
                'vitality_score', vitality_score
              )
            )
          ), '[]'::json)
        ) AS geojson
        FROM stores
        WHERE tenant_id = $1
        `,
        [tenantId]
      );
    }

    return NextResponse.json({ success: true, geoJson });
  } catch (error: any) {
    console.error('Spatial Copilot Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Database error' },
      { status: 500 }
    );
  }
}
