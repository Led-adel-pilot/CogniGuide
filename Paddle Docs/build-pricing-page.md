Title: Build a pricing page - Paddle Developer

URL Source: https://developer.paddle.com/build/checkout/build-pricing-page

Markdown Content:
Get a step-by-step overview of how to build a pricing page that displays localized prices, including taxes and discount calculation. Open a checkout when a prospect wants to sign up.

Pricing pages show prospects the subscription plans, addons, or one-time charges that you offer and how much they cost. They're one of the most important pages on your website, and typically [play a key part in customer conversion](https://www.paddle.com/resources/pricing-page-examples).

You can use [Paddle.js](https://developer.paddle.com/paddlejs/overview) to build pricing pages that show prospects prices that are [relevant for their country](https://developer.paddle.com/build/products/offer-localized-pricing), displayed in their local currency with estimated taxes. If you're running a sale or promo, you can calculate discounts too.

> #### [Grab the code and test using CodePen](https://developer.paddle.com/build/checkout/build-pricing-page#grab-the-code-and-test-using-codepen)
> 
> 
> CodePen is a platform for building and sharing frontend code. Explore the code for this tutorial and test right away using our pricing page pen.

[How it works](https://developer.paddle.com/build/checkout/build-pricing-page#background)
-----------------------------------------------------------------------------------------

[Paddle Checkout](https://developer.paddle.com/concepts/sell/self-serve-checkout) automatically shows the correct prices for a customer using geolocation to estimate where a customer is buying from. Customers see prices in their local currency, with taxes estimated for their country or region.

You can use the [`Paddle.PricePreview()`](https://developer.paddle.com/paddlejs/methods/paddle-pricepreview) method in Paddle.js to get localized prices for pricing pages or other pages on your website. This means you can show the same information on your pricing page that a customer sees when they open checkout to subscribe.

You don't need to do any calculations yourself or manipulate returned data. Paddle returns totals formatted for the country or region you're working with, including the currency symbol.

[What are we building?](https://developer.paddle.com/build/checkout/build-pricing-page#objectives)
--------------------------------------------------------------------------------------------------

In this tutorial, we'll create a simple, three-tier pricing page. It includes a toggle to switch between monthly and annual plans.

![Image 1: Short animation showing toggling between monthly and annual pricing. The prices change when the monthly and annual radio buttons are clicked.](https://developer.paddle.com/assets/images/pricing-page-toggle-test-20231027-high.gif)

We'll learn how to:

*   Include and set up Paddle.js using a client-side token

*   Build an items list that we can send to `Paddle.PricePreview()`

*   Present and update prices on our page

*   Toggle between monthly and annual prices for products

If you like, you can copy-paste the sample code into your editor or [view on CodePen](https://codepen.io/heymcgovern/pen/VwgvgNb) and follow along.

[Before you begin](https://developer.paddle.com/build/checkout/build-pricing-page#prerequisites)
------------------------------------------------------------------------------------------------

### [Choose a pricing page](https://developer.paddle.com/build/checkout/build-pricing-page#prerequisites-choose-implementation)

This tutorial walks through creating a simple pricing page. You can also create a cart-style pricing page for more advanced implementations using transaction previews.

### [Create products and prices](https://developer.paddle.com/build/checkout/build-pricing-page#prerequisites-create-product-price)

You'll need to [create a product and at least one related price](https://developer.paddle.com/build/products/create-products-prices) for the items that you want to include on your pricing page.

### [Localize prices](https://developer.paddle.com/build/checkout/build-pricing-page#prerequisites-localize-prices)

To show localized prices, [turn on automatic currency conversion or add price overrides](https://developer.paddle.com/build/products/offer-localized-pricing) to your prices.

[Overview](https://developer.paddle.com/build/checkout/build-pricing-page#tutorial-steps)
-----------------------------------------------------------------------------------------

To build a pricing page:

[1. Include and initialize Paddle.js](https://developer.paddle.com/build/checkout/build-pricing-page#include-paddle-js)
-----------------------------------------------------------------------------------------------------------------------

[Paddle.js](https://developer.paddle.com/paddlejs/overview) is a lightweight JavaScript library that lets you build rich, integrated subscription billing experiences using Paddle. We can use Paddle.js to securely work with products and prices in our Paddle system, as well as opening checkouts and capturing payment information.

### [Include Paddle.js script](https://developer.paddle.com/build/checkout/build-pricing-page#include-paddle-js-embed-script)

Start with a blank webpage, or an existing page on your website. Then, [include Paddle.js](https://developer.paddle.com/paddlejs/include-paddlejs) by adding this script to the `<head>`:

`<script src="https://cdn.paddle.com/paddle/v2/paddle.js"></script>`

### [Set environment (optional)](https://developer.paddle.com/build/checkout/build-pricing-page#include-paddle-js-environment)

We recommend [signing up for a sandbox account](https://sandbox-login.paddle.com/signup?utm_source=dx&utm_medium=dev-docs) to test and build your integration, then switching to a live account later when you're ready to go live.

If you're testing with the [sandbox](https://developer.paddle.com/build/tools/sandbox), call [`Paddle.Environment.set()`](https://developer.paddle.com/paddlejs/methods/paddle-environment-set) and set your environment to `sandbox`:

```
12341<script src="https://cdn.paddle.com/paddle/v2/paddle.js"></script>
2<script type="text/javascript">
3  Paddle.Environment.set("sandbox");
4</script>
```

### [Pass a client-side token](https://developer.paddle.com/build/checkout/build-pricing-page#include-paddle-js-authenticate)

Next, go to **Paddle > Developer tools > Authentication** and create a client-side token. [Client-side tokens](https://developer.paddle.com/paddlejs/client-side-tokens) let you interact with the Paddle platform in frontend code, like webpages or mobile apps. They have limited access to the data in your system, so they're safe to publish.

In your page, call [`Paddle.Initialize()`](https://developer.paddle.com/paddlejs/methods/paddle-initialize) and pass your client-side token as `token`. For best performance, do this just after calling `Paddle.Environment.set()`, like this:

```
12345671<script src="https://cdn.paddle.com/paddle/v2/paddle.js"></script>
2<script type="text/javascript">
3  Paddle.Environment.set("sandbox");
4  Paddle.Initialize({ 
5    token: "test_7d279f61a3499fed520f7cd8c08" // replace with a client-side token
6  });
7</script>
```

> Client-side tokens are separate for your [sandbox and live accounts](https://developer.paddle.com/paddlejs/client-side-tokens#sandbox-vs-live-tokens). You'll need to [create a new client-side token](https://developer.paddle.com/paddlejs/client-side-tokens#create-client-side-token) for your live account. Sandbox tokens start with `test_` to make them easy to distinguish.

[2. Pass prices to Paddle.js](https://developer.paddle.com/build/checkout/build-pricing-page#pricing-preview)
-------------------------------------------------------------------------------------------------------------

Next, we'll pass prices to Paddle.js so that we can get localized prices for them. When previewing prices, Paddle returns calculated totals for line items only — it doesn't include grand totals. This means that we can include prices with different billing cycles and trial periods in our request, unlike when [opening a checkout](https://developer.paddle.com/build/checkout/pass-update-checkout-items) or [creating a transaction](https://developer.paddle.com/build/transactions/create-transaction).

### [Define lists of prices](https://developer.paddle.com/build/checkout/build-pricing-page#pricing-preview-price-lists)

Our page includes four prices:

**Starter**

*   Starter (monthly)

*   Starter (yearly)

**Pro**

*   Pro (monthly)

*   Pro (yearly)

In Paddle, we've set these up as two products called 'Starter' and 'Pro,' each with two prices for monthly and annual.

To define these, create variables for the products in your script section and set them to the Paddle IDs for the products. We'll use these later to determine which products returned prices are for.

Then, create arrays for your prices. Each array should contain an object that includes the Paddle ID for a price (`priceId`) and a `quantity`. We've created two arrays:

*   `monthItems`, which contains monthly prices for our products.

*   `yearItems`, which contains yearly prices for our products.

We'll present localized prices for `monthItems` when the monthly toggle is selected, and `yearItems` when the yearly toggle is selected.

```
12345678910111213141516171819201<script type="text/javascript">
2  Paddle.Environment.set("sandbox");
3  Paddle.Initialize({ 
4    token: 'test_7d279f61a3499fed520f7cd8c08' // replace with a client-side token
5  });
6  
7  // define products and prices
8  var starterProduct = 'pro_01gsz4s0w61y0pp88528f1wvvb';
9  var proProduct = 'pro_01gsz4t5hdjse780zja8vvr7jg';
10  var monthItems = [{
11      quantity: 1,
12      priceId: 'pri_01gsz8ntc6z7npqqp6j4ys0w1w',
13    },
14    {
15      quantity: 1,
16      priceId: 'pri_01gsz8x8sawmvhz1pv30nge1ke',
17    }
18  ];
19  var yearItems = [{
20      quantity: 1,
```

### [Get prices](https://developer.paddle.com/build/checkout/build-pricing-page#pricing-preview-get-prices)

Next, we'll create a function to get prices. This should pass our list of monthly or yearly items to Paddle.js.

In our sample, we've created a function called `getPrices()` that takes a parameter called `cycle`. Here's how it works:

1.   We create a variable called `billingCycle` and set this to `year`. This is the billing cycle that we'd like to show when customers first visit our page.

2.   We check to see if `cycle` is `month`, then set a variable called `itemsList` to either `monthItems` or `yearItems`. We also set a variable called `billingCycle` to the value of `cycle` for later.

3.   We define a variable called `request`. This is what we're going to send to Paddle.js. It includes an object with an `items` key. The format of our request should match the request body for the pricing preview operation in the Paddle API, except with `camelCase` names for fields.

4.   We call `Paddle.PricePreview()`, passing in `request` as a parameter.

5.   `Paddle.PricePreview()` returns a promise that contains a pricing preview object. We use the `.then()` method to attach a callback that logs the resolved value to the console, and the `.catch()` method to log errors to the console.

```
202122232425262728293031323334353637383920      quantity: 1,
21      priceId: 'pri_01gsz8s48pyr4mbhvv2xfggesg',
22    },
23    {
24      quantity: 1,
25      priceId: 'pri_01gsz8z1q1n00f12qt82y31smh',
26    }
27  ];
28  
29  // set initial billing cycle
30  var billingCycle = 'year'
31  
32  // get prices
33  function getPrices(cycle) {
34    var itemsList = cycle === "month" ? monthItems : yearItems;  
35    var billingCycle = cycle;
36    var request = {
37      items: itemsList
38    }
39
```

### [Test your work](https://developer.paddle.com/build/checkout/build-pricing-page#pricing-preview-test)

Save your page, then [open your browser console](https://developer.chrome.com/docs/devtools/console/) and type `getPrices('year')` or `getPrices('month')`. You should see a promise that contains a pricing preview object from Paddle returned the console.

> Use `⌘ Command` + `⌥ Option` + `J` (Mac) or `Ctrl` + `⇧ Shift` + `J` (Windows) to quickly open your browser console in Google Chrome.

![Image 2: Short animation showing Google Chrome with the browser console open. "getPrices('year')" is typed into the console, which returns a line saying data and meta. This section is expanded to show the full object.](https://developer.paddle.com/assets/images/pricing-page-console-test-20231027-high.gif)

[3. Update page](https://developer.paddle.com/build/checkout/build-pricing-page#update-page)
--------------------------------------------------------------------------------------------

Our function doesn't do anything to our page yet. We'll update `getPrices()` so that it displays pricing information returned by Paddle.js on our page.

### [Create HTML for pricing table](https://developer.paddle.com/build/checkout/build-pricing-page#update-page-html)

First, we need to add some HTML for a simple pricing table with options for monthly and yearly. We'll add some CSS to the `<head>` of the page, too.

HTML

CSS

Add this to the `<body>` of your page.

In this sample, there are radio buttons for our pricing toggle, then a `<div>` with three `<div>` elements for each product that we offer. The radio buttons have an `onclick` attribute that runs our `getPrices()` function when clicked, passing either `month` or `year` as the parameter for `cycle`.

It sets `id`s `<p>` elements that contain prices. We'll use these IDs to replace the contents of these elements with returned prices from Paddle.js later.

```
12345678910111213141516171819201<div class="pricing-page-container">
2  <h1>Choose your plan</h1>
3  <div class="pricing-toggle">
4    <input type="radio" name="plan" value="month" id="month" onclick="getPrices('month')"><label for="month">Monthly</label>
5    <input type="radio" name="plan" value="year" id="year" onclick="getPrices('year')" checked><label for="year">Yearly  <sup>save 20%</sup></label>
6  </div>
7  <div class="pricing-grid">
8    <div class="starter-plan">
9      <h3>Starter</h3>
10      <p id="starter-price">$100.00</p>
11      <p><small>per user</small></p>
12      <button>Sign up now</button>
13    </div>
14    <div class="pro-plan">
15      <h3>Pro</h3>
16      <p id="pro-price">$300.00</p>
17      <p><small>per user</small></p>
18      <button>Sign up now</button>
19    </div>
20    <div class="enterprise-plan">
```

### [Update elements using JavaScript](https://developer.paddle.com/build/checkout/build-pricing-page#update-page-elements)

Next, we'll change our script to update the `starter-price` and `pro-price` elements so they return pricing from Paddle.

First, we'll get elements in our pricing table using their `id` and assign them to variables that we can use later.

Then, we'll update our `getPrices()` function to iterate through `result.data.details.lineItems`. This array contains calculated totals for the prices that we passed to Paddle.js.

To make sure we show the correct prices for our products, we check to see if the Paddle ID of the related product of a price matches the product IDs we defined earlier:

*   If the product for a returned price is `starterProduct`, we replace the contents of the `starter-price` element with `item.formattedTotals.subtotal`

*   If the product for a returned price is `proProduct`, we replace the contents of the `pro-price` element with `item.formattedTotals.subtotal`.

For this sample, we also log `item.formattedTotals.subtotal` to console. This can be useful for debugging.

```
202122232425262728293031323334353637383920      quantity: 1,
21      priceId: 'pri_01gsz8s48pyr4mbhvv2xfggesg',
22    },
23    {
24      quantity: 1,
25      priceId: 'pri_01gsz8z1q1n00f12qt82y31smh',
26    }
27  ];
28  
29  // DOM queries
30  var starterPriceLabel = document.getElementById("starter-price");
31  var proPriceLabel = document.getElementById("pro-price");
32  
33  // set initial billing cycle
34  var billingCycle = 'year'
35  
36  // get prices
37  function getPrices(cycle) {
38    var itemsList = cycle === "month" ? monthItems : yearItems;  
39    var billingCycle = cycle;
```

### [Set getPrices() to run on page load](https://developer.paddle.com/build/checkout/build-pricing-page#update-page-on-load)

Right now, our function only runs when the monthly or annual radio buttons are clicked.

We can add `onLoad` to our `<body>` tag to run our `getPrices()` function immediately after the page has loaded:

`11<body onLoad="getPrices(billingCycle)">`

### [Test your work](https://developer.paddle.com/build/checkout/build-pricing-page#update-page-test)

Save your page, then open it in your browser. You should see prices from Paddle.js in your pricing table. Selecting the monthly or annual toggle should change the prices that you see.

![Image 3: Short animation showing toggling between monthly and annual pricing. The prices change when the monthly and annual radio buttons are clicked.](https://developer.paddle.com/assets/images/pricing-page-toggle-test-20231027-high.gif)

> Paddle.js automatically detects visitor location using their IP address and returns localized prices. To see localization in action, see the [get started](https://developer.paddle.com/build/onboarding/overview) demo. We don't recommend including a country selector in real implementations.

[Next steps](https://developer.paddle.com/build/checkout/build-pricing-page#next-steps)
---------------------------------------------------------------------------------------

That's it. Now we've built a simple pricing page, you might like to add other fields to your page, pass a discount, or open a checkout.

### [Add other fields to your pricing page](https://developer.paddle.com/build/checkout/build-pricing-page#next-steps-request)

[`Paddle.PricePreview()`](https://developer.paddle.com/paddlejs/methods/paddle-pricepreview) returns a pricing preview object for the prices and location passed. We show `details.lineItems.formattedTotals.subtotal` in our sample. This is the calculated total for an item before estimated taxes and discounts, formatted for a particular currency.

You might like to use another value for the price you show on your page, or include other values.

Preview prices operation

Paddle.PricePreview() method

### [Pass a discount](https://developer.paddle.com/build/checkout/build-pricing-page#next-steps-discount)

Extend your pricing page by passing `discountId` in your request to `Paddle.PricePreview()`. The response includes a `discount` array that has information about the discount applied. Calculated totals in `details.lineItems` include discounts, where applicable.

Discount entity overview

Create or update a discount

### [Open a checkout](https://developer.paddle.com/build/checkout/build-pricing-page#next-steps-open-checkout)

Pass items to [`Paddle.Checkout.open()`](https://developer.paddle.com/paddlejs/methods/paddle-checkout-open) or use [HTML data attributes](https://developer.paddle.com/paddlejs/html-data-attributes) to open a checkout.

Build an inline checkout

Build an overlay checkout
