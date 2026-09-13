import { NextResponse } from 'next/server';
import { queryGeoJSON } from '@/lib/db';

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
    } else if (lower.includes('competitor') || lower.includes('market') || lower.includes('retail') || lower.includes('commercial')) {
      // Query competitors table where OSM commercial points live
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
                'category', category,
                'address', address
              )
            )
          ), '[]'::json)
        ) AS geojson
        FROM competitors
        WHERE tenant_id = $1 OR tenant_id = '4b22a069-7535-4e05-aa8c-2e2989704652'
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
        WHERE tenant_id = $1 OR tenant_id = '4b22a069-7535-4e05-aa8c-2e2989704652'
        `,
        [tenantId]
      );
    } else {
      // Default: Pull all active stores across both tenants
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
        WHERE (tenant_id = $1 OR tenant_id = '4b22a069-7535-4e05-aa8c-2e2989704652')
          AND is_active = TRUE
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
