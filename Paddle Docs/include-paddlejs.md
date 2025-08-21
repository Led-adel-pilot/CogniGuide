Title: Include and initialize Paddle.js - Paddle Developer

URL Source: https://developer.paddle.com/paddlejs/include-paddlejs

Markdown Content:
You can manually load the Paddle.js script on your website using a script tag.

[Add the script tag to your HTML](https://developer.paddle.com/paddlejs/include-paddlejs#manual)
------------------------------------------------------------------------------------------------

Add the Paddle.js script to the `<head>` section of your HTML:

`11<script src="https://cdn.paddle.com/paddle/v2/paddle.js"></script>`

> Always load Paddle.js directly from `https://cdn.paddle.com/`. This makes sure that you're running with the latest security and feature updates from Paddle.

[Initialize and authenticate](https://developer.paddle.com/paddlejs/include-paddlejs#manual-initialize-paddlejs)
----------------------------------------------------------------------------------------------------------------

You need a [client-side token](https://developer.paddle.com/paddlejs/client-side-tokens) to authenticate with Paddle.js. [Create a token](https://developer.paddle.com/paddlejs/client-side-tokens#create-client-side-token) in **Paddle > Developer tools > Authentication**.

> Never use [API keys](https://developer.paddle.com/api-reference/about/api-keys#format) with Paddle.js. API keys should be kept secret and away from the frontend. [Revoke the key](https://developer.paddle.com/api-reference/about/api-keys#revoke-api-key) if it has been compromised. Use [client-side tokens](https://developer.paddle.com/paddlejs/client-side-tokens) starting with `test_` or `live_`.

Initialize Paddle.js by calling the [`Paddle.Initialize()` method](https://developer.paddle.com/paddlejs/methods/paddle-initialize) with a configuration object that includes a client-side token as the `token` property:

```
1234561<script src="https://cdn.paddle.com/paddle/v2/paddle.js"></script>
2<script type="text/javascript">
3  Paddle.Initialize({ 
4    token: 'live_7d279f61a3499fed520f7cd8c08' // replace with a client-side token
5  });
6</script>
```

### [Setup Retain](https://developer.paddle.com/paddlejs/include-paddlejs#manual-initialize-paddlejs-retain)

[Paddle.js integrates with Retain](https://developer.paddle.com/concepts/retain/overview), so you don't have to include a separate Retain script in your app or website. [Client-side tokens](https://developer.paddle.com/paddlejs/client-side-tokens) for live accounts authenticate with both Paddle Billing and Paddle Retain, so there's no need to pass a separate key for Retain.

> To use [Retain](https://developer.paddle.com/concepts/retain/overview), include Paddle.js on your commercial website homepage and the first page your user sees after authenticating, as well as your checkout and pricing pages.

You need to include a `pwCustomer` object in the configuration object passed to the [`Paddle.Initialize()` method](https://developer.paddle.com/paddlejs/methods/paddle-initialize). The `id` property of the `pwCustomer` object must be the Paddle ID of a [customer entity](https://developer.paddle.com/api-reference/customers/overview). Other IDs and internal identifiers for a customer don't work with Retain.

pwCustomer object or null

Identifier for a logged-in customer for Paddle Retain. Pass an empty object if you don't have a logged-in customer. Paddle Retain is only loaded for live accounts.

id string

Paddle ID of a customer entity, prefixed `ctm_`. Only customer IDs are accepted. Don't pass subscription IDs, other Paddle IDs, or your own internal identifiers for a customer.

```
1234567891<script src="https://cdn.paddle.com/paddle/v2/paddle.js"></script>
2<script type="text/javascript">
3  Paddle.Initialize({
4    token: 'live_7d279f61a3499fed520f7cd8c08', // replace with a client-side token
5    pwCustomer: {
6      id: 'ctm_01gt25aq4b2zcfw12szwtjrbdt' // replace with a customer Paddle ID
7    }
8  });
9</script>
```

> **Only available for live accounts.**Paddle Retain works with live data only, meaning this method is only available for live accounts. Paddle Retain isn't loaded at all for sandbox accounts.
