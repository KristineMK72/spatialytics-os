'use client';

import Link from 'next/link';
import AppNav from '@/components/AppNav';

const stages = ['Lead', 'Touring', 'LOI', 'Lease', 'Open'];

export default function PipelinePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-bold text-sky-400">Spatialytics OS</Link>
        <AppNav />
      </header>
      <section className="max-w-6xl mx-auto px-6 py-10 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Spatial Kanban / Lease Pipeline</h1>
          <p className="text-slate-400 text-sm mt-2">
            Track proposed sites by stage. Full CRM wiring comes next.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {stages.map((stage) => (
            <div key={stage} className="rounded-xl border border-slate-800 bg-slate-900 min-h-[220px] p-3">
              <h2 className="text-xs uppercase tracking-wider text-slate-500 mb-3">{stage}</h2>
              <div className="rounded-lg border border-dashed border-slate-700 p-3 text-xs text-slate-500">
                Drop a property here
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
