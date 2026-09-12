import { Pool, PoolClient, QueryResult } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var __spatialyticsPool: Pool | undefined;
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.warn(
      '[Spatialytics] DATABASE_URL is not set. Database calls will fail until configured.'
    );
  }

  return new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
}

/** Singleton pool — safe for Next.js hot-reload in development */
export const pool: Pool =
  global.__spatialyticsPool ?? (global.__spatialyticsPool = createPool());

export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

export async function withClient<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Convenience: return a FeatureCollection GeoJSON from a query that builds it */
export async function queryGeoJSON(
  text: string,
  params?: any[]
): Promise<GeoJSON.FeatureCollection> {
  const result = await query(text, params);
  return (
    result.rows[0]?.geojson ??
    result.rows[0]?.geoJson ?? {
      type: 'FeatureCollection',
      features: [],
    }
  );
}
