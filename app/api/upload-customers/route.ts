import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function POST(req: Request) {
  try {
    const { tenantId, customers } = await req.json(); 
    // customers = [{ name: 'Jane Doe', lat: 46.35, lng: -94.68, ltv: 450 }, ...]

    if (!tenantId || !customers || !Array.isArray(customers)) {
      return NextResponse.json({ error: 'Invalid payload or missing tenant ID' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Bulk insert customer rows with PostGIS point geometries
      for (const c of customers) {
        await client.query(`
          INSERT INTO customers (tenant_id, customer_name, lifetime_value, geom)
          VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326))
        `, [tenantId, c.name, c.ltv, c.lng, c.lat]);
      }

      // 2. Query back the clustered results using ST_ClusterDBSCAN
      const clusterResult = await client.query(`
        SELECT json_build_object(
          'type', 'FeatureCollection',
          'features', json_agg(json_build_object(
            'type', 'Feature',
            'geometry', ST_AsGeoJSON(geom)::json,
            'properties', json_build_object(
              'id', id,
              'name', customer_name,
              'ltv', lifetime_value,
              'cluster_id', cluster_id
            )
          ))
        ) as geojson
        FROM (
          SELECT id, customer_name, lifetime_value, geom,
                 ST_ClusterDBSCAN(geom::geometry, 0.02, 3) OVER() AS cluster_id
          FROM customers
          WHERE tenant_id = $1
        ) clustered_data;
      `, [tenantId]);

      await client.query('COMMIT');

      return NextResponse.json({ 
        success: true, 
        count: customers.length,
        geoJson: clusterResult.rows[0].geojson 
      });

    } catch (dbError) {
      await client.query('ROLLBACK');
      throw dbError;
    } finally {
      client.release();
    }

  } catch (error: any) {
    console.error('Customer Upload Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
