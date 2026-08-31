# Security and privacy

Use the loader only on origins registered for the merchant site. Origin matching
includes the scheme and non-default port. Register loopback origins explicitly
for local development.

The `siteId` is publishable. Keep API secrets and other server credentials out
of browser configuration. Load the production tag from `https://catalog3d.ai`
and use only the documented API and events.

Catalog3D runs in an isolated frame. Style and position the target container
rather than attempting to inspect or modify the embedded page.

## Content Security Policy

Merchants normally need to allow:

```text
script-src https://catalog3d.ai
frame-src https://catalog3d.ai
```

Apply the site's existing nonce or hash policy to inline integration code, or
place mount code in a merchant-owned external script.

Merchants with a restrictive `style-src-attr` policy should include the embed
in their CSP verification.
