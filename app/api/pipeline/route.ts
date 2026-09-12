import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function PATCH(req: Request) {
  try {
    const { propertyId, newStage, tenantId } = await req.json();

    if (!propertyId || !newStage || !tenantId) {
      return NextResponse.json({ error: 'Missing required pipeline parameters' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      // 1. Update the property lease stage in PostGIS
      const updateQuery = `
        UPDATE commercial_properties
        SET lease_stage = $1, updated_at = NOW()
        WHERE id = $2 AND tenant_id = $3
        RETURNING id, address, lease_stage, vitality_score, ST_AsGeoJSON(geom)::json as geometry;
      `;

      const result = await client.query(updateQuery, [newStage, propertyId, tenantId]);
      const updatedProperty = result.rows[0];

      if (!updatedProperty) {
        return NextResponse.json({ error: 'Property not found' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        message: `Property stage updated to '${newStage}'`,
        property: updatedProperty,
      });

    } finally {
      client.release();
    }

  } catch (error: any) {
    console.error('Pipeline Update Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
