# Versioning and migration

The loader follows semantic versioning. The stable browser URL is versioned by
major API generation:

```text
https://catalog3d.ai/embed/v1/catalog3d.js
```

Backward-compatible fixes and additions may ship within v1. Breaking changes
use a new major URL and include a migration guide.

Stores that require an exact version should use the npm package and commit their
lockfile:

```sh
npm install @catalog3d/embed
```

## Compatibility commitments

- Existing valid mount configuration retains its meaning within v1.
- Events and error codes documented for v1 remain stable.
- New optional configuration or handle methods may be added in a minor release.
- The documented API defines the compatibility surface.

## Product changes

V1 configuration is immutable. Use `destroy()` and mount again:

```js
let room = await Catalog3D.mount(firstProduct);

async function showProduct(nextProduct) {
  room.destroy();
  room = await Catalog3D.mount(nextProduct);
}
```

Remounting starts a new room experience. Prefer normal product-page navigation
when the shopper should not carry the current room session between products.
