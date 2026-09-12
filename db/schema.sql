-- =============================================================================
-- Spatialytics OS — Multi-tenant PostGIS Schema
-- Purpose-built business spatial database on top of PostgreSQL + PostGIS
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE tenants (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL,
    slug            TEXT UNIQUE NOT NULL,
    plan            TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'growth', 'enterprise')),
    stripe_customer_id TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tenants_slug ON tenants(slug);

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email           TEXT NOT NULL,
    full_name       TEXT,
    role            TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, email)
);

CREATE INDEX idx_users_tenant ON users(tenant_id);

CREATE TABLE stores (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    address         TEXT,
    geom            GEOMETRY(Point, 4326) NOT NULL,
    trade_polygon   GEOMETRY(Polygon, 4326),
    vitality_score  NUMERIC(5,2),
    metadata        JSONB DEFAULT '{}',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stores_tenant ON stores(tenant_id);
CREATE INDEX idx_stores_geom ON stores USING GIST (geom);
CREATE INDEX idx_stores_trade ON stores USING GIST (trade_polygon) WHERE trade_polygon IS NOT NULL;

CREATE TABLE customers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_name   TEXT,
    email           TEXT,
    lifetime_value  NUMERIC(12,2) DEFAULT 0,
    tier            TEXT,
    geom            GEOMETRY(Point, 4326),
    attributes      JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customers_tenant ON customers(tenant_id);
CREATE INDEX idx_customers_geom ON customers USING GIST (geom);
CREATE INDEX idx_customers_ltv ON customers(tenant_id, lifetime_value DESC);

CREATE TABLE competitors (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    category        TEXT,
    address         TEXT,
    geom            GEOMETRY(Point, 4326) NOT NULL,
    source          TEXT DEFAULT 'manual',
    opened_at       DATE,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_competitors_tenant ON competitors(tenant_id);
CREATE INDEX idx_competitors_geom ON competitors USING GIST (geom);

CREATE TABLE trade_areas (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    store_id        UUID REFERENCES stores(id) ON DELETE SET NULL,
    zone_name       TEXT NOT NULL,
    geom            GEOMETRY(Polygon, 4326) NOT NULL,
    drive_time_mins INTEGER,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trade_areas_tenant ON trade_areas(tenant_id);
CREATE INDEX idx_trade_areas_geom ON trade_areas USING GIST (geom);

CREATE TABLE proposed_properties (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name            TEXT,
    address         TEXT,
    geom            GEOMETRY(Point, 4326) NOT NULL,
    trade_polygon   GEOMETRY(Polygon, 4326),
    vitality_score  NUMERIC(5,2),
    status          TEXT DEFAULT 'scouting' CHECK (status IN ('scouting', 'tour_booked', 'loi', 'signed', 'rejected')),
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_proposed_tenant ON proposed_properties(tenant_id);
CREATE INDEX idx_proposed_geom ON proposed_properties USING GIST (geom);

CREATE TABLE lease_pipeline (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_id     UUID REFERENCES proposed_properties(id) ON DELETE CASCADE,
    stage           TEXT NOT NULL DEFAULT 'Tour Booked'
                    CHECK (stage IN ('Tour Booked', 'LOI Submitted', 'Under Negotiation', 'Signed', 'Dead')),
    notes           TEXT,
    assigned_to     UUID REFERENCES users(id),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pipeline_tenant ON lease_pipeline(tenant_id);
CREATE INDEX idx_pipeline_stage ON lease_pipeline(tenant_id, stage);

CREATE TABLE competitor_alerts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    store_id        UUID REFERENCES stores(id),
    competitor_id   UUID REFERENCES competitors(id),
    distance_meters NUMERIC,
    alerted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledged    BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_alerts_tenant ON competitor_alerts(tenant_id, alerted_at DESC);

CREATE OR REPLACE FUNCTION calculate_vitality_score(
    p_geom GEOMETRY,
    p_tenant_id UUID DEFAULT NULL
) RETURNS NUMERIC AS $$
DECLARE
    competitor_count INTEGER;
    score NUMERIC;
BEGIN
    SELECT COUNT(*) INTO competitor_count
    FROM competitors c
    WHERE ST_DWithin(c.geom::geography, p_geom::geography, 1609.34 * 1.5)
      AND (p_tenant_id IS NULL OR c.tenant_id = p_tenant_id OR c.tenant_id IS NULL);

    score := GREATEST(20, 80 - (competitor_count * 4));
    RETURN ROUND(score, 1);
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION cluster_customers(
    p_tenant_id UUID,
    p_eps_degrees FLOAT DEFAULT 0.02,
    p_min_points INTEGER DEFAULT 3
) RETURNS JSON AS $$
BEGIN
    RETURN (
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
                        'tier', tier,
                        'cluster_id', cluster_id
                    )
                )
            ), '[]'::json)
        )
        FROM (
            SELECT id, customer_name, lifetime_value, tier, geom,
                   ST_ClusterDBSCAN(geom, p_eps_degrees, p_min_points) OVER () AS cluster_id
            FROM customers
            WHERE tenant_id = p_tenant_id AND geom IS NOT NULL
        ) t
    );
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION analyze_cannibalization(
    p_tenant_id UUID,
    p_proposed_id UUID
) RETURNS TABLE (
    existing_store_name TEXT,
    overlap_percentage NUMERIC,
    distance_miles NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.name,
        ROUND(
            (ST_Area(ST_Intersection(e.trade_polygon, p.trade_polygon)::geography) /
             NULLIF(ST_Area(e.trade_polygon::geography), 0) * 100)::numeric, 1
        ),
        ROUND((ST_Distance(e.geom::geography, p.geom::geography) / 1609.34)::numeric, 2)
    FROM stores e
    CROSS JOIN proposed_properties p
    WHERE e.tenant_id = p_tenant_id
      AND p.id = p_proposed_id
      AND e.trade_polygon IS NOT NULL
      AND p.trade_polygon IS NOT NULL
      AND ST_Intersects(e.trade_polygon, p.trade_polygon);
END;
$$ LANGUAGE plpgsql STABLE;

INSERT INTO tenants (id, name, slug, plan) VALUES
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Demo Coffee Co', 'demo-coffee', 'growth');

INSERT INTO stores (tenant_id, name, address, geom, vitality_score) VALUES
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Downtown Flagship',
     '123 Main St, Brainerd, MN',
     ST_SetSRID(ST_MakePoint(-94.2338, 46.3580), 4326), 78.5),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Westside Cafe',
     '456 Oak Ave, Baxter, MN',
     ST_SetSRID(ST_MakePoint(-94.2800, 46.3400), 4326), 64.0);

INSERT INTO customers (tenant_id, customer_name, lifetime_value, tier, geom)
SELECT
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Customer ' || g,
    (random() * 800 + 50)::numeric(10,2),
    CASE WHEN random() > 0.8 THEN 'Top 20%' ELSE 'Core' END,
    ST_SetSRID(ST_MakePoint(
        -94.2338 + (random() - 0.5) * 0.08,
        46.3580 + (random() - 0.5) * 0.06
    ), 4326)
FROM generate_series(1, 40) g;

COMMENT ON TABLE tenants IS 'Multi-tenant root. Every spatial entity is scoped by tenant_id.';
COMMENT ON TABLE stores IS 'Physical locations with optional trade-area polygons and vitality scores.';
COMMENT ON TABLE customers IS 'Point data from CSV/CRM uploads. Ready for ST_ClusterDBSCAN.';
COMMENT ON FUNCTION calculate_vitality_score IS 'MVP vitality score. Replace body with real demographic + foot-traffic layers.';
