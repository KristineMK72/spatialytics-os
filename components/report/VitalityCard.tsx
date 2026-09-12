'use client';

import React from 'react';

interface VitalityCardProps {
  selectedLocation?: {
    name: string;
    address: string;
    vitalityScore: number;
    demographics: {
      medianIncome: string;
      footTrafficIndex: string;
      competitorCount: number;
    };
  } | null;
  onExportPdf: () => void;
}

export default function VitalityCard({ selectedLocation, onExportPdf }: VitalityCardProps) {
  if (!selectedLocation) {
    return (
      <div className="absolute bottom-6 right-6 z-20 w-80 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-4 shadow-2xl text-slate-400 text-sm">
        <p>💡 Click a store pin or zone on the map to inspect its location intelligence scorecard.</p>
      </div>
    );
  }

  return (
    <div className="absolute bottom-6 right-6 z-20 w-96 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-xl p-5 shadow-2xl text-slate-100 space-y-4">
      <div className="flex items-start justify-between border-b border-slate-800 pb-3">
        <div>
          <h2 className="font-bold text-base text-slate-100">{selectedLocation.name}</h2>
          <p className="text-xs text-slate-400">{selectedLocation.address}</p>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-2xl font-black text-sky-400">{selectedLocation.vitalityScore}</span>
          <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Vitality Score</span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
          <span className="block text-xs text-slate-400">Median Income</span>
          <span className="text-sm font-semibold text-slate-200">{selectedLocation.demographics.medianIncome}</span>
        </div>
        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
          <span className="block text-xs text-slate-400">Foot Traffic</span>
          <span className="text-sm font-semibold text-slate-200">{selectedLocation.demographics.footTrafficIndex}</span>
        </div>
        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
          <span className="block text-xs text-slate-400">Competitors</span>
          <span className="text-sm font-semibold text-slate-200">{selectedLocation.demographics.competitorCount}</span>
        </div>
      </div>

      {/* Action Button */}
      <button
        onClick={onExportPdf}
        className="w-full py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-lg shadow-sky-900/20"
      >
        Export Executive Pitch Deck (PDF)
      </button>
    </div>
  );
}
