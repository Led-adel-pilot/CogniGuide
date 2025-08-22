import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: NextRequest) {
  try {
    // Secure the endpoint
    const authToken = (req.headers.get('authorization') || '').replace('Bearer ', '');
    if (authToken !== process.env.CRON_SECRET) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { data: subscriptions, error } = await supabase
      .from('subscriptions')
      .select(`
        user_id,
        plan,
        user_credits (
          last_refilled_at
        )
      `)
      .eq('status', 'active');

    if (error) {
      throw error;
    }

    for (const subscription of subscriptions) {
      if (!subscription.user_credits || subscription.user_credits.length === 0) {
        console.warn(`User ${subscription.user_id} has an active subscription but no user_credits entry.`);
        continue;
      }
      const lastRefilledAt = new Date(subscription.user_credits[0].last_refilled_at);
      const now = new Date();
      const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());

      if (lastRefilledAt < oneMonthAgo) {
        const credits = subscription.plan === process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_STUDENT_MONTH || subscription.plan === process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_STUDENT_YEAR ? 300 : 1000;

        await supabase.from('user_credits').upsert({
          user_id: subscription.user_id,
          credits: credits,
          last_refilled_at: now.toISOString(),
          updated_at: now.toISOString(),
        }, { onConflict: 'user_id' });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error refilling credits:', error.message);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
