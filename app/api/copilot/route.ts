// pages/api/copilot.ts (or app/api/copilot/route.ts for Next 13+)

import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

type LayerName = 'stores' | 'competitors' | 'trade_areas' | 'customers';

async function queryGeoJSON(sql: string): Promise<any> {
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
    FROM competitors
    WHERE geom IS NOT NULL;
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

function inferLayer(prompt: string): LayerName {
  const p = prompt.toLowerCase();

  if (p.includes('customer') || p.includes('cluster') || p.includes('value')) {
    return 'customers';
  }
  if (p.includes('competitor') || p.includes('rival') || p.includes('competition')) {
    return 'competitors';
  }
  if (
    p.includes('trade area') ||
    p.includes('trade_area') ||
    p.includes('catchment') ||
    p.includes('polygon')
  ) {
    return 'trade_areas';
  }
  return 'stores';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { prompt } = req.body as { prompt: string };

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
      case 'stores':
      default:
        geojson = await fetchStores();
        break;
    }

    res.status(200).json({
      layer,
      geojson,
    });
  } catch (err: any) {
    console.error('Copilot route error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
