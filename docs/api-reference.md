# API reference

The stable browser global is `window.Catalog3D`, installed by the browser tag.
The same API is available as named exports for bundlers:

```js
import { mount, version, Catalog3DError } from "@catalog3d/embed";
```

TypeScript declarations are published in `dist/index.d.ts`.

## `Catalog3D.version`

The loader's semantic version string. The current version is `1.3.0`.

## `Catalog3D.mount(options)`

```ts
function mount(options: Catalog3DMountOptions): Promise<Catalog3DHandle>;
```

Mounts Catalog3D in the target. The promise resolves when the experience is
ready and rejects with `Catalog3DError` if mounting fails.

```ts
type Catalog3DMountOptions = {
  target: Element | string;
  siteId: string;
  productId: string;
  variantId?: string;
  locale?: "en" | "de" | "fr";
  appearance?: {
    theme?: "light" | "dark" | "auto";
    accentColor?: string;
    fontFamily?: string;
  };
};
```

- `target` is an element or selector for exactly one merchant-owned container.
  **Mounting replaces the target's existing children.** Put a poster image or a
  `<noscript>` fallback in a sibling element, not inside the target.
- `siteId` is the publishable merchant registration id: 3-64 characters matching
  `[a-z0-9][a-z0-9_-]*`.
- `productId` identifies an authorized published product: 1-192 characters
  matching `[A-Za-z0-9][A-Za-z0-9._:-]*`.
- `variantId` optionally identifies a variant in that product family, in the
  same format as `productId`.
- `locale` defaults to `en`.
- `appearance` is immutable and bounded; see [Appearance](appearance.md).

Only one active mount may own a target. Product and appearance configuration
are fixed for the lifetime of the mount.

**Unknown options are rejected**, not ignored. `{ local: "de" }` or
`{ appearance: { accentcolor: "#639" } }` fails with `INVALID_CONFIG` rather
than mounting with the wrong configuration.

`mount()` rejects with `INVALID_CONFIG` when called without a browser
environment, so importing the loader into a server-rendered page is safe.

## `Catalog3DHandle`

```ts
type Catalog3DHandle = {
  destroy(): void;
  requestRemoval(request: { description: string }): Promise<void>;
};
```

### `destroy()`

Removes the iframe and loader-owned wrapper, event listeners, timers, and pending
intent requests. Calling it more than once is safe.

### `requestRemoval({ description })`

Submits a plain-language object-removal request after `catalog3d:room-ready`.
Descriptions are trimmed and must contain 1-500 characters. The promise resolves
when Catalog3D accepts the request.

Only one removal may be in flight at a time. A second call while one is pending
rejects immediately with `BUSY`.

## `Catalog3DError`

```ts
class Catalog3DError extends Error {
  readonly code: Catalog3DErrorCode;
}
```

The message is safe to log or display. Use `code` for application decisions.
See [Events and errors](events-and-errors.md).

## Declarative element

```html
<catalog3d-room
  site-id="merchant-site"
  product-id="product-123"
  variant-id="variant-456"
  locale="en"
  theme="auto"
  accent-color="#274d3d"
  font-family="Inter, system-ui, sans-serif">
</catalog3d-room>
```

Attributes are initial configuration. The element does not observe identity or
appearance mutations; replace it to reconfigure.

Child content is treated as a placeholder and is replaced when the embed mounts,
so `<catalog3d-room><p>Loading your room…</p></catalog3d-room>` works. Moving the
element in the DOM — a carousel, a tab panel, a framework reorder — keeps the
mount; removing it destroys the mount.
