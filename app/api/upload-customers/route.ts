import { NextResponse } from 'next/server';
import { withTransaction, queryGeoJSON } from '@/lib/db';

function emptyFC() {
  return { type: 'FeatureCollection', features: [] };
}

function safeFC(fc: any) {
  if (!fc || !fc.features || !Array.isArray(fc.features)) {
    return emptyFC();
  }
  return fc;
}

export async function POST(req: Request) {
  try {
    const { tenantId, customers } = await req.json();

    if (!tenantId || !Array.isArray(customers)) {
      return NextResponse.json(
        { error: 'Invalid payload or missing tenant ID' },
        { status: 400 }
      );
    }

    // Validate customer payload
    for (const c of customers) {
      if (!c || !c.name || c.lat == null || c.lng == null) {
        return NextResponse.json(
          { error: 'Each customer must include name, lat, lng' },
          { status: 400 }
        );
      }
    }

    // Insert customers
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

    // Try clustering first
    let geoJson = null;

    try {
      geoJson = await queryGeoJSON(
        `SELECT cluster_customers($1) AS geojson`,
        [tenantId]
      );
    } catch {
      geoJson = null;
    }

    // Fallback to raw customers if clustering fails
    if (!geoJson || !geoJson.features || geoJson.features.length === 0) {
      geoJson = await queryGeoJSON(
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

    const fc = safeFC(geoJson);

    return NextResponse.json({
      type: fc.type,
      features: fc.features,
      meta: {
        layer: 'customers',
        tenantId,
        featureCount: fc.features.length,
        uploadedCount: customers.length,
      },
    });

  } catch (error: any) {
    console.error('Customer Upload Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
