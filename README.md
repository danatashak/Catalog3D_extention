# Catalog3D Embed

The public, zero-runtime-dependency loader for Catalog3D room experiences. It creates a Catalog3D-hosted iframe and never exposes backend credentials, model URLs, room jobs, geometry artifacts, or renderer controls to the merchant page.

## No-build usage

```html
<div id="catalog3d-room"></div>
<script src="https://catalog3d.ai/embed/v1/catalog3d.js"></script>
<script>
  Catalog3D.mount({
    target: "#catalog3d-room",
    siteId: "your-publishable-site-id",
    productId: "your-product-id",
    variantId: "optional-variant-id",
    locale: "en",
    appearance: { theme: "auto" },
  });
</script>
```

The promise resolves after the iframe is ready. Product changes destroy and remount the experience.

```js
const room = await Catalog3D.mount({
  target: "#catalog3d-room",
  siteId: "your-publishable-site-id",
  productId: "your-product-id",
});

await room.requestRemoval({
  description: "remove the floor lamp beside the sofa",
});
```

Call `requestRemoval()` after `catalog3d:room-ready`. Its promise confirms that
Catalog3D accepted the intent; Catalog3D owns localization, UI state, processing,
and the resulting room update. Descriptions are plain text from 1 to 500
characters. The handle also contains `destroy()`.

## Declarative usage

```html
<script src="https://catalog3d.ai/embed/v1/catalog3d.js"></script>
<catalog3d-room
  site-id="your-publishable-site-id"
  product-id="your-product-id"
  locale="en"
  theme="auto">
</catalog3d-room>
```

## Events

- `catalog3d:ready`
- `catalog3d:room-ready`
- `catalog3d:error` with `{ code, message }`

`room-ready` intentionally carries no room image, file, scene, job, or artifact data.

## Development

```sh
npm install
npm test
npm run typecheck
npm run build
```
