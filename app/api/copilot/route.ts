import { NextResponse } from 'next/server';
import { queryGeoJSON, query } from '@/lib/db';

const PILOT_TENANT = '4b22a069-7535-4e05-aa8c-2e2989704652';
const DEMO_TENANT = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

async function fetchLayer(
  layer: 'stores' | 'customers' | 'competitors' | 'trade_areas',
  tenantId: string
): Promise<GeoJSON.FeatureCollection> {
  if (layer === 'customers') {
    try {
      return await queryGeoJSON(`SELECT cluster_customers($1) AS geojson`, [tenantId]);
    } catch {
      return await queryGeoJSON(
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
  }

  if (layer === 'competitors') {
    return await queryGeoJSON(
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
      WHERE (tenant_id = $1 OR tenant_id IS NULL) AND geom IS NOT NULL
      LIMIT 2000
      `,
      [tenantId]
    );
  }

  if (layer === 'trade_areas') {
    return await queryGeoJSON(
      `
      SELECT json_build_object(
        'type', 'FeatureCollection',
        'features', COALESCE(json_agg(
          json_build_object(
            'type', 'Feature',
            'geometry', ST_AsGeoJSON(geom)::json,
            'properties', json_build_object(
              'id', id,
              'zone_name', COALESCE(zone_name, 'Trade Area'),
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
  }

  // stores (default)
  return await queryGeoJSON(
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
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt: string = (body.prompt || '').toLowerCase();
    let tenantId: string = body.tenantId || PILOT_TENANT;

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    if (prompt.includes('demo coffee') || prompt.includes('demo tenant')) {
      tenantId = DEMO_TENANT;
    }

    let layer: 'stores' | 'customers' | 'competitors' | 'trade_areas' = 'stores';

    if (prompt.includes('customer') || prompt.includes('cluster') || prompt.includes('value')) {
      layer = 'customers';
    } else if (prompt.includes('competitor') || prompt.includes('rival') || prompt.includes('competition')) {
      layer = 'competitors';
    } else if (prompt.includes('trade') || prompt.includes('area') || prompt.includes('catchment') || prompt.includes('polygon')) {
      layer = 'trade_areas';
    } else if (prompt.includes('store') || prompt.includes('site') || prompt.includes('score') || prompt.includes('location') || prompt.includes('all')) {
      layer = 'stores';
    }

    // Try requested tenant first
    let geoJson = await fetchLayer(layer, tenantId);
    let usedTenant = tenantId;

    // If empty, try the other tenant automatically
    if ((!geoJson.features || geoJson.features.length === 0) && tenantId === PILOT_TENANT) {
      const fallback = await fetchLayer(layer, DEMO_TENANT);
      if (fallback.features && fallback.features.length > 0) {
        geoJson = fallback;
        usedTenant = DEMO_TENANT;
      }
    } else if ((!geoJson.features || geoJson.features.length === 0) && tenantId === DEMO_TENANT) {
      const fallback = await fetchLayer(layer, PILOT_TENANT);
      if (fallback.features && fallback.features.length > 0) {
        geoJson = fallback;
        usedTenant = PILOT_TENANT;
      }
    }

    // Last resort: pull ALL records for that layer (ignore tenant)
    if (!geoJson.features || geoJson.features.length === 0) {
      if (layer === 'stores') {
        geoJson = await queryGeoJSON(`
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
                  'address', address,
                  'tenant_id', tenant_id
                )
              )
            ), '[]'::json)
          ) AS geojson
          FROM stores
          WHERE geom IS NOT NULL
          LIMIT 2000
        `);
        usedTenant = 'all';
      } else if (layer === 'competitors') {
        geoJson = await queryGeoJSON(`
          SELECT json_build_object(
            'type', 'FeatureCollection',
            'features', COALESCE(json_agg(
              json_build_object(
                'type', 'Feature',
                'geometry', ST_AsGeoJSON(geom)::json,
                'properties', json_build_object(
                  'id', id,
                  'name', name,
                  'category', category
                )
              )
            ), '[]'::json)
          ) AS geojson
          FROM competitors
          WHERE geom IS NOT NULL
          LIMIT 2000
        `);
        usedTenant = 'all';
      } else if (layer === 'trade_areas') {
        geoJson = await queryGeoJSON(`
          SELECT json_build_object(
            'type', 'FeatureCollection',
            'features', COALESCE(json_agg(
              json_build_object(
                'type', 'Feature',
                'geometry', ST_AsGeoJSON(geom)::json,
                'properties', json_build_object(
                  'id', id,
                  'zone_name', COALESCE(zone_name, 'Trade Area')
                )
              )
            ), '[]'::json)
          ) AS geojson
          FROM trade_areas
          WHERE geom IS NOT NULL
          LIMIT 1000
        `);
        usedTenant = 'all';
      }
    }

    const count = geoJson?.features?.length ?? 0;

    return NextResponse.json({
      success: true,
      geoJson,
      meta: {
        layer,
        tenantId: usedTenant,
        featureCount: count,
      },
    });
  } catch (error: any) {
    console.error('Spatial Copilot Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Database error' },
      { status: 500 }
    );
  }
}
