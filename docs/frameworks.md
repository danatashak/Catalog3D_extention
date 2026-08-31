# React and Next.js

Catalog3D is framework-independent. Mount it when the client component is ready
and destroy it during cleanup.

Bundler-based apps can install the package and import `mount` directly instead of
loading the browser tag:

```sh
npm install @catalog3d/embed
```

The examples below use the browser tag, which keeps the loader out of the
application bundle. Either route is supported; the API is identical. Importing
the package during server rendering is safe — it registers nothing without a
document, and `mount()` rejects with `INVALID_CONFIG` rather than throwing.

## React component

```tsx
import { useEffect, useRef } from "react";
import type {
  Catalog3DHandle,
  Catalog3DMountOptions,
} from "@catalog3d/embed";

type Catalog3DRoomProps = Omit<Catalog3DMountOptions, "target"> & {
  sdkReady: boolean;
};

export function Catalog3DRoom({ sdkReady, ...options }: Catalog3DRoomProps) {
  const targetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = targetRef.current;
    if (!sdkReady || !target || !window.Catalog3D) return;

    let disposed = false;
    let handle: Catalog3DHandle | undefined;

    window.Catalog3D.mount({ ...options, target })
      .then((mounted) => {
        if (disposed) mounted.destroy();
        else handle = mounted;
      })
      .catch((error) => {
        if (!disposed) console.error("Catalog3D failed to mount", error);
      });

    return () => {
      disposed = true;
      handle?.destroy();
    };
  }, [
    sdkReady,
    options.siteId,
    options.productId,
    options.variantId,
    options.locale,
    options.appearance?.theme,
    options.appearance?.accentColor,
    options.appearance?.fontFamily,
  ]);

  return <div ref={targetRef} className="catalog3d-room" />;
}
```

Changing an immutable option runs cleanup and mounts a new instance. Avoid
passing a newly created options object as the only effect dependency.

## Next.js App Router

Load the browser script with `next/script`, and keep the mount component on the
client:

```tsx
"use client";

import { useState } from "react";
import Script from "next/script";

export default function ProductPage() {
  const [sdkReady, setSdkReady] = useState(false);

  return (
    <>
      <Script
        src="https://catalog3d.ai/embed/v1/catalog3d.js"
        strategy="afterInteractive"
        onReady={() => setSdkReady(true)}
      />
      <Catalog3DRoom
        sdkReady={sdkReady}
        siteId="your-publishable-site-id"
        productId="your-product-id"
        locale="en"
      />
    </>
  );
}
```

Catalog3D mounts in the browser. Product metadata, pricing, structured data, and
commerce controls can remain server-rendered.

## Strict Mode

Development Strict Mode may run an effect setup-cleanup-setup cycle. Always
destroy the first handle when its promise resolves after disposal. Never disable
cleanup or retain a handle for a target that React has removed.
