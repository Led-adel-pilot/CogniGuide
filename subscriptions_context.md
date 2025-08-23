# CogniGuide Subscriptions & Payments Context

## Overview
CogniGuide is a comprehensive AI-powered study assistant that uses a sophisticated subscription and credit-based payment system. The system integrates Paddle.js for payment processing, Supabase for user management and data persistence, and a custom credit system for usage tracking.

## Core Architecture Components

### 1. Payment Processing (Paddle.js Integration)

#### Environment Variables
```bash
# Paddle Configuration
NEXT_PUBLIC_PADDLE_ENV=sandbox # or production
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=your_paddle_client_side_token

# Price IDs for different plans and billing cycles
NEXT_PUBLIC_PADDLE_PRICE_ID_STUDENT_MONTH=pri_xxx
NEXT_PUBLIC_PADDLE_PRICE_ID_STUDENT_YEAR=pri_xxx
NEXT_PUBLIC_PADDLE_PRICE_ID_PRO_MONTH=pri_xxx
NEXT_PUBLIC_PADDLE_PRICE_ID_PRO_YEAR=pri_xxx

# Webhook Security
PADDLE_WEBHOOK_SECRET=your_paddle_webhook_secret

# Supabase (Service Role for Webhooks)
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

#### Paddle.js Implementation (`components/PricingClient.tsx`)

**Key Features:**
- **Dynamic Price Preview**: Uses `Paddle.PricePreview()` to show localized prices
- **Overlay Checkout**: Uses `Paddle.Checkout.open()` with overlay mode
- **Subscription Status Tracking**: Monitors current user's subscription status
- **Upgrade Flow Management**: Handles new user vs existing user upgrade flows
- **Authentication Integration**: Triggers auth modal for unauthenticated users

**Billing Cycle Toggle:**
```typescript
const [billingCycle, setBillingCycle] = useState<BillingCycle>('month');
```

**Price Fetching Logic:**
```typescript
const updatePrices = useCallback(async (cycle: BillingCycle) => {
  const PaddleObj = (window as any).Paddle;
  const request = {
    items: [
      { quantity: 1, priceId: PRICE_IDS.student[cycle] },
      { quantity: 1, priceId: PRICE_IDS.pro[cycle] },
    ],
  };
  const result = await PaddleObj.PricePreview(request);
  // Update prices in state
}, [paddleReady, isConfigured]);
```

### 2. Webhook Processing (`app/api/paddle-webhook/route.ts`)

#### Security Implementation
- **HMAC-SHA256 Verification**: Validates webhook signatures
- **Timestamp Validation**: Prevents replay attacks
- **Environment-Specific Processing**: Handles sandbox vs production

#### Webhook Payload Structure
```typescript
// Example webhook payload
{
  event_type: 'subscription.created' | 'subscription.updated' | 'subscription.canceled',
  data: {
    customer_id: string,
    id: string, // subscription_id
    status: string,
    items: Array<{
      price: {
        id: string // Price ID from environment variables
      }
    }>,
    custom_data: {
      user_id: string // Supabase user ID
    }
  }
}
```

#### Event Handlers

**Subscription Created:**
```typescript
case 'subscription.created': {
  // 1. Extract data
  const { customer_id, id: subscription_id, status, items, custom_data } = event.data;
  const user_id = custom_data?.user_id;
  const plan = items[0]?.price.id;

  // 2. Create customer record
  await supabase.from('customers').insert({
    user_id,
    paddle_customer_id: customer_id,
  });

  // 3. Create subscription record
  await supabase.from('subscriptions').insert({
    user_id,
    paddle_subscription_id: subscription_id,
    status,
    plan,
  });

  // 4. Provision initial credits
  const credits = plan === process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_STUDENT_MONTH
    || plan === process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_STUDENT_YEAR
    ? 300 : 1000;
  await supabase.from('user_credits').upsert({
    user_id,
    credits,
    last_refilled_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  break;
}
```

**Subscription Updated:**
- Updates subscription status and plan
- Adjusts credit allocation based on new plan
- Maintains `last_refilled_at` timestamp

**Subscription Canceled:**
- Updates subscription status to 'canceled'
- Does NOT revoke credits (allows continued usage until expiration)

### 3. Credit System Architecture

#### Credit Calculation Formula
```typescript
const ONE_CREDIT_CHARS = 3800; // 1 credit = 3800 characters
const creditsRaw = totalRawChars > 0 ? (totalRawChars / ONE_CREDIT_CHARS) : 0;
```

#### Credit Deduction Logic (`app/api/generate-mindmap/route.ts`)

**Minimum Credit Enforcement:**
```typescript
let creditsNeeded = creditsRaw;

// Image-only requests: minimum 0.5 credits
if (imageParts.length > 0 && creditsNeeded < 0.5) {
  creditsNeeded = 0.5;
}

// Prompt-only requests: minimum 1 credit
if (isPromptOnly && creditsNeeded < 1) {
  creditsNeeded = 1;
}
```

**Credit Deduction Process:**
1. **Reserve Credits**: Deduct credits before processing begins
2. **Process Request**: Generate mind map or flashcards
3. **Refund on Failure**: If streaming fails before any data is sent, refund reserved credits
4. **Partial Failure**: If some data sent but process fails, do not refund

#### Free Tier Management

**Monthly Free Credits (`app/api/ensure-credits/route.ts`):**
- **Free Users**: 8 credits per calendar month
- **Reset Logic**: Credits reset on the 1st of each month (UTC)
- **Subscription Override**: Users with active subscriptions bypass free credit system
- **Automatic Provisioning**: Credits are auto-provisioned when user accesses dashboard

```typescript
function isSameUtcMonth(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
}
```

#### Subscription Credit Refill (`app/api/refill-credits/route.ts`)

**Automated Monthly Refill:**
- **Cron-Triggered**: External cron job calls this endpoint
- **Active Subscription Check**: Only refills users with active subscriptions
- **Monthly Allocation**:
  - Student Plan: 300 credits
  - Pro Plan: 1000 credits
- **Refill Logic**: Only refills if `last_refilled_at` is more than a month old

### 4. Database Schema

#### Core Tables

**customers**
```sql
create table public.customers (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  paddle_customer_id text not null,
  created_at timestamp with time zone not null default now(),
  constraint customers_pkey primary key (id),
  constraint customers_paddle_customer_id_key unique (paddle_customer_id),
  constraint customers_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade
)
```

**user_credits**
```sql
create table public.user_credits (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  credits numeric(12, 6) not null default 0,
  last_refilled_at timestamp with time zone null,
  updated_at timestamp with time zone not null default now(),
  constraint user_credits_pkey primary key (id),
  constraint user_credits_user_id_key unique (user_id),
  constraint user_credits_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade,
  constraint user_credits_nonnegative check ((credits >= (0)::numeric))
)
```

**subscriptions**
```sql
create table public.subscriptions (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  paddle_subscription_id text not null,
  status text null,
  plan text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint subscriptions_pkey primary key (id),
  constraint subscriptions_paddle_subscription_id_key unique (paddle_subscription_id),
  constraint subscriptions_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade
)
```

**flashcards_schedule** (Spaced Repetition)
```sql
create table public.flashcards_schedule (
  user_id uuid not null,
  deck_id uuid not null,
  exam_date date null,
  schedules jsonb not null default '[]'::jsonb,
  updated_at timestamp with time zone not null default now(),
  constraint flashcards_schedule_pkey primary key (user_id, deck_id),
  constraint flashcards_schedule_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade
)
```

### 5. User Interface Components

#### Pricing Modal (`components/PricingModal.tsx`)
- **Modal Container**: Responsive design with rounded corners
- **Integration**: Wraps `PricingClient` component
- **Purchase Callback**: Refreshes credits after successful purchase
- **Close Handler**: Manages localStorage flags for upgrade flow

#### Dashboard Integration (`app/dashboard/DashboardClient.tsx`)
- **Real-time Credit Display**: Shows current credit balance
- **Upgrade Button**: Prominent upgrade CTA in main content area
- **Settings Panel**: Credit balance display and pricing access
- **Error Handling**: Inline upgrade button for insufficient credits errors

#### Credit Display Logic
```typescript
// Real-time credit updates via Supabase realtime
useEffect(() => {
  const channel = supabase
    .channel(`user_credits_change_${user.id}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'user_credits',
      filter: `user_id=eq.${user.id}`,
    }, (payload) => {
      if (payload.new && typeof (payload.new as any).credits === 'number') {
        setCredits(Number((payload.new as any).credits ?? 0));
      }
    })
    .subscribe();
  return () => supabase.removeChannel(channel);
}, [user]);
```

### 6. Authentication & Upgrade Flow

#### Upgrade Flow Mechanics
1. **Unauthenticated Users**:
   - Set `localStorage.cogniguide_upgrade_flow = 'true'`
   - Trigger authentication modal
   - After auth, redirect to `/dashboard?upgrade=true`
   - Auto-open pricing modal

2. **Authenticated Users**:
   - Direct access to pricing modal
   - Immediate Paddle overlay checkout

#### LocalStorage Flags
```typescript
// Set when unauthenticated user initiates upgrade
localStorage.setItem('cogniguide_upgrade_flow', 'true');

// Set after successful auth to trigger pricing modal
localStorage.setItem('cogniguide_open_upgrade', 'true');

// Cleared after modal interaction
localStorage.removeItem('cogniguide_open_upgrade');
localStorage.removeItem('cogniguide_upgrade_flow');
```

### 7. Error Handling & User Experience

#### Insufficient Credits Flow
- **API Response**: `402 Insufficient credits. Please upgrade your plan or top up.`
- **UI Response**: 
  - Inline error message with upgrade button
  - Different behavior for auth vs non-auth users
  - Automatic redirect to appropriate upgrade flow

#### Authentication Requirements
- **All Generation Endpoints**: Require `Authorization: Bearer <token>` header
- **Credit Deduction**: Only authenticated users can consume credits
- **Free Generation**: Landing page allows one free generation per browser session

### 8. Subscription Plans & Pricing

#### Plan Tiers

**Free Plan:**
- 8 monthly credits (auto-refilled)
- Basic features only
- No subscription required

**Student Plan ($X/month or $X/year):**
- 300 monthly credits
- All features including spaced repetition
- "Most Popular" designation
- Annual discount available

**Pro Plan ($X/month or $X/year):**
- 1000 monthly credits
- All features
- Higher volume usage
- Annual discount available

#### Credit Usage Examples
```
1 credit = 3800 characters ≈
- 10 slides of content
- 2-page PDF document
- 2 images for OCR
- Minimum 1 credit for prompt-only requests
- Minimum 0.5 credits for image-only requests
```

### 9. Spaced Repetition Integration

#### Credit System Integration
- **No Additional Credits**: Spaced repetition uses existing credits
- **Free Tier Compatible**: Works with monthly free credits
- **Usage Tracking**: Each review session consumes credits based on content
- **Schedule Persistence**: Stored in `flashcards_schedule` table
- **Due Date Management**: Exam dates constrain future review scheduling

### 10. Security & Compliance

#### Webhook Security
- **HMAC Verification**: SHA256 signature validation
- **Timestamp Checks**: Prevents replay attacks
- **Environment Isolation**: Separate handling for sandbox vs production

#### Credit Security
- **Server-Side Deduction**: All credit calculations done server-side
- **Atomic Operations**: Credit deduction and content generation in single transaction
- **Refund Logic**: Automatic refunds for complete failures
- **Audit Trail**: All credit transactions logged via Supabase

#### Data Privacy
- **User Isolation**: RLS policies ensure users only see their own data
- **Secure Tokens**: Service role key for admin operations
- **Environment Variables**: Sensitive data stored as env vars

### 11. Monitoring & Analytics

#### Key Metrics to Track
- **Credit Consumption**: Per user, per plan tier
- **Conversion Rates**: Free → Student → Pro
- **Churn Analysis**: Subscription cancellation patterns
- **Usage Patterns**: Peak usage times, feature adoption
- **Error Rates**: Webhook failures, credit deduction issues

#### Logging Points
- Webhook receipt and processing
- Credit deduction attempts
- Refund operations
- Authentication state changes
- Purchase completions

### 12. Business Logic Edge Cases

#### Credit Edge Cases
- **Zero Credit Balance**: Clear error messaging with upgrade path
- **Partial Credit Deduction**: No refunds for partial content delivery
- **Concurrent Requests**: Sequential processing to prevent race conditions
- **Subscription Status Changes**: Immediate credit adjustments via webhooks

#### User Experience Edge Cases
- **Network Interruptions**: Graceful handling of failed requests
- **Browser Restrictions**: localStorage availability checks
- **Multiple Tabs**: Consistent state across browser tabs
- **Mobile Responsiveness**: All modals and flows work on mobile

### 13. Future Extensibility

#### Potential Enhancements
- **Credit Gifting**: Allow users to gift credits to others
- **Credit Pools**: Team or organization credit sharing
- **Dynamic Pricing**: AI-based pricing adjustments
- **Credit Marketplace**: Buy/sell unused credits
- **Usage Analytics**: Detailed breakdown of credit consumption
- **Budget Controls**: Spending limits and notifications

#### Integration Points
- **Analytics Platforms**: Segment, Mixpanel for user behavior
- **CRM Integration**: Customer data synchronization
- **Email Marketing**: Automated upgrade suggestions
- **Support Ticketing**: Credit-related support automation

This comprehensive system provides a robust foundation for subscription management, credit tracking, and user monetization while maintaining excellent user experience and security standards.
