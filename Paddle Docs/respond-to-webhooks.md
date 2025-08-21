Title: Handle webhook delivery - Paddle Developer

URL Source: https://developer.paddle.com/webhooks/respond-to-webhooks

Markdown Content:
Properly handle notifications by making sure your webhook event server is configured correctly, and responding within five seconds.

Once you've created a notification destination, you should properly handle webhook delivery to make sure your integration performs well.

[How it works](https://developer.paddle.com/webhooks/respond-to-webhooks#background)
------------------------------------------------------------------------------------

[Webhooks](https://developer.paddle.com/webhooks/overview) let you subscribe to events in Paddle. When a subscribed event occurs, Paddle sends a notification to [a webhook endpoint that you specify](https://developer.paddle.com/webhooks/notification-destinations).

You can use notifications to keep your app in sync with Paddle, or to integrate with third-party systems. For example, when a [subscription cancels](https://developer.paddle.com/build/subscriptions/cancel-subscriptions), Paddle can send you a [`subscription.canceled`](https://developer.paddle.com/webhooks/subscriptions/subscription-canceled) webhook. When you receive this webhook, you can provision your app to make sure the canceled customer can no longer access your app.

To make sure your app or integration performs well, you should properly handle webhook delivery by making sure your webhook server is configured correctly, responding to notifications promptly, and handling retries.

[Before you begin](https://developer.paddle.com/webhooks/respond-to-webhooks#prerequisites)
-------------------------------------------------------------------------------------------

### [Create a notification destination](https://developer.paddle.com/webhooks/respond-to-webhooks#prerequisites-create-notification-setting)

[Create a notification destination](https://developer.paddle.com/webhooks/notification-destinations) where the type is `url` (webhook), if you haven't already.

[Allow Paddle IP addresses](https://developer.paddle.com/webhooks/respond-to-webhooks#allow-paddle-ips)
-------------------------------------------------------------------------------------------------------

You should make sure that webhooks originate from a Paddle webhook IP address. We recommend adding Paddle webhook IP addresses to your allowlist, and rejecting webhooks that come from other sources.

Allow different IP addresses for `sandbox` and `live` accounts:

#### [Sandbox](https://developer.paddle.com/webhooks/respond-to-webhooks#sandbox)

Your [sandbox account](https://developer.paddle.com/build/tools/sandbox) is for evaluation and testing. All transactions are tests, meaning transactions are simulated and any money isn't real.

```
123456134.194.127.46
254.234.237.108
33.208.120.145
444.226.236.210
544.241.183.62
6100.20.172.113
```

#### [Live](https://developer.paddle.com/webhooks/respond-to-webhooks#live)

Your live account is where customers can make purchases. Transactions are real, meaning payment methods are charged and you earn real money.

```
123456134.232.58.13
234.195.105.136
334.237.3.244
435.155.119.135
552.11.166.252
634.212.5.7
```

If you're using a Web Application Firewall (WAF) to protect your web server from bot traffic, requests from Paddle may be blocked incorrectly. We recommend configuring your firewall to bypass bot checks on webhook endpoint paths. Additionally, use Paddle IP addresses and match `Paddle` as the user agent string to further restrict your rule.

[Configure your webhook handler](https://developer.paddle.com/webhooks/respond-to-webhooks#configure-webhook-handler)
---------------------------------------------------------------------------------------------------------------------

To receive webhooks, make sure your webhook event server:

*   Uses HTTPS

*   Can accept `POST` requests with a JSON payload

*   Returns `200` within **five seconds** of receiving a request

We recommend configuring your handler to process webhooks asynchronously by queueing received events and processing them in order. This helps prevent a large spike in webhooks from overwhelming your server.

[Respond to events](https://developer.paddle.com/webhooks/respond-to-webhooks#respond-events)
---------------------------------------------------------------------------------------------

The server that you set to receive events from Paddle should respond with an HTTP `200` status code within five seconds. This lets Paddle know that you successfully received the message.

You should respond before doing any internal processing. For example, if you use a webhook to update a record in a third-party system, respond with a `200` before running any logic to communicate with the third-party solution.

We can't guarantee the order of delivery for webhooks. They may be delivered in a different order to the order they're generated. Store and check the `occurred_at` date against a webhook before making changes.

[Handle retries](https://developer.paddle.com/webhooks/respond-to-webhooks#handle-retries)
------------------------------------------------------------------------------------------

If your server sends another kind of status code or doesn't respond within five seconds, Paddle automatically retries using an exponential backoff schedule:

*   For sandbox accounts, we retry 3 times within 15 minutes.

*   For live accounts, we retry 60 times within 3 days. The first 20 attempts happen in the first hour, with 47 in the first day and 60 in total.

Use [an exponential backoff calculator](https://exponentialbackoffcalculator.com/) to visualize retries from the date now. Use these values:

**Interval (secs)**`60`
**Max retries**`60`
**Exponential**`1.1`

You can check the status of a webhook and see delivery attempts using the Paddle dashboard, or by using the [list logs for a notification operation](https://developer.paddle.com/api-reference/notification-logs/list-notification-logs) in the Paddle API.

When all attempts to deliver a webhook are exhausted, its status is set to `failed`. You can attempt to redeliver a notification using the [replay a notification operation](https://developer.paddle.com/api-reference/notifications/replay-notification) in the Paddle API.

[Verify webhook signatures](https://developer.paddle.com/webhooks/respond-to-webhooks#verify-webhooks)
------------------------------------------------------------------------------------------------------

Use the `Paddle-Signature` header included with each webhook to [verify that received events](https://developer.paddle.com/webhooks/signature-verification) are genuinely sent by Paddle.

[Test your handler](https://developer.paddle.com/webhooks/respond-to-webhooks#test-your-handler)
------------------------------------------------------------------------------------------------

### [Send simulated webhooks to your handler](https://developer.paddle.com/webhooks/respond-to-webhooks#send-simulated-test-events)

Test your webhook handler by sending simulated events to your endpoint using the [webhook simulator](https://developer.paddle.com/webhooks/test-webhooks). You can customize payloads, inspect event details, and replay simulations as part of your testing process.

### [Forward events to a local endpoint](https://developer.paddle.com/webhooks/respond-to-webhooks#local-testing-test-your-handler)

Notification destinations require public-facing URLs. If you're developing locally, you can expose your local development server to the internet using a service like [Hookdeck CLI](https://hookdeck.com/docs/cli):

2.   Run your local server. Note the port your local server is running on.

3.   Run `hookdeck listen {PORT} paddle --path {WEBHOOK_ENDPOINT_PATH}`, where `{PORT}` is the port where your local server is running and `{WEBHOOK_ENDPOINT_PATH}` is the path to your webhook handler. For example:

`11hookdeck listen 3000 paddle --path /api/webhook`  

To learn more about Hookdeck, see [Test and replay Paddle Billing webhooks](https://hookdeck.com/webhooks/platforms/how-to-test-and-replay-paddle-webhooks-events-on-localhost-with-hookdeck) on the Hookdeck docs.

[Related pages](https://developer.paddle.com/webhooks/respond-to-webhooks#related-pages)
----------------------------------------------------------------------------------------

Verify webhook signatures

Create a notification destination
