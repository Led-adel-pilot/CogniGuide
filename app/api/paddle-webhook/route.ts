import { NextRequest, NextResponse } from "next/server";
import { Readable } from 'stream';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper function to buffer the request stream
async function buffer(readable: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await buffer(req.body as any);
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

    const event = JSON.parse(rawBody.toString());

    // Handle the event
    switch (event.event_type) {
      case 'subscription.created': {
        const { customer_id, id: subscription_id, status, items, custom_data } = event.data;
        const user_id = custom_data?.user_id;

        if (!user_id) {
          console.error('User ID not found in custom_data for subscription.created event');
          break;
        }

        const plan = items[0]?.price.id; // Adjust based on your pricing structure

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
          plan,
        });

        // Assign credits
        const credits = plan === process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_STUDENT_MONTH || plan === process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_STUDENT_YEAR ? 300 : 1000;
        await supabase.from('user_credits').upsert({
          user_id,
          credits,
          last_refilled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
        break;
      }
      case 'subscription.updated': {
        const { id: subscription_id, status, items } = event.data;
        const plan = items[0]?.price.id;

        const { data: subscription, error: subscriptionError } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('paddle_subscription_id', subscription_id)
          .single();

        if (subscriptionError || !subscription) {
          console.error('Subscription not found for paddle_subscription_id:', subscription_id);
          break;
        }

        const { user_id } = subscription;

        // Update subscription
        await supabase
          .from('subscriptions')
          .update({ status, plan, updated_at: new Date().toISOString() })
          .eq('paddle_subscription_id', subscription_id);

        // Update credits on plan change or renewal
        const credits = plan === process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_STUDENT_MONTH || plan === process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_STUDENT_YEAR ? 300 : 1000;
        await supabase.from('user_credits').upsert({
          user_id,
          credits,
          last_refilled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
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

        const { user_id } = subscription;

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
  } catch (error: any) {
    console.error('Error handling Paddle webhook:', error.message);
    return new NextResponse('Webhook Error', { status: 400 });
  }
}
