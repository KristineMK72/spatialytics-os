import { NextResponse } from 'next/server';
import { queryGeoJSON, query } from '@/lib/db';

//
// ──────────────────────────────────────────────────────────────
//   CONFIG
// ──────────────────────────────────────────────────────────────
//

const PILOT_TENANT = '4b22a069-7535-4e05-aa8c-2e2989704652';
const DEMO_TENANT  = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

type LayerName = 'stores' | 'customers' | 'competitors' | 'trade_areas';

//
// ──────────────────────────────────────────────────────────────
//   UTILITIES
// ──────────────────────────────────────────────────────────────
//

function emptyFeatureCollection(): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features: [] };
}

function isEmpty(fc: GeoJSON.FeatureCollection | null | undefined): boolean {
  return !fc || !Array.isArray(fc.features) || fc.features.length === 0;
}

//
// ──────────────────────────────────────────────────────────────
//   LAYER QUERIES (RAW GEOJSON)
// ──────────────────────────────────────────────────────────────
//

async function fetchLayer(layer: LayerName, tenantId: string): Promise<GeoJSON.FeatureCollection> {
  switch (layer) {
    case 'customers':
      return await fetchCustomers(tenantId);

    case 'competitors':
      return await fetchCompetitors(tenantId);

    case 'trade_areas':
      return await fetchTradeAreas(tenantId);

    case 'stores':
    default:
      return await fetchStores(tenantId);
  }
}

async function fetchCustomers(tenantId: string): Promise<GeoJSON.FeatureCollection> {
  try {
    // Try cluster function first
    const clustered = await queryGeoJSON(`SELECT cluster_customers($1) AS geojson`, [tenantId]);
    if (!isEmpty(clustered)) return clustered;
  } catch {}

  // Fallback to raw customers
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
            'tier', tier,
            'tenant_id', tenant_id
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

async function fetchCompetitors(tenantId: string): Promise<GeoJSON.FeatureCollection> {
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
            'address', address,
            'tenant_id', tenant_id
          )
        )
      ), '[]'::json)
    ) AS geojson
    FROM competitors
    WHERE (tenant_id = $1 OR tenant_id IS NULL)
      AND geom IS NOT NULL
    LIMIT 2000
    `,
    [tenantId]
  );
}

async function fetchTradeAreas(tenantId: string): Promise<GeoJSON.FeatureCollection> {
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
            'tenant_id', tenant_id
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

async function fetchStores(tenantId: string): Promise<GeoJSON.FeatureCollection> {
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
            'address', address,
            'tenant_id', tenant_id
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

//
// ──────────────────────────────────────────────────────────────
//   FALLBACKS
// ──────────────────────────────────────────────────────────────
//

async function fallbackAll(layer: LayerName): Promise<GeoJSON.FeatureCollection> {
  switch (layer) {
    case 'stores':
      return await queryGeoJSON(`
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

    case 'competitors':
      return await queryGeoJSON(`
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
                'tenant_id', tenant_id
              )
            )
          ), '[]'::json)
        ) AS geojson
        FROM competitors
        WHERE geom IS NOT NULL
        LIMIT 2000
      `);

    case 'trade_areas':
      return await queryGeoJSON(`
        SELECT json_build_object(
          'type', 'FeatureCollection',
          'features', COALESCE(json_agg(
            json_build_object(
              'type', 'Feature',
              'geometry', ST_AsGeoJSON(geom)::json,
              'properties', json_build_object(
                'id', id,
                'zone_name', COALESCE(zone_name, 'Trade Area'),
                'tenant_id', tenant_id
              )
            )
          ), '[]'::json)
        ) AS geojson
        FROM trade_areas
        WHERE geom IS NOT NULL
        LIMIT 1000
      `);

    case 'customers':
      return await queryGeoJSON(`
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
                'tier', tier,
                'tenant_id', tenant_id
              )
            )
          ), '[]'::json)
        ) AS geojson
        FROM customers
        WHERE geom IS NOT NULL
      `);
  }
}

//
// ──────────────────────────────────────────────────────────────
//   MAIN ROUTE (POST)
// ──────────────────────────────────────────────────────────────
//

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt: string = (body.prompt || '').toLowerCase();
    let tenantId: string = body.tenantId || PILOT_TENANT;

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Auto-switch tenant based on prompt
    if (prompt.includes('demo coffee') || prompt.includes('demo tenant')) {
      tenantId = DEMO_TENANT;
    }

    // Determine layer
    let layer: LayerName = 'stores';
    if (prompt.includes('customer') || prompt.includes('cluster') || prompt.includes('value')) {
      layer = 'customers';
    } else if (prompt.includes('competitor') || prompt.includes('rival') || prompt.includes('competition')) {
      layer = 'competitors';
    } else if (prompt.includes('trade') || prompt.includes('area') || prompt.includes('catchment') || prompt.includes('polygon')) {
      layer = 'trade_areas';
    }

    //
    // ──────────────────────────────────────────────────────────────
    //   FETCH + FALLBACKS
    // ──────────────────────────────────────────────────────────────
    //

    let geoJson = await fetchLayer(layer, tenantId);
    let usedTenant = tenantId;

    // Tenant fallback
    if (isEmpty(geoJson)) {
      const otherTenant = tenantId === PILOT_TENANT ? DEMO_TENANT : PILOT_TENANT;
      const fallback = await fetchLayer(layer, otherTenant);
      if (!isEmpty(fallback)) {
        geoJson = fallback;
        usedTenant = otherTenant;
      }
    }

    // All-records fallback
    if (isEmpty(geoJson)) {
      geoJson = await fallbackAll(layer);
      usedTenant = 'all';
    }

    //
    // ──────────────────────────────────────────────────────────────
    //   FINAL RESPONSE (RAW GEOJSON)
    // ──────────────────────────────────────────────────────────────
    //

    return NextResponse.json({
      type: geoJson.type,
      features: geoJson.features,
      meta: {
        layer,
        tenantId: usedTenant,
        featureCount: geoJson.features.length,
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
