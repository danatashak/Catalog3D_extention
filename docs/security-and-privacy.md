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

`allow-same-origin` alongside `allow-scripts` is safe here because the iframe
host remains cross-origin to the merchant. A classic browser tag derives the
iframe host from its own script URL unless `data-catalog3d-host` explicitly
overrides it; the npm module defaults to `https://catalog3d.ai`. Do not self-host
the classic tag without also setting the intended trusted Catalog3D host.

## Delegated browser permissions

The current loader does not delegate camera, sensor, WebXR, microphone, or
fullscreen permissions. The room experience currently uses file upload rather
than direct camera capture. Any future delegated feature requires corresponding
runtime use, production policy support, tests, and a security review.

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

The loader injects no `<style>` element. It applies inline declarations only to
the wrapper and iframe it creates; those declarations are marked `!important`
so a store-wide reset cannot collapse the embed's box. Size and placement stay
under merchant control through the target element. Merchants with a restrictive
`style-src-attr` policy should include the embed in their own CSP verification.
