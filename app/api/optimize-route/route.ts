import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function POST(req: Request) {
  try {
    const { tenantId, depot, stops } = await req.json();
    // depot = { lat: 46.35, lng: -94.68 }
    // stops = [{ id: 1, address: '123 Main St', lat: 46.38, lng: -94.71 }, ...]

    if (!tenantId || !depot || !stops || stops.length === 0) {
      return NextResponse.json({ error: 'Missing route parameters' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      // 1. Execute optimized path calculation (Simulated efficient coordinate ordering for MVP)
      // In production, this invokes pgRouting's pgr_TSP or an OSRM (Open Source Routing Machine) API matrix.
      const orderedStops = [depot, ...stops, depot]; // Round trip loop

      // 2. Generate a continuous GeoJSON LineString connecting the optimized stops
      const lineStringQuery = `
        SELECT json_build_object(
          'type', 'FeatureCollection',
          'features', json_build_object(
            'type', 'Feature',
            'geometry', ST_AsGeoJSON(
              ST_MakeLine(ARRAY[
                ${orderedStops.map(s => `ST_SetSRID(ST_MakePoint(${s.lng}, ${s.lat}), 4326)`).join(',\n')}
              ])
            )::json,
            'properties', json_build_object(
              'route_name', 'Optimized Field Service Run',
              'total_stops', ${stops.length},
              'estimated_duration_mins', ${stops.length * 22}
            )
          )
        ) as route_geojson;
      `;

      const result = await client.query(lineStringQuery);
      const routeGeoJson = result.rows[0].route_geojson;

      return NextResponse.json({
        success: true,
        sequence: orderedStops,
        geoJson: routeGeoJson,
      });

    } finally {
      client.release();
    }

  } catch (error: any) {
    console.error('Route Optimization Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
