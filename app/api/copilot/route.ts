import { NextResponse } from 'next/server';
import { queryGeoJSON } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt: string = (body.prompt || '').toLowerCase();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    let geoJson: GeoJSON.FeatureCollection;
    let layer = 'stores';

    if (prompt.includes('customer') || prompt.includes('cluster') || prompt.includes('value')) {
      layer = 'customers';
      geoJson = await queryGeoJSON(`
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
        WHERE geom IS NOT NULL
      `);
    } else if (prompt.includes('competitor') || prompt.includes('rival') || prompt.includes('competition')) {
      layer = 'competitors';
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
                'category', category,
                'address', address
              )
            )
          ), '[]'::json)
        ) AS geojson
        FROM competitors
        WHERE geom IS NOT NULL
        LIMIT 2000
      `);
    } else if (prompt.includes('trade') || prompt.includes('area') || prompt.includes('catchment') || prompt.includes('polygon')) {
      layer = 'trade_areas';
      geoJson = await queryGeoJSON(`
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
        WHERE geom IS NOT NULL
        LIMIT 1500
      `);
    } else {
      // stores (default) — pull everything
      layer = 'stores';
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
                'address', address
              )
            )
          ), '[]'::json)
        ) AS geojson
        FROM stores
        WHERE geom IS NOT NULL
      `);
    }

    const count = geoJson?.features?.length ?? 0;

    return NextResponse.json({
      success: true,
      geoJson,
      meta: { layer, featureCount: count },
    });
  } catch (error: any) {
    console.error('Spatial Copilot Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Database error' },
      { status: 500 }
    );
  }
}
