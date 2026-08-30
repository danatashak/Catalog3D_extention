# Versioning and migration

The loader follows semantic versioning. The stable browser URL is versioned by
major API generation:

```text
https://catalog3d.ai/embed/v1/catalog3d.js
```

Backward-compatible fixes and additions may ship within v1. Breaking changes
require a new major URL and migration guide.

The `v1` URL is mutable by design and currently has no immutable per-release
counterpart, so it cannot be combined with a stable Subresource Integrity hash.
Stores that require a pinned dependency should use the npm package and commit
their lockfile:

```sh
npm install @catalog3d/embed
```

## Compatibility commitments

- Existing valid mount configuration retains its meaning within v1.
- Events and error codes documented for v1 remain stable.
- New optional configuration or handle methods may be added in a minor release.
- Private wire messages, iframe DOM, internal styles, backend routes, and room
  implementation details are not public compatibility surfaces.

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

## Changelog

See [`CHANGELOG.md`](../CHANGELOG.md) for release-level additions.
