Title: Build and deploy a Next.js app with Vercel and Supabase - Paddle Developer

URL Source: https://developer.paddle.com/build/nextjs-supabase-vercel-starter-kit

Markdown Content:
Get a step-by-step overview of how to build a Next.js app with Paddle Billing, including a localized pricing page, integrated inline checkout, and screens for customers to manage their payments.

Next.js is an open source web development framework that you can use to create high-quality web apps. It's built on top of React, a popular JavaScript library for building user interfaces, and includes a range of features designed to make building web apps easier.

You can use our Paddle Billing SaaS starter kit to quickly create and deploy a Next.js app that includes everything you need for subscription billing — including a localized pricing page, integrated checkout, auth and user management, and screens for customers to manage their payments.

![Image 1: Grid of logos used in the starter kit: Paddle, Supabase, Next.js, and Vercel.](https://developer.paddle.com/assets/images/vercel-logos-20240912.svg)

[What are we building?](https://developer.paddle.com/build/nextjs-supabase-vercel-starter-kit#objectives)
---------------------------------------------------------------------------------------------------------

In this tutorial, we'll create a Next.js app that's integrated with Paddle Billing and deploy it to Vercel. Our app includes:

*   A beautiful, three-tier pricing page that's fully localized for 200+ markets.

*   A high-converting checkout that's fully integrated with your app, built with [Paddle Checkout](https://developer.paddle.com/concepts/sell/self-serve-checkout).

*   User management and auth handled by [Supabase](https://supabase.com/).

*   Ready-made screens to let customers manage their payments and subscriptions.

*   Automatic syncing of customer and subscription data between Paddle and your app [using webhooks](https://developer.paddle.com/webhooks/overview).

Check out the demo at **[`paddle-billing.vercel.app`](https://paddle-billing.vercel.app/)**.

![Image 2: Illustration showing two screens from the starter kit: the pricing page and a subscription screen. The pricing page has three tiers on it, with a toggle for monthly and annual.](https://developer.paddle.com/assets/images/hero-starter-kit-20240911.png)

We'll learn how to:

*   Set up Paddle Billing in sandbox.

*   Create a notification destination for syncing data.

*   Create products and prices for our SaaS app.

*   Configure and deploy a Next.js app to Vercel.

*   Take a test payment.

*   Transition from sandbox to live.

[Before you begin](https://developer.paddle.com/build/nextjs-supabase-vercel-starter-kit#prerequisites)
-------------------------------------------------------------------------------------------------------

### [Sign up for Paddle](https://developer.paddle.com/build/nextjs-supabase-vercel-starter-kit#paddle-prerequisites)

Paddle Billing is a complete digital product sales and subscription management platform, designed for modern software businesses. Our API-first platform takes care of payments, localization, and subscription management for you.

You'll need a Paddle account to get started. You can sign up for two kinds of account:

*   Sandbox — for testing and evaluation

*   Live — for selling to customers

For this tutorial, we recommend [signing up for a sandbox account](https://sandbox-login.paddle.com/signup). You can transition to a live account later when you've built your integration and you're ready to start selling.

> If you sign up for a live account, you'll need to complete account verification. This is where we ask for some information from you to make sure that we can work together. While we're verifying your account, you can't launch a checkout or sell on the Paddle platform.

### [Sign up for Vercel and Supabase](https://developer.paddle.com/build/nextjs-supabase-vercel-starter-kit#other-accounts-prerequisites)

As part of our tutorial, we're going to deploy our app to Vercel and use Supabase.

*   [Vercel](https://vercel.com/) is a developer platform that you can use to host and deploy web apps using serverless technology, designed for [Next.js](https://nextjs.org/). We'll deploy our app to Vercel.

*   [Supabase](https://supabase.com/) is a developer platform that includes databases, authentication, and other features. Our app integrates with Supabase to handle user management and authentication, as well as syncing customer data with Paddle Billing using webhooks.

If you don't have Vercel and Supabase accounts, you'll need to sign up — it's free to get started.

You'll also need a Git provider to store the code that powers your app. When deploying to Vercel, the deployment screen walks you through setting up an account with [GitHub](https://github.com/) (recommended), [GitLab](https://gitlab.com/), or [Bitbucket](https://bitbucket.org/), if you don't already have one.

### [Set up your local environment](https://developer.paddle.com/build/nextjs-supabase-vercel-starter-kit#dev-env-prerequisites)

To work on the starter kit locally, you'll need an IDE like [Visual Studio Code](https://code.visualstudio.com/) and:

You don't need to set up your local development environment to get a working demo on Vercel, so you can come back to this later when you're ready to start building.

[Overview](https://developer.paddle.com/build/nextjs-supabase-vercel-starter-kit#tutorial-steps)
------------------------------------------------------------------------------------------------

Create and deploy a Next.js app integrated with Paddle Billing in four steps:

3.   [**Add your website and test**](https://developer.paddle.com/build/nextjs-supabase-vercel-starter-kit#test-domain-approval)

Add your website to Paddle, then give your app a spin — take a test payment and explore the customer billing screens. 

[1. Start deploy to Vercel](https://developer.paddle.com/build/nextjs-supabase-vercel-starter-kit#deploy-vercel)
----------------------------------------------------------------------------------------------------------------

To create a Vercel project ready for us to set up, click the button to get started:

### [Create Git repo](https://developer.paddle.com/build/nextjs-supabase-vercel-starter-kit#clone-deploy-vercel)

First, create a clone of our starter kit repo. This creates a copy of the code in a repo in your Git provider account, so you can build your app on top of our project.

Click the **Continue with GitHub**, **Continue with GitLab**, or **Continue with Bitbucket** buttons to connect your Git provider to Vercel, if you haven't already. Then, enter a name for your repo.

![Image 3: Screenshot of the deploy to Vercel workflow, showing the Get started section. It shows three buttons to continue with GitHub, GitLab, and Bitbucket.](https://developer.paddle.com/assets/images/vercel-github-connect-20240918.png)

The repo name becomes the name of your project in Vercel, and it's also used for deploy preview URLs. If the name is taken, Vercel appends some characters to your project name when creating a deploy preview URL.

### [Integrate with Supabase](https://developer.paddle.com/build/nextjs-supabase-vercel-starter-kit#supabase-deploy-vercel)

Next, click **Add** to walk through integrating with Supabase.

![Image 4: Screenshot of the deploy to Vercel workflow, showing the add integration section. It shows Supabase with an Add button.](https://developer.paddle.com/assets/images/vercel-supabase-auth-20240918.png)

You can give your project any name. We recommend using a password manager to generate and store a secure password.

Make sure the **Create sample tables with seed data** box is checked. This creates tables in Supabase to store customer and subscription data for our app.

![Image 5: Screenshot of the new project modal in Supabase. It shows fields for project name, password, and region. It shows a checkbox that says 'create sample tables with seed data' that's checked.](https://developer.paddle.com/assets/images/vercel-supabase-config-20240917.png)

### [Configure Paddle variables](https://developer.paddle.com/build/nextjs-supabase-vercel-starter-kit#env-variables-deploy-vercel)

We need to supply some variables so that our app can interact with our Paddle account.

![Image 6: Screenshot of the deploy to Vercel workflow, showing the configure project section. It shows four required environment variables.](https://developer.paddle.com/assets/images/vercel-paddle-variables-20240912.png)

We need four variables:

`PADDLE_API_KEY`An API key, used for interacting with Paddle data in the backend. For example, syncing customer and subscription data with Supabase.
`NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`A client-side token, used for interacting with Paddle in the frontend. For example, getting localized prices for pricing pages and opening a checkout.
`PADDLE_NOTIFICATION_WEBHOOK_SECRET`A secret key used for verifying that webhooks came from Paddle and haven't been tampered with in transit. Important for security.
`NEXT_PUBLIC_PADDLE_ENV`Environment for our Paddle account. `sandbox` for sandbox accounts; `production` for live accounts.

#### [Get an API key and client-side token](https://developer.paddle.com/build/nextjs-supabase-vercel-starter-kit#keys-env-variables-deploy-vercel)

[Client-side tokens](https://developer.paddle.com/paddlejs/client-side-tokens) and [API keys](https://developer.paddle.com/api-reference/about/api-keys) are used for authentication. Even if you already have an API key and client-side token, we recommend creating new ones for this app.

API keys need [permissions](https://developer.paddle.com/api-reference/about/permissions) to perform actions with your Paddle account. For this app, you need the **Subscription: Write** permission to both read and cancel subscriptions, and the **Transaction: Read** permission to access transactions.

1.   Go to **Paddle > Developer tools > Authentication**.

2.   Click **New API key**.

3.   Fill in all details, then select the **Subscription: Write** permission.

4.   Click **Save** and then click **Copy key**.

5.   Paste your key as `PADDLE_API_KEY` in the Deploy to Vercel screen.

6.   Head back to the authentication screen in Paddle and click the **Client-side tokens** tab.

7.   Click **New client-side token**.

8.   Give your client-side token a name and description.

9.   Click **Save** and then click **Copy key**. You can also copy it from the three-dot menu (**…**) next to the token.

10.   Paste your key as `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` in the Deploy to Vercel screen.

![Image 7: Illustration of the create API key drawer in Paddle. It shows fields for name and description.](https://developer.paddle.com/assets/images/api-key-create-2-new-20250407.svg)

![Image 8: Illustration of an open modal to copy the API key. There's instructions on saving and a button that says Copy.](https://developer.paddle.com/assets/images/api-key-create-5-copy-20250407.svg)

As you build out your app, your API key may need other permissions to take more actions. You can [edit the API key](https://developer.paddle.com/api-reference/about/api-keys#edit-api-key) to add them as you need.

To learn more about client-side tokens and API keys, see [Client-side tokens](https://developer.paddle.com/paddlejs/client-side-tokens) and [API keys](https://developer.paddle.com/api-reference/about/api-keys).

> Treat your API key like a password. Keep it safe and never share it with apps or people you don't trust.

#### [Create a webhook destination](https://developer.paddle.com/build/nextjs-supabase-vercel-starter-kit#notifications-env-variables-deploy-vercel)

You can use notifications to get webhooks from Paddle when something important happens in your Paddle system, like a customer is updated or a new subscription is created. We use webhooks in our app to keep our app in sync with Paddle, letting customers see and manage their subscriptions and payments.

To start receiving webhooks, create a notification destination. This is where you can tell Paddle which events you want to receive and where to deliver them to.

1.   Go to **Paddle > Developer Tools > Notifications**.

2.   Click **New destination**.

3.   Give your destination a name.

4.   Make sure notification type is set to **webhook** — this is the default.

5.   Enter `https://<PROJECTNAME>.vercel.app/api/webhook` as your URL, where `<PROJECTNAME>` is the name of your Vercel project. You can always rename this later. For example: `https://paddle-billing.vercel.app/api/webhook`.

6.   Check the **select all events** box.

7.   Click **Save destination** when you're done.

8.   From the list of notification destinations, click the **…** action menu next to the notification destination you just created, then choose **Edit destination** from the menu.

9.   Copy the secret key and paste it as `PADDLE_NOTIFICATION_WEBHOOK_SECRET`.

![Image 9: Illustration of the new destination drawer in Paddle. It shows fields for description, type, URL, and version. Under those fields, there's a section called events with a checkbox that says 'select all events'](https://developer.paddle.com/assets/images/create-webhook-destination-20240912.svg)

![Image 10: Illustration of the edit destination drawer in Paddle. The secret key field is called out.](https://developer.paddle.com/assets/images/copy-webhook-secret-key-20240912.svg)

To learn more about webhooks and notification destinations, see [Create a notification destination](https://developer.paddle.com/webhooks/notification-destinations)

#### [Set your environment](https://developer.paddle.com/build/nextjs-supabase-vercel-starter-kit#notifications-env-variables-deploy-vercel)

For `NEXT_PUBLIC_PADDLE_ENV`, enter:

*   `sandbox` if you're working with a sandbox account

*   `production` if you're working with a live account

> We recommend working with a sandbox account for this tutorial. Sandbox accounts are designed for testing and evaluation. Live accounts must be approved by Paddle before you can open checkouts for them.

### [Review and deploy](https://developer.paddle.com/build/nextjs-supabase-vercel-starter-kit#deploy-deploy-vercel)

At this point, we've done everything that we need to deploy. Review your settings, then click **Deploy**.

Wait for Vercel to build. If everything went well, our build should complete successfully.

![Image 11: Screenshot of the complete screen for the deploy to Vercel workflow. It says 'congratulations!' and there's a preview of our app.](https://developer.paddle.com/assets/images/vercel-deploy-success-20240917.png)

However, if we open our deploy preview link then our integration isn't ready yet — our pricing page doesn't display and prices and the buttons to get started don't work. We'll fix these in the next step.

[2. Set up your product catalog](https://developer.paddle.com/build/nextjs-supabase-vercel-starter-kit#create-catalog)
----------------------------------------------------------------------------------------------------------------------

To make our app work properly with Paddle, we need to specify how products in our app map to products in Paddle.

### [Model your pricing](https://developer.paddle.com/build/nextjs-supabase-vercel-starter-kit#model-create-catalog)

A complete product in Paddle is made up of two parts:

*   A product entity that describes the item, like its name, description, and an image.

*   At least one related price entity that describes how much and how often a product is billed.

You can create as many prices for a product as you want to describe all the ways they're billed.

Our template comes with a three tier pricing page, with plans for `Free`, `Basic`, and `Pro`. For each of these plans, there are monthly and annual options.

We can mirror this in Paddle, modeling this as three products with two prices for monthly and annual:

**Product: `Free`**

*   Price: Free (monthly)

*   Price: Free (yearly)

**Product: `Basic`**

*   Price: Basic (monthly)

*   Price: Basic (yearly)

**Product: `Pro`**

*   Price: Pro (monthly)

*   Price: Pro (yearly)

### [Create products and prices](https://developer.paddle.com/build/nextjs-supabase-vercel-starter-kit#paddle-create-catalog)

You can [create products and prices](https://developer.paddle.com/build/products/create-products-prices) using the Paddle dashboard or the API.

1.   Go to **Paddle > Catalog > Products**.

2.   Click **New product**.

3.   Enter details for your new product, then click **Save** when you're done.

4.   Under the **Prices** section on the page for your product, click **New price**.

5.   Enter details for your new price. Set the billing period to **Monthly** to create a monthly price.

6.   Click **Save** when you're done.

7.   Create another price, setting the billing period to **Annually** and **Save**.

![Image 12: Illustration showing the new product drawer in Paddle. It shows fields for product name, tax category, and description](https://developer.paddle.com/assets/images/dashboard-create-product-20230831.svg)

Repeat for each of the products, until you have three products with two prices each.

To learn more products and prices, see [Create products and prices](https://developer.paddle.com/build/products/create-products-prices)

### [Update pricing constants](https://developer.paddle.com/build/nextjs-supabase-vercel-starter-kit#constants-create-catalog)

Now we've created products and prices, we need to update our app with details of our new prices.

Clone your Git repo locally, then open `src/constants/pricing-tier.ts` in your IDE. If you're using GitHub, you can use [GitHub Desktop to clone a repo locally](https://docs.github.com/en/desktop/adding-and-cloning-repositories/cloning-a-repository-from-github-to-github-desktop) if you're not familiar with Git.

`pricing-tier.ts` contains constants that we use in our pricing page and checkout. Swap the Price IDs starting with `pri_` with price IDs for the prices we just created.

> You can also edit `src/constants/pricing-tier.ts` directly on your Git platform if you've not set up your local development environment.

For example:

```
export interface Tier {
2  name: string;
3  id: 'starter' | 'pro' | 'advanced';
4  icon: string;
5  description: string;
6  features: string[];
7  featured: boolean;
8  priceId: Record<string, string>;
9}
10
11export const PricingTier: Tier[] = [
12  {
13    name: 'Starter',
14    id: 'starter',
15    icon: '/assets/icons/price-tiers/free-icon.svg',
16    description: 'Ideal for individuals who want to get started with simple design tasks.',
17    features: ['1 workspace', 'Limited collaboration', 'Export to PNG and SVG'],
18    featured: false,
19    priceId: { month: 'pri_01hsxyh9txq4rzbrhbyngkhy46', year: 'pri_01hsxyh9txq4rzbrhbyngkhy46' },
20  },
```

You can get Paddle IDs for your prices using the Paddle dashboard:

1.   Go to **Paddle > Catalog > Products**, then click the product you want to get a price ID for in the list.

2.   Click the **…** action menu next to a price in the list, then choose **Copy price ID** from the menu.

3.   Paste the ID as the value for `priceId.month` or `priceId.year` in `src/constants/pricing-tier.ts`.

Add all your price IDs, then commit and push your changes to the `main` branch on Git.

Vercel automatically rebuilds your site at this point. You can hop over the Vercel dashboard to check on the build progress.

![Image 13: Screenshot of the project page in Vercel. It shows that our site is building.](https://developer.paddle.com/assets/images/vercel-redeploy-20240917.png)

When it's done, your pricing page should display prices, but you won't be able to checkout just yet. This is our next step.

[3. Add your website to Paddle and test](https://developer.paddle.com/build/nextjs-supabase-vercel-starter-kit#test-domain-approval)
------------------------------------------------------------------------------------------------------------------------------------

To keep the Paddle platform safe for everyone, you must add your website to Paddle before you can launch a checkout from it. This protects you as a seller, making sure that only you are able to sell your products.

### [Get your website approved](https://developer.paddle.com/build/nextjs-supabase-vercel-starter-kit#approval-test-domain-approval)

> If you're using a sandbox account, website approval is instant. You'll need to add your domain, but our verification team don't check your website.

Website approval makes sure you own the domains where you use Paddle Checkout, and that the products sold meet the Paddle acceptable use policy.

Get your website approved using the Paddle dashboard:

1.   Go to **Paddle > Checkout > Website approval**.

2.   Click **Add a new domain**, enter your Vercel demo app link, then click **Submit for Approval**.

3.   Wait for approval.

If you're using a sandbox account, your website is automatically approved right away. You should see a green status symbol that says "Approved."

For live accounts, website approval may take a few days while the Paddle verification team check your website to make sure you're able to sell with Paddle. For more information, see: [Website verification FAQs](https://www.paddle.com/help/start/account-verification/what-is-domain-verification)

### [Set your default payment link](https://developer.paddle.com/build/nextjs-supabase-vercel-starter-kit#default-payment-link-test-domain-approval)

Your default payment link is a quick way to open Paddle Checkout for a transaction. It's also used in emails from Paddle that let customers manage their subscription. It's typically your checkout page, or another page that includes Paddle.js.

We'll set our default payment link to the checkout page in our starter kit.

1.   Go to **Paddle > Checkout > Checkout settings**.

2.   Enter your Vercel demo app link under the **Default payment link** heading.

3.   Click **Save** when you're done.

To learn more about what a default payment link is for, see [Set your default payment link](https://developer.paddle.com/build/transactions/default-payment-link)

### [Check your notification destination endpoint](https://developer.paddle.com/build/nextjs-supabase-vercel-starter-kit#notification-destination-test-domain-approval)

If the name of our project name in Vercel is taken, Vercel appends some characters to your project name when creating a deploy preview URL.

Earlier, we entered `https://<PROJECTNAME>.vercel.app/api/webhook` as the endpoint for our notification destination. If your deploy preview URL doesn't match your project name, update this URL in Paddle. You can find your deploy URL in your Vercel dashboard.

### [Test](https://developer.paddle.com/build/nextjs-supabase-vercel-starter-kit#test-test-domain-approval)

We're now ready to take a test payment. Open your Vercel demo site. You should notice that Paddle returns the prices you entered for each of your plans on your pricing page.

![Image 14: Screenshot of the pricing page from our app. It shows three tiers, which show prices, with a toggle to switch from monthly to annual.](https://developer.paddle.com/assets/images/vercel-complete-demo-20240912.png)

Click **Get started** to launch a checkout for a plan, then take a test payment.

If you're using a sandbox account, you can take a test payment using [our test card details](https://developer.paddle.com/concepts/payment-methods/credit-debit-card):

**Email address**An email address you own
**Country**Any valid country supported by Paddle
**ZIP code** (if required)Any valid ZIP or postal code
**Card number**`4242 4242 4242 4242`
**Name on card**Any name
**Expiration date**Any valid date in the future.
**Security code**`100`

After checkout is completed, head back to the homepage and click **Sign in**. Have a look at the subscriptions and payments pages. They pull information from Paddle about a customer's subscriptions and transactions.

[4. Build your app, then go to live](https://developer.paddle.com/build/nextjs-supabase-vercel-starter-kit#go-live)
-------------------------------------------------------------------------------------------------------------------

You're done. You can use this starter kit as a basis for building a SaaS app on Paddle Billing.

Once you've built your app, transition to a live account to start taking real payments.

1.   Sign up for a live account, then follow our [go-live checklist](https://developer.paddle.com/build/onboarding/go-live-checklist) to transition from sandbox to live.

2.   Update your Vercel environment variables so they're for your live account.

3.   Create new schemas in Supabase for your live data.

[Next steps](https://developer.paddle.com/build/nextjs-supabase-vercel-starter-kit#next-steps)
----------------------------------------------------------------------------------------------

That's it. Now you've built a Next.js app with Paddle Billing and deployed it to Vercel, you might like to hook into other features of the Paddle platform.

### [Do more with Paddle.js](https://developer.paddle.com/build/nextjs-supabase-vercel-starter-kit#extend-checkout-next-steps)

Our starter kit passes prices to Paddle.js to display localized pricing on our pricing page and open a checkout to create subscriptions. Paddle.js includes a bunch of properties and settings you can pass that give you more control over how opened checkouts work.

For example, you can prepopulate a discount, set the language that Paddle Checkout uses, or restrict payment options shown to customers.

Prefill checkout properties

Pass checkout settings

Brand inline checkout

### [Build advanced subscription functionality](https://developer.paddle.com/build/nextjs-supabase-vercel-starter-kit#extend-checkout-next-steps)

Paddle Billing is designed for modern SaaS businesses, letting you build workflows to pause and resume subscriptions, flexibly change billing dates, and offer trials.

Pause or resume a subscription

Change billing dates

Work with trials

### [Integrate with Paddle Retain](https://developer.paddle.com/build/nextjs-supabase-vercel-starter-kit#retain-next-steps)

[Paddle Retain](https://developer.paddle.com/concepts/retain/overview) combines world-class subscription expertise with algorithms that use billions of datapoints to recover failed payments, reduce churn, and proactively upgrade plans.

Configure Payment Recovery and dunning

Build cancellation surveys

Proactively upgrade plans
