Title: Create or update notification destinations - Paddle Developer

URL Source: https://developer.paddle.com/webhooks/notification-destinations

Markdown Content:
Create notification destinations to tell Paddle which events you want to receive and where to deliver them to. Once added, you can update, deactivate, and delete destinations.

A notification destination is a webhook endpoint or email address that Paddle sends notifications about events to. It's called a notification setting in the API.

[How it works](https://developer.paddle.com/webhooks/notification-destinations#background)
------------------------------------------------------------------------------------------

When something notable occurs in your system, Paddle creates an event entity with information about what happened and when. You use [the list events operation](https://developer.paddle.com/api-reference/events/list-events) in the API to get a paginated list of events that have occurred. This is sometimes called the event stream.

You can [set up a notification destination](https://developer.paddle.com/webhooks/notification-destinations) to tell Paddle to deliver notifications when events occur. When an event occurs, Paddle sends a notification with the event payload to your notification destination — typically a webhook to your webhook endpoint server.

Events include the new or changed entity, along with information about when an event occurred. You can use notifications to keep your app in sync with Paddle, or to integrate with third-party systems. For example, you can subscribe to notifications for [`subscription.canceled`](https://developer.paddle.com/webhooks/subscriptions/subscription-canceled), then make sure customers can't access a canceled subscription when you receive these notifications.

> A **notification** is an instance of a delivery attempt for an event. A single event may create multiple **notifications**. For example, you can create two notification destinations configured for the same event. In this case, Paddle creates two notifications for each destination that share an `event_id`.

[Create a notification destination](https://developer.paddle.com/webhooks/notification-destinations#create-destination)
-----------------------------------------------------------------------------------------------------------------------

Create a notification destination to start receiving notifications for events. You can choose the kind of events that you want to receive notifications for.

> You can create as many notification destinations as you want, but only 10 can be active at once.

Dashboard

API

1.   Go to **Paddle > Developer tools > Notifications**.

2.   Click **New destination**.

3.   Enter the details for your new notification destination.

4.   Choose the events that you want to receive notifications for.

5.   Click **Save destination** when you're done.

![Image 1: Illustration of the create notification destination drawer in Paddle.](https://developer.paddle.com/assets/images/procedure-new-destination-20240923.svg)

> You can use [Hookdeck Console](https://console.hookdeck.com/?provider=paddlebilling) to get a URL that you can send events to right away. If you're working locally, you can [forward events to your local server](https://developer.paddle.com/webhooks/respond-to-webhooks#local-testing-test-your-handler).

[Update a notification destination](https://developer.paddle.com/webhooks/notification-destinations#update-destination)
-----------------------------------------------------------------------------------------------------------------------

Once you've created a notification destination, you can change its name, destination URL or email, what kind of traffic it receives, and the events received.

To change other fields, deactivate this notification destination and create another.

Dashboard

API

1.   Go to **Paddle > Developer tools > Notifications**.

2.   Click the **…** action menu next to a notification destination in the list, then choose **Edit destination** from the menu.

3.   Edit notification destination details and subscribed events.

4.   Click **Update destination** when you're done.

![Image 2: Illustration of the update notification destination drawer in Paddle.](https://developer.paddle.com/assets/images/procedure-update-destination-20240923.svg)

[Deactivate a notification destination](https://developer.paddle.com/webhooks/notification-destinations#deactivate-destination)
-------------------------------------------------------------------------------------------------------------------------------

Deactivate a notification destination to stop Paddle from sending notifications for events to it. Deactivation is useful if you need to make changes to a webhook endpoint server or integration. You can reactivate later, if needed.

Dashboard

API

1.   Go to **Paddle > Developer tools > Notifications**.

2.   Click the **…** action menu next to a notification destination in the list, then choose **Deactivate** from the menu.

3.   Click **Deactivate destination** on the box that appears to confirm.

You can reactivate later by choosing **Activate** from the menu.

![Image 3](https://developer.paddle.com/assets/images/procedure-deactivate-destination-20240916.svg)

[Delete a notification destination](https://developer.paddle.com/webhooks/notification-destinations#delete-destination)
-----------------------------------------------------------------------------------------------------------------------

Delete a notification destination to permanently remove it from your Paddle system. Paddle stops sending notifications for events to your destination, and you'll lose access to all the logs for this notification destination.

> There's no way to recover a deleted notification destination. Deactivate a notification destination if you'll need access to the logs or want to reactivate later on.

You can only delete notification destinations using the API.

### [Request](https://developer.paddle.com/webhooks/notification-destinations#request-delete-destination)

Send a `DELETE` request to the `/notification-settings/{notification_setting_id}` endpoint, passing the ID of the notification destination as a path parameter.

notification_setting_id string

Paddle ID of the notification entity to work with.

### [Response](https://developer.paddle.com/webhooks/notification-destinations#response-delete-destination)

If successful, Paddle returns `204 No Content` with no response body.

[Troubleshooting](https://developer.paddle.com/webhooks/notification-destinations#troubleshooting)
--------------------------------------------------------------------------------------------------

[Common errors](https://developer.paddle.com/webhooks/notification-destinations#related-errors)
-----------------------------------------------------------------------------------------------

[`notification_maximum_active_settings_reached`](https://developer.paddle.com/errors/notifications/notification_maximum_active_settings_reached)You can only have 10 active notification destinations at once. Deactivate a notification destination before creating a new one.
[`url_notification_setting_incorrect`](https://developer.paddle.com/errors/notifications/url_notification_setting_incorrect)The URL you supplied for a notification destination isn't valid.
[`url_notification_setting_incorrect`](https://developer.paddle.com/errors/notifications/email_notification_setting_incorrect)The email address you supplied for a notification destination isn't valid.

[Related pages](https://developer.paddle.com/webhooks/notification-destinations#related-pages)
----------------------------------------------------------------------------------------------

Verify webhook signatures

Simulate webhooks

List event types operation
