Title: List events - Paddle Developer

URL Source: https://developer.paddle.com/api-reference/events/list-events

Markdown Content:
Permission required

Returns a paginated list of events that have occurred in the last 90 days. Use the query parameters to page through results.

Events older than 90 days aren't retained.

This is sometimes referred to as "the event stream."

### [Query Parameters](https://developer.paddle.com/api-reference/events/list-events#query-parameters)

after string

Return entities after the specified Paddle ID when working with paginated endpoints. Used in the `meta.pagination.next` URL in responses for list operations.

order_by string

Order returned entities by the specified field and direction (`[ASC]` or `[DESC]`). For example, `?order_by=id[ASC]`.

Valid fields for ordering: `id` (for `event_id`).

per_page integer

Set how many entities are returned per page. Paddle returns the maximum number of results if a number greater than the maximum is requested. Check `meta.pagination.per_page` in the response to see how many were returned.

Default: `50`; Maximum: `200`.

event_type array[string]

Return events that match the specified event type. Use a comma-separated list to specify multiple event types.

### [Response](https://developer.paddle.com/api-reference/events/list-events#response)

data array[object]

Represents an event entity.

event_id string

Unique Paddle ID for this event, prefixed with `evt_`.

event_type string

Type of event sent by Paddle, in the format `entity.event_type`.

occurred_at string<date-time>

RFC 3339 datetime string of when this event occurred.

data object

New or changed entity.

meta object

Information about this response.

request_id string

Unique ID for the request relating to this response. Provide this when contacting Paddle support about a specific request.

pagination object

Keys used for working with paginated results.

200 Response

```
12345678910111213141516171819201{
2  "data": [
3    {
4      "event_id": "evt_01hv97725sakkxq0yqdqef4m6p",
5      "event_type": "transaction.completed",
6      "occurred_at": "2024-04-12T13:16:10.809640Z",
7      "data": {
8        "id": "txn_01hv975mbh902hcyb7mks5kt0n",
9        "status": "completed",
10        "customer_id": "ctm_01hv976dcgq4wmyrp8yq7asfmj",
11        "address_id": "add_01hv976dczs1h4a7zym0dn7qam",
12        "business_id": null,
13        "custom_data": null,
14        "currency_code": "USD",
15        "origin": "web",
16        "subscription_id": "sub_01hv9770y40xzc823155s0z4zz",
17        "invoice_id": "inv_01hv9770zc8cs6exr53y8acsms",
18        "invoice_number": "325-10576",
19        "collection_mode": "automatic",
20        "discount_id": null,
```
