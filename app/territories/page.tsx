'use client';

import { useState } from 'react';
import Link from 'next/link';
import AppNav from '@/components/AppNav';

export default function TerritoriesPage() {
  const [result, setResult] = useState('Run a territory request to see coverage.');

  const run = async () => {
    setResult('Calculating...');
    try {
      const res = await fetch('/api/optimize-route/territories', { method: 'POST' });
      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setResult(String(err));
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-bold text-sky-400">Spatialytics OS</Link>
        <AppNav />
      </header>
      <section className="max-w-4xl mx-auto px-6 py-10 space-y-6">
        <h1 className="text-2xl font-bold">Territory Planner</h1>
        <button onClick={run} className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-sm font-medium">
          Generate territories
        </button>
        <pre className="text-xs bg-slate-900 border border-slate-800 rounded-xl p-4 overflow-auto max-h-[420px] text-slate-300">{result}</pre>
      </section>
    </main>
  );
}
