import { NextResponse } from 'next/server';
import { withTransaction, queryGeoJSON } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const { tenantId, customers } = await req.json();
    // customers = [{ name: 'Jane Doe', lat: 46.35, lng: -94.68, ltv: 450 }, ...]

    if (!tenantId || !customers || !Array.isArray(customers)) {
      return NextResponse.json(
        { error: 'Invalid payload or missing tenant ID' },
        { status: 400 }
      );
    }

    await withTransaction(async (client) => {
      for (const c of customers) {
        await client.query(
          `
          INSERT INTO customers (tenant_id, customer_name, lifetime_value, geom)
          VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326))
          `,
          [tenantId, c.name, c.ltv ?? 0, c.lng, c.lat]
        );
      }
    });

    // Return clustered GeoJSON via the schema helper
    const geoJson = await queryGeoJSON(
      `SELECT cluster_customers($1) AS geojson`,
      [tenantId]
    );

    return NextResponse.json({
      success: true,
      count: customers.length,
      geoJson,
    });
  } catch (error: any) {
    console.error('Customer Upload Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
