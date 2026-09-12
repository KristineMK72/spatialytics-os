# Spatialytics OS

**Geospatial Command Center for SMBs, franchises, and community organizations.**

Bridges the gap between bloated enterprise GIS (ArcGIS-class) and overly simple consumer maps. Built with Next.js, MapLibre GL JS, and PostGIS.

## Quick Start

### 1. Prerequisites
- Node.js 18+
- Docker (for local PostGIS)

### 2. Clone & install
```bash
git clone https://github.com/KristineMK72/spatialytics-os.git
cd spatialytics-os
npm install
```

### 3. Start the spatial database
```bash
npm run db:up
```
This launches PostGIS 16 and automatically applies `db/schema.sql` (multi-tenant tables, spatial indexes, helper functions, and demo seed data).

Connection string (also in `.env.example`):
```
postgresql://spatialytics:spatialytics_dev@localhost:5432/spatialytics
```

### 4. Configure environment
```bash
cp .env.example .env.local
# Edit if needed — defaults work for local Docker
```

### 5. Run the app
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) → click **Open Command Center**.

## Architecture

| Layer | Stack |
|-------|-------|
| Frontend | Next.js 14 (App Router) · React · Tailwind · MapLibre GL JS |
| API | Next.js Route Handlers |
| Spatial DB | PostgreSQL 16 + PostGIS 3.4 |
| Billing | Stripe Checkout (subscriptions) |

### Database design philosophy
We do **not** reinvent PostGIS. We put a clean, multi-tenant business schema *on top of* real PostGIS so the system feels purpose-built for SMB location intelligence:

- Every spatial entity is scoped by `tenant_id`
- GiST indexes on all geometries
- Ready-made functions: `cluster_customers()`, `calculate_vitality_score()`, `analyze_cannibalization()`
- Tables map 1:1 to product modules (stores, customers, trade_areas, competitors, lease_pipeline, proposed_properties, …)

See `db/schema.sql` for the full blueprint.

## Product Modules (roadmap status)

| # | Module | Status |
|---|--------|--------|
| 1 | Site Selection & Location Scoring | Scaffold + vitality function |
| 2 | Local Market Intelligence Dashboard | Scaffold |
| 3 | Sales & Franchise Territory Planner | API route present |
| 4 | Lightweight Route & Field Service Optimizer | API route present |
| 5 | Customer Mapping & Spatial Clustering | Working (CSV upload + DBSCAN) |
| 6 | Web GIS Lite / Community Mapping | Planned |
| 7 | Sustainability & Impact Toolkit | Card component + API |
| 8 | Automated Competitor Proximity Alerts | Webhook route present |
| 9 | Spatial Kanban & Commercial Lease Pipeline | Schema ready |
| 10 | Cannibalization & Revenue Impact Analyzer | API + SQL function |

## Project structure
```
app/
  api/               # Route handlers (copilot, upload, route, stripe, …)
  dashboard/         # Main command-center UI
  page.tsx           # Landing page
components/
  map/MapView.tsx    # MapLibre wrapper
  report/            # Scorecard cards
  billing/           # Pricing table
db/
  schema.sql         # Full multi-tenant PostGIS schema + seed
docker/
  docker-compose.yml # Local PostGIS
lib/
  db.ts              # Shared connection pool + helpers
```

## Scripts
- `npm run dev` — start Next.js
- `npm run db:up` — start PostGIS container
- `npm run db:down` — stop
- `npm run db:reset` — wipe volume and re-seed

## Next priorities
1. Real auth (Clerk or Auth.js) + tenant isolation middleware
2. Replace rule-based Copilot with LLM tool-calling against PostGIS
3. Wire remaining API routes to the shared schema
4. Demographic / foot-traffic data layers for true vitality scores
5. PDF export pipeline (server-side)

---

Built for Greater Minnesota and every other place that needs serious spatial tools without enterprise pricing.
