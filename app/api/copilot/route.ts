import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function queryGeoJSON(sql: string) {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(sql);
    return rows[0]?.geojson ?? { type: 'FeatureCollection', features: [] };
  } finally {
    client.release();
  }
}

async function fetchStores() {
  return queryGeoJSON(`
    SELECT json_build_object(
      'type', 'FeatureCollection',
      'features', COALESCE(json_agg(
        json_build_object(
          'type', 'Feature',
          'geometry', ST_AsGeoJSON(geom)::json,
          'properties', json_build_object(
            'id', id,
            'name', name,
            'address', address,
            'vitality_score', vitality_score,
            'tenant_id', tenant_id
          )
        )
      ), '[]'::json)
    ) AS geojson
    FROM stores
    WHERE geom IS NOT NULL;
  `);
}

async function fetchCompetitors() {
  return queryGeoJSON(`
    SELECT json_build_object(
      'type', 'FeatureCollection',
      'features', COALESCE(json_agg(
        json_build_object(
          'type', 'Feature',
          'geometry', ST_AsGeoJSON(geom)::json,
          'properties', json_build_object(
            'id', id,
            'name', name,
            'address', address,
            'category', category,
            'tenant_id', tenant_id
          )
        )
      ), '[]'::json)
    ) AS geojson
    FROM stores
    WHERE geom IS NOT NULL
      AND (
        category IS NOT NULL OR
        name ILIKE '%subway%' OR
        name ILIKE '%dollar%' OR
        name ILIKE '%bp%' OR
        name ILIKE '%walgreens%' OR
        name ILIKE '%hardware%' OR
        name ILIKE '%pizza%' OR
        name ILIKE '%brew%' OR
        name ILIKE '%fuel%' OR
        name ILIKE '%gas%' OR
        name ILIKE '%cafe%' OR
        name ILIKE '%coffee%'
      );
  `);
}

async function fetchTradeAreas() {
  return queryGeoJSON(`
    SELECT json_build_object(
      'type', 'FeatureCollection',
      'features', COALESCE(json_agg(
        json_build_object(
          'type', 'Feature',
          'geometry', ST_AsGeoJSON(geom)::json,
          'properties', json_build_object(
            'id', id,
            'name', name,
            'tenant_id', tenant_id
          )
        )
      ), '[]'::json)
    ) AS geojson
    FROM trade_areas
    WHERE geom IS NOT NULL;
  `);
}

async function fetchCustomers() {
  return queryGeoJSON(`
    SELECT json_build_object(
      'type', 'FeatureCollection',
      'features', COALESCE(json_agg(
        json_build_object(
          'type', 'Feature',
          'geometry', ST_AsGeoJSON(geom)::json,
          'properties', json_build_object(
            'id', id,
            'segment', segment,
            'lifetime_value', lifetime_value,
            'tenant_id', tenant_id
          )
        )
      ), '[]'::json)
    ) AS geojson
    FROM customers
    WHERE geom IS NOT NULL;
  `);
}

function inferLayer(prompt: string) {
  const p = prompt.toLowerCase();

  if (p.includes('customer') || p.includes('cluster') || p.includes('value')) {
    return 'customers';
  }
  if (p.includes('competitor') || p.includes('rival') || p.includes('competition')) {
    return 'competitors';
  }
  if (p.includes('trade area') || p.includes('catchment') || p.includes('polygon')) {
    return 'trade_areas';
  }
  return 'stores';
}

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();
    const layer = inferLayer(prompt ?? '');

    let geojson;

    switch (layer) {
      case 'competitors':
        geojson = await fetchCompetitors();
        break;
      case 'trade_areas':
        geojson = await fetchTradeAreas();
        break;
      case 'customers':
        geojson = await fetchCustomers();
        break;
      default:
        geojson = await fetchStores();
        break;
    }

    return NextResponse.json({ layer, geojson });
  } catch (err) {
    console.error('Copilot route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
