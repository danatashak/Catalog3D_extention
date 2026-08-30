# Security and privacy

The public loader is an intentionally narrow trust boundary.

## Parent-page boundary

The merchant page receives no Catalog3D API secret, backend token, model URL,
room file, room image, scene description, job id, revision id, geometry
artifact, or renderer control. Product identity is delivered to a generic frame
through a versioned browser message rather than the frame URL.

The frame validates:

- the exact parent window;
- the browser-reported parent origin;
- the protocol version;
- the random mount instance id;
- the registered site and allowed origin; and
- the authorized published product and optional variant.

## Where the loader's trust anchor comes from

The loader accepts frame messages from exactly one origin, and rejects every
message whose `event.source` is not its own iframe. That origin is the origin the
loader script itself was served from — not a constant compiled into the bundle.
A page that loads the tag from `https://catalog3d.ai` therefore trusts only
`https://catalog3d.ai`.

A `data-catalog3d-host` attribute on the script tag overrides it, accepting any
HTTPS origin or an `http://127.0.0.1`/`http://localhost` origin for local
development. This is what makes the bundled example and local integration work.
It is set by whoever writes the page's markup, who already controls the page
completely, so it grants no capability an attacker would not already have — but
it does mean the trust anchor is *page-controlled*, not pinned. Treat the script
tag as security-relevant markup and apply the same review as any other
third-party tag.

## Iframe isolation

The loader creates a sandboxed iframe with only the capabilities needed by the
room experience: `allow-downloads allow-forms allow-same-origin allow-scripts`.
The parent cannot style or inspect the private iframe DOM, and the frame session
endpoint does not grant cross-origin read access.

`allow-same-origin` alongside `allow-scripts` is safe here precisely because the
frame is cross-origin to the merchant: it restores catalog3d.ai's own origin
inside the frame without granting any access to the merchant's. That reasoning
does **not** hold if a merchant self-hosts the loader on their own domain, since
the frame would then be same-origin to the page and could remove its own sandbox
attribute. Load the tag from Catalog3D.

## Delegated browser permissions

The embedding page is the only party that can grant a cross-origin frame access
to device features, so the loader delegates the ones the room experience needs,
each scoped to the frame's own origin:

```text
accelerometer; camera; fullscreen; gyroscope; magnetometer; xr-spatial-tracking
```

`camera` supports in-frame room capture; the motion sensors and
`xr-spatial-tracking` support placement and AR. The browser still prompts the
shopper before the camera is used, and the merchant page never receives the
camera stream, the captured frames, or any sensor data.

## Storage partitioning

Browsers partition third-party iframe storage by top-level site. A shopper's
Catalog3D room session is therefore scoped to the store they are on: it does not
follow them to another merchant, and it is not shared with catalog3d.ai's
first-party storage. The loader does not request unpartitioned storage
access.

## Object-removal intent

`requestRemoval()` sends only a bounded plain-text description. The
acknowledgement contains only an opaque request id internally and resolves the
public promise without returning target coordinates, masks, jobs, or room
state.

## Site registration

Catalog3D operators register each merchant's allowed origins and product policy.
Origins include scheme and non-default port. HTTPS subdomain wildcards may be
configured narrowly; a bare wildcard is never valid. Publishable site ids are
not secrets, but API secrets must never appear in browser configuration.

## Content Security Policy

Merchants normally need to allow:

```text
script-src https://catalog3d.ai
frame-src https://catalog3d.ai
```

Apply the site's existing nonce or hash policy to inline integration code, or
place mount code in a merchant-owned external script.

No `style-src` relaxation is required. The loader styles only the elements it
creates, through the CSSOM, which CSP does not govern — it injects no `<style>`
element and no `style` attribute markup. Those inline declarations are marked
`!important` so a store-wide CSS reset cannot collapse the embed's box; size and
placement stay under merchant control through the target element.
