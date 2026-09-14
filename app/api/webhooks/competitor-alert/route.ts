import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

function emptyFC() {
  return { type: 'FeatureCollection', features: [] };
}

export async function POST(req: Request) {
  try {
    const { competitorName, lat, lng, category } = await req.json();

    if (!competitorName || lat == null || lng == null) {
      return NextResponse.json(
        { error: 'Missing competitor details (name, lat, lng required)' },
        { status: 400 }
      );
    }

    const client = await pool.connect();

    try {
      //
      // 1. Insert competitor into PostGIS
      //
      const insertCompetitor = `
        INSERT INTO competitors (name, category, geom)
        VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326))
        RETURNING 
          id,
          name,
          category,
          ST_AsGeoJSON(geom)::json AS geometry
      `;

      const competitorRes = await client.query(insertCompetitor, [
        competitorName,
        category ?? 'general',
        lng,
        lat,
      ]);

      const competitor = competitorRes.rows[0];

      //
      // 2. Find affected stores within 2 miles
      //
      const alertQuery = `
        SELECT 
          s.id AS store_id,
          s.tenant_id,
          s.name AS store_name,
          s.owner_email,
          ROUND(
            CAST(
              ST_Distance(
                s.geom::geography,
                ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
              ) AS numeric
            ), 1
          ) AS distance_meters
        FROM stores s
        WHERE ST_DWithin(
          s.geom::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          3218
        );
      `;

      const affectedRes = await client.query(alertQuery, [lng, lat]);
      const affectedStores = affectedRes.rows;

      //
      // 3. Insert competitor alerts
      //
      const alerts = [];

      for (const store of affectedStores) {
        const insertAlert = `
          INSERT INTO competitor_alerts (competitor_id, store_id, tenant_id, distance_meters)
          VALUES ($1, $2, $3, $4)
          RETURNING id
        `;

        const alertRes = await client.query(insertAlert, [
          competitor.id,
          store.store_id,
          store.tenant_id,
          store.distance_meters,
        ]);

        alerts.push({
          alertId: alertRes.rows[0].id,
          tenantId: store.tenant_id,
          storeName: store.store_name,
          distanceMeters: store.distance_meters,
        });
      }

      //
      // 4. Return GeoJSON for the competitor (so the map can render it)
      //
      const geoJson = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: competitor.geometry,
            properties: {
              id: competitor.id,
              name: competitor.name,
              category: competitor.category,
              alertCount: alerts.length,
            },
          },
        ],
      };

      return NextResponse.json({
        type: geoJson.type,
        features: geoJson.features,
        meta: {
          layer: 'competitors',
          featureCount: 1,
          alertsTriggered: alerts.length,
        },
      });

    } finally {
      client.release();
    }

  } catch (error: any) {
    console.error('Competitor Alert Webhook Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
