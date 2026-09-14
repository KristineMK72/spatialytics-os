import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// ──────────────────────────────────────────────────────────────
//   UTILITIES
// ──────────────────────────────────────────────────────────────

function emptyFeatureCollection() {
  return { type: 'FeatureCollection', features: [] };
}

function safeFC(fc: any) {
  if (!fc || !fc.features || !Array.isArray(fc.features)) {
    return emptyFeatureCollection();
  }
  return fc;
}

// ──────────────────────────────────────────────────────────────
//   GET — Dashboard Pipeline Layer
// ──────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Missing tenantId' },
        { status: 400 }
      );
    }

    const client = await pool.connect();

    try {
      const query = `
        SELECT json_build_object(
          'type', 'FeatureCollection',
          'features', COALESCE(json_agg(
            json_build_object(
              'type', 'Feature',
              'geometry', ST_AsGeoJSON(geom)::json,
              'properties', json_build_object(
                'id', id,
                'address', address,
                'lease_stage', lease_stage,
                'vitality_score', vitality_score,
                'tenant_id', tenant_id
              )
            )
          ), '[]'::json)
        ) AS geojson
        FROM commercial_properties
        WHERE tenant_id = $1 AND geom IS NOT NULL
      `;

      const result = await client.query(query, [tenantId]);
      const fc = safeFC(result.rows[0]?.geojson);

      return NextResponse.json({
        type: fc.type,
        features: fc.features,
        meta: {
          layer: 'pipeline',
          tenantId,
          featureCount: fc.features.length,
        },
      });

    } finally {
      client.release();
    }

  } catch (error: any) {
    console.error('Pipeline GET Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// ──────────────────────────────────────────────────────────────
//   PATCH — Update Lease Stage
// ──────────────────────────────────────────────────────────────

export async function PATCH(req: Request) {
  try {
    const { propertyId, newStage, tenantId } = await req.json();

    if (!propertyId || !newStage || !tenantId) {
      return NextResponse.json(
        { error: 'Missing required pipeline parameters' },
        { status: 400 }
      );
    }

    const client = await pool.connect();

    try {
      const updateQuery = `
        UPDATE commercial_properties
        SET lease_stage = $1, updated_at = NOW()
        WHERE id = $2 AND tenant_id = $3
        RETURNING 
          id,
          address,
          lease_stage,
          vitality_score,
          ST_AsGeoJSON(geom)::json AS geometry,
          tenant_id
      `;

      const result = await client.query(updateQuery, [
        newStage,
        propertyId,
        tenantId,
      ]);

      const updated = result.rows[0];

      if (!updated) {
        return NextResponse.json(
          { error: 'Property not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Property stage updated to '${newStage}'`,
        property: updated,
      });

    } finally {
      client.release();
    }

  } catch (error: any) {
    console.error('Pipeline PATCH Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
