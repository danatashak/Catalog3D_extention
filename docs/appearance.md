# Appearance, sizing, and placement

The merchant controls the outer container. Catalog3D controls the iframe's
internal DOM, responsive layout, interaction styling, accessibility, and room
workflow.

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

Catalog3D fills the target's width and height and enforces a 420-pixel minimum
height. The elements the loader creates inside the target declare their geometry
`!important`, so a store-wide reset such as `iframe { width: auto }` or
`* { margin: 8px }` cannot collapse the embed. Size and place the target itself;
do not try to restyle the loader's own wrapper or iframe. On a viewport narrower
than 420 pixels, use a fixed 420-pixel height instead of combining the minimum
height with a square aspect ratio; otherwise the aspect ratio can force the
target wider than its column. The merchant can place the target in a grid,
carousel, dialog, product gallery, or full-width section. Do not attempt to
style through the iframe.

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
  readable foreground, hover, focus, selection, and translucent states.
- `fontFamily` is a bounded CSS family stack up to 200 characters. The named
  font must already be available inside the Catalog3D frame. This option does
  not load external font files or URLs.

Tokens are immutable. Arbitrary CSS, selectors, class names, HTML, JavaScript,
font URLs, and alpha colors are rejected or unsupported.

## Responsive integration

Let the product page decide when columns collapse. Keep the Catalog3D target
mounted while temporarily showing another gallery image; use visibility and
opacity rather than deleting the target if room state must survive the gallery
switch. The reference product page demonstrates this pattern.
