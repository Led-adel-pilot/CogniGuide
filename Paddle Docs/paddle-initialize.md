Title: Paddle.Initialize() - Paddle Developer

URL Source: https://developer.paddle.com/paddlejs/methods/paddle-initialize

Markdown Content:
Paddle.Initialize() - Paddle Developer

===============

[![Image 1: Paddle Logo](https://developer.paddle.com/logo.svg)](https://developer.paddle.com/)

Paddle Billing

[Open Paddle Checkout from iOS apps. Learn more Open checkout from iOS. Learn more](https://developer.paddle.com/build/mobile-apps/overview "Open checkout from iOS app")

Search

Feedback

[Login](https://sandbox-vendors.paddle.com/)

[Home](https://developer.paddle.com/)[Concepts](https://developer.paddle.com/concepts/overview)[Build](https://developer.paddle.com/build/overview)[Errors](https://developer.paddle.com/errors/overview)[Webhooks](https://developer.paddle.com/webhooks/overview)[API Reference](https://developer.paddle.com/api-reference/overview)[Paddle.js](https://developer.paddle.com/paddlejs/overview)[Changelog](https://developer.paddle.com/changelog/overview)[SDKs and Tools](https://developer.paddle.com/resources/overview)[Migrate](https://developer.paddle.com/migrate/overview)

[Home](https://developer.paddle.com/)[Concepts](https://developer.paddle.com/concepts/overview)[Build](https://developer.paddle.com/build/overview)[Errors](https://developer.paddle.com/errors/overview)[Webhooks](https://developer.paddle.com/webhooks/overview)[API Reference](https://developer.paddle.com/api-reference/overview)[Paddle.js](https://developer.paddle.com/paddlejs/overview)[Changelog](https://developer.paddle.com/changelog/overview)[SDKs and Tools](https://developer.paddle.com/resources/overview)[Migrate](https://developer.paddle.com/migrate/overview)

Paddle.js

*   [Overview](https://developer.paddle.com/paddlejs/overview)
*   Setup & Authentication 

*   [Manage client-side tokens](https://developer.paddle.com/paddlejs/client-side-tokens)
*   [Include and initialize Paddle.js](https://developer.paddle.com/paddlejs/include-paddlejs)
*   [Test Retain x Paddle.js](https://developer.paddle.com/paddlejs/test-retain)
*   Methods 

*   [Paddle.Initialize()](https://developer.paddle.com/paddlejs/methods/paddle-initialize)
*   [Paddle.Update()](https://developer.paddle.com/paddlejs/methods/paddle-update)
*   [Paddle.Environment.set()](https://developer.paddle.com/paddlejs/methods/paddle-environment-set)
*   [Paddle.Checkout.open()](https://developer.paddle.com/paddlejs/methods/paddle-checkout-open)
*   [Paddle.Checkout.updateCheckout()](https://developer.paddle.com/paddlejs/methods/paddle-checkout-updatecheckout)
*   [Paddle.Checkout.updateItems()](https://developer.paddle.com/paddlejs/methods/paddle-checkout-updateitems)
*   [Paddle.Checkout.close()](https://developer.paddle.com/paddlejs/methods/paddle-checkout-close)
*   [Paddle.PricePreview()](https://developer.paddle.com/paddlejs/methods/paddle-pricepreview)
*   [Paddle.Retain.demo()](https://developer.paddle.com/paddlejs/methods/paddle-retain-demo)
*   [Paddle.Retain.initCancellationFlow()](https://developer.paddle.com/paddlejs/methods/paddle-retain-initcancellationflow)
*   [Paddle.Spinner.show()](https://developer.paddle.com/paddlejs/methods/paddle-spinner-show)
*   [Paddle.Spinner.hide()](https://developer.paddle.com/paddlejs/methods/paddle-spinner-hide)
*   [Paddle.Status.libraryVersion](https://developer.paddle.com/paddlejs/methods/paddle-status-libraryversion)
*   [Paddle.TransactionPreview()](https://developer.paddle.com/paddlejs/methods/paddle-transactionpreview)
*   Hosted checkouts 

*   [URL parameters](https://developer.paddle.com/paddlejs/hosted-checkout-url-parameters)
*   HTML data attributes 

*   [HTML data attributes](https://developer.paddle.com/paddlejs/html-data-attributes)
*   Events 

*   [Overview](https://developer.paddle.com/paddlejs/events/overview)
*   General 
*   Items 
*   Customer 
*   Payment 
*   Discount 

1.   paddlejs

3.   Paddle.Initialize()

[Paddle.Initialize()](https://developer.paddle.com/paddlejs/methods/paddle-initialize#paddle.initialize())
==========================================================================================================

Initializes Paddle.js and Retain. Replaces Paddle.Setup().

Use `Paddle.Initialize()` to initialize Paddle.js and set default checkout settings. This is a **required** method, letting you:

*   Authenticate with your Paddle account 
*   Integrate with Retain 
*   Pass settings that apply to all checkouts opened on a page 
*   Create event callbacks 

You must call `Paddle.Initialize()` and pass a client-side token to use Paddle Checkout. You can [create and manage client-side tokens](https://developer.paddle.com/paddlejs/client-side-tokens#create-client-side-token) in **Paddle > Developer tools > Authentication**.

> You can only call `Paddle.Initialize()` once on a page. You'll get an error if you try to call it more than once. Use [`Paddle.Update()`](https://developer.paddle.com/paddlejs/methods/paddle-update) to update `pwCustomer` or pass an updated `eventCallback`.

You can pass settings for opened checkouts using either [`Paddle.Checkout.open()`](https://developer.paddle.com/paddlejs/methods/paddle-checkout-open) or `Paddle.Initialize()`. Settings passed to `Paddle.Initialize()` are [default settings](https://developer.paddle.com/build/checkout/set-up-checkout-default-settings), applied to all checkouts opened on a page.

Paddle.js [emits events for key actions](https://developer.paddle.com/paddlejs/events/overview) as a customer moves through checkout. You can pass an `eventCallback` to `Paddle.Initialize()` to call a function for every Paddle.js checkout event. This is typically used as part of an [inline checkout integration](https://developer.paddle.com/build/checkout/build-branded-inline-checkout) for updating on-page elements, like items lists or breadcrumbs.

> `Paddle.Initialize()` replaces the deprecated `Paddle.Setup()` method. It's functionally the same.

### [Paddle Retain](https://developer.paddle.com/paddlejs/methods/paddle-initialize#background-retain)

[Paddle.js integrates with Retain](https://developer.paddle.com/concepts/retain/overview), so you don't have to include a separate Retain script in your app or website. Client-side tokens for live accounts authenticate with both Paddle Billing and Paddle Retain, so there's no need to pass a separate key for Retain.

To use Retain, pass `pwCustomer` for logged-in customers. You can update `pwCustomer` after initialization using [`Paddle.Update()`](https://developer.paddle.com/paddlejs/methods/paddle-update).

> **Only available for live accounts.**Paddle Retain works with live data only, meaning this method is only available for live accounts. Paddle Retain isn't loaded at all for sandbox accounts.

[Parameters](https://developer.paddle.com/paddlejs/methods/paddle-initialize#params)
------------------------------------------------------------------------------------

token string

Client-side token for authentication. You can create and manage client-side tokens in Paddle > Developer tools > Authentication. Required.

pwCustomer object or null

Identifier for a logged-in customer for Paddle Retain. Pass an empty object if you don't have a logged-in customer. Paddle Retain is only loaded for live accounts.

id string

Paddle ID of a customer entity, prefixed `ctm_`. Only customer IDs are accepted. Don't pass subscription IDs, other Paddle IDs, or your own internal identifiers for a customer.

checkout object or null

Set general checkout settings. Settings here apply to all checkouts opened on the page.

settings object

Configured settings.

eventCallback(event: EventData) => void or null

Function to call for Paddle.js events.

[Examples](https://developer.paddle.com/paddlejs/methods/paddle-initialize#examples)
------------------------------------------------------------------------------------

Initialize Paddle.js

This example passes a client-side token to Paddle.js. This is required.

You can create and manage client-side tokens in **Paddle > Developer tools > Authentication**.

```javascript
1231Paddle.Initialize({
2  token: 'live_7d279f61a3499fed520f7cd8c08'
3});
```

To learn more, see [Include and initialize Paddle.js](https://developer.paddle.com/paddlejs/include-paddlejs)

Pass customer ID for Retain

For logged-in users, you should pass `pwCustomer`.

This example passes the Paddle ID for a customer entity in Paddle to Retain.

```javascript
1234561Paddle.Initialize({
2  token: 'live_7d279f61a3499fed520f7cd8c08',
3  pwCustomer: {
4    id: 'ctm_01gt25aq4b2zcfw12szwtjrbdt'
5  }
6});
```

Where you don't know the Paddle ID for a customer, you can pass an empty object to `pwCustomer`.

To learn more, see [Initialize Paddle.js with Retain](https://developer.paddle.com/paddlejs/include-paddlejs#manual-initialize-paddlejs-retain)

Set default checkout settings (inline)

This example sets default checkout settings for all checkouts opened on a page. It includes common settings for `inline` checkouts.

```javascript
123456789101112131Paddle.Initialize({
2  token: 'live_7d279f61a3499fed520f7cd8c08', // replace with a client-side token
3  checkout: {
4    settings: {
5      displayMode: "inline",
6      theme: "light",
7      locale: "en",
8      frameTarget: "checkout-container",
9      frameInitialHeight: "450",
10      frameStyle: "width: 100%; min-width: 312px; background-color: transparent; border: none;"
11    }
12  }
13});
```

To learn more, see [Pass checkout settings](https://developer.paddle.com/build/checkout/set-up-checkout-default-settings)

Set default checkout settings for one-page (inline)

This example sets default checkout settings for all checkouts opened on a page. It includes the required settings to open a one-page inline checkout.

```javascript
12345678910111213141Paddle.Initialize({
2  token: 'live_7d279f61a3499fed520f7cd8c08', // replace with a client-side token
3  checkout: {
4    settings: {
5      displayMode: "inline",
6      variant: "one-page",
7      theme: "light",
8      locale: "en",
9      frameTarget: "checkout-container",
10      frameInitialHeight: "450",
11      frameStyle: "width: 100%; min-width: 312px; background-color: transparent; border: none;"
12    }
13  }
14});
```

Set default checkout settings (overlay)

This example sets default checkout settings for all checkouts opened on a page. It includes common settings for `overlay` checkouts.

```javascript
123456789101Paddle.Initialize({
2  token: 'live_7d279f61a3499fed520f7cd8c08', // replace with a client-side token
3  checkout: {
4    settings: {
5      displayMode: "overlay",
6      theme: "light",
7      locale: "en"
8    }
9  }
10});
```

To learn more, see [Paddle.js events](https://developer.paddle.com/paddlejs/events/overview)

Log events to console

This example logs events emitted by Paddle.js to console.

```javascript
1234561Paddle.Initialize({
2  token: 'live_7d279f61a3499fed520f7cd8c08', // replace with a client-side token
3  eventCallback: function(data) {
4    console.log(data);
5  }
6});
```

To learn more, see [Paddle.js events](https://developer.paddle.com/paddlejs/events/overview)

Log text to console based on events emitted

This example uses a switch statement to log some text to console based on events emitted by Paddle.js.

```javascript
1234567891011121314151617181Paddle.Initialize({
2  token: 'live_7d279f61a3499fed520f7cd8c08', // replace with a client-side token
3  eventCallback: function(data) {
4    switch(data.name) {
5      case "checkout.loaded":
6        console.log("Checkout opened");
7        break;
8      case "checkout.customer.created":
9        console.log("Customer created");
10        break;
11      case "checkout.completed":
12        console.log("Checkout completed");
13        break;
14      default:
15        console.log(data);
16    }
17  }
18});
```

To learn more, see [Paddle.js events](https://developer.paddle.com/paddlejs/events/overview)

[Related pages](https://developer.paddle.com/paddlejs/methods/paddle-initialize#related-pages)
----------------------------------------------------------------------------------------------

Include and initialize Paddle.js

[Read more](https://developer.paddle.com/paddlejs/include-paddlejs)

Paddle.js events

[Read more](https://developer.paddle.com/paddlejs/events/overview)

Paddle.checkout.open() method

[Read more](https://developer.paddle.com/paddlejs/methods/paddle-checkout-open)

On this page

*   [Paddle.Initialize()](https://developer.paddle.com/paddlejs/methods/paddle-initialize#paddle.initialize() "Paddle.Initialize()")
*   [Paddle Retain](https://developer.paddle.com/paddlejs/methods/paddle-initialize#background-retain "Paddle Retain ")
*   [Parameters](https://developer.paddle.com/paddlejs/methods/paddle-initialize#params "Parameters ")
*   [Examples](https://developer.paddle.com/paddlejs/methods/paddle-initialize#examples "Examples ")
*   [Related pages](https://developer.paddle.com/paddlejs/methods/paddle-initialize#related-pages "Related pages ")

![Image 2: Paddle Logo](https://developer.paddle.com/logo.svg)

[Status](https://paddle.status.io/)[Paddle.com](https://www.paddle.com/)[Security](https://security.paddle.com/)[Changelog](https://developer.paddle.com/changelog/overview)

[](https://twitter.com/PaddleHQ "Twitter")[](https://linkedin.com/company/paddle "LinkedIn")[](https://github.com/PaddleHQ "GitHub")

### Sign up for developer updates

No marketing emails. Unsubscribe any time.

Subscribe

[Privacy Policy](https://www.paddle.com/legal/privacy)[Terms](https://www.paddle.com/legal/terms)

Paddle.com Market Ltd. © 2012–2025
