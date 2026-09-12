import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function POST(req: Request) {
  try {
    const { tenantId, proposedPropertyId } = await req.json();

    if (!tenantId || !proposedPropertyId) {
      return NextResponse.json({ error: 'Missing tenant ID or proposed property ID' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      // 1. Query overlap metrics against existing store network
      const analysisQuery = `
        SELECT 
            e.name as existing_store_name,
            ROUND(
                CAST(
                    (ST_Area(ST_Intersection(e.trade_polygon, p.trade_polygon)::geography) / 
                     ST_Area(e.trade_polygon::geography)) * 100 
                AS numeric), 1
            ) as overlap_percentage,
            ROUND(CAST(ST_Distance(e.geom::geography, p.geom::geography) / 1609.34 AS numeric), 2) as distance_miles
        FROM stores e
        CROSS JOIN proposed_properties p
        WHERE p.id = $1 AND e.tenant_id = $2;
      `;

      const result = await client.query(analysisQuery, [proposedPropertyId, tenantId]);
      const comparisons = result.rows;

      // 2. Compute overall safety recommendation
      const maxOverlap = Math.max(...comparisons.map((c: any) => parseFloat(c.overlap_percentage) || 0), 0);
      let riskLevel = 'Low Risk - Safe to Expand';
      if (maxOverlap > 35) riskLevel = 'High Cannibalization Risk (>35% Trade Overlap)';
      else if (maxOverlap > 15) riskLevel = 'Moderate Risk - Monitor Regional Spillover';

      return NextResponse.json({
        success: true,
        proposedPropertyId,
        maxCannibalizationOverlapPct: maxOverlap,
        expansionRiskRating: riskLevel,
        storeComparisons: comparisons,
      });

    } finally {
      client.release();
    }

  } catch (error: any) {
    console.error('Cannibalization Analysis Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
