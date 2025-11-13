import { NextRequest, NextResponse } from "next/server";
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { getCreditsByPriceId, PAID_PLANS, type Plan } from "@/lib/plans";

type BillingCycle = 'month' | 'year';
type PaddleWebhookEventType = 'subscription.created' | 'subscription.updated' | 'subscription.canceled' | string;

interface PaddleWebhookItem {
  price?: { id?: string };
  price_id?: string;
  priceId?: string;
}

interface PaddleWebhookEvent {
  event_type: PaddleWebhookEventType;
  data: {
    customer_id?: string;
    id: string;
    status: string;
    items?: PaddleWebhookItem[];
    custom_data?: unknown;
  };
}

interface PaddleCustomData {
  user_id?: string;
  plan_key?: string;
  billing_cycle?: string;
  [key: string]: unknown;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

function normalizeCustomData(raw: unknown): PaddleCustomData {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object') {
    return raw as PaddleCustomData;
  }
  return {};
}

function getPlanIdentifier(
  items: PaddleWebhookItem[] | undefined,
  planKey: Plan | null,
  billingCycle: BillingCycle | null,
): string | null {
  const priceFromItems = items?.[0]?.price?.id ?? items?.[0]?.price_id ?? items?.[0]?.priceId ?? null;
  if (priceFromItems) {
    return priceFromItems;
  }
  if (planKey && billingCycle) {
    const planDetails = PAID_PLANS[planKey];
    if (planDetails?.priceIds?.[billingCycle]) {
      return planDetails.priceIds[billingCycle];
    }
  }
  if (planKey) {
    return planKey;
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = Buffer.from(await req.arrayBuffer());
    const signature = req.headers.get('paddle-signature') || '';
    const secret = process.env.PADDLE_WEBHOOK_SECRET || '';

    if (!signature || !secret) {
      return new NextResponse('Signature or secret missing', { status: 401 });
    }

    // 1. Extract timestamp and signature from header
    const parts = signature.split(';');
    const timestampPart = parts.find(part => part.startsWith('ts='));
    const h1Part = parts.find(part => part.startsWith('h1='));

    if (!timestampPart || !h1Part) {
      return new NextResponse('Invalid signature header', { status: 401 });
    }

    const timestamp = timestampPart.split('=')[1];
    const h1 = h1Part.split('=')[1];

    // 2. Build signed payload
    const signedPayload = `${timestamp}:${rawBody.toString()}`;

    // 3. Hash signed payload
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(signedPayload);
    const computedSignature = hmac.digest('hex');

    // 4. Compare signatures
    if (computedSignature !== h1) {
        return new NextResponse('Signature mismatch', { status: 401 });
    }

    const event = JSON.parse(rawBody.toString()) as PaddleWebhookEvent;

    // Handle the event
    switch (event.event_type) {
      case 'subscription.created': {
        const { customer_id, id: subscription_id, status, items, custom_data } = event.data;
        const normalizedCustomData = normalizeCustomData(custom_data);
        const planKey = (typeof normalizedCustomData.plan_key === 'string' && normalizedCustomData.plan_key in PAID_PLANS)
          ? normalizedCustomData.plan_key as Plan
          : null;
        const billingCycle = normalizedCustomData.billing_cycle === 'year' ? 'year'
          : normalizedCustomData.billing_cycle === 'month'
            ? 'month'
            : null;
        const user_id = normalizedCustomData?.user_id;

        if (!user_id) {
          console.error('User ID not found in custom_data for subscription.created event');
          break;
        }

        const planIdentifier = getPlanIdentifier(items, planKey, billingCycle);

        // Add to customers table
        await supabase.from('customers').insert({
          user_id,
          paddle_customer_id: customer_id,
        });

        // Create subscription
        await supabase.from('subscriptions').insert({
          user_id,
          paddle_subscription_id: subscription_id,
          status,
          plan: planIdentifier,
        });

        // Assign credits
        const credits = getCreditsByPriceId(planIdentifier || '');

        if (credits !== null) {
          await supabase.from('user_credits').upsert({
            user_id,
            credits,
            last_refilled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });
        } else {
          console.error(`Could not find credits for plan identifier: ${planIdentifier}`);
        }
        break;
      }
      case 'subscription.updated': {
        const { id: subscription_id, status, items } = event.data;

        const { data: subscription, error: subscriptionError } = await supabase
          .from('subscriptions')
          .select('user_id, plan')
          .eq('paddle_subscription_id', subscription_id)
          .single();

        if (subscriptionError || !subscription) {
          console.error('Subscription not found for paddle_subscription_id:', subscription_id);
          break;
        }

        const { user_id, plan: existingPlan } = subscription as { user_id: string; plan: string | null };
        const planIdentifier = getPlanIdentifier(items, null, null) ?? existingPlan;

        // Update subscription
        await supabase
          .from('subscriptions')
          .update({ status, plan: planIdentifier, updated_at: new Date().toISOString() })
          .eq('paddle_subscription_id', subscription_id);

        // Update credits on plan change or renewal
        const credits = getCreditsByPriceId(planIdentifier || '');

        if (credits !== null) {
          await supabase.from('user_credits').upsert({
            user_id,
            credits,
            last_refilled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });
        } else {
          console.error(`Could not find credits for plan identifier: ${planIdentifier}`);
        }
        break;
      }
      case 'subscription.canceled': {
        const { id: subscription_id, status } = event.data;

        const { data: subscription, error: subscriptionError } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('paddle_subscription_id', subscription_id)
          .single();

        if (subscriptionError || !subscription) {
          console.error('Subscription not found for paddle_subscription_id:', subscription_id);
          break;
        }

        // Update subscription status
        await supabase
          .from('subscriptions')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('paddle_subscription_id', subscription_id);

        
        break;
      }
      default:
        console.log(`Unhandled event type: ${event.event_type}`);
    }

    console.log('Received Paddle webhook:', event);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error handling Paddle webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ error: 'Webhook handler failed.', details: errorMessage }, { status: 500 });
  }
}
