'use client';

import React from 'react';

interface SustainabilityMetrics {
  name: string;
  floodRisk: string;
  parkDistanceMeters: number;
  walkabilityScore: number;
  solarPotentialKwh: number;
  ecoScorecardGrade: string;
}

export default function SustainabilityCard({ metrics }: { metrics: SustainabilityMetrics | null }) {
  if (!metrics) return null;

  return (
    <div className="absolute top-20 right-6 z-20 w-80 bg-slate-900/95 backdrop-blur-md border border-emerald-800/60 rounded-xl p-4 shadow-2xl text-slate-100 space-y-3">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">🌱 Eco & Impact Index</span>
        <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-black text-sm border border-emerald-800">
          {metrics.ecoScorecardGrade}
        </span>
      </div>

      <div className="space-y-2 text-xs text-slate-300">
        <div className="flex justify-between">
          <span className="text-slate-400">Flood Risk Proxy:</span>
          <span className="font-semibold text-slate-100">{metrics.floodRisk}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Nearest Green Space:</span>
          <span className="font-semibold text-slate-100">{metrics.parkDistanceMeters}m away</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Walkability Index:</span>
          <span className="font-semibold text-slate-100">{metrics.walkabilityScore} / 100</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Rooftop Solar Potential:</span>
          <span className="font-semibold text-slate-100">{metrics.solarPotentialKwh.toLocaleString()} kWh/yr</span>
        </div>
      </div>
    </div>
  );
}
