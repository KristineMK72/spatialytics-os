import { NextResponse } from 'next/server';
import { queryGeoJSON, query } from '@/lib/db';

// Prefer the tenant that has the bulk of the data (Spatialytics Pilot)
const DEFAULT_TENANT = '4b22a069-7535-4e05-aa8c-2e2989704652'; // Spatialytics Pilot
const DEMO_TENANT = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';   // Demo Coffee Co

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt: string = body.prompt || '';
    let tenantId: string = body.tenantId || DEFAULT_TENANT;

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const lower = prompt.toLowerCase();

    // Allow switching tenant via natural language
    if (lower.includes('demo coffee') || lower.includes('demo tenant')) {
      tenantId = DEMO_TENANT;
    }

    let geoJson: GeoJSON.FeatureCollection;
    let meta: Record<string, any> = { tenantId };

    if (lower.includes('customer') || lower.includes('cluster') || lower.includes('value')) {
      try {
        geoJson = await queryGeoJSON(`SELECT cluster_customers($1) AS geojson`, [tenantId]);
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
      meta.layer = 'customers';
    } else if (
      lower.includes('competitor') ||
      lower.includes('rival') ||
      lower.includes('competition')
    ) {
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
                'address', address,
                'source', source
              )
            )
          ), '[]'::json)
        ) AS geojson
        FROM competitors
        WHERE (tenant_id = $1 OR tenant_id IS NULL) AND geom IS NOT NULL
        LIMIT 2000
        `,
        [tenantId]
      );
      meta.layer = 'competitors';
    } else if (
      lower.includes('trade') ||
      lower.includes('area') ||
      lower.includes('catchment') ||
      lower.includes('polygon')
    ) {
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
                'zone_name', zone_name,
                'type', 'trade_area'
              )
            )
          ), '[]'::json)
        ) AS geojson
        FROM trade_areas
        WHERE tenant_id = $1 AND geom IS NOT NULL
        LIMIT 1000
        `,
        [tenantId]
      );
      meta.layer = 'trade_areas';
    } else if (
      lower.includes('site') ||
      lower.includes('store') ||
      lower.includes('score') ||
      lower.includes('location') ||
      lower.includes('all')
    ) {
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
        WHERE tenant_id = $1 AND geom IS NOT NULL
        `,
        [tenantId]
      );
      meta.layer = 'stores';
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
                'vitality_score', vitality_score,
                'address', address
              )
            )
          ), '[]'::json)
        ) AS geojson
        FROM stores
        WHERE tenant_id = $1 AND geom IS NOT NULL
        `,
        [tenantId]
      );
      meta.layer = 'stores';
    }

    const count = geoJson?.features?.length ?? 0;

    return NextResponse.json({
      success: true,
      geoJson,
      meta: { ...meta, featureCount: count },
    });
  } catch (error: any) {
    console.error('Spatial Copilot Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Database error' },
      { status: 500 }
    );
  }
}
