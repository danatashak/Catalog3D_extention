# Integration guide

Add Catalog3D to a product page with a publishable site id, a product id, and an
optional appearance configuration. Use normal page CSS to size and place it.

## 1. Register the merchant site

Ask Catalog3D for a publishable `siteId` registered for the merchant's HTTPS
origins and products. Never place an API secret in browser code.

For local development, use an explicitly registered loopback origin such as
`http://127.0.0.1:4174`. Origin matching includes the scheme and non-default
port.

## 2. Add a sized target

```html
<section class="product-media">
  <img class="product-poster" src="/media/chair.webp" alt="Marlow armchair" />
  <div id="catalog3d-room"></div>
</section>
```

Mounting replaces the target's children, so keep any poster image or
`<noscript>` fallback in a sibling element rather than inside the target.

```css
.product-media {
  width: min(100%, 760px);
}

#catalog3d-room {
  width: 100%;
  min-height: 420px;
  aspect-ratio: 1 / 1;
  overflow: hidden;
  border-radius: 22px;
}
```

The merchant controls placement and size. Catalog3D fills the target and applies
a 420-pixel minimum height.

## 3. Load and mount

```html
<script src="https://catalog3d.ai/embed/v1/catalog3d.js"></script>
<script type="module">
  const target = document.querySelector("#catalog3d-room");

  target.addEventListener("catalog3d:ready", () => {
    console.info("Catalog3D mounted");
  });

  target.addEventListener("catalog3d:room-ready", () => {
    console.info("The shopper's room is ready");
  });

  target.addEventListener("catalog3d:error", (event) => {
    console.error(event.detail.code, event.detail.message);
  });

  const handle = await window.Catalog3D.mount({
    target,
    siteId: "your-publishable-site-id",
    productId: "your-product-id",
    locale: "en",
    appearance: {
      theme: "auto",
      accentColor: "#274d3d",
      fontFamily: "Inter, system-ui, sans-serif",
    },
  });
</script>
```

Attach listeners before mounting so early errors are observable.

## 4. Connect a host chatbot

After `catalog3d:room-ready`, pass a shopper's plain-language removal request:

```js
await handle.requestRemoval({
  description: "remove the small table beside the window",
});
```

Resolution confirms that Catalog3D accepted the request.

## 5. Clean up or change products

```js
handle.destroy();
```

Configuration is immutable. Destroy and mount again to show another product or
variant. This starts a new Catalog3D room experience. For normal product pages,
full page navigation is often the simplest lifecycle.

## Product-page architecture

Keep merchant commerce UI—title, price, variants, quantity, cart,
recommendations, and navigation—in the product page. Place Catalog3D in the
product media area.

See [`examples/product-page`](../examples/product-page/) for the complete
reference.
