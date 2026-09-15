'use client';

import { useState } from 'react';
import Link from 'next/link';
import AppNav from '@/components/AppNav';

export default function SustainabilityPage() {
  const [result, setResult] = useState('Run an eco-index request for a selected site.');

  const run = async () => {
    setResult('Calculating...');
    try {
      const res = await fetch('/api/sustainability', { method: 'POST' });
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
        <h1 className="text-2xl font-bold">Sustainability Toolkit</h1>
        <button onClick={run} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-medium">
          Run eco index
        </button>
        <pre className="text-xs bg-slate-900 border border-slate-800 rounded-xl p-4 overflow-auto max-h-[420px] text-slate-300">{result}</pre>
      </section>
    </main>
  );
}
