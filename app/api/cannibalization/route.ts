import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// ──────────────────────────────────────────────────────────────
//   UTILITIES
// ──────────────────────────────────────────────────────────────

function safeNumber(n: any, fallback = 0): number {
  const parsed = parseFloat(n);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function classifyRisk(maxOverlap: number): string {
  if (maxOverlap > 35) return 'High Cannibalization Risk (>35% Trade Overlap)';
  if (maxOverlap > 15) return 'Moderate Risk – Monitor Regional Spillover';
  return 'Low Risk – Safe to Expand';
}

// ──────────────────────────────────────────────────────────────
//   MAIN ROUTE
// ──────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const { tenantId, proposedPropertyId } = await req.json();

    if (!tenantId || !proposedPropertyId) {
      return NextResponse.json(
        { error: 'Missing tenant ID or proposed property ID' },
        { status: 400 }
      );
    }

    const client = await pool.connect();

    try {
      // Validate proposed property geometry
      const proposedGeomCheck = await client.query(
        `
        SELECT id, ST_AsGeoJSON(geom)::json AS geom, 
               ST_AsGeoJSON(trade_polygon)::json AS trade_polygon
        FROM proposed_properties
        WHERE id = $1
        `,
        [proposedPropertyId]
      );

      if (proposedGeomCheck.rowCount === 0) {
        return NextResponse.json(
          { error: 'Proposed property not found' },
          { status: 404 }
        );
      }

      const proposed = proposedGeomCheck.rows[0];

      if (!proposed.geom) {
        return NextResponse.json({
          error: 'Proposed property has no geometry (geom is NULL)',
          proposedPropertyId,
        });
      }

      if (!proposed.trade_polygon) {
        return NextResponse.json({
          error: 'Proposed property has no trade area polygon (trade_polygon is NULL)',
          proposedPropertyId,
        });
      }

      // Cannibalization analysis
      const analysisQuery = `
        SELECT 
          e.id AS existing_store_id,
          e.name AS existing_store_name,
          ST_AsGeoJSON(e.geom)::json AS existing_geom,
          ST_AsGeoJSON(e.trade_polygon)::json AS existing_trade_polygon,

          -- Safe overlap calculation
          CASE 
            WHEN e.trade_polygon IS NULL OR p.trade_polygon IS NULL THEN 0
            ELSE ROUND(
              CAST(
                (ST_Area(ST_Intersection(e.trade_polygon, p.trade_polygon)::geography) /
                 NULLIF(ST_Area(e.trade_polygon::geography), 0)) * 100
              AS numeric), 1
            )
          END AS overlap_percentage,

          -- Safe distance calculation
          CASE 
            WHEN e.geom IS NULL OR p.geom IS NULL THEN NULL
            ELSE ROUND(
              CAST(ST_Distance(e.geom::geography, p.geom::geography) / 1609.34 AS numeric),
              2
            )
          END AS distance_miles

        FROM stores e
        CROSS JOIN proposed_properties p
        WHERE p.id = $1
          AND e.tenant_id = $2
      `;

      const result = await client.query(analysisQuery, [
        proposedPropertyId,
        tenantId,
      ]);

      const comparisons = result.rows.map((row) => ({
        existing_store_id: row.existing_store_id,
        existing_store_name: row.existing_store_name,
        existing_geom: row.existing_geom,
        existing_trade_polygon: row.existing_trade_polygon,
        overlap_percentage: safeNumber(row.overlap_percentage),
        distance_miles: safeNumber(row.distance_miles, null),
      }));

      const maxOverlap = Math.max(
        ...comparisons.map((c) => c.overlap_percentage),
        0
      );

      const riskLevel = classifyRisk(maxOverlap);

      return NextResponse.json({
        success: true,
        proposedPropertyId,
        proposedGeometry: proposed.geom,
        proposedTradeArea: proposed.trade_polygon,
        maxCannibalizationOverlapPct: maxOverlap,
        expansionRiskRating: riskLevel,
        storeComparisons: comparisons,
        storeCountAnalyzed: comparisons.length,
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Cannibalization Analysis Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
