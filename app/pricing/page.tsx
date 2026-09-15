import Link from 'next/link';
import PricingTable from '@/components/billing/PricingTable';
import AppNav from '@/components/AppNav';

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-bold text-sky-400">Spatialytics OS</Link>
        <AppNav />
      </header>
      <PricingTable tenantId="demo" userEmail="owner@example.com" />
    </main>
  );
}
