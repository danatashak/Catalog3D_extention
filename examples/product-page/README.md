# Product-page example

This is the canonical visual and integration example for the Catalog3D loader.
It uses plain HTML, CSS, and JavaScript so it can be adapted to any storefront
stack.

Run it from the repository root:

```sh
npm install
npm run build
npm run example
```

Then open
<http://127.0.0.1:4174/examples/product-page/>.

The page loads the repository's local `dist/catalog3d.js` build while pointing
that loader at the real Catalog3D iframe host. The minimal copy-paste example
continues to use the stable production script URL.

## What the example uses

The host page owns product content, commerce controls, media navigation,
placement, sizing, and the assistant UI. `catalog3d-host.js` is the complete
boundary with Catalog3D. It uses only:

- `Catalog3D.mount(options)`;
- `catalog3d:ready`, `catalog3d:room-ready`, and `catalog3d:error` events;
- `handle.requestRemoval({ description })`;
- `handle.destroy()`.

The material and wood buttons demonstrate host-owned storefront UI. Public v1
configuration is immutable, so a real product or variant change should destroy
the current handle and mount a new one. See
[versioning and immutable configuration](../../docs/versioning.md).

## Adapting the page

1. Replace `data-site-id` and `data-product-id` on `<body>` with published IDs.
2. Replace the demo product content and media.
3. Change the target size and placement in `styles.css` as needed.
4. Set the bounded appearance tokens passed in `app.js`.
5. Use the documented events for page coordination.

The page code is MIT-licensed. The remote product photography has separate
usage terms documented in [ASSETS.md](./ASSETS.md).
