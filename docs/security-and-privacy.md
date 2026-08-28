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

## Iframe isolation

The loader creates a sandboxed iframe with only the capabilities needed by the
room experience. The parent cannot style or inspect the private iframe DOM, and
the frame session endpoint does not grant cross-origin read access.

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
