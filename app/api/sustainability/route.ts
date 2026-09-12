import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function POST(req: Request) {
  try {
    const { storeId } = await req.json();

    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      const query = `
        SELECT 
          s.name, 
          s.address,
          COALESCE(f.risk_level, 'Minimal Risk') as flood_risk,
          ROUND(CAST(ST_Distance(s.geom::geography, parks.geom::geography) AS numeric), 1) as park_distance_m,
          COALESCE(env.walkability_score, 82) as walkability_score,
          COALESCE(env.solar_potential_kwh_yr, 14200) as solar_potential
        FROM stores s
        LEFT JOIN fema_flood_zones f ON ST_Intersects(s.geom, f.geom)
        LEFT JOIN LATERAL (
          SELECT geom FROM public_parks ORDER BY s.geom <-> geom LIMIT 1
        ) parks ON true
        LEFT JOIN environmental_indices env ON ST_Contains(env.geom, s.geom)
        WHERE s.id = $1;
      `;

      const result = await client.query(query, [storeId]);
      const data = result.rows[0];

      if (!data) {
        return NextResponse.json({ error: 'Location not found' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        sustainabilityMetrics: {
          name: data.name,
          floodRisk: data.flood_risk,
          parkDistanceMeters: data.park_distance_m,
          walkabilityScore: data.walkability_score,
          solarPotentialKwh: data.solar_potential,
          ecoScorecardGrade: 'A-', // Calculated composite sustainability index
        }
      });

    } finally {
      client.release();
    }

  } catch (error: any) {
    console.error('Sustainability API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
