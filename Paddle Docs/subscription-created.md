Title: Subscription created scenario - Paddle Developer

URL Source: https://developer.paddle.com/webhooks/scenarios/subscription-created

Markdown Content:
Simulates all events that occur when a subscription is created from a checkout.

Configure which webhooks send when simulating a created subscription

2.   #### [Customer adds their details and address](https://developer.paddle.com/webhooks/scenarios/subscription-created#events-adds-customer-details)

[`customer.created`](https://developer.paddle.com/webhooks/customers/customer-created)Paddle creates a new customer with the information provided by the customer. The customer's status is `active`.
[`address.created`](https://developer.paddle.com/webhooks/addresses/address-created)When a customer enters their country and ZIP/postal code, Paddle always creates a new address related to this customer.
[`transaction.updated`](https://developer.paddle.com/webhooks/transactions/transaction-updated)Paddle updates the transaction with the customer and address. The transaction status is `ready` because the transaction has customer and address information.
[`transaction.ready`](https://developer.paddle.com/webhooks/transactions/transaction-ready)Occurs because the transaction status changes to `ready`. 
3.   #### [Customer completes checkout successfully](https://developer.paddle.com/webhooks/scenarios/subscription-created#events-checkout-completed)

[`transaction.updated`](https://developer.paddle.com/webhooks/transactions/transaction-updated)The transaction status changes to `paid` now that the customer has paid successfully. The transaction is updated with information about the successful payment.
[`transaction.paid`](https://developer.paddle.com/webhooks/transactions/transaction-paid)Occurs because the transaction status changes to `paid`.
[`subscription.created`](https://developer.paddle.com/webhooks/subscriptions/subscription-created)Paddle creates a subscription for the customer, address, and business against the transaction. Its status is `active` as the prices in the transaction items have no `trial_period`. Includes a `transaction_id` field so you can match with the completed transaction.
[`subscription.activated`](https://developer.paddle.com/webhooks/subscriptions/subscription-activated)Occurs because the subscription has no trial period and is now active.
[`transaction.updated`](https://developer.paddle.com/webhooks/transactions/transaction-updated)The transaction is updated with the ID of the new subscription, the billing period, and information about fees, payouts, and earnings.
[`transaction.updated`](https://developer.paddle.com/webhooks/transactions/transaction-updated)An invoice number is assigned to the transaction. Its status changes to `completed` as Paddle has finished processing it.
[`transaction.completed`](https://developer.paddle.com/webhooks/transactions/transaction-completed)Occurs because the transaction status changes to `completed`. 

[Related pages](https://developer.paddle.com/webhooks/scenarios/subscription-created#related-pages)
---------------------------------------------------------------------------------------------------

Subscription creation

Simulate webhooks
