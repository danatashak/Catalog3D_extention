# Appearance, sizing, and placement

Style the target container with normal page CSS and use the `appearance` option
to align Catalog3D with the surrounding product page.

## Container sizing

Use ordinary CSS on the target or its parent:

```css
.catalog3d-product-media {
  width: 100%;
  max-width: 760px;
  aspect-ratio: 1 / 1;
  min-height: 420px;
  overflow: hidden;
  border-radius: 22px;
}

@media (max-width: 460px) {
  .catalog3d-product-media {
    height: 420px;
    aspect-ratio: auto;
  }
}
```

Catalog3D fills the target's width and height and uses a 420-pixel minimum
height. Size and place the target itself. On a viewport narrower than 420
pixels, use a fixed 420-pixel height instead of combining the minimum height
with a square aspect ratio. The target can sit in a grid, carousel, dialog,
product gallery, or full-width section.

## Appearance tokens

```js
appearance: {
  theme: "auto",
  accentColor: "#274d3d",
  fontFamily: "Inter, system-ui, sans-serif",
}
```

- `theme` is `light`, `dark`, or `auto` and defaults to `auto`.
- `accentColor` is an opaque three- or six-digit hex color. Catalog3D derives
  the related interface colors.
- `fontFamily` is a bounded CSS family stack up to 200 characters. The named
  font must be available to Catalog3D.

Appearance is fixed for the lifetime of the mount. Only the documented fields
are accepted.

## Responsive integration

Let the product page decide when columns collapse. Keep the target mounted while
temporarily showing another gallery image if the current experience should be
preserved. The reference product page demonstrates this pattern.
