# Catalog3D Extension

The public, zero-runtime-dependency browser loader for embedding Catalog3D in a
product page. Catalog3D owns room selection, upload, processing, object removal,
and presentation inside an isolated Catalog3D application. The merchant page
controls the application's placement, dimensions, responsive layout, and
bounded visual theme.

## Five-minute integration

```html
<div id="catalog3d-room" style="height:680px"></div>

<script src="https://catalog3d.ai/embed/v1/catalog3d.js"></script>
<script>
  Catalog3D.mount({
    target: "#catalog3d-room",
    siteId: "your-publishable-site-id",
    productId: "your-product-id",
    locale: "en",
    appearance: {
      theme: "auto",
      accentColor: "#274d3d",
      fontFamily: "Inter, system-ui, sans-serif",
    },
  }).then((handle) => {
    window.catalog3dRoom = handle;
  });
</script>
```

The promise resolves when the Catalog3D application is ready. Catalog3D owns the
upload interface; the host does not select or load room files. Mounting replaces
the target's children, so keep any poster or fallback markup in a sibling
element.

Bundler-based apps can skip the tag and import the package instead:

```sh
npm install @catalog3d/embed
```

```js
import { mount } from "@catalog3d/embed";
```

After `catalog3d:room-ready`, a host chatbot can submit a plain-language removal
intent:

```js
await window.catalog3dRoom.requestRemoval({
  description: "remove the floor lamp beside the sofa",
});
```

Product identity is immutable. To display another product, call `destroy()` and
mount a new instance.

## Product-page example

[`examples/product-page`](examples/product-page/) is the canonical integration
and visual debugging surface. It demonstrates:

- a responsive merchant-owned product page;
- sizing and placing Catalog3D inside a media gallery;
- appearance tokens;
- ready, room-ready, and error events;
- a host-owned assistant using `requestRemoval({ description })`;
- cleanup with `destroy()`; and
- ordinary merchant recommendation links without private scene-item APIs.

Run it locally:

```sh
npm install
npm run build
npm run example
```

Then open <http://127.0.0.1:4174/examples/product-page/>.

## Documentation

- [Integration guide](docs/integration-guide.md)
- [API reference](docs/api-reference.md)
- [Events and errors](docs/events-and-errors.md)
- [Appearance, sizing, and placement](docs/appearance.md)
- [React and Next.js](docs/frameworks.md)
- [Security and privacy](docs/security-and-privacy.md)
- [Versioning and migration](docs/versioning.md)
- [Design decisions](docs/design-decisions.md)

## Declarative alternative

```html
<script src="https://catalog3d.ai/embed/v1/catalog3d.js"></script>
<catalog3d-room
  site-id="your-publishable-site-id"
  product-id="your-product-id"
  locale="en"
  theme="auto"
  accent-color="#274d3d"
  font-family="Inter, system-ui, sans-serif"
  style="display:block;height:680px">
</catalog3d-room>
```

Attributes are initial configuration. Replace the element to change product
identity.

## Development

```sh
npm install
npm run verify   # typecheck, tests, build, package-consumer checks
```

`dist/` is committed because it is the source for the served tag. Rebuild and
commit it with any source change; a test and CI both fail on a stale build.
[Design decisions](docs/design-decisions.md) records why the loader is built the
way it is, and [PUBLISHING.md](PUBLISHING.md) is the release checklist.

The public package is intentionally small. It does not expose backend URLs,
tokens, model URLs, room files or jobs, renderer controls, scene collections,
room-picker commands, or mode setters.

## License

Code is available under the [MIT License](LICENSE). Product-page demo media is
Catalog3D example content; see the example's [asset notice](examples/product-page/ASSETS.md).
