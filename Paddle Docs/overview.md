Title: Get started - Paddle Developer

URL Source: https://developer.paddle.com/build/onboarding/overview

Markdown Content:
Get a step-by-step overview of how to get started with Paddle — including creating your catalog, previewing your pricing page, opening a checkout, and listening to webhooks.

Welcome! Paddle Billing is a complete digital product sales and subscription management platform, designed for modern software businesses. Our API-first platform takes care of payments, tax, localization, and subscription management for you.

This guide walks through how to get started with Paddle Billing — from creating a catalog right up to provisioning and order fulfilment.

> #### [Grab the code and test using CodePen](https://developer.paddle.com/build/onboarding/overview#grab-the-code-and-test-using-codepen)
> 
> 
> CodePen is a platform for building and sharing frontend code. Explore the code for this tutorial and test right away using our getting started pen.

[What are we building?](https://developer.paddle.com/build/onboarding/overview#objectives)
------------------------------------------------------------------------------------------

By the end of this tutorial, we'll have a typical three-tier pricing page connected to [Paddle Checkout](https://developer.paddle.com/concepts/sell/self-serve-checkout).

![Image 1: An animation that's light on details, showing the getting started CodePen. It's a three-tier pricing page initially. We change the country to France and prices change to euro, swapping back to US as prices change to USD. We hit sign up for the Pro plan and a checkout opens, then we take a test payment. A pleasant checkout complete screen ends the animation.](https://developer.paddle.com/assets/images/get-started-hero-20250131.gif)

We'll learn how to:

*   Sign up for Paddle and set up an account

*   Create products and prices

*   Work with Paddle.js to present localized prices

*   Open a checkout and take a test payment

*   Create a notification destination and preview webhooks

[Overview](https://developer.paddle.com/build/onboarding/overview#overview-get-started)
---------------------------------------------------------------------------------------

4.   [**Open a checkout**](https://developer.paddle.com/build/onboarding/overview#checkout)

Launch a checkout from your pricing page, then take a test payment. 
5.   [**Listen for webhooks**](https://developer.paddle.com/build/onboarding/overview#webhooks)

Preview the webhooks that occur during checkout for handling provisioning and fulfilment. 

[1. Sign up for Paddle](https://developer.paddle.com/build/onboarding/overview#sign-up)
---------------------------------------------------------------------------------------

To get started with Paddle, sign up for a Paddle account. You can sign up for two kinds of account:

*   [Sandbox](https://developer.paddle.com/build/tools/sandbox) — for testing and evaluation

*   Live — for selling to customers

For the best experience when testing your Paddle integration, **sign up for a sandbox account**. You can sign up for a live account later when you've built your integration and you're ready to start selling.

[2. Set up your product catalog](https://developer.paddle.com/build/onboarding/overview#catalog)
------------------------------------------------------------------------------------------------

Your [product catalog](https://developer.paddle.com/build/products/create-products-prices) includes subscription plans, recurring addons, one-time charges, and things like additional seats. For flexibility, there's no rigid hierarchy of products — everything you offer is a product.

Create products and related prices to start billing.

### [Model your pricing](https://developer.paddle.com/build/onboarding/overview#model-catalog)

A complete product in Paddle is made up of two parts:

1.   A [product entity](https://developer.paddle.com/api-reference/products/overview) that describes the item, like its name, description, and an image.

2.   At least one related [price entity](https://developer.paddle.com/api-reference/prices/overview) that describes how much and how often a product is billed.

You can create as many prices for a product as you want to describe all the ways it's billed.

![Image 2: Illustration showing a pricing page. One of the prices is Enterprise at $3000/mo. There's an arrow pointing to enterprise that says 1. product. Another arrow points to $3000/mo saying 2. price.](https://developer.paddle.com/assets/images/get-started-product-price-20250122.svg)

We'll start with a simple three-tier pricing structure, with plans for `Starter`, `Pro`, and `Enterprise`. For each of these plans, we'll offer monthly and annual options:

|  | Starter | Pro | Enterprise |
| --- | --- | --- | --- |
| **Monthly** | $10.00 | $30.00 | $300.00 |
| **Annual** | $100.00 | $300.00 | $3000.00 |

We can mirror this in Paddle, modeling this as three products with two prices for monthly and annual:

**Product: `Starter`**

*   Price: Starter (monthly)

*   Price: Starter (yearly)

**Product: `Pro`**

*   Price: Pro (monthly)

*   Price: Pro (yearly)

**Product: `Enterprise`**

*   Price: Enterprise (monthly)

*   Price: Enterprise (yearly)

### [Create products and prices](https://developer.paddle.com/build/onboarding/overview#paddle-create-catalog)

You can [create products and prices](https://developer.paddle.com/build/products/create-products-prices) using the Paddle dashboard or the API.

For the moment, we'll create products and prices for `Starter` and `Pro` only. Instead of letting customers sign up for an `Enterprise` plan, we'll ask them to contact us.

1.   Go to **Paddle > Catalog > Products**.

2.   Click **New product**.

3.   Enter details for your new product, then click **Save** when you're done.

4.   Under the **Prices** section on the page for your product, click **New price**.

5.   Enter details for your new price. Set the billing period to **Monthly** to create a monthly price.

6.   Click **Save** when you're done.

7.   Create another price, setting the billing period to **Annually** and **Save**.

![Image 3: New product drawer in Paddle. It shows fields for product name, tax category, and description](https://developer.paddle.com/assets/images/dashboard-create-product-20230831.svg)

Repeat so you have two products for `Starter` and `Pro`, each with a monthly and annual price.

[3. Build your pricing page](https://developer.paddle.com/build/onboarding/overview#pricing-page)
-------------------------------------------------------------------------------------------------

[Pricing pages](https://developer.paddle.com/build/checkout/build-pricing-page) show potential customers the subscription plans that you offer and how much they cost. They're one of the most important pages on your website, and typically play a key part in customer conversion.

Paddle includes [Paddle.js](https://developer.paddle.com/paddlejs/overview), a lightweight JavaScript library for securely interacting with Paddle in your frontend. You can use Paddle.js to build pricing pages that show prospects prices that are localized for their country, displayed in their local currency with estimated taxes.

### [Get a client-side token](https://developer.paddle.com/build/onboarding/overview#authentication-pricing-page)

[Client-side tokens](https://developer.paddle.com/paddlejs/client-side-tokens) let you interact with the Paddle platform in frontend code, like webpages or mobile apps. They have limited access to the data in your system, so they're safe to publish.

1.   Go to **Paddle > Developer tools > Authentication**.

2.   Click the **Client-side tokens** tab.

3.   Click **New client-side token**.

4.   Give your client-side token a name and description, then click **Save**.

5.   From the list of client-side tokens, click the **…** action menu next to the client-side token you just created, then choose **Copy token** from the menu.

We'll use your client-side token in the next step.

![Image 4: Create client-side token drawer in Paddle. It shows fields for name and description.](https://developer.paddle.com/assets/images/client-side-token-create-20250407.svg)

### [Update constants](https://developer.paddle.com/build/onboarding/overview#constants-pricing-page)

Now we've created a client-side token and created products and prices, let's add them to a pricing page. We'll use **the getting started CodePen**.

> If you have a CodePen account, you can fork the CodePen to create a copy for yourself. You don't need an account to follow these steps, but your changes won't be saved.

Open the CodePen, then change the values in the `CONFIG` constant at the top of the JavaScript section:

`clientToken`Client-side token you copied in the last step.
`prices.starter.month`Paddle ID for the monthly price of the starter product we created previously.
`prices.starter.year`Paddle ID for the annual price for the starter product we created previously.
`prices.pro.month`Paddle ID for the monthly price for the pro product we created previously.
`prices.pro.year`Paddle ID for the annual price for the pro product we created previously.

You can get Paddle IDs for your prices using the Paddle dashboard:

1.   Go to **Paddle > Catalog > Products**, then click the product you want to get a price ID for in the list.

2.   Click the **…** action menu next to a price in the list, then choose **Copy price ID** from the menu.

3.   Paste the ID as a value for `month` or `year` in `prices.starter` or `prices.pro`.

![Image 5: Prices list in the Paddle dashboard, with the action menu open and copy ID selected.](https://developer.paddle.com/assets/images/copy-price-id-20250127.svg)

> [Paddle IDs](https://developer.paddle.com/api-reference/about/paddle-ids) are designed to be easily recognizable. Price IDs start with `pri_` and product IDs start with `pro_`. Check that you've copied Paddle IDs for prices rather than products.

### [Test your pricing page](https://developer.paddle.com/build/onboarding/overview#test-pricing-page)

If you've added a valid client-side token and passed your price IDs correctly, you should see your prices on your pricing page. These prices are fetched dynamically from Paddle.js, so any changes you make in your Paddle dashboard are reflected on your pricing page on the next call.

Select the monthly or annual toggle to change the prices that you see, then test how localized pricing works using the dropdown at the bottom.

> We've included a dropdown to simulate price localization for demo purposes. In [real implementations](https://developer.paddle.com/build/checkout/build-pricing-page), we recommend letting Paddle.js automatically localize.

![Image 6: CodePen getting started project with the country selector dropdown open.](https://developer.paddle.com/assets/images/get-started-pricing-page-20250131.png)

[4. Open a checkout](https://developer.paddle.com/build/onboarding/overview#checkout)
-------------------------------------------------------------------------------------

[Paddle Checkout](https://developer.paddle.com/concepts/sell/self-serve-checkout) is where customers make purchases. For companies that offer subscriptions, it's where customers enter their details and payment information, and confirm that they'd like to sign up for a subscription with you.

You can use [Paddle.js](https://developer.paddle.com/paddlejs/overview) to quickly add an overlay checkout to your app or website. [Overlay checkout](https://developer.paddle.com/concepts/sell/overlay-checkout) lets you present customers with a full-page checkout overlay that's optimized for conversion.

### [Set a default payment link](https://developer.paddle.com/build/onboarding/overview#default-payment-link-checkout)

Before we can open a checkout, we need to set [a default payment link](https://developer.paddle.com/build/transactions/default-payment-link). Your default payment link is typically a page that includes your checkout, like a pricing page or billing screen in your app. Paddle uses your default payment link to generate URLs to send a way for customers to manage a payment or subscription.

For the moment, we'll set our default payment link to your website homepage or development environment URL. We can always change this later.

1.   Go to **Paddle > Checkout > Checkout settings**.

2.   Enter your website homepage under the **Default payment link** heading. If you don't have one, enter `https://localhost/`.

3.   Click **Save** when you're done.

> You can turn on other payment methods on this screen, too. We'll see eligible payment methods when we open a test checkout in the next step.

![Image 7: Checkout settings screen showing the Paddle dashboard. The default payment URL is set to https://example.com/](https://developer.paddle.com/assets/images/default-payment-link-20250127.svg)

### [Take a test payment](https://developer.paddle.com/build/onboarding/overview#test-checkout)

Now we've set our default payment link, we're ready to run through checkout and take a test purchase.

In your CodePen, click **Get started** for a plan to open an overlay checkout. You can take a test payment using our [test card details](https://developer.paddle.com/concepts/payment-methods/credit-debit-card):

**Email address**An email address you own
**Country**Any valid country supported by Paddle
**ZIP code** (if required)Any valid ZIP or postal code
**Card number**`4242 4242 4242 4242`
**Name on card**Any name
**Expiration date**Any valid date in the future.
**Security code**`100`

![Image 8: CodePen getting started project with overlay checkout open. Card, PayPal, and Apple Pay are presented as payment methods. Fields for email address, card number, expiration date, and country are visible.](https://developer.paddle.com/assets/images/get-started-checkout-20250131.png)

[5. Listen for webhooks](https://developer.paddle.com/build/onboarding/overview#webhooks)
-----------------------------------------------------------------------------------------

[Webhooks](https://developer.paddle.com/webhooks/overview) let you know when something important happens in your Paddle account. Paddle includes webhooks for all parts of the purchase and subscription lifecycle, from new customer to cancellation.

You can use webhooks to [handle provisioning and fulfilment](https://developer.paddle.com/build/subscriptions/provision-access-webhooks), and to keep your app in sync with Paddle. For example, you can provision an account for a customer in your app when a subscription is created and limit access to your app if they cancel.

### [Create a webhook destination](https://developer.paddle.com/build/onboarding/overview#destination-webhooks)

To start receiving webhooks, [create a notification destination](https://developer.paddle.com/webhooks/notification-destinations). This is where you can tell Paddle which events you want to receive and where to deliver them to.

For the moment, **we'll use Hookdeck Console** rather than spinning up a webhook endpoint server. Hookdeck Console lets you receive webhooks in a friendly interface, with no account or setup required.

1.   Go to [Hookdeck Console](https://console.hookdeck.com/), then copy the webhook endpoint URL. Keep this tab open.

2.   In a new tab, go to **Paddle > Developer Tools > Notifications**.

3.   Click **New destination**.

4.   Give your destination a memorable name.

5.   Make sure notification type is set to **webhook** and usage type is set to **platform**. These are the defaults.

6.   Paste the webhook endpoint URL you copied from Hookdeck Console earlier.

7.   Check the **select all events** box.

8.   Click **Save destination** when you're done.

![Image 9: Illustration of the new destination drawer in Paddle. It shows fields for description, type, URL, and version. Under those fields, there's a section called events with a checkbox that says 'select all events'](https://developer.paddle.com/assets/images/create-webhook-destination-20240912.svg)

How does this work?
As you move through checkout, Paddle automatically creates and updates entities in your system. Webhooks occur each time an entity is created and updated.

For provisioning and order fulfilment, there are some core webhooks that are useful:

transaction.created	Transactions handle capturing payment and calculating revenue in Paddle. Paddle Checkout creates a transaction, then updates it as the customer enters information and completes payment.
customer.created	When a customer enters their email address, Paddle creates a customer for you.
address.created	When a customer enters their country and ZIP/postal code, Paddle creates an address related to this customer.
business.created	If a customer chooses to enter a tax/VAT number, Paddle creates a business. The option to add a tax number is presented in regions that require it, like most of Europe.
transaction.paid	When payment goes through successfully, the transaction status changes to paid. At this point, you can be sure that a customer paid and you can start provisioning and order fulfilment.
subscription.created	If a checkout is for recurring items, Paddle automatically creates a subscription for the customer, address, and business. Its status is active or trialing, depending on the items on the subscription.
transaction.completed	Once payment is received and a subscription is created, Paddle continues processing a transaction to add subscription details, an invoice number, and information about fees, payouts, and earnings.

### [Take another test payment](https://developer.paddle.com/build/onboarding/overview#test-webhooks)

Now we've created a notification destination, we can run through checkout again and check the events that occur.

Open your CodePen, then run through checkout again and take a test payment. As you move through checkout, you should notice webhooks in Hookdeck depending on the actions that you take.

![Image 10: Hookdeck Console with a list of webhooks. The transaction.completed webhook is selected, and the JSON payload is visible.](https://developer.paddle.com/assets/images/get-started-webhooks-20250131.png)

> [Paddle.js also emits events](https://developer.paddle.com/paddlejs/events/overview) during the checkout lifecycle. Events emitted by Paddle.js contain information about the items and totals on a checkout that you can use to build advanced workflows in your frontend.

[Next steps](https://developer.paddle.com/build/onboarding/overview#next-steps)
-------------------------------------------------------------------------------

That's it. Now you've covered the basics, we recommend starting your integration or learning more about the Paddle platform.

### [Start building a Paddle integration](https://developer.paddle.com/build/onboarding/overview#integrate-next-steps)

Get a jump start with our Next.js starter kit, letting you quickly create and deploy an app that includes a localized pricing page, integrated inline checkout, and screens for customers to manage their payments. Or, start by building an overlay checkout and pricing page.

Build and deploy Next.js app

Build an overlay checkout

Build a pricing page

### [Learn more about Paddle Billing](https://developer.paddle.com/build/onboarding/overview#learn-next-steps)

Understand the different checkout experiences that come with Paddle, learn about the payment methods you can turn on, and get an idea of how to handle customer workflows using the customer portal.

Paddle Checkout

Payment methods

Customer portal

### [Learn about Paddle Retain](https://developer.paddle.com/build/onboarding/overview#retain-next-steps)

Paddle Retain powers dunning and payment recovery in Paddle Billing. Configure Paddle Retain to minimize churn and maximize lifetime revenue (LTV) by plugging into algorithms that use billions of datapoints.

Paddle Retain

Payment Recovery

Cancellation Flows

---
# CodePen:

```js
// Configuration
// Replace with values from your sandbox account
const CONFIG = {
  clientToken: "test_7d279f61a3499fed520f7cd8c08",
  prices: {
    starter: {
      month: "pri_01gsz8ntc6z7npqqp6j4ys0w1w",
      year: "pri_01gsz8s48pyr4mbhvv2xfggesg"
    },
    pro: {
      month: "pri_01gsz8x8sawmvhz1pv30nge1ke",
      year: "pri_01gsz8z1q1n00f12qt82y31smh"
    }
  }
};

// UI elements
const monthlyBtn = document.getElementById("monthlyBtn");
const yearlyBtn = document.getElementById("yearlyBtn");
const countrySelect = document.getElementById("countrySelect");
const starterPrice = document.getElementById("starter-price");
const proPrice = document.getElementById("pro-price");

// State
let currentBillingCycle = "month";
let currentCountry = "US";
let paddleInitialized = false;

// Initialize Paddle
function initializePaddle() {
  try {
    Paddle.Environment.set("sandbox");
    Paddle.Initialize({
      token: CONFIG.clientToken,
      eventCallback: function (event) {
        console.log("Paddle event:", event);
      }
    });
    paddleInitialized = true;
    updatePrices();
  } catch (error) {
    console.error("Initialization error:", error);
  }
}

// Update billing cycle
function updateBillingCycle(cycle) {
  currentBillingCycle = cycle;
  monthlyBtn.classList.toggle("bg-white", cycle === "month");
  yearlyBtn.classList.toggle("bg-white", cycle === "year");
  updatePrices();
}

// Update prices
async function updatePrices() {
  if (!paddleInitialized) {
    console.log("Paddle not initialized yet");
    return;
  }

  try {
    const request = {
      items: [
        {
          quantity: 1,
          priceId: CONFIG.prices.starter[currentBillingCycle]
        },
        {
          quantity: 1,
          priceId: CONFIG.prices.pro[currentBillingCycle]
        }
      ],
      address: {
        countryCode: currentCountry
      }
    };

    console.log("Fetching prices:", request);
    const result = await Paddle.PricePreview(request);

    result.data.details.lineItems.forEach((item) => {
      const price = item.formattedTotals.subtotal;
      if (item.price.id === CONFIG.prices.starter[currentBillingCycle]) {
        starterPrice.textContent = price;
      } else if (item.price.id === CONFIG.prices.pro[currentBillingCycle]) {
        proPrice.textContent = price;
      }
    });
    console.log("Prices updated:", result);
  } catch (error) {
    console.error(`Error fetching prices: ${error.message}`);
  }
}

// Open checkout
function openCheckout(plan) {
  if (!paddleInitialized) {
    console.log("Paddle not initialized yet");
    return;
  }

  try {
    Paddle.Checkout.open({
      items: [
        {
          priceId: CONFIG.prices[plan][currentBillingCycle],
          quantity: 1
        }
      ],
      settings: {
        theme: "light",
        displayMode: "overlay",
        variant: "one-page"
      }
    });
  } catch (error) {
    console.error(`Checkout error: ${error.message}`);
  }
}

// Event Listeners
countrySelect.addEventListener("change", (e) => {
  currentCountry = e.target.value;
  updatePrices();
});

// Initialize on page load
document.addEventListener("DOMContentLoaded", initializePaddle);
```

```html
<!-- Pricing Container -->
<div class="max-w-6xl mx-auto px-4 py-8">

  <!-- Billing Toggle -->
  <div class="text-center mb-8">
    <div class="inline-flex items-center bg-gray-100 rounded-lg p-1">
      <button id="monthlyBtn" class="px-4 py-2 rounded-md text-sm bg-white" onclick="updateBillingCycle('month')">Monthly</button>
      <button id="yearlyBtn" class="px-4 py-2 rounded-md text-sm" onclick="updateBillingCycle('year')">Yearly (Save 20%)</button>
    </div>
  </div>

  <!-- Pricing Grid -->
  <div class="grid md:grid-cols-3 gap-8">
    <!-- Starter Plan -->
    <div class="bg-white rounded-lg shadow-lg p-8">
      <h3 class="text-xl font-semibold mb-4">Starter</h3>
      <div class="mb-4">
        <span id="starter-price" class="text-4xl font-bold">$10.00</span>
        <span class="text-gray-500 ml-1">/month</span>
      </div>
      <button onclick="openCheckout('starter')" class="w-full bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700 transition-colors">
        Get started
      </button>
    </div>

    <!-- Pro Plan -->
    <div class="bg-white rounded-lg shadow-lg p-8 border-2 border-blue-500 relative">
      <div class="absolute -top-3 right-12 bg-blue-500 text-white px-3 py-1 rounded-full text-sm">Popular</div>
      <h3 class="text-xl font-semibold mb-4">Pro</h3>
      <div class="mb-4">
        <span id="pro-price" class="text-4xl font-bold">$30.00</span>
        <span class="text-gray-500 ml-1">/month</span>
      </div>
      <button onclick="openCheckout('pro')" class="w-full bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700 transition-colors">
        Get started
      </button>
    </div>

    <!-- Enterprise Plan -->
    <div class="bg-white rounded-lg shadow-lg p-8">
      <h3 class="text-xl font-semibold mb-4">Enterprise</h3>
      <div class="mb-4">
        <span class="text-4xl font-bold">Contact us</span>
      </div>
      <button onclick="window.location.href='mailto:sales@example.com'" class="w-full bg-gray-600 text-white rounded-lg px-4 py-2 hover:bg-gray-700 transition-colors">
        Let's talk
      </button>
    </div>
  </div>

  <!-- Country Selector -->
  <!-- Remove from live implementations -->
  <div class="mt-12 p-6 bg-blue-50 border border-blue-200 rounded-lg">
    <div class="md:flex md:items-center md:justify-between">
      <div class="md:flex-1 md:pr-8">
        <h3 class="text-lg font-semibold mb-2">Explore customer localization</h3>
        <p class="mb-4 md:mb-0 text-sm text-gray-600">
          Test how price localization works by changing the country. You can pass a country, IP address, or existing customer ID to <code class="bg-blue-100 px-1 py-0.5 rounded">Paddle.PricePreview()</code> to get localized prices. In live implementations, we recommend using an IP address.
        </p>
      </div>

      <div class="text-center md:text-right md:flex-shrink-0">
        <select id="countrySelect" class="px-4 py-2 rounded-lg border border-gray-300">
          <option value="US">🇺🇸 United States</option>
          <option value="GB">🇬🇧 United Kingdom</option>
          <option value="DE">🇩🇪 Germany</option>
          <option value="FR">🇫🇷 France</option>
          <option value="AU">🇦🇺 Australia</option>
        </select>
      </div>
    </div>
  </div>
</div>
```
