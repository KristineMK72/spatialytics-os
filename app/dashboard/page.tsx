'use client';

import React, { useState } from 'react';
import MapView from '@/components/map/MapView';
import VitalityCard from '@/components/report/VitalityCard';

export default function DashboardPage() {
  const [prompt, setPrompt] = useState('');
  const [spatialData, setSpatialData] = useState<GeoJSON.FeatureCollection | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastResponse, setLastResponse] = useState<string | null>(null);

  const handleCopilotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setLastResponse(null);

    try {
      const res = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      const data = await res.json();

      // ✔ FIXED: Your API returns { type, features, meta }
      if (data.features && Array.isArray(data.features)) {
        const fc: GeoJSON.FeatureCollection = {
          type: data.type || 'FeatureCollection',
          features: data.features,
        };

        setSpatialData(fc);

        const count = data.features.length ?? 0;
        const layer = data.meta?.layer || 'features';
        setLastResponse(`Returned ${count} ${layer}.`);
      } else {
        setLastResponse(data.error || 'No results');
      }
    } catch (err) {
      console.error('Failed to execute spatial query', err);
      setLastResponse('Request failed — check DATABASE_URL');
    } finally {
      setLoading(false);
    }
  };

  const examplePrompts = [
    'Map all store locations and scores',
    'Show me high-value customer clusters',
    'Show competitors',
    'Display trade areas',
  ];

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Sidebar */}
      <aside className="w-96 flex flex-col border-r border-slate-800 bg-slate-900 z-10 shrink-0">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-lg tracking-tight text-sky-400">Spatialytics OS</h1>
            <p className="text-[11px] text-slate-500 mt-0.5">Command Center</p>
          </div>
          <span className="text-xs px-2 py-1 rounded bg-sky-950 text-sky-300 border border-sky-800">
            v0.3
          </span>
        </div>

        {/* Chat feed */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/50 text-sm">
            <p className="text-slate-300">
              👋 Connected to Neon. Ask for stores, customers, competitors, or trade areas.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Try</p>
            {examplePrompts.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setPrompt(ex)}
                className="block w-full text-left text-xs px-3 py-2 rounded-md bg-slate-800/40 hover:bg-slate-800 border border-slate-700/40 text-slate-300 transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>

          {lastResponse && (
            <div className="p-3 rounded-lg bg-sky-950/40 border border-sky-800/50 text-sm text-sky-200">
              {lastResponse}
            </div>
          )}
        </div>

        {/* Prompt form */}
        <form onSubmit={handleCopilotSubmit} className="p-4 border-t border-slate-800 bg-slate-900/80">
          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., Map all store locations and scores"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 resize-none h-24"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              className="absolute bottom-3 right-3 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium rounded-md transition-colors disabled:opacity-50"
            >
              {loading ? 'Analyzing…' : 'Run Analysis'}
            </button>
          </div>
        </form>
      </aside>

      {/* Map workspace */}
      <section className="flex-1 relative h-full min-w-0">
        <MapView geoJsonData={spatialData} />
        <VitalityCard selectedLocation={null} onExportPdf={() => {}} />
      </section>
    </main>
  );
}
