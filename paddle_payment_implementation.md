After a thorough review of the credit addition and subscription management logic, I have identified some critical issues that need to be addressed to ensure the system is robust and functions as intended.

### Summary of Findings

The current system correctly handles credit allocation for new monthly subscriptions and renewals. However, there are significant flaws in the logic for yearly subscriptions and a potential issue with the cancellation process.

### Critical Issue: Yearly Subscriptions Do Not Receive Monthly Credits

The most significant problem is that **users on a yearly plan will not receive their monthly credit allotment**. Here's why:

*   **Reliance on Webhooks:** The system relies entirely on the `subscription.updated` event from Paddle to trigger a credit refill.
*   **Paddle's Behavior:** For a yearly subscription, Paddle only sends this event upon the initial purchase and then once a year upon renewal. It does **not** send a webhook every month.
*   **The Consequence:** Your backend logic to add credits is only triggered annually for yearly subscribers, while your pricing page promises them monthly credits. This will lead to customer complaints and a poor user experience.

### Secondary Issue: Immediate Credit Revocation on Cancellation

When a user cancels their subscription (`subscription.canceled` event), their credits are immediately set to zero.

*   **Problem:** Standard practice and user expectation is that they should be able to use the credits they've paid for until the end of their current billing period (monthly or yearly). Revoking them immediately is likely to be perceived as unfair.

### How the System Currently Works

*   **`app/api/paddle-webhook/route.ts`**: This endpoint manages credits for **paid users**. It adds credits when a subscription is created or updated. As noted, this is insufficient for yearly plans.
*   **`app/api/ensure-credits/route.ts`**: This endpoint correctly handles credit refills for **free users only**, giving them 8 credits each month. It is not involved in the logic for paid subscribers.
*   **`components/PricingClient.tsx`**: The frontend clearly advertises "300 monthly credits" and "1,000 monthly credits" for the Student and Pro plans, respectively, regardless of whether the user chooses a monthly or yearly billing cycle.

### Recommendations for a More Robust System

To fix these issues and make your credit system solid, I recommend the following changes:

1.  **Implement a Reliable Monthly Credit Refill Mechanism:** You cannot rely on Paddle webhooks for this. Instead, you should create a system that runs independently to check for and refill credits. A common approach is to use a **cron job** that runs daily.

    *   **Cron Job Logic:**
        1.  Fetch all active subscriptions from your `subscriptions` table.
        2.  For each subscription, check the `last_refilled_at` date in the `user_credits` table.
        3.  If the `last_refilled_at` date is more than a month ago, refill the user's credits based on their plan (300 for Student, 1,000 for Pro) and update the `last_refilled_at` timestamp to the current date.

2.  **Adjust Cancellation Logic:** Modify the `subscription.canceled` webhook handler. Instead of setting credits to 0, you should simply update the subscription status to `canceled` in your database. This allows the user to continue using their remaining credits until their subscription period officially ends. The daily cron job would then naturally stop refilling their credits since their subscription is no longer "active".

By implementing these changes, you will ensure that all users, regardless of their subscription plan, receive the credits they are promised in a timely and fair manner. This will create a more reliable and trustworthy system.