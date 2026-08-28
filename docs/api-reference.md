# API reference

The stable browser global is `window.Catalog3D`. TypeScript declarations are
published in `dist/index.d.ts`.

## `Catalog3D.version`

The loader's semantic version string. The current version is `1.2.0`.

## `Catalog3D.mount(options)`

```ts
function mount(options: Catalog3DMountOptions): Promise<Catalog3DHandle>;
```

Mounts one Catalog3D iframe in the target. The promise resolves after Catalog3D
reports ready and rejects with `Catalog3DError` on validation, authorization,
frame loading, or timeout failure.

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
- `siteId` is the publishable merchant registration id.
- `productId` identifies an authorized published product.
- `variantId` optionally identifies a variant in that product family.
- `locale` defaults to `en`.
- `appearance` is immutable and bounded; see [Appearance](appearance.md).

Only one active mount may own a target. Product and appearance configuration
cannot be mutated after mounting.

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

Submits a plain-language object-removal intent after `catalog3d:room-ready`.
Descriptions are trimmed and must contain 1–500 characters. The promise resolves
when the private Catalog3D experience accepts the request. Only one removal may
be active at a time.

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

## Deliberately absent APIs

Public v1 has no `setProduct`, `setItems`, `addItem`, `removeItem`, `loadRoom`,
`openRoomPicker`, `setMode`, generic `update`, direct iframe DOM access, or job
API. These are not accidental omissions: Catalog3D owns room workflow and
private runtime evolution.
