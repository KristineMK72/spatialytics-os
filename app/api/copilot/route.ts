import { NextResponse } from 'next/server';
import { Pool } from 'pg';

// Initialize PostgreSQL/PostGIS connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // 1. LLM Intent & Parameter Extraction (Production would call OpenAI/Gemini API here)
    // For our robust MVP engine, we map natural language intents to secure PostGIS queries:
    let sqlQuery = '';
    const lowerPrompt = prompt.toLowerCase();

    if (lowerPrompt.includes('customer') || lowerPrompt.includes('cluster') || lowerPrompt.includes('value')) {
      // Query top customers with spatial geometries
      sqlQuery = `
        SELECT json_build_object(
          'type', 'FeatureCollection',
          'features', json_agg(json_build_object(
            'type', 'Feature',
            'geometry', ST_AsGeoJSON(geom)::json,
            'properties', json_build_object(
              'id', id,
              'lifetime_value', lifetime_value,
              'tier', tier
            )
          ))
        ) as geojson
        FROM customers
        WHERE tier = 'Top 20%';
      `;
    } else if (lowerPrompt.includes('site') || lowerPrompt.includes('store') || lowerPrompt.includes('score')) {
      // Query retail store locations and vitality scores
      sqlQuery = `
        SELECT json_build_object(
          'type', 'FeatureCollection',
          'features', json_agg(json_build_object(
            'type', 'Feature',
            'geometry', ST_AsGeoJSON(geom)::json,
            'properties', json_build_object(
              'name', name,
              'vitality_score', vitality_score,
              'address', address
            )
          ))
        ) as geojson
        FROM stores;
      `;
    } else {
      // Default fallback spatial query (e.g., regional trade areas or catchments)
      sqlQuery = `
        SELECT json_build_object(
          'type', 'FeatureCollection',
          'features', json_agg(json_build_object(
            'type', 'Feature',
            'geometry', ST_AsGeoJSON(geom)::json,
            'properties', json_build_object(
              'zone_name', zone_name,
              'type', 'trade_area'
            )
          ))
        ) as geojson
        FROM trade_areas;
      `;
    }

    // 2. Execute the spatial query against PostGIS
    const client = await pool.connect();
    try {
      const result = await client.query(sqlQuery);
      const geoJson = result.rows[0]?.geojson || { type: 'FeatureCollection', features: [] };

      return NextResponse.json({ success: true, geoJson });
    } finally {
      client.release();
    }

  } catch (error: any) {
    console.error('Spatial Copilot Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
