import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt: string = (body.prompt || '').toLowerCase();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    let sql = '';
    let layer = 'stores';

    if (prompt.includes('customer') || prompt.includes('cluster') || prompt.includes('value')) {
      layer = 'customers';
      sql = `
        SELECT id, customer_name AS name, lifetime_value, tier,
               ST_AsGeoJSON(geom)::json AS geometry
        FROM customers
        WHERE geom IS NOT NULL
        LIMIT 500
      `;
    } else if (prompt.includes('competitor') || prompt.includes('rival')) {
      layer = 'competitors';
      sql = `
        SELECT id, name, category, address,
               ST_AsGeoJSON(geom)::json AS geometry
        FROM competitors
        WHERE geom IS NOT NULL
        LIMIT 1000
      `;
    } else if (prompt.includes('trade') || prompt.includes('area') || prompt.includes('catchment')) {
      layer = 'trade_areas';
      sql = `
        SELECT id, COALESCE(zone_name, 'Trade Area') AS name,
               ST_AsGeoJSON(geom)::json AS geometry
        FROM trade_areas
        WHERE geom IS NOT NULL
        LIMIT 800
      `;
    } else {
      layer = 'stores';
      sql = `
        SELECT id, name, vitality_score, address,
               ST_AsGeoJSON(geom)::json AS geometry
        FROM stores
        WHERE geom IS NOT NULL
        LIMIT 1000
      `;
    }

    const result = await pool.query(sql);

    const features = result.rows
      .filter((row) => row.geometry)
      .map((row) => {
        const { geometry, ...properties } = row;
        return {
          type: 'Feature',
          geometry,
          properties,
        };
      });

    const geoJson = {
      type: 'FeatureCollection',
      features,
    };

    return NextResponse.json({
      success: true,
      geoJson,
      meta: { layer, featureCount: features.length },
    });
  } catch (error: any) {
    console.error('Spatial Copilot Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Database error',
        detail: String(error),
      },
      { status: 500 }
    );
  }
}
