import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function POST(req: Request) {
  try {
    const { competitorName, lat, lng, category } = await req.json();

    if (!competitorName || lat === undefined || lng === undefined) {
      return NextResponse.json({ error: 'Missing competitor details' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      // 1. Execute spatial query to find any tenant stores within 2 miles (3218 meters) of the new competitor
      const alertQuery = `
        SELECT 
            s.tenant_id,
            s.name as store_name,
            s.owner_email,
            ROUND(CAST(ST_Distance(s.geom::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS numeric), 1) as distance_meters
        FROM stores s
        WHERE ST_DWithin(
            s.geom::geography, 
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 
            3218
        );
      `;

      const result = await client.query(alertQuery, [lng, lat]);
      const affectedStores = result.rows;

      // 2. Loop through affected tenants and simulate dispatching alerts (Email/SMS/In-app notification)
      const alertsDispatched = affectedStores.map((store) => {
        console.log(`[Alert Dispatched] To: ${store.owner_email} | Store: ${store.store_name} | New competitor '${competitorName}' opened ${store.distance_meters}m away.`);
        return {
          tenantId: store.tenant_id,
          storeName: store.store_name,
          distanceMeters: store.distance_meters,
        };
      });

      return NextResponse.json({
        success: true,
        competitorProcessed: competitorName,
        totalAlertsTriggered: alertsDispatched.length,
        affectedTenants: alertsDispatched,
      });

    } finally {
      client.release();
    }

  } catch (error: any) {
    console.error('Competitor Alert Webhook Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
