import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Hero */}
      <section className="relative flex-1 flex flex-col items-center justify-center px-6 py-24 text-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-900/40 via-slate-950 to-slate-950" />
        <div className="relative z-10 max-w-3xl space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-950/80 border border-sky-800 text-sky-300 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
            Spatialytics OS · MVP
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white">
            Geospatial intelligence
            <br />
            <span className="text-sky-400">for real small businesses</span>
          </h1>

          <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            The missing middle between bloated enterprise GIS and toy consumer maps.
            Site scoring, territory planning, customer clustering, route optimization,
            and an AI Copilot — all in one command center.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium transition-colors"
            >
              Open Command Center
            </Link>
            <a
              href="https://github.com/KristineMK72/spatialytics-os"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg border border-slate-700 hover:border-slate-500 text-slate-300 font-medium transition-colors"
            >
              View on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Module grid */}
      <section className="border-t border-slate-800 bg-slate-900/50 py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-semibold text-center mb-10 text-slate-200">
            10 intelligence modules. One login.
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { title: 'Site Selection & Scoring', desc: '1–100 Location Vitality Score + PDF pitch decks' },
              { title: 'Market Intelligence', desc: 'Trade areas, competitor heat maps, public layers' },
              { title: 'Territory Planner', desc: 'Voronoi territories for sales & franchise teams' },
              { title: 'Route Optimizer', desc: 'Multi-stop sequencing for field service fleets' },
              { title: 'Customer Clustering', desc: 'CSV → DBSCAN high-value pockets' },
              { title: 'Web GIS Lite', desc: 'White-label maps for nonprofits & municipalities' },
              { title: 'Sustainability Toolkit', desc: 'Flood, walkability, solar potential overlays' },
              { title: 'Competitor Alerts', desc: 'Webhook radar with ST_DWithin radius checks' },
              { title: 'Spatial Kanban', desc: 'Lease pipeline pins + CRM stages on one map' },
              { title: 'Cannibalization Analyzer', desc: 'Trade-area overlap before you expand' },
            ].map((m) => (
              <div
                key={m.title}
                className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-sky-800/60 transition-colors"
              >
                <h3 className="font-medium text-sky-300 mb-1">{m.title}</h3>
                <p className="text-sm text-slate-400">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-800 py-8 text-center text-sm text-slate-500">
        Spatialytics OS · Built for SMBs, franchises & community organizations
      </footer>
    </main>
  );
}
