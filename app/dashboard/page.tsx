'use client';

import React, { useState } from 'react';
import MapView from '@/components/map/MapView';

export default function DashboardPage() {
  const [prompt, setPrompt] = useState('');
  const [spatialData, setSpatialData] = useState<GeoJSON.FeatureCollection | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCopilotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      setSpatialData(data.geoJson);
    } catch (err) {
      console.error('Failed to execute spatial query', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* AI Copilot & Control Sidebar */}
      <aside className="w-96 flex flex-col border-r border-slate-800 bg-slate-900 z-10">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h1 className="font-bold text-lg tracking-tight text-sky-400">Spatialytics OS</h1>
          <span className="text-xs px-2 py-1 rounded bg-sky-950 text-sky-300 border border-sky-800">v1.0 MVP</span>
        </div>

        {/* Chat / Prompt Feed */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/50 text-sm">
            <p className="text-slate-300">👋 Welcome! Ask me to analyze locations, map customer clusters, or run trade-area scores in plain English.</p>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleCopilotSubmit} className="p-4 border-t border-slate-800 bg-slate-900/80">
          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., Show me high-value customer clusters outside a 10-minute drive..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 resize-none h-24"
            />
            <button
              type="submit"
              disabled={loading}
              className="absolute bottom-3 right-3 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium rounded-md transition-colors disabled:opacity-50"
            >
              {loading ? 'Analyzing...' : 'Run Analysis'}
            </button>
          </div>
        </form>
      </aside>

      {/* Map Canvas Workspace */}
      <section className="flex-1 relative h-full">
        <MapView geoJsonData={spatialData} />
      </section>
    </main>
  );
}
