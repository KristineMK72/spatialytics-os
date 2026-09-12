import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function POST(req: Request) {
  try {
    const { tenantId, regionName } = await req.json();

    if (!tenantId || !regionName) {
      return NextResponse.json({ error: 'Tenant ID and region name are required' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      // 1. Compute balanced territories and enrich with customer/revenue stats inside each polygon
      const territoryQuery = `
        SELECT json_build_object(
          'type', 'FeatureCollection',
          'features', json_agg(json_build_object(
            'type', 'Feature',
            'geometry', ST_AsGeoJSON(t.territory_geom)::json,
            'properties', json_build_object(
              'territory_id', t.id,
              'rep_name', t.assigned_rep,
              'active_customers', t.customer_count,
              'estimated_revenue', t.total_revenue
            )
          ))
        ) as territories_geojson
        FROM calculated_territories t
        WHERE t.tenant_id = $1 AND t.region = $2;
      `;

      const result = await client.query(territoryQuery, [tenantId, regionName]);
      const territoriesGeoJson = result.rows[0]?.territories_geojson || { type: 'FeatureCollection', features: [] };

      return NextResponse.json({
        success: true,
        geoJson: territoriesGeoJson,
      });

    } finally {
      client.release();
    }

  } catch (error: any) {
    console.error('Territory Planner Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
