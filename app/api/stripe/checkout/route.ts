import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'mock_key', {
  apiVersion: '2024-06-20', // Compatible with stripe@16 types
});

export async function POST(req: Request) {
  try {
    const { priceId, tenantId, customerEmail } = await req.json();

    if (!priceId || !tenantId) {
      return NextResponse.json({ error: 'Missing price ID or tenant ID' }, { status: 400 });
    }

    // Create Stripe Checkout Session for recurring SaaS subscription
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: customerEmail,
      line_items: [
        {
          price: priceId, // Stripe Price ID (e.g., price_1Nx... for Growth tier)
          quantity: 1,
        },
      ],
      metadata: {
        tenantId,
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?subscription=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?subscription=canceled`,
    });

    return NextResponse.json({ success: true, url: session.url });

  } catch (error: any) {
    console.error('Stripe Checkout Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
