Title: Paddle.Checkout.open() - Paddle Developer

URL Source: https://developer.paddle.com/paddlejs/methods/paddle-checkout-open

Markdown Content:
Opens a checkout with settings, items, and customer information.

Use `Paddle.Checkout.open()` to open a checkout.

*   Set the initial items list or transaction that this checkout is for

*   Set checkout settings, like the theme

*   Prefill checkout properties, like customer email and country

To add items to a checkout, you can pass either:

*   An `items` array of objects, where each object contains a `priceId` and `quantity` property. `priceId` should be a Paddle ID of [a price entity](https://developer.paddle.com/api-reference/prices/overview).

> Recurring items on a checkout must have the same billing interval. For example, you can't have a checkout with some prices that are billed monthly and some products that are billed annually.

To speed up checkout, or build workflows for logged-in customers, you can [prefill customer, address, and business information](https://developer.paddle.com/build/checkout/prefill-checkout-properties). You can do this by passing customer, address, and business data, or by passing Paddle IDs for an existing customer, address, or business.

You can use [the `Paddle.Initialize()` method](https://developer.paddle.com/paddlejs/methods/paddle-initialize) to [set default checkout settings](https://developer.paddle.com/build/checkout/set-up-checkout-default-settings). These settings apply to all checkouts opened on a page.

> Instead of using `Paddle.Checkout.open()`, you can use HTML data attributes to open a checkout. This is ideal when working with a CMS that has limited customization options, or if you're not comfortable with JavaScript. To learn more, see [HTML data attributes](https://developer.paddle.com/paddlejs/html-data-attributes)

[Parameters](https://developer.paddle.com/paddlejs/methods/paddle-checkout-open#params)
---------------------------------------------------------------------------------------

settings object

Set general checkout settings.

allowLogout boolean or null

Whether the user can change their email once on the checkout.

allowDiscountRemoval boolean or null

Whether the user can remove an applied discount at checkout. Defaults to `true`.

allowedPaymentMethods null or array[string]

Payment options presented to customers at checkout.

displayMode string or null

Display mode for the checkout.

frameInitialHeight string or null

Height in pixels of the `<div>` on load. Do not include `px`. Recommended `450`.

The inline checkout footer includes a message to let customers know that Paddle is the merchant of record for the transaction. For compliance, the inline checkout frame must be sized so that the footer message is visible.

frameStyle string<css> or null

Styles to apply to the checkout `<div>`. `min-width` must be set to `286px` or above with checkout padding off; `312px` with checkout padding on. Use `frameInitialHeight` to set height.

frameTarget string or null

Class name of the `<div>` element where the checkout should be rendered.

locale string or null

Language for the checkout. If omitted, the browser's default locale is used.

showAddDiscounts boolean or null

Whether the option to add a discount is displayed at checkout. Requires the "display discount field on the checkout"option enabled in Paddle > Checkout > Checkout settings. Defaults to `true`.

showAddTaxId boolean or null

Whether the option to add a tax number is displayed at checkout. Defaults to `true`.

successUrl string<uri> or null

URL to redirect to on checkout completion. Must start with `http://` or `https://`.

theme string or null

Theme for the checkout. If omitted, defaults to light.

variant string or null

Checkout experience presented to customers. Defaults to `multi-page`.

items array[object]

List of items for this checkout. You must pass at least one item. Use the `updateItems()` or `updateCheckout()` method to update the items list.

priceId string<Paddle ID>

Paddle ID of the price for this item.

quantity integer or null

Quantity for this line item.

transactionId string<Paddle ID> or null

Paddle ID of an existing transaction to use for this checkout. Use this instead of an `items` array to create a checkout for a transaction you previously created.

customerAuthToken string

customer object

Information about the customer for this checkout. Pass either an existing `id`, or the other fields.

id string<Paddle ID>

Paddle ID of the customer for this checkout. Use if you know the customer, like if they're authenticated and making a change to their subscription. You can't use if you're passing `email`.

email string<email> or null

Email for this customer. You can't use if you're passing `id`.

address object

Information about the customer address for this checkout. Pass either an existing `id`, or the other fields.

business object

Information about the customer business for this checkout. Pass either an existing `id`, or the other fields.

discountCode string or null

Discount code to apply to this checkout. Use to prepopulate a discount. Pass either `discountCode` or `discountId`.

discountId string<Paddle ID> or null

Paddle ID of a discount to apply to this checkout. Use to prepopulate a discount. Pass either `discountCode` or `discountId`.

customData object or null

Your own structured key-value data to include with this checkout. Passed data is held against the related transaction. If a transaction is for recurring items, custom data is copied to the related subscription when created. Must be valid JSON and contain at least one key.

savedPaymentMethodId string or null

Paddle ID for a saved payment method for this customer. If passed, only this saved payment method is presented at checkout. Use the [list payment methods for a customer operation](https://developer.paddle.com/api-reference/payment-methods/list-payment-methods)to get saved payment method IDs for a customer. Requires `customerAuthToken`.

[Examples](https://developer.paddle.com/paddlejs/methods/paddle-checkout-open#examples)
---------------------------------------------------------------------------------------

[Events](https://developer.paddle.com/paddlejs/methods/paddle-checkout-open#related-events)
-------------------------------------------------------------------------------------------

[`checkout.loaded`](https://developer.paddle.com/paddlejs/general/checkout-loaded)Emitted when the checkout opens.
[`checkout.customer.created`](https://developer.paddle.com/paddlejs/customer/checkout-customer-created)Emitted when the checkout opens with customer properties prefilled.

[Related pages](https://developer.paddle.com/paddlejs/methods/paddle-checkout-open#related-pages)
-------------------------------------------------------------------------------------------------

Build an inline checkout

Build an overlay checkout

Paddle.Initialize() method
