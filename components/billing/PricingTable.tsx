'use client';

import React, { useState } from 'react';

const tiers = [
  {
    name: 'Starter',
    price: '$29',
    period: '/month',
    description: 'Perfect for single-location shops and independent retailers scouting new spots.',
    features: ['Site Selection Scorer', 'Customer CSV Upload & Clustering', 'Basic Demographics Layer', 'Standard Map Support'],
    priceId: 'price_starter_monthly',
  },
  {
    name: 'Growth',
    price: '$79',
    period: '/month',
    description: 'Ideal for mobile fleets, multi-location operators, and growing service teams.',
    features: ['Everything in Starter', 'Field Service Route Optimizer', 'Sales & Franchise Territory Planner', 'White Space Opportunity Finder', 'Executive PDF Pitch Deck Export'],
    priceId: 'price_growth_monthly',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: '$199',
    period: '/month',
    description: 'For small franchisors, community orgs, and regional multi-unit operators.',
    features: ['Everything in Growth', 'Multi-User Collaboration Seats', 'Custom GIS Data Layer Ingestion', 'Priority AI Copilot Processing', 'Dedicated Support'],
    priceId: 'price_enterprise_monthly',
  },
];

export default function PricingTable({ tenantId, userEmail }: { tenantId: string; userEmail: string }) {
  const [loadingTier, setLoadingTier] = useState<string | null>(null);

  const handleSubscribe = async (priceId: string) => {
    setLoadingTier(priceId);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, tenantId, customerEmail: userEmail }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url; // Redirect to secure Stripe Checkout
      }
    } catch (err) {
      console.error('Failed to initialize checkout', err);
    } finally {
      setLoadingTier(null);
    }
  };

  return (
    <div className="py-12 px-6 max-w-7xl mx-auto text-slate-100">
      <div className="text-center max-w-2xl mx-auto mb-16">
        <h2 className="text-3xl font-black tracking-tight text-sky-400 sm:text-4xl">Simple, Transparent Pricing</h2>
        <p className="mt-4 text-slate-400 text-sm">Empower your small business with enterprise-grade location intelligence without the enterprise price tag.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {tiers.map((tier) => (
          <div 
            key={tier.name}
            className={`relative rounded-2xl bg-slate-900 border p-8 flex flex-col justify-between shadow-xl ${
              tier.popular ? 'border-sky-500 ring-2 ring-sky-500/20' : 'border-slate-800'
            }`}
          >
            {tier.popular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-sky-500 text-slate-950 text-xs font-bold uppercase tracking-wider rounded-full">
                Most Popular
              </span>
            )}

            <div>
              <h3 className="text-lg font-bold text-slate-100">{tier.name}</h3>
              <p className="text-xs text-slate-400 mt-2">{tier.description}</p>
              <div className="mt-6 flex items-baseline">
                <span className="text-4xl font-black text-slate-100">{tier.price}</span>
                <span className="ml-1 text-xs text-slate-400">{tier.period}</span>
              </div>

              <ul className="mt-8 space-y-3 text-xs text-slate-300">
                {tier.features.map((feat, idx) => (
                  <li key={idx} className="flex items-center">
                    <span className="mr-2 text-sky-400 font-bold">✓</span> {feat}
                  </li>
                ))}
              </ul>
            </div>

            <button
              onClick={() => handleSubscribe(tier.priceId)}
              disabled={loadingTier === tier.priceId}
              className={`mt-8 w-full py-2.5 rounded-xl font-semibold text-xs transition-colors shadow-lg ${
                tier.popular 
                  ? 'bg-sky-600 hover:bg-sky-500 text-white shadow-sky-900/30' 
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              {loadingTier === tier.priceId ? 'Redirecting...' : `Choose ${tier.name}`}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
